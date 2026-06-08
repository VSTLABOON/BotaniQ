import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { logger } from '../../lib/logger';
import { useTenant } from '../../context/TenantContext.tsx';
import { cleanInstagramUsername } from '../../utils/formatters';

/**
 * InstagramFeed — Componente que consume instagram_cache de Supabase.
 *
 * Flujo multi-tenant:
 * 1. Si recibe `tiendaId` directo, lo usa.
 * 2. Si recibe `slug`, resuelve slug → tienda.id vía tabla `tiendas`.
 * 3. Consulta `instagram_cache` filtrando por ese tienda_id.
 *
 * Props:
 * @param {string} [tiendaId] - UUID directo de la tienda
 * @param {string} [slug]     - Slug de la tienda (alternativa a tiendaId)
 * @param {number} [limit=8]  - Cantidad de fotos a mostrar
 */
export default function InstagramFeed({ tiendaId, slug, limit = 8 }) {
  const { tenant } = useTenant();
  const igUser = cleanInstagramUsername(tenant?.redes_sociales?.instagram || '');

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!igUser) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function fetchFeed() {
      setLoading(true);
      setError(null);

      try {
        // ── Resolver tienda_id ──────────────────────────────
        let resolvedId = tiendaId;

        if (!resolvedId && slug) {
          const { data: tienda, error: tErr } = await supabase
            .from('tiendas')
            .select('id')
            .eq('slug', slug)
            .single();

          if (tErr || !tienda) {
            throw new Error(`Tienda "${slug}" no encontrada`);
          }
          resolvedId = tienda.id;
        }

        if (!resolvedId) {
          throw new Error('Se requiere tiendaId o slug');
        }

        // ── Consultar cache ─────────────────────────────────
        const { data, error: cacheErr } = await supabase
          .from('instagram_cache')
          .select('ig_post_id, permalink, media_type, thumbnail_url, media_url, caption, timestamp')
          .eq('tienda_id', resolvedId)
          .order('timestamp', { ascending: false })
          .limit(limit);

        if (cacheErr) {
          // Si la tabla no existe aún, simplemente no renderizamos el feed
          if (cacheErr.code === 'PGRST205' || cacheErr.message?.includes('schema cache')) {
            if (!cancelled) { setPosts([]); }
            return;
          }
          throw cacheErr;
        }

        if (!cancelled) {
          setPosts(data || []);
        }
      } catch (err) {
        if (!cancelled) {
          logger.warn(`[InstagramFeed] ${err.message}`);
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchFeed();
    return () => { cancelled = true; };
  }, [tiendaId, slug, limit]);

  if (!igUser) return null;

  // ── Estado vacío: sin conexión o sin posts ────────────────
  if (!loading && posts.length === 0) {
    return null; // No renderizar nada si no hay feed configurado
  }

  return (
    <section id="instagram" className="bg-negro pt-24 px-6 pb-20">
      {/* Header */}
      <div className="text-center mb-12 animate-fade-up">
        <p className="inline-flex items-center gap-2 text-[0.65rem] tracking-[0.28em] uppercase text-rosa-light font-body font-medium mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          @{igUser}
        </p>
        <h2 className="font-display text-[clamp(2rem,5vw,3.4rem)] leading-[1.05] font-bold text-[var(--color-background-primary)] mb-2">
          Síguenos en <em className="italic text-rosa not-italic">Instagram</em>
        </h2>
        <p className="text-[0.86rem] text-[var(--color-background-primary)]/40 font-light">
          Las entregas más recientes directo desde nuestro feed
        </p>
      </div>

      {/* Grid de fotos */}
      <div className="max-w-[1200px] mx-auto">
        {loading ? (
          /* Skeleton loader */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[...Array(limit)].map((_, i) => (
              <div key={i} className="aspect-square rounded-[12px] bg-[var(--color-background-primary)]/5 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          /* Error state */
          <div className="text-center py-16">
            <p className="text-[var(--color-background-primary)]/30 text-[0.85rem]">
              No se pudo cargar el feed de Instagram.
            </p>
          </div>
        ) : (
          /* Feed real */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {posts.map((post) => (
              <a
                key={post.ig_post_id}
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-square rounded-[12px] overflow-hidden bg-negro-soft"
              >
                <img
                  src={post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url}
                  alt={post.caption ? post.caption.slice(0, 80) : 'Post de Instagram'}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-negro/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 p-4">
                  {/* Video indicator */}
                  {post.media_type === 'VIDEO' && (
                    <svg viewBox="0 0 24 24" fill="white" width="28" height="28" className="mb-1" aria-hidden="true">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}

                  {/* Carousel indicator */}
                  {post.media_type === 'CAROUSEL_ALBUM' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" width="22" height="22" className="mb-1" aria-hidden="true">
                      <rect x="2" y="2" width="16" height="16" rx="2" />
                      <path d="M6 22h12a4 4 0 004-4V6" />
                    </svg>
                  )}

                  {/* Caption preview */}
                  {post.caption && (
                    <p className="text-[var(--color-background-primary)] text-[0.7rem] leading-[1.5] text-center line-clamp-3 max-w-[180px]">
                      {post.caption}
                    </p>
                  )}

                  {/* IG icon */}
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" width="16" height="16" className="opacity-60" aria-hidden="true">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <circle cx="12" cy="12" r="5" />
                    <circle cx="17.5" cy="6.5" r="1.5" fill="white" stroke="none" />
                  </svg>
                </div>

                {/* Media type badge */}
                {post.media_type !== 'IMAGE' && (
                  <div className="absolute top-3 right-3 bg-negro/60 backdrop-blur-sm rounded-full p-1.5">
                    {post.media_type === 'VIDEO' ? (
                      <svg viewBox="0 0 24 24" fill="white" width="12" height="12"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="12" height="12"><rect x="2" y="2" width="16" height="16" rx="2" /><path d="M6 22h12a4 4 0 004-4V6" /></svg>
                    )}
                  </div>
                )}
              </a>
            ))}
          </div>
        )}

        {/* CTA */}
        {!loading && posts.length > 0 && (
          <div className="text-center mt-10 animate-fade-up">
            <a
              href={`https://instagram.com/${igUser}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-transparent border border-rosa/40 text-rosa text-[0.8rem] font-bold tracking-[0.1em] uppercase py-3 px-8 rounded-full transition-all duration-300 ease-spring hover:bg-rosa hover:text-[var(--color-background-primary)] hover:scale-105 hover:border-rosa"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
              </svg>
              Seguir en Instagram
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
