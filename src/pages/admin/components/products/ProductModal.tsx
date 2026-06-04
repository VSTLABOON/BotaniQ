// ─── ADMIN PRODUCTOS — GESTOR DE CATÁLOGO Y VARIANTES ───────────
// CRUD de productos con tabla limpia, toggle de disponibilidad y
// modal complejo para gestionar arrays de ProductVariant.
//
// SAAS_FLAG OVERVIEW:
//   NIVEL 1: Máximo 20 productos, 2 variantes por producto
//   NIVEL 2: Productos ilimitados, variantes ilimitadas
//   NIVEL 3: Importación/exportación CSV, edición masiva
//
// Dependencias:
//   TenantContext — Para leer tenant.id
//   types.ts      — Product, ProductVariant
// ────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, X, Save, Package,
  Image, Loader2, ChevronDown, AlertCircle, Crown,
  Upload, ImagePlus,
} from 'lucide-react';
import type { Product, ProductVariant } from '../../../../types';
import { supabase } from '../../../../lib/supabaseClient';
import { useTenant } from '../../../../context/TenantContext';
import { logger } from '../../../../lib/logger';
import { toast } from '../../../../store/toastStore';

// ── Clase base para tarjetas admin ───────────────────────────────
import { CARD } from '../config/SharedUI';

const uid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback para contextos no seguros (http en IPs locales)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const generateSlug = (name: string) => {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
};

// ── Variante vacía para "añadir fila" ────────────────────────────
const emptyVariant = (productId: string): ProductVariant => ({
  id: uid(), productId, name: '', price: null, stock: 0, sku: '',
});

// ═══════════════════════════════════════════════════════════════════
// ██ COMPONENTE: TOGGLE DE DISPONIBILIDAD
// ═══════════════════════════════════════════════════════════════════

function AvailabilityToggle({
  checked, onChange,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
        checked ? 'bg-emerald-500' : 'bg-[var(--color-border-secondary)]'
      }`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-[var(--color-background-primary)] rounded-full shadow transition-transform duration-200 ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ██ COMPONENTE: MODAL DE EDICIÓN CON VARIANTES
// ═══════════════════════════════════════════════════════════════════

/**
 * Modal complejo para editar un producto y gestionar su array de variantes.
 *
 * Flujo de datos:
 *   1. Recibe `product` como prop → clona a estado local `draft`.
 *   2. El usuario edita nombre, descripción, precio base.
 *   3. En la sub-sección de variantes, puede:
 *      a. Añadir filas (genera un ProductVariant vacío con uid()).
 *      b. Editar nombre, priceModifier, stock de cada variante.
 *      c. Eliminar variantes existentes.
 *   4. Al pulsar "Guardar", invoca `onSave(draft)` que propaga
 *      al estado padre y eventualmente a Supabase (tabla productos
 *      + tabla producto_variantes en una transacción).
 *
 * SAAS_FLAG: NIVEL 1 - Máximo 2 variantes por producto.
 * SAAS_FLAG: NIVEL 2 - Variantes ilimitadas.
 */
export function ProductModal({
  product, onClose, onSave, isNew,
}: {
  product: Product;
  onClose: () => void;
  onSave: (updated: Product) => Promise<void> | void;
  isNew?: boolean;
}) {
  const { tenant } = useTenant();
  const [draft, setDraft] = useState<Product>({ ...product, variants: [...product.variants.map(v => ({ ...v }))] });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  /** Subir imagen a Supabase Storage */
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar los 5 MB.');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${draft.tienda_id}/${draft.id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('productos')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('productos')
        .getPublicUrl(fileName);

      setDraft(prev => ({ ...prev, images: [publicUrl] }));
    } catch (err) {
      logger.error('Error al subir imagen:', err as Error);
      toast.error('Error al subir la imagen. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  /** Subir imagen para una variante específica */
  const handleVariantImageUpload = async (variantId: string, file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar los 5 MB.');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${draft.tienda_id}/variants/${variantId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('productos')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('productos')
        .getPublicUrl(fileName);

      updateVariant(variantId, 'image', publicUrl);
    } catch (err) {
      logger.error('Error al subir imagen de variante:', err as Error);
      toast.error('Error al subir la imagen. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  /** Remover imagen actual */
  const handleImageRemove = async () => {
    if (!draft.images[0]) return;
    try {
      // Extraer la ruta del archivo desde la URL pública
      const url = new URL(draft.images[0]);
      const pathParts = url.pathname.split('/storage/v1/object/public/productos/');
      if (pathParts[1]) {
        await supabase.storage.from('productos').remove([pathParts[1]]);
      }
    } catch {
      // Si falla el borrado del storage, no es crítico
    }
    setDraft(prev => ({ ...prev, images: [] }));
  };

  /** Handler de drop */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  };

  /** Actualizar un campo del producto */
  const updateField = <K extends keyof Product>(key: K, value: Product[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  /** Actualizar un campo de una variante específica */
  const updateVariant = (variantId: string, field: keyof ProductVariant, value: string | number | null | undefined) => {
    setDraft(prev => ({
      ...prev,
      variants: prev.variants.map(v =>
        v.id === variantId ? { ...v, [field]: value } : v
      ),
    }));
  };

  /** Añadir nueva variante vacía al array */
  const addVariant = () => {
    // SAAS_FLAG: NIVEL 1 - Limitar a 2 variantes por producto en plan básico
    // if (draft.variants.length >= 2 && tenant.subscription_level < 2) {
    //   toast.error('Actualiza a Plan Pro para añadir más variantes.');
    //   return;
    // }
    setDraft(prev => ({
      ...prev,
      variants: [...prev.variants, emptyVariant(prev.id)],
    }));
  };

  /** Eliminar una variante del array */
  const removeVariant = (variantId: string) => {
    setDraft(prev => ({
      ...prev,
      variants: prev.variants.filter(v => v.id !== variantId),
    }));
  };

  /**
   * Guardar cambios del modal.
   * En producción, aquí se haría:
   *   1. UPDATE a tabla `productos` con los campos del producto.
   *   2. UPSERT batch a tabla `producto_variantes` con el array de variantes.
   *   3. DELETE de variantes removidas (diff entre original y draft).
   * Todo dentro de una transacción RPC de Supabase.
   */
  const handleSave = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[3px] z-[9998]" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[680px] md:max-h-[85vh] bg-[var(--color-background-primary)] md:bg-[var(--color-background-primary)]/90 md:backdrop-blur-2xl md:rounded-2xl shadow-2xl z-[9999] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-tertiary)] shrink-0">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
            {isNew ? 'Nuevo Producto' : 'Editar Producto'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ── Datos básicos ── */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Nombre del producto</label>
              <input
                type="text" value={draft.name}
                onChange={e => updateField('name', e.target.value)}
                className="w-full h-10 px-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                style={{ fontSize: '16px' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Descripción</label>
              <textarea
                value={draft.description}
                onChange={e => updateField('description', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all resize-none"
                style={{ fontSize: '16px' }}
              />
            </div>

            {/* ── Imagen del producto ── */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Imagen del producto</label>
              {draft.images[0] ? (
                <div className="relative group w-full aspect-[16/9] max-w-[320px] rounded-xl overflow-hidden bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)]">
                  <img
                    src={draft.images[0]}
                    alt={draft.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <label className="p-2 rounded-lg bg-[var(--color-background-primary)]/90 text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-background-primary)] transition-colors shadow-sm">
                        <Upload className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleImageRemove}
                        className="p-2 rounded-lg bg-red-500/90 text-[var(--color-background-primary)] hover:bg-red-600 transition-colors shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {uploading && (
                    <div className="absolute inset-0 bg-[var(--color-background-primary)]/80 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`relative w-full max-w-[320px] aspect-[16/9] rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer ${
                    dragOver
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] hover:border-[var(--color-border-primary)] hover:bg-[var(--color-background-tertiary)]'
                  }`}
                >
                  <label className="flex flex-col items-center gap-2 cursor-pointer w-full h-full justify-center">
                    {uploading ? (
                      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    ) : (
                      <>
                        <ImagePlus className={`w-8 h-8 ${dragOver ? 'text-emerald-500' : 'text-[var(--color-text-tertiary)]'}`} />
                        <span className="text-xs text-[var(--color-text-tertiary)] text-center px-4">
                          Arrastra una imagen o haz clic para seleccionar
                        </span>
                        <span className="text-[0.65rem] text-[var(--color-text-tertiary)]">JPG, PNG, WebP — Max 5 MB</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Precio Base (MXN)</label>
                <input
                  type="number" min={0} step={10} 
                  value={draft.variants.length > 0 ? '' : (draft.basePrice || '')}
                  disabled={draft.variants.length > 0}
                  placeholder={draft.variants.length > 0 ? 'Definido en variantes' : '0'}
                  onChange={e => updateField('basePrice', Number(e.target.value))}
                  onFocus={(e) => e.target.select()}
                  className="w-full h-10 px-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all disabled:opacity-60 disabled:bg-[var(--color-background-tertiary)] disabled:cursor-not-allowed"
                />
                {draft.variants.length > 0 && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">El precio se define por variante</p>
                )}
              </div>
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-text-secondary)]">
                  Disponible
                  <AvailabilityToggle
                    checked={draft.isAvailable}
                    onChange={val => updateField('isAvailable', val)}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* ── Sub-sección: Variantes ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <Package className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                Variantes del producto
              </h4>
              {/* SAAS_FLAG: NIVEL 1 - El botón "Añadir variante" se oculta cuando
                  el tenant alcanza el límite de 3 variantes en plan básico. */}
              {!(tenant?.subscription_level === 1 && draft.variants.length >= 3) && (
                <button
                  onClick={addVariant}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                  Añadir variante
                </button>
              )}
            </div>

            {draft.variants.length === 0 ? (
              <div className="text-center py-8 bg-[var(--color-background-secondary)] rounded-xl border border-dashed border-[var(--color-border-secondary)]">
                <Package className="w-8 h-8 text-[var(--color-text-tertiary)] opacity-50 mx-auto mb-2" />
                <p className="text-sm text-[var(--color-text-tertiary)]">Sin variantes — el producto usará el precio base</p>
              </div>
            ) : (
              <div className="space-y-3">
                {draft.variants.map((variant, idx) => (
                  <div key={variant.id} className="relative bg-[var(--color-background-secondary)] rounded-xl border border-[var(--color-border-tertiary)] p-4">
                    {/* Número de variante */}
                    <span className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-[var(--color-text-primary)] text-[var(--color-background-primary)] text-[0.6rem] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>

                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* Imagen de la variante */}
                      <div className="shrink-0">
                        <label className="block text-[0.7rem] font-medium text-[var(--color-text-tertiary)] mb-1 uppercase tracking-wider">Foto</label>
                        <div className="relative w-12 h-12 rounded-lg bg-[var(--color-background-primary)] border border-[var(--color-border-secondary)] overflow-hidden flex items-center justify-center group cursor-pointer hover:border-emerald-400 transition-colors">
                          {variant.image ? (
                            <>
                              <img src={variant.image} alt={variant.name} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ImagePlus className="w-4 h-4 text-white" />
                              </div>
                            </>
                          ) : (
                            <ImagePlus className="w-4 h-4 text-[var(--color-text-tertiary)] group-hover:text-emerald-500 transition-colors" />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleVariantImageUpload(variant.id, file);
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 flex-1">
                        {/* Nombre de la variante */}
                        <div className="sm:col-span-1">
                          <label className="block text-[0.7rem] font-medium text-[var(--color-text-tertiary)] mb-1 uppercase tracking-wider">Nombre</label>
                          <input
                            type="text" value={variant.name} placeholder="Ej: Premium"
                            onChange={e => updateVariant(variant.id, 'name', e.target.value)}
                            className="w-full h-9 px-3 bg-[var(--color-background-primary)] border border-[var(--color-border-secondary)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                          />
                        </div>

                        {/* Precio absolute */}
                        <div>
                          <label className="block text-[0.7rem] font-medium text-[var(--color-text-tertiary)] mb-1 uppercase tracking-wider">Precio</label>
                          <input
                            type="number" step={10} min={0}
                            value={variant.price !== null && variant.price !== undefined ? variant.price : ''}
                            placeholder="Ej: 250"
                            onChange={e => {
                              const val = e.target.value === '' ? null : Number(e.target.value);
                              updateVariant(variant.id, 'price', val);
                            }}
                            onFocus={(e) => e.target.select()}
                            className="w-full h-9 px-3 bg-[var(--color-background-primary)] border border-[var(--color-border-secondary)] rounded-lg text-sm text-[var(--color-text-primary)] font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                          />
                        </div>

                        {/* Stock */}
                        <div>
                          <label className="block text-[0.7rem] font-medium text-[var(--color-text-tertiary)] mb-1 uppercase tracking-wider">Stock</label>
                          <input
                            type="number" min={0} 
                            value={variant.stock || ''}
                            placeholder="0"
                            onChange={e => updateVariant(variant.id, 'stock', Number(e.target.value))}
                            onFocus={(e) => e.target.select()}
                            className="w-full h-9 px-3 bg-[var(--color-background-primary)] border border-[var(--color-border-secondary)] rounded-lg text-sm text-[var(--color-text-primary)] font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                          />
                        </div>

                      {/* SKU + Delete */}
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <label className="block text-[0.7rem] font-medium text-[var(--color-text-tertiary)] mb-1 uppercase tracking-wider">SKU</label>
                          <input
                            type="text" value={variant.sku}
                            onChange={e => updateVariant(variant.id, 'sku', e.target.value)}
                            className="w-full h-9 px-3 bg-[var(--color-background-primary)] border border-[var(--color-border-secondary)] rounded-lg text-sm text-[var(--color-text-primary)] font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                          />
                        </div>
                        <button
                          onClick={() => removeVariant(variant.id)}
                          className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar variante"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      </div>
                    </div>

                    {/* Preview de precio de variante */}
                    <div className="mt-2 text-right text-xs text-[var(--color-text-tertiary)]">
                      Precio de la variante: <span className="font-semibold text-[var(--color-text-secondary)]">
                        {variant.price !== null && variant.price !== undefined ? `$${variant.price.toLocaleString()} MXN` : 'Sin precio (se usará precio base)'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] shrink-0 pb-safe md:pb-4">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave} disabled={saving}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-[var(--color-text-primary)] text-[var(--color-background-primary)] hover:bg-[var(--color-text-primary)] disabled:bg-[var(--color-border-primary)] disabled:cursor-wait transition-all active:scale-[0.97] shadow-lg shadow-black/5"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <><Save className="w-4 h-4" /> Guardar producto</>}
          </button>
        </div>
      </div>
    </>
  );
}
