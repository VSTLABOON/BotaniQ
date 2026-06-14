// ─── ADMIN PRODUCTOS — GESTOR DE CATÁLOGO Y VARIANTES ───────────
// CRUD de productos con tabla limpia, reordenamiento interactivo (DND),
// toggle de disponibilidad y modal para gestionar variantes.
//
// Dependencias:
//   TenantContext — Para leer tenant.id
//   types.ts      — Product, ProductVariant
// ────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, X, Package,
  Image as ImageIcon, Loader2, ChevronDown, GripVertical
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';

class CustomMouseSensor extends PointerSensor {
  static activators = [{
    eventName: 'onPointerDown' as const,
    handler: ({ nativeEvent }: { nativeEvent: PointerEvent }) => {
      return nativeEvent.pointerType === 'mouse';
    },
  }];
}
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { Product } from '../../types';
import { useTenant } from '../../context/TenantContext';
import { logger } from '../../lib/logger';
import { toast } from '../../store/toastStore';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  fetchAdminProducts,
  updateProductAvailability,
  saveAdminProduct,
  deleteAdminProduct,
  reorderProductos
} from '../../services/productService';

import { CARD } from './components/config/SharedUI';
import { ProductModal } from './components/products/ProductModal';

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
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
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
// ██ COMPONENTE: SKELETON ROW PREMIUM
// ═══════════════════════════════════════════════════════════════════

function SkeletonRow() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[80px_1fr_120px_100px_80px_80px] gap-4 px-5 py-4 items-center animate-pulse border-b border-[var(--color-border-tertiary)] last:border-0">
      {/* Grip + Img */}
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-[var(--color-border-secondary)] rounded"></div>
        <div className="w-14 h-14 rounded-xl bg-[var(--color-border-secondary)] shrink-0"></div>
      </div>
      
      {/* Producto */}
      <div className="space-y-2">
        <div className="h-4 bg-[var(--color-border-secondary)] rounded-md w-2/3"></div>
        <div className="h-3 bg-[var(--color-border-secondary)] rounded-md w-1/2"></div>
      </div>
      
      {/* Precio Base */}
      <div className="flex justify-end">
        <div className="h-5 bg-[var(--color-border-secondary)] rounded-md w-16"></div>
      </div>
      
      {/* Variantes */}
      <div className="flex justify-center">
        <div className="h-6 bg-[var(--color-border-secondary)] rounded-full w-10"></div>
      </div>
      
      {/* Activo */}
      <div className="flex justify-center">
        <div className="h-6 bg-[var(--color-border-secondary)] rounded-full w-11"></div>
      </div>
      
      {/* Acciones */}
      <div className="flex justify-end gap-1">
        <div className="h-8 w-8 bg-[var(--color-border-secondary)] rounded-lg"></div>
        <div className="h-8 w-8 bg-[var(--color-border-secondary)] rounded-lg"></div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ██ COMPONENTE: FILA DE PRODUCTO ORDENABLE (SORTABLE)
// ═══════════════════════════════════════════════════════════════════

function SortableProductRow({
  product,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onToggleAvailability,
}: {
  product: Product;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAvailability: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-[var(--color-background-primary)] md:bg-transparent border border-[var(--color-border-secondary)] md:border-0 rounded-2xl md:rounded-none flex flex-col md:grid md:grid-cols-[80px_1fr_120px_100px_80px_80px] gap-4 p-5 md:px-5 md:py-4 hover:bg-[var(--color-background-secondary)]/50 transition-colors group shadow-sm md:shadow-none"
    >
      {/* Columna 1: Grip + Img */}
      <div className="flex items-center gap-3 w-full md:contents">
        <div 
          {...attributes} 
          {...listeners} 
          style={{ touchAction: 'none' }}
          className="cursor-grab active:cursor-grabbing p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] select-none shrink-0"
        >
          <GripVertical className="w-4 h-4" />
        </div>
        
        <div className="w-14 h-14 rounded-xl bg-[var(--color-background-tertiary)] overflow-hidden shrink-0">
          {product.images[0] ? (
            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-[var(--color-text-tertiary)]" />
            </div>
          )}
        </div>

        {/* Nombre y descripción */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{product.name}</p>
            {product.disponible_hasta && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.7rem] font-bold bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                Expira el {new Date(product.disponible_hasta).toLocaleDateString()}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">{product.description || 'Sin descripción'}</p>
        </div>

        {/* Botones de acción sólo en móvil (top right) */}
        <div className="flex md:hidden items-center gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-2 rounded-lg text-emerald-600 bg-emerald-50/50 hover:bg-emerald-100/50 transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 rounded-lg text-red-600 bg-red-50/50 hover:bg-red-100/50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Columnas restantes */}
      <div className="flex items-center justify-between w-full md:contents pt-2 md:pt-0 border-t border-[var(--color-border-secondary)] md:border-0 mt-2 md:mt-0">
        {/* Precio */}
        <div className="text-left md:text-right">
          <span className="text-[0.6rem] font-semibold text-[var(--color-text-tertiary)] block md:hidden mb-0.5 uppercase tracking-wider">Precio Base</span>
          <span className="text-sm font-bold text-[var(--color-text-primary)]">
            ${(product.basePrice ?? 0).toLocaleString()}
          </span>
          <span className="text-[0.65rem] text-[var(--color-text-tertiary)] ml-1">MXN</span>
        </div>

        {/* Variantes */}
        <div className="text-center">
          <span className="text-[0.6rem] font-semibold text-[var(--color-text-tertiary)] block md:hidden mb-0.5 uppercase tracking-wider">Variantes</span>
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full transition-all active:scale-95 ${
              expanded 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
            }`}
          >
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            {product.variants.length}
          </button>
        </div>

        {/* Toggle disponible */}
        <div className="flex flex-col items-center justify-center">
          <span className="text-[0.6rem] font-semibold text-[var(--color-text-tertiary)] block md:hidden mb-1 uppercase tracking-wider">Estado</span>
          <AvailabilityToggle
            checked={product.isAvailable}
            onChange={onToggleAvailability}
          />
        </div>

        {/* Acciones en Desktop */}
        <div className="hidden md:flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Desplegable de Variantes ── */}
      {expanded && (
        <div className="col-span-full bg-[var(--color-background-primary)]/50 border-t border-[var(--color-border-tertiary)] px-5 py-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-[0.65rem] font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest">Desglose de Variantes</h5>
            <button 
              onClick={onEdit}
              className="text-[0.65rem] font-bold text-emerald-600 hover:underline uppercase tracking-wider"
            >
              Gestionar en editor →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {product.variants.map(v => (
              <div key={v.id} className="bg-[var(--color-background-primary)] border border-[var(--color-border-secondary)] rounded-xl p-3 shadow-sm">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">{v.name || 'Sin nombre'}</p>
                  <span className={`text-[0.6rem] font-bold px-1.5 py-0.5 rounded ${v.isAvailable ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {v.isAvailable ? 'Disponible' : 'No disponible'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono font-bold text-[var(--color-text-secondary)]">
                    ${(v.price !== null && v.price !== undefined ? v.price : product.basePrice).toLocaleString()} MXN
                  </span>
                </div>
              </div>
            ))}
            {product.variants.length === 0 && (
              <p className="text-xs text-[var(--color-text-tertiary)] italic">Este producto no tiene variantes configuradas.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ██ COMPONENTE PRINCIPAL — ADMIN PRODUCTOS
// ═══════════════════════════════════════════════════════════════════

export default function AdminProductos() {
  const { tenant } = useTenant();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, productId: string | null}>({ isOpen: false, productId: null });

  // Configuración de sensores para dnd-kit
  const sensors = useSensors(
    useSensor(CustomMouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /** Toggle de expansión de variantes */
  const toggleExpand = (productId: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  useEffect(() => {
    let active = true;

    async function fetchProductsData() {
      if (!tenant?.id) return;
      try {
        setLoading(true);
        const mappedProducts = await fetchAdminProducts(tenant.id);

        if (!active) return;
        setProducts(mappedProducts);
      } catch (err) {
        if (!active) return;
        logger.error('Error fetching products:', err as Error);
        toast.error('Hubo un error al cargar los productos.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    fetchProductsData();

    return () => {
      active = false;
    };
  }, [tenant?.id]);

  /**
   * Toggle de disponibilidad — Actualización inline optimista.
   */
  const toggleAvailability = useCallback(async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const newVal = !product.isAvailable;
    setProducts(prev => prev.map(p =>
      p.id === productId ? { ...p, isAvailable: newVal } : p
    ));

    try {
      await updateProductAvailability(productId, newVal);
    } catch (err) {
      logger.error('Error toggling availability:', err as Error);
      // Revertir
      setProducts(prev => prev.map(p =>
        p.id === productId ? { ...p, isAvailable: !newVal } : p
      ));
      toast.error('Error al actualizar disponibilidad');
    }
  }, [products]);

  /**
   * Callback del modal: persiste el producto editado.
   */
  const handleProductSave = useCallback(async (updated: Product) => {
    if (!tenant?.id) return;
    try {
      const currentProduct = products.find(p => p.id === updated.id);
      const oldVariants = currentProduct ? currentProduct.variants : [];
      
      // Determinar eliminadas
      const updatedIds = updated.variants.map(v => v.id);
      const toDeleteIds = oldVariants.filter(v => !updatedIds.includes(v.id)).map(v => v.id);

      await saveAdminProduct(tenant.id, updated, toDeleteIds);

      // Sincronizar estado local
      setProducts(prev => {
        const exists = prev.some(p => p.id === updated.id);
        if (exists) {
          return prev.map(p => p.id === updated.id ? updated : p);
        }
        return [updated, ...prev];
      });
      toast.success('Producto guardado correctamente');
      setEditingProduct(null);
    } catch (err) {
      logger.error('Error al guardar producto:', err as Error);
      toast.error('Hubo un error al guardar el producto.');
    }
  }, [tenant?.id, products]);

  /** Eliminar un producto */
  const handleDelete = useCallback(async () => {
    if (!confirmDialog.productId) return;
    const productId = confirmDialog.productId;
    try {
      await deleteAdminProduct(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
      toast.success('Producto eliminado correctamente');
    } catch (err) {
      logger.error('Error al eliminar producto:', err as Error);
      toast.error('Hubo un error al intentar eliminar el producto o sus variantes.');
    } finally {
      setConfirmDialog({ isOpen: false, productId: null });
    }
  }, [confirmDialog.productId]);

  /** Drag end handler para persistir nuevo orden */
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = products.findIndex(p => p.id === active.id);
    const newIndex = products.findIndex(p => p.id === over.id);

    const newOrderedProducts = arrayMove(products, oldIndex, newIndex);
    
    // Cambiar localmente de forma inmediata (UX fluida)
    setProducts(newOrderedProducts);

    if (tenant?.id) {
      try {
        const orderedIds = newOrderedProducts.map(p => p.id);
        await reorderProductos(tenant.id, orderedIds);
        toast.success('Orden de catálogo actualizado');
      } catch (err) {
        logger.error('Error reordering products:', err as Error);
        toast.error('Error al guardar el nuevo orden');
        // Revertir en caso de fallo
        setProducts(products);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Encabezado ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Catálogo de Productos</h1>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Gestiona tu inventario, precios y variantes
          </p>
        </div>

        <button
          onClick={() => {
            if (!tenant?.id) return;
            // Correction 2: Variants starts completely empty
            const newProduct: Product = {
              id: uid(),
              tienda_id: tenant.id,
              name: '',
              description: '',
              basePrice: 0,
              images: [],
              isAvailable: true,
              variants: [],
              sku: '',
              categoria: '',
              nota_interna: '',
              nota_publica: false,
              disponible_hasta: ''
            };
            setEditingProduct(newProduct);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[var(--color-text-primary)] text-[var(--color-background-primary)] hover:bg-[var(--color-text-primary)] transition-all active:scale-[0.97] shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Nuevo producto
        </button>
      </div>

      {/* ── Contador ── */}
      <div className="flex items-center gap-3 text-sm text-[var(--color-text-tertiary)]">
        <span className="inline-flex items-center gap-1.5 bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)] px-3 py-1 rounded-full text-xs font-semibold">
          <Package className="w-3.5 h-3.5" />
          {products.length} productos
        </span>
      </div>

      {/* ═══ TABLA DE PRODUCTOS ═══ */}
      <div className={`${CARD} overflow-hidden`}>
        {/* Header de la tabla */}
        <div className="hidden md:grid grid-cols-[80px_1fr_120px_100px_80px_80px] gap-4 px-5 py-3 bg-[var(--color-background-secondary)] border-b border-[var(--color-border-tertiary)] text-[0.7rem] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
          <span className="pl-6">Img</span>
          <span>Producto</span>
          <span className="text-right">Precio Base</span>
          <span className="text-center">Variantes</span>
          <span className="text-center">Activo</span>
          <span></span>
        </div>

        {/* Drag and Drop Context Wrapper */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col gap-4 md:gap-0 md:divide-y md:divide-gray-50 md:dark:divide-white/5 p-4 md:p-0">
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : (
              <SortableContext
                items={products.map(p => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {products.map((product) => (
                  <SortableProductRow
                    key={product.id}
                    product={product}
                    expanded={expandedProducts.has(product.id)}
                    onToggleExpand={() => toggleExpand(product.id)}
                    onEdit={() => setEditingProduct(product)}
                    onDelete={() => setConfirmDialog({ isOpen: true, productId: product.id })}
                    onToggleAvailability={() => toggleAvailability(product.id)}
                  />
                ))}
              </SortableContext>
            )}
          </div>
        </DndContext>

        {/* Empty state */}
        {!loading && products.length === 0 && (
          <div className="text-center py-20 px-4">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <Package className="w-10 h-10 text-emerald-500" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Catálogo vacío</h3>
            <p className="text-sm text-[var(--color-text-tertiary)] max-w-md mx-auto mb-8 leading-relaxed">
              Tu catálogo está vacío. Agrega tu primer arreglo para que tus clientes puedan verlo.
            </p>
            <button
              onClick={() => {
                if (!tenant?.id) return;
                const newProduct: Product = {
                  id: uid(),
                  tienda_id: tenant.id,
                  name: '',
                  description: '',
                  basePrice: 0,
                  images: [],
                  isAvailable: true,
                  variants: [],
                  sku: '',
                  categoria: '',
                  nota_interna: '',
                  nota_publica: false,
                  disponible_hasta: ''
                };
                setEditingProduct(newProduct);
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all active:scale-[0.97] shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Agregar mi primer arreglo
            </button>
          </div>
        )}
      </div>

      {/* ═══ MODAL DE EDICIÓN ═══ */}
      {editingProduct && (
        <ProductModal
          product={editingProduct}
          isNew={!products.some(p => p.id === editingProduct.id)}
          onClose={() => setEditingProduct(null)}
          onSave={handleProductSave}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Eliminar producto"
        description="¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer y se borrará de tu catálogo público."
        onConfirm={handleDelete}
        onCancel={() => setConfirmDialog({ isOpen: false, productId: null })}
      />
    </div>
  );
}
