import { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext.tsx';
import CategorySlider from '../ui/CategorySlider';
import { fetchSeccionProductos } from '../../services/seccionProductosService';

export default function Servicios() {
  const { tenant, loading } = useTenant();
  const [openCatalogId, setOpenCatalogId] = useState(null);
  const [relationalCatalogs, setRelationalCatalogs] = useState({});
  const [loadingRelational, setLoadingRelational] = useState(false);

  const servicios = tenant?.servicios || [];

  useEffect(() => {
    let active = true;
    async function loadRelational() {
      if (!tenant?.id || servicios.length === 0) return;
      setLoadingRelational(true);
      try {
        const catalogs = {};
        await Promise.all(
          servicios.map(async (serv, i) => {
            const key = serv.id || i;
            try {
              const products = await fetchSeccionProductos(tenant.id, key, true);
              if (products && products.length > 0) {
                catalogs[key] = products;
              }
            } catch (err) {
              console.error(`Error loading relational catalog for ${key}:`, err);
            }
          })
        );
        if (active) {
          setRelationalCatalogs(catalogs);
        }
      } catch (err) {
        console.error('Error loading relational catalogs:', err);
      } finally {
        if (active) {
          setLoadingRelational(false);
        }
      }
    }
    loadRelational();
    return () => { active = false; };
  }, [tenant?.id, servicios]);

  if (loading) {
    return (
      <section className="bg-negro-soft pt-[7rem] px-6 pb-[6rem] animate-pulse">
        <div className="max-w-[1100px] mx-auto h-[400px] bg-[var(--color-background-primary)]/5 rounded-[20px]"></div>
      </section>
    );
  }

  const toggleCatalog = (e, id) => {
    e.preventDefault();
    setOpenCatalogId(prev => prev === id ? null : id);
  };

  // Mapeamos los iconos asumiendo que el JSON guarda strings como 'heart', 'ribbon', 'zap' o clases de Tabler 'ti-...'
  const renderIcon = (iconStr) => {
    if (iconStr && iconStr.startsWith('ti-')) {
      return <i className={`ti ${iconStr} text-3xl`} style={{ fontSize: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} />;
    }
    switch (iconStr) {
      case 'heart':
        return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>;
      case 'ribbon':
        return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>;
      case 'cake':
        return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v2"/><path d="M12 8v2"/><path d="M17 8v2"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>;
      case 'briefcase':
        return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
      case 'flower':
        return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2c-1.5 0-2.8.7-3.6 1.8A3 3 0 0 0 4.2 8C2.7 8.8 2 10.3 2 12c0 1.5.7 2.8 1.8 3.6a3 3 0 0 0 4.2 4.2C8.8 21.3 10.3 22 12 22c1.5 0 2.8-.7 3.6-1.8a3 3 0 0 0 4.2-4.2c1.1-1 1.8-2.5 1.8-4.2 0-1.5-.7-2.8-1.8-3.6a3 3 0 0 0-4.2-4.2C14.8 2.7 13.5 2 12 2z"/></svg>;
      default:
        // Default to a star instead of a shield, which is more generic and friendly for occasions
        return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
    }
  };

  return (
    <section id="servicios" className="bg-negro-soft pt-[7rem] px-6 pb-[6rem]">
      <div className="text-center mb-16 animate-fade-up">
        <p className="inline-flex items-center gap-2 text-[0.65rem] tracking-[0.28em] uppercase text-verde-light font-body font-medium mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="11" height="11" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          {tenant.secciones?.servicios?.etiqueta || 'Ocasiones especiales'}
        </p>
        <h2 className="font-display text-[clamp(2rem,5vw,3.4rem)] leading-[1.05] font-bold text-[var(--color-background-primary)] mb-2">
          {tenant.secciones?.servicios?.titulo || 'Flores para'} <em className="italic text-rosa-light not-italic">{tenant.secciones?.servicios?.titulo_italic || 'cada momento'}</em>
        </h2>
      </div>

      <div className="max-w-[1100px] mx-auto flex flex-col gap-8">
        {servicios.map((serv, i) => {
          const idToToggle = serv.id || i;
          const relationalProducts = relationalCatalogs[idToToggle];

          // Use relational products if available, fallback to legacy catalog
          const rawCatalog = (relationalProducts && relationalProducts.length > 0)
            ? relationalProducts
            : (serv.catalog || []);

          // Normalize to what CategorySlider expects: { name, img, priceRange }
          const catalog = rawCatalog.map(item => ({
            name: item.nombre || item.name || '',
            img: item.imagen_url || item.img || '',
            priceRange: item.precio ? `$${item.precio}` : (item.priceRange || '')
          }));

          const isOpen = openCatalogId === idToToggle;
          
          return (
            <div 
              key={idToToggle} 
              className="group flex flex-col bg-negro border border-white/5 rounded-[20px] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] hover:border-white/10 animate-fade-up"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              {/* ── Tarjeta Principal ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 min-h-auto md:min-h-[400px]">
                
                <div className={`relative overflow-hidden bg-verde-dark h-[260px] md:h-auto ${i % 2 !== 0 ? 'md:order-2' : ''}`}>
                  <img 
                    src={serv.imgUrl || serv.imagen_url || 'img/rosas.jpeg'} 
                    alt={serv.title || serv.titulo} 
                    loading="lazy" 
                    className="w-full h-full object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-105" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-negro-soft/60 to-transparent mix-blend-multiply" />
                </div>
                
                {/* Contenido */}
                <div className={`p-8 md:p-12 lg:p-16 flex flex-col justify-center transition-colors duration-500 group-hover:bg-verde/5 ${i % 2 !== 0 ? 'md:order-1' : ''}`}>
                  <div className="w-12 h-12 text-rosa mb-6 shrink-0 transition-transform duration-300 group-hover:scale-110">
                    {renderIcon(serv.icon || serv.icono)}
                  </div>
                  
                  <h3 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] font-bold text-[var(--color-background-primary)] leading-[1.1] mb-4">
                    {serv.title || serv.titulo}
                  </h3>
                  
                  <p className="text-[0.95rem] text-[var(--color-background-primary)]/60 leading-[1.7] mb-8 font-light">
                    {serv.desc || serv.descripcion}
                  </p>

                  {/* Contador de arreglos + Botón */}
                  {catalog.length > 0 && (
                    <div className="flex items-center gap-4">
                      <button 
                        type="button"
                        onClick={(e) => toggleCatalog(e, idToToggle)}
                        className={`group/btn inline-flex items-center gap-3 text-[0.8rem] tracking-[0.15em] uppercase font-bold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rosa rounded-md px-2 py-1 -ml-2 ${isOpen ? 'text-rosa' : 'text-verde-light hover:text-rosa'}`}
                        aria-expanded={isOpen}
                        aria-controls={`slider-${idToToggle}`}
                      >
                        {isOpen ? 'Ocultar' : 'Ver arreglos'}
                        <svg 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2.5" 
                          width="16" 
                          height="16" 
                          className={`transition-transform duration-500 ease-spring ${isOpen ? 'rotate-180' : 'group-hover/btn:translate-y-0.5'}`}
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>

                      <span className="text-[0.7rem] text-[var(--color-background-primary)]/25 tracking-[0.06em] font-medium">
                        {catalog.length} opciones
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Carrusel Horizontal ── */}
              {catalog.length > 0 && (
                <CategorySlider
                  id={`slider-${idToToggle}`}
                  items={catalog}
                  isOpen={isOpen}
                  categoryTitle={serv.title || serv.titulo}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
