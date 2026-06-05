import { useState, useRef } from 'react';
import { Plus, Trash2, Edit2, GripVertical, GripHorizontal, Upload, Loader2, Package, Search } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { IconPicker } from './IconPicker';
import { CARD } from './config/SharedUI';
import { SlideOverPanel } from './SlideOverPanel';
import { useTenant } from '../../../context/TenantContext';
import { supabase } from '../../../lib/supabaseClient';
import { logger } from '../../../lib/logger';
import { fetchAdminProducts } from '../../../services/productService';
import {
  fetchSeccionProductos,
  reorderSeccionProductos
} from '../../../services/seccionProductosService';
import { toast } from '../../../store/toastStore';

function EmptyStateIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4">
      <rect x="20" y="20" width="80" height="80" rx="16" fill="var(--color-primario-50)" />
      <rect x="35" y="45" width="50" height="8" rx="4" fill="var(--color-primario-200)" />
      <rect x="35" y="65" width="30" height="8" rx="4" fill="var(--color-primario-200)" />
      <circle cx="80" cy="80" r="24" fill="var(--color-primario-400)" />
      <path d="M73 80H87M80 73V87" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'icon' | 'number' | 'color' | 'image' | 'catalog';
  options?: string[]; // Para iconos
}

function ImageUploadField({ value, onChange }: { value: string, onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { tenant } = useTenant();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no debe pesar más de 5MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${tenant.id}/secciones/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('productos')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('productos')
        .getPublicUrl(fileName);

      onChange(publicUrl);
    } catch (err) {
      logger.error("Error subiendo imagen:", err as Error);
      setError("Hubo un error subiendo la imagen. Intenta de nuevo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {value && (
        <div className="relative w-full h-32 rounded-lg border border-[var(--color-border-secondary)] overflow-hidden bg-[var(--color-background-secondary)] flex items-center justify-center">
          <img src={value} alt="Preview" className="max-w-full max-h-full object-contain" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className={`
          w-full flex justify-center items-center gap-2 px-4 py-2 border border-dashed border-[var(--color-border-primary)]/50 rounded-lg text-sm font-medium transition-colors cursor-pointer backdrop-blur-sm
          ${uploading ? 'bg-[var(--color-background-secondary)]/50 text-[var(--color-text-tertiary)] pointer-events-none' : 'bg-[var(--color-background-primary)]/50 text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)]/70 hover:border-emerald-300/50 hover:text-emerald-600'}
        `}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Subiendo...' : (value ? 'Cambiar imagen' : 'Subir imagen')}
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange} 
            disabled={uploading}
          />
        </label>
        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
      </div>
      <p className="text-[0.65rem] text-[var(--color-text-tertiary)]">Recomendado: Imágenes de alta calidad en formato JPG o PNG. Max 5MB.</p>
    </div>
  );
}

// ── Catalog List Editor (nested sub-list) ────────────────────────
interface CatalogItem {
  nombre: string;
  precio?: number | string;
  imagen_url: string;
}

function CatalogListEditor({ items, onChange }: { items: CatalogItem[]; onChange: (items: CatalogItem[]) => void }) {
  const { tenant } = useTenant();
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<CatalogItem>({ nombre: '', precio: '', imagen_url: '' });

  const addItem = () => {
    const newItem: CatalogItem = { nombre: '', precio: '', imagen_url: '' };
    const updated = [...items, newItem];
    onChange(updated);
    setEditIdx(updated.length - 1);
    setDraft(newItem);
  };

  const saveItem = () => {
    if (editIdx === null) return;
    const updated = [...items];
    updated[editIdx] = { ...draft };
    onChange(updated);
    setEditIdx(null);
  };

  const deleteItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
    if (editIdx === idx) setEditIdx(null);
  };

  return (
    <div className="space-y-3">
      {/* Horizontal scroll carousel */}
      {items.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-[var(--color-border-secondary)] scrollbar-track-transparent">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={`snap-start shrink-0 w-[140px] rounded-xl border overflow-hidden transition-all duration-200 ${
                editIdx === idx
                  ? 'border-emerald-400/50 ring-2 ring-emerald-500/20 bg-white/70 dark:bg-black/70'
                  : 'border-[var(--color-border-tertiary)]/50 bg-white/50 dark:bg-black/50 hover:border-[var(--color-border-secondary)]'
              }`}
            >
              {/* Image */}
              <div className="h-20 bg-[var(--color-background-secondary)] flex items-center justify-center overflow-hidden">
                {item.imagen_url ? (
                  <img src={item.imagen_url} alt={item.nombre} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                )}
              </div>
              {/* Info */}
              <div className="p-2.5">
                <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                  {item.nombre || '(Sin nombre)'}
                </p>
                <p className="text-[0.65rem] text-[var(--color-text-tertiary)] mt-0.5 font-medium">
                  {(item.precio !== undefined && item.precio !== '') ? `$${Number(item.precio).toLocaleString()}` : 'Precio no especificado'}
                </p>
                <div className="flex gap-1 mt-2">
                  <button
                    type="button"
                    onClick={() => { setEditIdx(idx); setDraft({ ...item }); }}
                    className="flex-1 text-[0.6rem] font-semibold px-1.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-500/20 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteItem(idx)}
                    className="px-1.5 py-1 text-[0.6rem] text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline edit form */}
      {editIdx !== null && (
        <div className="p-4 rounded-xl border border-emerald-300/30 bg-emerald-50/10 dark:bg-emerald-950/20 space-y-3">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Nombre</label>
            <input
              type="text"
              value={draft.nombre}
              onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
              className="w-full h-10 px-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
              placeholder="Ej. Ramo Elegante"
              style={{ fontSize: '16px' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Precio (MXN)</label>
            <input
              type="number"
              value={draft.precio ?? ''}
              onChange={(e) => setDraft({ ...draft, precio: e.target.value === '' ? '' : parseFloat(e.target.value) })}
              className="w-full h-10 px-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
              placeholder="Ej. 450.00"
              style={{ fontSize: '16px' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Imagen</label>
            <ImageUploadField
              value={draft.imagen_url}
              onChange={(url) => setDraft({ ...draft, imagen_url: url })}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={saveItem}
              className="flex-1 px-3 py-2 text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/25 transition-colors"
            >
              Guardar arreglo
            </button>
            <button
              type="button"
              onClick={() => setEditIdx(null)}
              className="px-3 py-2 text-xs font-semibold text-[var(--color-text-tertiary)] hover:bg-[var(--color-background-secondary)] rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Add button */}
      {!(tenant?.subscription_level === 1 && items.length >= 10) && (
        <button
          type="button"
          onClick={addItem}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-lg border border-dashed border-emerald-400/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-400/50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar arreglo al carrusel
        </button>
      )}
    </div>
  );
}

function ProductSelector({
  availableProducts,
  selectedProductIds,
  onToggleSelection,
  loading,
  useLegacyCatalog,
  setUseLegacyCatalog
}: {
  availableProducts: any[];
  selectedProductIds: string[];
  onToggleSelection: (id: string) => void;
  loading: boolean;
  useLegacyCatalog: boolean;
  setUseLegacyCatalog: (val: boolean) => void;
}) {
  const [filterQuery, setFilterQuery] = useState('');
  
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)] py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Cargando productos de la tienda...</span>
      </div>
    );
  }

  const filtered = availableProducts.filter(p => 
    p.name.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
          Vincular productos reales
        </span>
        <button
          type="button"
          onClick={() => setUseLegacyCatalog(!useLegacyCatalog)}
          className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 underline"
        >
          {useLegacyCatalog ? 'Usar vinculación real' : 'Usar catálogo virtual (legacy)'}
        </button>
      </div>

      {!useLegacyCatalog ? (
        <div className="border border-[var(--color-border-secondary)] rounded-xl p-3 bg-[var(--color-background-secondary)]/20 space-y-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar producto..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full pl-9 pr-4 h-10 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
              style={{ fontSize: '14px' }}
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-[var(--color-text-tertiary)]" />
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 select-none">
            {filtered.length === 0 ? (
              <p className="text-[10px] text-[var(--color-text-tertiary)] text-center py-4">
                No hay productos en el inventario
              </p>
            ) : (
              filtered.map(p => {
                const isSelected = selectedProductIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--color-background-secondary)]/40 cursor-pointer text-xs transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelection(p.id)}
                      className="rounded border-[var(--color-border-secondary)] text-emerald-600 focus:ring-emerald-500/20"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--color-text-primary)] truncate">{p.name}</p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)] font-mono">${p.basePrice}</p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
          
          <div className="text-[10px] text-[var(--color-text-tertiary)] border-t border-[var(--color-border-tertiary)] pt-2 flex justify-between items-center">
            <span>{selectedProductIds.length} seleccionados</span>
            <span className="font-semibold text-emerald-600">Conexión Relacional Activa</span>
          </div>
        </div>
      ) : (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3 rounded-xl text-[10px] leading-relaxed">
          Modo catálogo virtual legacy activo. Los productos se administran de forma independiente al inventario real. Selecciona productos del listado superior para vincular de forma relacional.
        </div>
      )}
    </div>
  );
}

interface SectionListEditorProps {
  title: string;
  description: string;
  items: any[];
  fields: FieldConfig[];
  onChange: (items: any[]) => void;
  disabled?: boolean;
}

export function SectionListEditor({ title, description, items, fields, onChange, disabled }: SectionListEditorProps) {
  const { tenant } = useTenant();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tempItem, setTempItem] = useState<any>({});

  // States for relational product linking
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [useLegacyCatalog, setUseLegacyCatalog] = useState(false);
  const [savingRelational, setSavingRelational] = useState(false);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;

    const reordered = Array.from(items);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    onChange(reordered);
  };

  const startEdit = async (index: number) => {
    const item = items[index];
    const finalId = item.id || (crypto.randomUUID ? crypto.randomUUID() : 'serv_' + Date.now());
    const itemWithId = { ...item, id: finalId };
    
    setEditingId(index);
    setTempItem(itemWithId);
    setSelectedProductIds([]);
    setUseLegacyCatalog(false);
    
    if (tenant?.id) {
      setLoadingLinked(true);
      try {
        // Fetch all store products
        const allProds = await fetchAdminProducts(tenant.id);
        setAvailableProducts(allProds);
        
        // Fetch linked products
        const linkedProds = await fetchSeccionProductos(tenant.id, finalId);
        if (linkedProds && linkedProds.length > 0) {
          setSelectedProductIds(linkedProds.map(p => p.id));
          setUseLegacyCatalog(false);
        } else {
          // If no linked products, fall back to legacy JSONB
          setUseLegacyCatalog(true);
        }
      } catch (err) {
        logger.error('Error fetching linked products for editor:', err as Error);
        setUseLegacyCatalog(true);
      } finally {
        setLoadingLinked(false);
      }
    }
  };

  const saveEdit = async () => {
    if (savingRelational) return;
    if (editingId !== null && tenant?.id) {
      const finalId = tempItem.id;
      
      setSavingRelational(true);
      try {
        // Save the product associations to seccion_productos
        if (!useLegacyCatalog) {
          await reorderSeccionProductos(tenant.id, finalId, selectedProductIds);
        } else {
          // If using legacy catalog, clear any relacional links so fallback stays active
          await reorderSeccionProductos(tenant.id, finalId, []);
        }
        
        // Save the rest of the edits to the parent list
        const newItems = [...items];
        newItems[editingId] = tempItem;
        onChange(newItems);
        
        setEditingId(null);
        toast.success('Cambios guardados correctamente');
      } catch (err) {
        logger.error('Error saving relational section products:', err as Error);
        toast.error('Error al guardar vinculos de productos');
      } finally {
        setSavingRelational(false);
      }
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setAvailableProducts([]);
    setSelectedProductIds([]);
    setUseLegacyCatalog(false);
    setSavingRelational(false);
  };

  const deleteItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const addNewItem = () => {
    const newItem: any = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'serv_' + Date.now()
    };
    fields.forEach(f => {
      newItem[f.key] = f.type === 'number' ? '' : f.type === 'color' ? '#D94F6E' : '';
    });
    
    const newItems = [...items, newItem];
    onChange(newItems);
    setEditingId(newItems.length - 1);
    setTempItem(newItem);
  };

  const renderFieldInput = (field: FieldConfig) => {
    const val = tempItem[field.key] || '';
    
    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={val}
            onChange={(e) => setTempItem({ ...tempItem, [field.key]: e.target.value })}
            className="w-full px-4 py-3 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all resize-none min-h-[100px]"
            style={{ fontSize: '16px' }}
          />
        );
      case 'icon':
        return (
          <IconPicker
            value={val}
            onChange={(v) => setTempItem({ ...tempItem, [field.key]: v })}
            options={field.options}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={val}
            onChange={(e) => setTempItem({ ...tempItem, [field.key]: e.target.value === '' ? '' : parseFloat(e.target.value) })}
            className="w-full h-10 px-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
            style={{ fontSize: '16px' }}
          />
        );
      case 'color':
        return (
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={val}
              onChange={(e) => setTempItem({ ...tempItem, [field.key]: e.target.value })}
              className="w-10 h-10 rounded-xl border border-[var(--color-border-secondary)] cursor-pointer p-0 shrink-0 overflow-hidden bg-transparent"
            />
            <input
              type="text"
              value={val}
              onChange={(e) => setTempItem({ ...tempItem, [field.key]: e.target.value })}
              className="flex-1 h-10 px-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
              style={{ fontSize: '16px' }}
            />
          </div>
        );
      case 'image':
        return (
          <ImageUploadField
            value={val}
            onChange={(url) => setTempItem({ ...tempItem, [field.key]: url })}
          />
        );
      case 'catalog':
        return (
          <div className="space-y-4">
            <ProductSelector
              availableProducts={availableProducts}
              selectedProductIds={selectedProductIds}
              onToggleSelection={(id) => {
                setSelectedProductIds(prev => {
                  const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
                  if (next.length > 0) setUseLegacyCatalog(false);
                  return next;
                });
              }}
              loading={loadingLinked}
              useLegacyCatalog={useLegacyCatalog}
              setUseLegacyCatalog={setUseLegacyCatalog}
            />

            {useLegacyCatalog && (
              <div className="border-t border-[var(--color-border-tertiary)] pt-4">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">
                  Editar Catálogo Virtual (Legacy)
                </p>
                <CatalogListEditor
                  items={val || []}
                  onChange={(catalogItems) => setTempItem({ ...tempItem, [field.key]: catalogItems })}
                />
              </div>
            )}
          </div>
        );
      default:
        return (
          <input
            type="text"
            value={val}
            onChange={(e) => setTempItem({ ...tempItem, [field.key]: e.target.value })}
            className="w-full h-10 px-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
            style={{ fontSize: '16px' }}
          />
        );
    }
  };

  return (
    <div className={`${CARD} p-6 flex flex-col gap-4 ${disabled ? 'opacity-70 pointer-events-none' : ''}`}>
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h2>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{description}</p>
        </div>
        {!(tenant?.subscription_level === 1 && items.length >= 10) && (
          <button
            onClick={addNewItem}
            disabled={disabled}
            title={disabled ? "Disponible en tu plan actual" : "Agregar elemento"}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg backdrop-blur-md transition-colors border ${
              disabled 
                ? 'bg-[var(--color-background-secondary)]/50 border-[var(--color-border-secondary)]/50 text-[var(--color-text-tertiary)] cursor-not-allowed' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/30'
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-10 bg-white/30 dark:bg-black/30 backdrop-blur-md border border-dashed border-white/40 dark:border-white/10 rounded-xl">
          <EmptyStateIllustration />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">Aún no hay elementos</h3>
          <p className="text-xs text-[var(--color-text-tertiary)] mb-4 max-w-[250px] mx-auto">
            Comienza a construir esta sección agregando tu primer elemento de contenido.
          </p>
          <button
            onClick={addNewItem}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-white/50 dark:bg-black/50 backdrop-blur-md border border-white/20 dark:border-white/10 text-[var(--color-text-secondary)] hover:bg-white/70 dark:hover:bg-black/70 hover:text-[var(--color-text-primary)] shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> Agregar primer elemento
          </button>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId={`list-${title}`} isDropDisabled={disabled}>
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-3"
              >
                {items.map((item, index) => (
                  <Draggable key={`item-${index}`} draggableId={`item-${index}`} index={index} isDragDisabled={disabled}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`border rounded-lg overflow-hidden transition-all duration-300 backdrop-blur-md ${
                          snapshot.isDragging ? 'border-emerald-300/50 shadow-lg bg-[var(--color-background-primary)]/70' : 'border-[var(--color-border-tertiary)]/50 bg-[var(--color-background-primary)]/40 hover:bg-[var(--color-background-primary)]/60'
                        }`}
                      >
                        <div className="flex items-center p-3 gap-3">
                          <div {...provided.dragHandleProps} className={`cursor-grab ${disabled ? 'text-[var(--color-border-primary)]' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'}`}>
                            <GripVertical className="w-4 h-4" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                              {item[fields[0].key] || '(Sin título)'}
                            </p>
                            {fields.length > 1 && (
                              <p className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">
                                {item[fields[1].key]}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEdit(index)}
                              disabled={disabled}
                              className="p-1.5 text-[var(--color-text-tertiary)] hover:text-blue-600 hover:bg-blue-500/10 dark:hover:bg-blue-500/10 rounded-md transition-colors disabled:opacity-50"
                              title="Editar elemento"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteItem(index)}
                              disabled={disabled}
                              className="p-1.5 text-[var(--color-text-tertiary)] hover:text-red-600 hover:bg-red-500/10 dark:hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50"
                              title="Eliminar elemento"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Panel lateral para editar */}
      <SlideOverPanel
        isOpen={editingId !== null}
        onClose={cancelEdit}
        onSave={saveEdit}
        title={`Editar ${title.split(' ')[0]}`}
      >
        <div className="flex flex-col gap-5">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                {f.label}
              </label>
              {renderFieldInput(f)}
            </div>
          ))}
        </div>
      </SlideOverPanel>
    </div>
  );
}
