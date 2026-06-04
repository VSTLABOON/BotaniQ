import { memo } from 'react';
import { useCartStore } from '../../store/cartStore.ts';
import { UI_COLORS } from '../../lib/constants.ts';
import { useTenant } from '../../context/TenantContext.tsx';

const ProductoCard = memo(function ProductoCard({ producto, priority = false }) {
  const { tenant } = useTenant();
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);

  const hasVariants = producto.variants && producto.variants.length > 0;
  let displayPrice = '';

  if (hasVariants) {
    const prices = producto.variants.map(v => v.price !== null && v.price !== undefined ? v.price : producto.precioNum);
    const minPrice = Math.min(...prices, producto.precioNum);
    displayPrice = `Desde $${minPrice.toLocaleString()} ${tenant?.currency || 'MXN'}`;
  } else {
    displayPrice = typeof producto.precio === 'number'
      ? `$${producto.precio.toLocaleString()} ${tenant?.currency || 'MXN'}`
      : producto.precio;
  }

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
      variantName: typeof producto.precio === 'number' ? `$${producto.precio} ${tenant?.currency || 'MXN'}` : producto.precio,     // Ej: "$450 MXN"
      unitPrice: producto.precioNum,
      quantity: 1,
      image: producto.imgUrl,
    });
    
    openCart();
  };

  return (
    <div className="group bg-blanco rounded-card overflow-hidden shadow-card transition-all duration-[350ms] ease-out cursor-pointer hover:-translate-y-2 hover:shadow-lg-custom focus-visible:outline-2 focus-visible:outline-rosa focus-visible:outline-offset-3 relative">
      <div className="relative aspect-[4/3] overflow-hidden bg-crema-dark">
        <img 
          src={producto.imgUrl} 
          alt={producto.name} 
          loading={priority ? "eager" : "lazy"}
          fetchpriority={priority ? "high" : "auto"}
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07]"
        />
        
        {producto.badge && (
          <span className={`absolute top-[0.8rem] left-[0.8rem] text-[var(--color-background-primary)] text-[0.65rem] font-bold tracking-[0.1em] uppercase py-[0.2rem] px-[0.65rem] rounded-[6px] ${producto.badgeClass === 'especial' ? 'bg-rosa' : 'bg-verde'}`}>
            {producto.badge}
          </span>
        )}

        <div className={`absolute bottom-[0.65rem] left-[0.65rem] flex items-center gap-[0.35rem] bg-[rgba(10,20,10,0.82)] backdrop-blur-[6px] text-[0.65rem] font-semibold tracking-[0.06em] uppercase py-[0.22rem] px-[0.6rem] rounded-full z-[3] ${producto.disponible ? 'text-[var(--color-background-primary)]' : 'text-[var(--color-background-primary)]/[.55]'}`}>
          {producto.disponible ? (
             <span className="w-[7px] h-[7px] rounded-full shrink-0 animate-pulse" style={{ backgroundColor: UI_COLORS.AVAILABLE_DOT, boxShadow: `0 0 0 0 ${UI_COLORS.AVAILABLE_DOT}80` }}></span>
          ) : (
             <span className="w-[7px] h-[7px] rounded-full shrink-0 bg-[var(--color-background-primary)]/[.3]"></span>
          )}
          {producto.disponible ? 'Disponible hoy' : 'Bajo pedido'}
        </div>
      </div>

      <div className="p-[1.3rem_1.4rem_1.5rem]">
        <h3 className="font-display text-[1.25rem] font-bold text-texto leading-[1.1] mb-[0.4rem]">
          {producto.name}
        </h3>
        <p className="text-[0.8rem] text-texto-muted mb-[1rem]">
          {producto.short}
        </p>
        
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-[1.4rem] font-bold text-verde">
            {displayPrice}
          </span>
          <button 
            type="button"
            onClick={handlePedir}
            aria-label={hasVariants ? `Ver opciones para ${producto.name}` : `Pedir ${producto.name} ahora`}
            className="inline-flex items-center gap-[0.4rem] bg-rosa text-[var(--color-background-primary)] py-[0.45rem] px-4 rounded-lg font-body text-[0.75rem] font-semibold tracking-[0.04em] transition-all duration-200 hover:bg-[var(--hover-bg)] hover:scale-[1.04] shrink-0"
            style={{ '--hover-bg': UI_COLORS.PRIMARY_HOVER }}
          >
            {hasVariants ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13" aria-hidden="true">
                  <path d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
                Ver Opciones
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13" aria-hidden="true">
                  <path d="M9 18V5l12-2v13"/>
                  <circle cx="6" cy="18" r="3"/>
                  <circle cx="18" cy="16" r="3"/>
                </svg>
                Pedir
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

export default ProductoCard;
