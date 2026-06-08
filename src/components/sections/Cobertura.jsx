import { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext.tsx';
import { LIMITS } from '../../lib/constants.ts';

export default function Cobertura() {
  const { tenant } = useTenant();
  const colonias = tenant.colonias;
  const [embedUrl, setEmbedUrl] = useState('');

  useEffect(() => {
    let active = true;
    async function resolveMapsUrl() {
      let rawUrl = tenant.mapa_url || '';
      if (!rawUrl) return;

      // 1. Si ya es una URL de embed, la usamos directo
      if (rawUrl.includes('/embed') || rawUrl.includes('output=embed')) {
        if (active) setEmbedUrl(rawUrl);
        return;
      }

      // 2. Si es un enlace acortado, lo resolvemos usando un proxy CORS libre
      if (rawUrl.includes('maps.app.goo.gl') || rawUrl.includes('goo.gl/maps')) {
        try {
          const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(rawUrl)}`);
          const json = await res.json();
          if (json.status && json.status.url) {
            rawUrl = json.status.url;
          }
        } catch (err) {
          console.error('[Cobertura] Error resolving short maps URL:', err);
        }
      }

      // 3. Extraer el nombre del lugar / dirección de la URL larga
      const placeMatch = rawUrl.match(/\/place\/([^/@\s]+)/);
      if (placeMatch && active) {
        setEmbedUrl(`https://maps.google.com/maps?q=${placeMatch[1]}&output=embed`);
        return;
      }

      // 4. Extraer coordenadas si no hay nombre del lugar
      const coordMatch = rawUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (coordMatch && active) {
        setEmbedUrl(`https://maps.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}&output=embed`);
        return;
      }

      // 5. Fallback general: intentar incrustar como query de búsqueda
      if (active) {
        setEmbedUrl(`https://maps.google.com/maps?q=${encodeURIComponent(rawUrl)}&output=embed`);
      }
    }

    resolveMapsUrl();
    return () => { active = false; };
  }, [tenant.mapa_url]);

  return (
    <section id="cobertura" className="bg-crema pt-[7rem] px-6 pb-[7rem]">
      <div className="max-w-[1180px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
        <div className="flex flex-col">
          <p className="inline-flex items-center gap-[0.45rem] text-[0.65rem] tracking-[0.28em] uppercase text-verde font-body font-medium mb-[0.9rem]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="11" height="11" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Zona de cobertura
          </p>
          <h2 className="font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] font-bold text-texto mb-6">
            Llegamos <em className="italic text-rosa not-italic">a tu puerta</em>
          </h2>
          <p className="text-[0.9rem] leading-[1.75] text-texto-muted mb-[1.6rem]">
            Costo de envío <strong>${tenant.envio_costo} MXN</strong> en toda la zona metropolitana.<br/>
            Pedidos express en {LIMITS.EXPRESS_DELIVERY_TEXT}.
          </p>
          
          <div className="flex flex-wrap gap-2 mt-4">
            {colonias.map(c => (
              <span key={c} className="bg-verde/10 text-verde border border-verde/20 px-3 py-1.5 rounded-full text-[0.75rem] tracking-[0.04em] font-body transition-colors hover:bg-verde/20">
                {c}
              </span>
            ))}
          </div>
          
          <p className="text-[0.78rem] mt-4 text-texto-muted/70">
            ¿Tu colonia no aparece? Consúltanos por WhatsApp.
          </p>
        </div>
        
        <div className="rounded-[18px] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.12)] h-[400px] border border-black/5 bg-crema-dark">
          {embedUrl ? (
            <iframe 
              src={embedUrl}
              width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={`Mapa área de cobertura ${tenant.ciudad}`}>
            </iframe>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-texto-muted/50 text-xs">
              Cargando mapa...
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
