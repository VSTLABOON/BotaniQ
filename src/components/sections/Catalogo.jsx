import { useState, useMemo, useEffect } from 'react';
import { usePublicCatalog } from '../../hooks/usePublicCatalog';
import { useTenant } from '../../context/TenantContext.tsx';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import ProductoCard from '../ui/ProductoCard';
import { fadeUp, staggerContainer, getMotionVariants } from '../../lib/motion';

export default function Catalogo() {
  const { tenant } = useTenant();
  const { productos, loading, error, source } = usePublicCatalog(tenant.slug);
  const shouldReduceMotion = useReducedMotion();

  // Control del Modal de Catálogo Completo
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');

  // Asegurar que al abrir el modal se bloquee el scroll del body
  useEffect(() => {
    if (catalogModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [catalogModalOpen]);

  // Cerrar modal con la tecla Esc
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setCatalogModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Guardar posición de scroll al hacer clic en un producto
  const handleProductClick = () => {
    sessionStorage.setItem('botaniq_scroll_pos', window.scrollY.toString());
  };

  // Restaurar scroll o navegar al catálogo si viene con hash
  useEffect(() => {
    if (!loading) {
      const saved = sessionStorage.getItem('botaniq_scroll_pos');
      if (saved) {
        const y = parseInt(saved, 10);
        const timer = setTimeout(() => {
          window.scrollTo(0, y);
          sessionStorage.removeItem('botaniq_scroll_pos');
        }, 100);
        return () => clearTimeout(timer);
      } else if (window.location.hash === '#catalogo') {
        const el = document.getElementById('catalogo');
        if (el) {
          const timer = setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth' });
          }, 100);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [loading]);

  // Productos destacados en la landing: primeros 3 según campo `orden` (que ya viene ordenado del hook)
  const productosDestacados = useMemo(() => {
    return productos.slice(0, 3);
  }, [productos]);

  // Categorías únicas
  const categories = useMemo(() => {
    if (!productos) return ['todos'];
    const cats = productos.map(p => p.category).filter(Boolean);
    return ['todos', ...new Set(cats)];
  }, [productos]);

  // Filtrado para el modal
  const filteredModalProducts = useMemo(() => {
    return productos.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.desc.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'todos' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [productos, searchQuery, selectedCategory]);

  return (
    <section id="catalogo" className="bg-crema pt-28 px-6 pb-24 text-texto">
      <div className="text-center mb-[3.5rem]">
        <p className="inline-flex items-center gap-[0.45rem] text-[0.65rem] tracking-[0.28em] uppercase text-verde font-body font-medium mb-[0.9rem]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="11" height="11" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2c-1.5 0-2.8.7-3.6 1.8A3 3 0 0 0 4.2 8C2.7 8.8 2 10.3 2 12c0 1.5.7 2.8 1.8 3.6a3 3 0 0 0 4.2 4.2C8.8 21.3 10.3 22 12 22c1.5 0 2.8-.7 3.6-1.8a3 3 0 0 0 4.2-4.2c1.1-1 1.8-2.5 1.8-4.2 0-1.5-.7-2.8-1.8-3.6a3 3 0 0 0-4.2-4.2C14.8 2.7 13.5 2 12 2z"/>
          </svg>
          Catálogo
        </p>
        <h2 className="font-display text-[clamp(2rem,5vw,3.4rem)] leading-[1.05] tracking-[-0.02em] font-bold text-texto">
          Arreglos que <em className="italic text-rosa not-italic">hablan</em>
        </h2>
        <p className="text-[0.86rem] text-texto-muted tracking-[0.04em] mt-[0.6rem] font-light">
          Toca cualquier arreglo para ver detalles y pedir por WhatsApp
        </p>
      </div>

      {/* Estado de carga */}
      {loading ? (
        <div className="max-w-[1180px] mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-blanco rounded-card overflow-hidden shadow-card animate-pulse">
              <div className="relative aspect-[4/3] bg-[var(--color-border-secondary)]"></div>
              <div className="p-[1.3rem_1.4rem_1.5rem]">
                <div className="h-[1.25rem] bg-[var(--color-border-secondary)] rounded w-3/4 mb-[0.4rem]"></div>
                <div className="h-[0.8rem] bg-[var(--color-border-secondary)] rounded w-full mb-[1rem]"></div>
                <div className="flex items-center justify-between gap-2">
                  <div className="h-[1.4rem] bg-[var(--color-border-secondary)] rounded w-1/3"></div>
                  <div className="h-[32px] w-[80px] bg-[var(--color-border-secondary)] rounded-lg"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : productosDestacados.length > 0 ? (
        <div className="space-y-12">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={getMotionVariants(staggerContainer, shouldReduceMotion)}
            className="max-w-[1180px] mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6"
          >
            {productosDestacados.map((prod, i) => (
              <motion.div 
                key={prod.id} 
                variants={getMotionVariants(fadeUp, shouldReduceMotion)}
              >
                <Link to={`/producto/${prod.slug}`} onClick={handleProductClick} className="block h-full">
                  <ProductoCard producto={prod} priority={i < 3} />
                </Link>
              </motion.div>
            ))}
          </motion.div>

          {/* Botón Ver Catálogo Completo */}
          <div className="text-center mt-12">
            <button
              onClick={() => setCatalogModalOpen(true)}
              className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full text-sm font-bold bg-rosa text-[var(--color-background-primary)] hover:scale-[1.04] active:scale-[0.98] transition-all duration-200 shadow-lg cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
              Ver catálogo completo
            </button>
          </div>
        </div>
      ) : (
        <p className="text-center py-12 px-6 text-[0.9rem] text-texto-muted max-w-[500px] mx-auto">
          No hay arreglos disponibles en este momento. <a href={tenant.whatsapp ? `https://wa.me/${tenant.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hola, me gustaría consultar por arreglos florales.')}` : '#'} target="_blank" rel="noopener noreferrer" className="text-verde underline">Consúltanos por WhatsApp</a> y encontramos algo para ti.
        </p>
      )}

      {/* ── MODAL: CATÁLOGO COMPLETO ── */}
      {catalogModalOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[3px] z-[9998] animate-in fade-in duration-300" onClick={() => setCatalogModalOpen(false)} />
          
          {/* Modal Container */}
          <div className="fixed inset-0 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[1000px] md:h-[90vh] md:max-h-[850px] bg-[var(--color-background-primary)] md:bg-[var(--color-background-primary)]/95 md:backdrop-blur-2xl md:rounded-2xl shadow-2xl z-[9999] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]/50 backdrop-blur-md shrink-0">
              <div>
                <h3 className="font-display text-xl md:text-2xl font-bold text-[var(--color-text-primary)]">Catálogo Completo</h3>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{productos.length} arreglos disponibles</p>
              </div>
              <button
                onClick={() => setCatalogModalOpen(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                aria-label="Cerrar catálogo"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="22" height="22">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-[var(--color-background-primary)]">
              {/* Buscador y Categorías (Solo si hay más de 8 productos) */}
              {productos.length > 8 && (
                <div className="max-w-[1180px] mx-auto mb-8 space-y-4">
                  <div className="relative max-w-md">
                    <input
                      type="text"
                      placeholder="Buscar arreglo por nombre o descripción..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-11 pl-4 pr-10 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all"
                    />
                    <span className="absolute right-3.5 top-3.5 text-[var(--color-text-tertiary)]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                    </span>
                  </div>
                  {categories.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`py-1.5 px-4 rounded-full border text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                            selectedCategory === cat
                              ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-background-primary)]'
                              : 'border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                          }`}
                        >
                          {cat === 'todos' ? 'Ver todo' : cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Grid de todos los productos (2 cols móvil, 3 cols desktop) */}
              <div className="max-w-[1180px] mx-auto">
                {filteredModalProducts.length > 0 ? (
                  <div className="catalog-grid grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 pb-12">
                    {filteredModalProducts.map((prod) => (
                      <Link 
                        key={prod.id} 
                        to={`/producto/${prod.slug}`} 
                        onClick={() => {
                          setCatalogModalOpen(false);
                          handleProductClick();
                        }}
                        className="block h-full"
                      >
                        <ProductoCard producto={prod} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 text-[var(--color-text-tertiary)]">
                    No se encontraron arreglos para esta búsqueda.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
