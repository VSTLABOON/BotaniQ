import { memo } from 'react';
import { useCartStore } from '../../store/cartStore.ts';
import { UI_COLORS } from '../../lib/constants.ts';
import { useTenant } from '../../context/TenantContext.tsx';
import { Menu, ShoppingCart } from 'lucide-react';

const ProductoCard = memo(function ProductoCard({ producto, priority = false }) {
  const { tenant } = useTenant();
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);

  const hasVariants = producto.variants && producto.variants.length > 0;
  const minPrice = hasVariants
    ? Math.min(...producto.variants.map(v => v.price !== null && v.price !== undefined ? v.price : producto.precioNum), producto.precioNum)
    : producto.precioNum;

  const handlePedir = (e) => {
    if (hasVariants) {
      // Permitir que la propagación continúe para que el Link padre maneje la navegación
      return;
    }

    e.stopPropagation(); 
    
    addItem({
      productId: producto.id,
      variantId: producto.id,           // Variante default
      name: producto.name,
      variantName: typeof producto.precio === 'number' ? `$${producto.precio}` : producto.precio,     // Ej: "$450"
      unitPrice: producto.precioNum,
      quantity: 1,
      image: producto.imgUrl,
    });
    
    openCart();
  };

  const showDescription = tenant?.config_ui?.catalogo?.mostrar_descripcion_en_tarjeta ?? false;

  return (
    <div className="group bg-[var(--color-background-primary)] rounded-card overflow-hidden shadow-card transition-all duration-[350ms] ease-out cursor-pointer hover:-translate-y-2 hover:shadow-lg-custom focus-visible:outline-2 focus-visible:outline-rosa focus-visible:outline-offset-3 relative border border-[var(--color-border-secondary)] flex flex-col h-full">
      <div className="relative aspect-[4/3] overflow-hidden bg-crema-dark shrink-0">
        <img 
          src={producto.imgUrl} 
          alt={producto.name} 
          loading={priority ? "eager" : "lazy"}
          fetchpriority={priority ? "high" : "auto"}
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07]"
        />
        
        {producto.badge && (
          <span className={`absolute top-[0.6rem] left-[0.6rem] md:top-[0.8rem] md:left-[0.8rem] text-[var(--color-background-primary)] text-[0.55rem] md:text-[0.65rem] font-bold tracking-[0.1em] uppercase py-[0.15rem] px-[0.5rem] md:py-[0.2rem] md:px-[0.65rem] rounded-[4px] md:rounded-[6px] z-[2] ${producto.badgeClass === 'especial' ? 'bg-rosa' : 'bg-verde'}`}>
            {producto.badge}
          </span>
        )}

        {/* Badges de Catálogo (Por encargo y Últimas unidades) */}
        <div className="absolute top-[0.6rem] right-[0.6rem] md:top-[0.8rem] md:right-[0.8rem] flex flex-col gap-1 items-end z-[3]">
          {producto.porEncargo && (
            <span className="text-[var(--color-background-primary)] bg-emerald-700/95 backdrop-blur-[4px] text-[0.52rem] md:text-[0.6rem] font-bold tracking-[0.06em] uppercase py-[0.15rem] px-[0.4rem] md:py-[0.2rem] md:px-[0.5rem] rounded-[4px] md:rounded-[6px] shadow-sm">
              Por encargo
            </span>
          )}
          {producto.ultimasUnidades && (
            <span className="text-[var(--color-background-primary)] bg-rosa/95 backdrop-blur-[4px] text-[0.52rem] md:text-[0.6rem] font-bold tracking-[0.06em] uppercase py-[0.15rem] px-[0.4rem] md:py-[0.2rem] md:px-[0.5rem] rounded-[4px] md:rounded-[6px] shadow-sm">
              Últimas unidades
            </span>
          )}
        </div>
      </div>

      <div className="p-3.5 sm:p-5 text-[var(--color-text-primary)] bg-[var(--color-background-primary)] border-t border-[var(--color-border-tertiary)] flex flex-col justify-between flex-grow">
        <div>
          {/* Categoría y disponibilidad integrados de forma elegante */}
          <div className="flex items-center gap-1.5 mb-[0.4rem] text-[0.62rem] sm:text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] flex-wrap">
            {producto.category ? (
              <>
                <span>{producto.category}</span>
                <span className="w-1 h-1 rounded-full bg-[var(--color-border-primary)]" />
              </>
            ) : null}
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${producto.disponible ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} style={producto.disponible ? { boxShadow: `0 0 4px ${UI_COLORS.AVAILABLE_DOT}` } : {}} />
              {producto.disponible ? 'Disponible hoy' : 'Bajo pedido'}
            </span>
          </div>

          <h3 className="font-body text-[0.875rem] sm:text-[0.95rem] font-semibold text-[var(--color-text-primary)] leading-snug mb-[0.4rem] line-clamp-1">
            {producto.name}
          </h3>
          {showDescription && producto.short && (
            <p className="text-[0.78rem] sm:text-[0.8rem] text-[var(--color-text-tertiary)] mb-[0.8rem] line-clamp-2 leading-relaxed font-light">
              {producto.short}
            </p>
          )}
        </div>
        
        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="font-body text-[0.95rem] sm:text-[1.1rem] text-[var(--color-primary)] whitespace-nowrap">
            {hasVariants ? (
              <>
                <span className="font-normal text-[var(--color-text-secondary)] text-[0.75rem] sm:text-[0.9rem]">Desde </span>
                <span className="font-bold">${new Intl.NumberFormat('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(minPrice)}</span>
              </>
            ) : (
              <span className="font-bold">
                {typeof producto.precio === 'number'
                  ? `$${new Intl.NumberFormat('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(producto.precio)}`
                  : producto.precio}
              </span>
            )}
          </div>
          <button 
            type="button"
            onClick={handlePedir}
            aria-label={hasVariants ? `Ver opciones para ${producto.name}` : `Pedir ${producto.name} ahora`}
            className="inline-flex items-center justify-center gap-[0.4rem] bg-rosa text-[var(--color-background-primary)] w-9 h-9 sm:w-auto sm:h-auto p-0 sm:py-[0.45rem] sm:px-4 rounded-full sm:rounded-lg font-body text-[0.75rem] font-semibold tracking-[0.04em] transition-all duration-200 hover:bg-[var(--hover-bg)] hover:scale-[1.04] shrink-0 cursor-pointer shadow-sm"
            style={{ '--hover-bg': UI_COLORS.PRIMARY_HOVER }}
          >
            {hasVariants ? (
              <>
                <Menu className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Ver Opciones</span>
              </>
            ) : (
              <>
                {(tenant?.preferred_gateway === 'whatsapp' || (tenant?.subscription_level ?? 0) < 2) ? (
                  /* EXCEPCIÓN: Se mantiene ti-brand-whatsapp por no contar con equivalente adecuado en Lucide */
                  <i className="ti ti-brand-whatsapp text-sm shrink-0" />
                ) : (
                  <ShoppingCart className="w-4 h-4 shrink-0" />
                )}
                <span className="hidden sm:inline">Pedir</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

export default ProductoCard;
