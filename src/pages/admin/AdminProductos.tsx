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
  Plus, Pencil, Trash2, X, Package,
  Image, Loader2, ChevronDown, Crown,
} from 'lucide-react';
import type { Product, ProductVariant } from '../../types';
import { useTenant } from '../../context/TenantContext';
import { logger } from '../../lib/logger';
import { toast } from '../../store/toastStore';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  fetchAdminProducts,
  updateProductAvailability,
  saveAdminProduct,
  deleteAdminProduct
} from '../../services/productService';

// ── Clase base para tarjetas admin ───────────────────────────────
import { CARD } from './components/config/SharedUI';

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

import { ProductModal } from './components/products/ProductModal';

// ═══════════════════════════════════════════════════════════════════
// ██ COMPONENTE: SKELETON ROW PREMIUM
// ═══════════════════════════════════════════════════════════════════

function SkeletonRow() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[64px_1fr_120px_100px_80px_80px] gap-4 px-5 py-4 items-center animate-pulse border-b border-[var(--color-border-tertiary)] last:border-0">
      {/* Img */}
      <div className="w-14 h-14 rounded-xl bg-[var(--color-border-secondary)] shrink-0"></div>
      
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
// ██ COMPONENTE PRINCIPAL — ADMIN PRODUCTOS
// ═══════════════════════════════════════════════════════════════════

export default function AdminProductos() {
  const { tenant } = useTenant();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, productId: string | null}>({ isOpen: false, productId: null });

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
   * Toggle de disponibilidad — Actualización optimista inline.
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

      // Todo salió bien, actualizamos local
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

        {/* SAAS_FLAG: NIVEL 1 - Máximo 20 productos. En plan básico,
            este botón se desactiva al alcanzar el límite y muestra
            un badge "Actualiza a Pro" con el icono Crown. */}
        {!(tenant?.subscription_level === 1 && products.length >= 40) && (
          <button
            onClick={() => {
              if (!tenant?.id) return;
              const newProduct: Product = {
                id: uid(), tienda_id: tenant.id, name: 'Nuevo Producto',
                description: '', basePrice: 0, images: [], isAvailable: false,
                variants: [emptyVariant(uid())],
              };
              setEditingProduct(newProduct);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[var(--color-text-primary)] text-[var(--color-background-primary)] hover:bg-[var(--color-text-primary)] transition-all active:scale-[0.97] shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Nuevo producto
          </button>
        )}
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
        <div className="hidden md:grid grid-cols-[64px_1fr_120px_100px_80px_80px] gap-4 px-5 py-3 bg-[var(--color-background-secondary)] border-b border-[var(--color-border-tertiary)] text-[0.7rem] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
          <span>Img</span>
          <span>Producto</span>
          <span className="text-right">Precio Base</span>
          <span className="text-center">Variantes</span>
          <span className="text-center">Activo</span>
          <span></span>
        </div>

        {/* Filas */}
        <div className="flex flex-col gap-4 md:gap-0 md:divide-y md:divide-gray-50 md:dark:divide-white/5 p-4 md:p-0">
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : products.map((product) => (
            <div
              key={product.id}
              className="bg-[var(--color-background-primary)] md:bg-transparent border border-[var(--color-border-secondary)] md:border-0 rounded-2xl md:rounded-none flex flex-col md:grid md:grid-cols-[64px_1fr_120px_100px_80px_80px] gap-4 p-5 md:px-5 md:py-4 hover:bg-[var(--color-background-secondary)]/50 transition-colors group shadow-sm md:shadow-none"
            >
              {/* Row 1 en Móvil / Cols 1-2 en Desktop */}
              <div className="flex items-center gap-4 w-full md:contents">
                {/* Miniatura */}
                <div className="w-14 h-14 rounded-xl bg-[var(--color-background-tertiary)] overflow-hidden shrink-0">
                  {product.images[0] ? (
                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                    </div>
                  )}
                </div>

                {/* Nombre y descripción */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{product.name}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">{product.description}</p>
                </div>

                {/* Botones de acción sólo en móvil (top right) */}
                <div className="flex md:hidden items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditingProduct(product)}
                    className="p-2 rounded-lg text-emerald-600 bg-emerald-50/50"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDialog({ isOpen: true, productId: product.id })}
                    className="p-2 rounded-lg text-red-600 bg-red-50/50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Row 2 en Móvil / Cols 3-6 en Desktop */}
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
                    onClick={() => toggleExpand(product.id)}
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full transition-all active:scale-95 ${
                      expandedProducts.has(product.id) 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                        : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                    }`}
                  >
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expandedProducts.has(product.id) ? 'rotate-180' : ''}`} />
                    {product.variants.length}
                  </button>
                </div>

                {/* Toggle */}
                <div className="flex flex-col items-center justify-center">
                  <span className="text-[0.6rem] font-semibold text-[var(--color-text-tertiary)] block md:hidden mb-1 uppercase tracking-wider">Estado</span>
                  <AvailabilityToggle
                    checked={product.isAvailable}
                    onChange={() => toggleAvailability(product.id)}
                  />
                </div>

                {/* Acciones en Desktop */}
                <div className="hidden md:flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditingProduct(product)}
                    className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDialog({ isOpen: true, productId: product.id })}
                    className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ── Desplegable de Variantes ── */}
              {expandedProducts.has(product.id) && (
                <div className="col-span-full bg-[var(--color-background-primary)]/50 border-t border-[var(--color-border-tertiary)] px-5 py-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-[0.65rem] font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest">Desglose de Variantes</h5>
                    <button 
                      onClick={() => setEditingProduct(product)}
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
                          <span className={`text-[0.6rem] font-bold px-1.5 py-0.5 rounded ${v.stock > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                            Stock: {v.stock}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[var(--color-text-tertiary)]">SKU: {v.sku || '-'}</span>
                          <span className="font-mono font-bold text-[var(--color-text-secondary)]">
                            ${(v.price !== null && v.price !== undefined ? v.price : product.basePrice).toLocaleString()}
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
          ))}
        </div>

        {/* Empty state emocional */}
        {!loading && products.length === 0 && (
          <div className="text-center py-20 px-4">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <Package className="w-10 h-10 text-emerald-500" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">¡Tu vitrina está vacía!</h3>
            <p className="text-sm text-[var(--color-text-tertiary)] max-w-md mx-auto mb-8 leading-relaxed">
              El paso más difícil ya lo diste. Ahora agrega tu primer arreglo floral. Solo necesitas una foto bonita, un nombre y el precio para empezar a recibir pedidos.
            </p>
            <button
              onClick={() => {
                if (!tenant?.id) return;
                const newProduct: Product = {
                  id: uid(), tienda_id: tenant.id, name: 'Nuevo Producto',
                  description: '', basePrice: 0, images: [], isAvailable: false,
                  variants: [emptyVariant(uid())],
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
