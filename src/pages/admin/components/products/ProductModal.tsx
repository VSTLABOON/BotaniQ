// ─── ADMIN PRODUCTOS — GESTOR DE CATÁLOGO Y VARIANTES ───────────
// CRUD de productos con tabla limpia, toggle de disponibilidad y
// modal complejo para gestionar arrays de ProductVariant.
//
// Dependencias:
//   TenantContext — Para leer tenant.id
//   types.ts      — Product, ProductVariant
// ────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { z } from 'zod';
import {
  Plus, Trash2, X, Save, Package,
  Image as ImageIcon, Loader2, AlertCircle,
  Upload, ImagePlus, Eye, EyeOff
} from 'lucide-react';
import type { Product, ProductVariant } from '../../../../types';
import { supabase } from '../../../../lib/supabaseClient';
import { useTenant } from '../../../../context/TenantContext';
import { logger } from '../../../../lib/logger';
import { toast } from '../../../../store/toastStore';

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

// ── Variante vacía para "añadir fila" ────────────────────────────
const emptyVariant = (productId: string): ProductVariant => ({
  id: uid(),
  productId,
  name: '',
  price: null,
  isAvailable: true,
  sku: '',
  description: ''
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
      type="button"
      role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
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
// ██ COMPONENTE: MODAL DE EDICIÓN CON VARIANTES Y VISTA PREVIA
// ═══════════════════════════════════════════════════════════════════

export function ProductModal({
  product, onClose, onSave, isNew,
}: {
  product: Product;
  onClose: () => void;
  onSave: (updated: Product) => Promise<void> | void;
  isNew?: boolean;
}) {
  const { tenant } = useTenant();
  
  // Clonar draft con variantes limpias
  const [draft, setDraft] = useState<Product>(() => {
    const base = { ...product };
    if (isNew) {
      base.variants = [];
      base.name = '';
      base.basePrice = 0;
      base.images = [];
      base.isAvailable = true;
      base.sku = '';
      base.categoria = '';
      base.nota_interna = '';
      base.nota_publica = false;
      base.disponible_hasta = '';
      base.por_encargo = false;
      base.ultimas_unidades = false;
    } else {
      base.variants = product.variants.map(v => ({ ...v }));
    }
    return base;
  });

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<'general' | 'variants' | 'advanced'>('general');

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
      setErrors(prev => {
        const next = { ...prev };
        delete next.images;
        return next;
      });
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
      // Path exacto: {tienda_id}/variantes/{variante_id}/
      const fileName = `${draft.tienda_id}/variantes/${variantId}/image_${Date.now()}.${ext}`;

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

  /** Remover imagen de variante */
  const handleVariantImageRemove = async (variantId: string, imageUrl: string) => {
    try {
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/storage/v1/object/public/productos/');
      if (pathParts[1]) {
        await supabase.storage.from('productos').remove([pathParts[1]]);
      }
    } catch (err) {
      logger.error('Error al remover imagen de variante del Storage:', err as Error);
    }
    updateVariant(variantId, 'image', null);
  };

  /** Remover imagen actual */
  const handleImageRemove = async () => {
    if (!draft.images[0]) return;
    try {
      const url = new URL(draft.images[0]);
      const pathParts = url.pathname.split('/storage/v1/object/public/productos/');
      if (pathParts[1]) {
        await supabase.storage.from('productos').remove([pathParts[1]]);
      }
    } catch {
      // Ignorar fallo no crítico
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
    if (errors[key as string]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    }
  };

  /** Actualizar un campo de una variante específica */
  const updateVariant = (variantId: string, field: keyof ProductVariant, value: string | number | boolean | null | undefined) => {
    setDraft(prev => ({
      ...prev,
      variants: prev.variants.map(v =>
        v.id === variantId ? { ...v, [field]: value } : v
      ),
    }));
  };

  /** Añadir nueva variante vacía al array */
  const addVariant = () => {
    setDraft(prev => ({
      ...prev,
      variants: [...prev.variants, emptyVariant(prev.id)],
    }));
  };

  /** Eliminar una variante del array */
  const removeVariant = (variantId: string) => {
    const variant = draft.variants.find(v => v.id === variantId);
    if (variant?.image) {
      handleVariantImageRemove(variantId, variant.image);
    }
    setDraft(prev => ({
      ...prev,
      variants: prev.variants.filter(v => v.id !== variantId),
    }));
  };

  /** Ejecutar validación Zod */
  const validateForm = () => {
    const schema = z.object({
      name: z.string().trim().min(1, 'El nombre es obligatorio'),
      basePrice: z.number({ invalid_type_error: 'El precio debe ser un número' }).min(0, 'El precio debe ser mayor o igual a 0'),
      images: z.array(z.string()).min(1, 'La imagen principal es obligatoria'),
    });

    const result = schema.safeParse({
      name: draft.name,
      basePrice: draft.basePrice,
      images: draft.images,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        const path = issue.path[0] as string;
        fieldErrors[path] = issue.message;
      });
      setErrors(fieldErrors);
      setActiveFormTab('general');
      toast.error('Corrige los campos obligatorios en el formulario.');
      return false;
    }

    // Validar variantes
    for (let i = 0; i < draft.variants.length; i++) {
      const v = draft.variants[i];
      if (!v.name.trim()) {
        setActiveFormTab('variants');
        toast.error(`La variante ${i + 1} requiere un nombre.`);
        return false;
      }
      if (v.price === null || v.price === undefined || v.price < 0) {
        setActiveFormTab('variants');
        toast.error(`La variante ${i + 1} requiere un precio válido.`);
        return false;
      }
    }

    setErrors({});
    return true;
  };

  /** Mostrar Modal de Vista Previa */
  const handlePreSave = () => {
    if (validateForm()) {
      setShowPreview(true);
    }
  };

  /** Guardar definitivo */
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setShowPreview(false);
      onClose();
    } catch (err) {
      logger.error('Error al guardar producto:', err as Error);
      toast.error('Hubo un error al guardar el producto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[3px] z-[9998]" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[680px] md:max-h-[85vh] bg-[var(--color-background-primary)] md:bg-[var(--color-background-primary)]/90 md:backdrop-blur-2xl md:rounded-2xl shadow-2xl z-[9999] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
          {/* Tabs del Formulario */}
          <div className="flex border-b border-[var(--color-border-secondary)] mb-6 shrink-0 gap-2">
            {[
              { id: 'general', label: 'Básico' },
              { id: 'variants', label: 'Variantes', count: draft.variants.length },
              { id: 'advanced', label: 'Avanzado' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFormTab(tab.id as any)}
                className={`pb-3 text-sm font-semibold border-b-2 transition-all px-4 flex items-center gap-1.5 focus:outline-none cursor-pointer ${
                  activeFormTab === tab.id
                    ? 'text-[var(--color-text-primary)]'
                    : 'border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                }`}
                style={activeFormTab === tab.id ? { borderColor: tenant.color_primario || '#10b981', color: tenant.color_primario || '#10b981' } : {}}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span 
                    className="px-1.5 py-0.5 text-[0.65rem] font-bold rounded-full transition-colors"
                    style={{ backgroundColor: `${tenant.color_primario || '#10b981'}18`, color: tenant.color_primario || '#10b981' }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeFormTab === 'general' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* ── Datos básicos ── */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Nombre del producto <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text" value={draft.name}
                    onChange={e => updateField('name', e.target.value)}
                    className={`w-full h-10 px-4 bg-[var(--color-background-secondary)] border rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all ${
                      errors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-[var(--color-border-secondary)]'
                    }`}
                    style={{ fontSize: '16px' }}
                    placeholder="Ej: Ramo de 24 Rosas Rojas"
                  />
                  {errors.name && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Descripción</label>
                  <textarea
                    value={draft.description}
                    onChange={e => updateField('description', e.target.value)}
                    rows={3}
                    placeholder="Escribe la descripción pública del arreglo..."
                    className="w-full px-4 py-3 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all resize-none"
                    style={{ fontSize: '16px' }}
                  />
                </div>

                {/* ── Imagen del producto ── */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Imagen del producto <span className="text-red-500 font-bold">*</span>
                  </label>
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
                          : errors.images
                            ? 'border-red-500 bg-red-50/50'
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
                  {errors.images && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.images}</p>}
                </div>

                {/* Precio Base y Disponible */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                      Precio Base (MXN) <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="number" min={0} step={10} 
                      value={draft.basePrice || ''}
                      placeholder="0"
                      onChange={e => updateField('basePrice', Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      className={`w-full h-10 px-4 bg-[var(--color-background-secondary)] border rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all ${
                        errors.basePrice ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-[var(--color-border-secondary)]'
                      }`}
                    />
                    {errors.basePrice && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.basePrice}</p>}
                  </div>
                  <div className="flex flex-col justify-end">
                    <label className="flex items-center justify-between sm:justify-start gap-3 text-sm font-medium text-[var(--color-text-secondary)] h-10">
                      <span>Disponible en tienda</span>
                      <AvailabilityToggle
                        checked={draft.isAvailable}
                        onChange={val => updateField('isAvailable', val)}
                      />
                    </label>
                  </div>
                </div>

                {/* SKU y Categoría Opcionales */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">SKU (Opcional)</label>
                    <input
                      type="text"
                      value={draft.sku || ''}
                      onChange={e => updateField('sku', e.target.value)}
                      placeholder="Ej: ROS-ROJ-01"
                      className="w-full h-10 px-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Categoría (Opcional)</label>
                    <input
                      type="text"
                      value={draft.categoria || ''}
                      onChange={e => updateField('categoria', e.target.value)}
                      placeholder="Ej: Ramos, Cajas, Bodas"
                      className="w-full h-10 px-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeFormTab === 'variants' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* ── Sub-sección: Variantes ── */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                    <Package className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                    Variantes del producto
                  </h4>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                    Agregar variante
                  </button>
                </div>

                {draft.variants.length === 0 ? (
                  <div className="text-center py-12 bg-[var(--color-background-secondary)] rounded-xl border border-dashed border-[var(--color-border-secondary)]">
                    <Package className="w-8 h-8 text-[var(--color-text-tertiary)] opacity-50 mx-auto mb-2" />
                    <p className="text-sm text-[var(--color-text-tertiary)]">Sin variantes — el producto usará el precio base</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {draft.variants.map((variant, idx) => (
                      <div key={variant.id} className="relative bg-[var(--color-background-secondary)] rounded-xl border border-[var(--color-border-tertiary)] p-4 shadow-sm animate-in fade-in duration-200">
                        {/* Número de variante */}
                        <span 
                          className="absolute -top-2 -left-2 w-5 h-5 rounded-full text-[var(--color-background-primary)] text-[0.6rem] font-bold flex items-center justify-center"
                          style={{ backgroundColor: tenant.color_primario || '#10b981' }}
                        >
                          {idx + 1}
                        </span>

                        <div className="flex flex-col sm:flex-row gap-3">
                          {/* Imagen de la variante */}
                          <div className="shrink-0">
                            <label className="block text-[0.7rem] font-medium text-[var(--color-text-tertiary)] mb-1 uppercase tracking-wider">Foto</label>
                            {variant.image ? (
                              <div className="relative w-12 h-12 rounded-lg bg-[var(--color-background-primary)] border border-[var(--color-border-secondary)] overflow-hidden flex items-center justify-center group">
                                <img src={variant.image} alt={variant.name} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleVariantImageRemove(variant.id, variant.image!);
                                  }}
                                  className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                                  title="Eliminar imagen de variante"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <label className="relative w-12 h-12 rounded-lg bg-[var(--color-background-primary)] border border-[var(--color-border-secondary)] overflow-hidden flex items-center justify-center group cursor-pointer hover:border-emerald-400 transition-colors">
                                <ImagePlus className="w-4 h-4 text-[var(--color-text-tertiary)] group-hover:text-emerald-500 transition-colors" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="sr-only"
                                  disabled={uploading}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleVariantImageUpload(variant.id, file);
                                  }}
                                />
                              </label>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 flex-1">
                            {/* Nombre de la variante */}
                            <div>
                              <label className="block text-[0.7rem] font-medium text-[var(--color-text-tertiary)] mb-1 uppercase tracking-wider">Nombre</label>
                              <input
                                type="text" value={variant.name} placeholder="Ej: Mediano, Premium"
                                onChange={e => updateVariant(variant.id, 'name', e.target.value)}
                                className="w-full h-9 px-3 bg-[var(--color-background-primary)] border border-[var(--color-border-secondary)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                              />
                            </div>

                            {/* Descripción de la variante */}
                            <div>
                              <label className="block text-[0.7rem] font-medium text-[var(--color-text-tertiary)] mb-1 uppercase tracking-wider">Descripción</label>
                              <textarea
                                rows={1}
                                value={variant.description || ''}
                                placeholder="Detalles (opcional)"
                                onChange={e => updateVariant(variant.id, 'description', e.target.value)}
                                className="w-full h-9 py-1.5 px-3 bg-[var(--color-background-primary)] border border-[var(--color-border-secondary)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all resize-none"
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

                            {/* Disponible + Eliminar */}
                            <div className="flex items-end justify-between gap-2">
                              <div className="flex-1">
                                <label className="block text-[0.7rem] font-medium text-[var(--color-text-tertiary)] mb-1.5 uppercase tracking-wider">Disponible</label>
                                <div className="h-9 flex items-center">
                                  <AvailabilityToggle
                                    checked={variant.isAvailable}
                                    onChange={val => updateVariant(variant.id, 'isAvailable', val)}
                                  />
                                </div>
                              </div>
                              <button
                                type="button"
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
          )}

          {activeFormTab === 'advanced' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Badges de Catálogo (Por encargo y Últimas unidades) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[var(--color-background-secondary)] p-4 rounded-xl border border-[var(--color-border-secondary)]">
                <label className="flex items-center justify-between gap-3 text-sm font-medium text-[var(--color-text-secondary)] cursor-pointer">
                  <div>
                    <span className="block font-semibold">Por encargo</span>
                    <span className="block text-xs text-[var(--color-text-tertiary)] font-normal">Indica que el arreglo se hace bajo pedido</span>
                  </div>
                  <AvailabilityToggle
                    checked={draft.por_encargo ?? false}
                    onChange={val => updateField('por_encargo', val)}
                  />
                </label>

                <label className="flex items-center justify-between gap-3 text-sm font-medium text-[var(--color-text-secondary)] cursor-pointer">
                  <div>
                    <span className="block font-semibold">Últimas unidades</span>
                    <span className="block text-xs text-[var(--color-text-tertiary)] font-normal">Muestra una etiqueta de urgencia en la tarjeta</span>
                  </div>
                  <AvailabilityToggle
                    checked={draft.ultimas_unidades ?? false}
                    onChange={val => updateField('ultimas_unidades', val)}
                  />
                </label>
              </div>

              {/* Disponible hasta */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Disponible hasta (Opcional)</label>
                <input
                  type="date"
                  value={draft.disponible_hasta ? draft.disponible_hasta.split('T')[0] : ''}
                  onChange={e => {
                    const val = e.target.value;
                    updateField('disponible_hasta', val ? new Date(val).toISOString() : null);
                  }}
                  className="w-full h-10 px-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                />
              </div>

              {/* Notas / Condiciones */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Nota / Condiciones (Opcional)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-1 font-semibold">
                      {draft.nota_publica ? <><Eye className="w-3.5 h-3.5" /> Visible para clientes</> : <><EyeOff className="w-3.5 h-3.5" /> Solo interna</>}
                    </span>
                    <AvailabilityToggle
                      checked={draft.nota_publica ?? false}
                      onChange={val => updateField('nota_publica', val)}
                    />
                  </div>
                </div>
                <textarea
                  value={draft.nota_interna || ''}
                  onChange={e => updateField('nota_interna', e.target.value)}
                  rows={3}
                  placeholder="Escribe notas internas o políticas especiales (ej: 'No incluye base de vidrio')"
                  className="w-full px-4 py-3 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all resize-none"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] shrink-0 pb-safe md:pb-4">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] transition-colors">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handlePreSave}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-[var(--color-text-primary)] text-[var(--color-background-primary)] hover:bg-[var(--color-text-primary)] transition-all active:scale-[0.97] shadow-lg shadow-black/5"
          >
            Guardar producto
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ██ MODAL: VISTA PREVIA ANTES DE GUARDAR
          ═══════════════════════════════════════════════════════════════════ */}
      {showPreview && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in" onClick={() => setShowPreview(false)} />
          
          {/* Content */}
          <div className="relative w-full max-w-md bg-[var(--color-background-primary)] rounded-2xl shadow-2xl overflow-hidden border border-[var(--color-border-tertiary)] flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)]">
              <h4 className="text-base font-bold text-[var(--color-text-primary)]">Confirmar y Guardar</h4>
              <p className="text-xs text-[var(--color-text-tertiary)]">Revisa la información del producto antes de persistir</p>
            </div>
            
            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="flex gap-4">
                {/* Image */}
                <div className="w-20 h-20 rounded-xl bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] overflow-hidden shrink-0">
                  {draft.images[0] ? (
                    <img src={draft.images[0]} alt={draft.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                    </div>
                  )}
                </div>
                
                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h5 className="font-semibold text-sm text-[var(--color-text-primary)] truncate">{draft.name}</h5>
                  <p className="text-xs text-[var(--color-text-tertiary)] line-clamp-2 mt-1">{draft.description || 'Sin descripción'}</p>
                  <p className="text-sm font-bold text-emerald-600 mt-1">
                    ${draft.basePrice.toLocaleString()} <span className="text-xs text-[var(--color-text-tertiary)] font-normal">MXN</span>
                  </p>
                </div>
              </div>

              {/* Extra Info */}
              <div className="bg-[var(--color-background-secondary)] rounded-xl p-3 text-xs space-y-2 border border-[var(--color-border-tertiary)] text-[var(--color-text-secondary)]">
                {draft.sku && (
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-tertiary)]">SKU:</span>
                    <span className="font-mono font-medium">{draft.sku}</span>
                  </div>
                )}
                {draft.categoria && (
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-tertiary)]">Categoría:</span>
                    <span className="font-medium">{draft.categoria}</span>
                  </div>
                )}
                {draft.disponible_hasta && (
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-tertiary)]">Expira el:</span>
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      {new Date(draft.disponible_hasta).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-tertiary)]">Estado:</span>
                  <span className={`font-semibold ${draft.isAvailable ? 'text-emerald-600' : 'text-red-500'}`}>
                    {draft.isAvailable ? 'Disponible' : 'No disponible'}
                  </span>
                </div>
                {draft.nota_interna && (
                  <div className="pt-2 border-t border-[var(--color-border-tertiary)]">
                    <p className="text-[var(--color-text-tertiary)] mb-1 font-semibold flex items-center gap-1">
                      {draft.nota_publica ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      Nota {draft.nota_publica ? 'Pública' : 'Interna'}:
                    </p>
                    <p className="text-[var(--color-text-secondary)] leading-relaxed italic">{draft.nota_interna}</p>
                  </div>
                )}
              </div>
              
              {/* Variants list */}
              {draft.variants.length > 0 && (
                <div className="space-y-2">
                  <h6 className="text-[0.7rem] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">Variantes ({draft.variants.length})</h6>
                  <div className="max-h-[150px] overflow-y-auto border border-[var(--color-border-tertiary)] rounded-xl divide-y divide-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)]">
                    {draft.variants.map((v) => (
                      <div key={v.id} className="p-3 flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${v.isAvailable ? 'bg-emerald-500' : 'bg-red-400'}`} />
                          <span className="font-semibold text-[var(--color-text-primary)]">{v.name || 'Sin nombre'}</span>
                        </div>
                        <span className="font-mono font-semibold text-[var(--color-text-secondary)]">
                          ${(v.price !== null && v.price !== undefined ? v.price : draft.basePrice).toLocaleString()} MXN
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="flex-1 px-4 py-2 bg-[var(--color-background-primary)] border border-[var(--color-border-secondary)] rounded-xl text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)] transition-colors"
              >
                Seguir editando
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[var(--color-text-primary)] text-[var(--color-background-primary)] rounded-xl text-xs font-bold hover:bg-[var(--color-text-primary)] transition-all disabled:opacity-50 disabled:cursor-wait"
              >
                {saving ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
                ) : (
                  <><Save className="w-3.5 h-3.5" /> Confirmar y guardar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
