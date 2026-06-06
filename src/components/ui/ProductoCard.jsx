import { memo } from 'react';
import { useCartStore } from '../../store/cartStore.ts';
import { UI_COLORS } from '../../lib/constants.ts';
import { useTenant } from '../../context/TenantContext.tsx';

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
    <div className="group bg-[var(--color-background-primary)] rounded-card overflow-hidden shadow-card transition-all duration-[350ms] ease-out cursor-pointer hover:-translate-y-2 hover:shadow-lg-custom focus-visible:outline-2 focus-visible:outline-rosa focus-visible:outline-offset-3 relative border border-[var(--color-border-secondary)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-crema-dark">
        <img 
          src={producto.imgUrl} 
          alt={producto.name} 
          loading={priority ? "eager" : "lazy"}
          fetchpriority={priority ? "high" : "auto"}
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07]"
        />

        {/* Overlay semitransparente oscuro en la parte inferior de la imagen para asegurar contraste de textos */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none z-[1]" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }} />
        
        {producto.badge && (
          <span className={`absolute top-[0.8rem] left-[0.8rem] text-[var(--color-background-primary)] text-[0.65rem] font-bold tracking-[0.1em] uppercase py-[0.2rem] px-[0.65rem] rounded-[6px] z-[2] ${producto.badgeClass === 'especial' ? 'bg-rosa' : 'bg-verde'}`}>
            {producto.badge}
          </span>
        )}

        {/* Badges de Catálogo (Por encargo y Últimas unidades) */}
        <div className="absolute top-[0.8rem] right-[0.8rem] flex flex-col gap-1.5 items-end z-[3]">
          {producto.porEncargo && (
            <span className="text-[var(--color-background-primary)] bg-verde-dark/95 backdrop-blur-[4px] text-[0.6rem] font-bold tracking-[0.06em] uppercase py-[0.2rem] px-[0.5rem] rounded-[6px] shadow-sm">
              Por encargo
            </span>
          )}
          {producto.ultimasUnidades && (
            <span className="text-[var(--color-background-primary)] bg-rosa/95 backdrop-blur-[4px] text-[0.6rem] font-bold tracking-[0.06em] uppercase py-[0.2rem] px-[0.5rem] rounded-[6px] shadow-sm">
              Últimas unidades
            </span>
          )}
        </div>

        <div className={`absolute bottom-[0.65rem] left-[0.65rem] flex items-center gap-[0.35rem] bg-[rgba(10,20,10,0.82)] backdrop-blur-[6px] text-[0.65rem] font-semibold tracking-[0.06em] uppercase py-[0.22rem] px-[0.6rem] rounded-full z-[3] ${producto.disponible ? 'text-[var(--color-background-primary)]' : 'text-[var(--color-background-primary)]/[.55]'}`}>
          {producto.disponible ? (
             <span className="w-[7px] h-[7px] rounded-full shrink-0 animate-pulse" style={{ backgroundColor: UI_COLORS.AVAILABLE_DOT, boxShadow: `0 0 0 0 ${UI_COLORS.AVAILABLE_DOT}80` }}></span>
          ) : (
             <span className="w-[7px] h-[7px] rounded-full shrink-0 bg-[var(--color-background-primary)]/[.3]"></span>
          )}
          {producto.disponible ? 'Disponible hoy' : 'Bajo pedido'}
        </div>
      </div>

      <div className="p-[1.1rem_1.2rem_1.3rem] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] border-t border-[var(--color-border-tertiary)]">
        <h3 className="font-body text-[0.95rem] font-semibold text-[var(--color-text-primary)] leading-snug mb-[0.4rem] line-clamp-1">
          {producto.name}
        </h3>
        {showDescription && producto.short && (
          <p className="text-[0.8rem] text-[var(--color-text-tertiary)] mb-[1rem] line-clamp-2 leading-relaxed">
            {producto.short}
          </p>
        )}
        
        <div className="flex items-center justify-between gap-2">
          <div className="font-body text-[1.1rem] text-[var(--color-primary)]">
            {hasVariants ? (
              <>
                <span className="font-normal text-[var(--color-text-secondary)] text-[0.9rem]">Desde </span>
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
            className="inline-flex items-center gap-[0.4rem] bg-rosa text-[var(--color-background-primary)] py-[0.45rem] px-4 rounded-lg font-body text-[0.75rem] font-semibold tracking-[0.04em] transition-all duration-200 hover:bg-[var(--hover-bg)] hover:scale-[1.04] shrink-0 cursor-pointer"
            style={{ '--hover-bg': UI_COLORS.PRIMARY_HOVER }}
          >
            {hasVariants ? (
              <>
                <i className="ti ti-menu-2 text-sm shrink-0" />
                Ver Opciones
              </>
            ) : (
              <>
                {(tenant?.preferred_gateway === 'whatsapp' || (tenant?.subscription_level ?? 0) < 2) ? (
                  <i className="ti ti-brand-whatsapp text-sm shrink-0" />
                ) : (
                  <i className="ti ti-shopping-cart text-sm shrink-0" />
                )}
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
