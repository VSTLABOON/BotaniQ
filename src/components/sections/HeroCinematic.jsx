// ─── HERO CINEMATIC — Variante de Hero con Video Background ─────
// Estilo: Fondo blanco/limpio, tipografía serif editorial, video en loop
// con fade suave. Pensado para florerías con estética elegante/minimalista.
//
// Configuración dinámica desde tenant.secciones.hero:
//   - titulo, titulo_italic, subtitulo
//   - video_url (URL del video de fondo)
//   - imagen_fondo (fallback si no hay video)
//   - trust_bar_1
// ────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import { useTenant } from '../../context/TenantContext.tsx';
import { motion } from 'framer-motion';

// ── Componente de Video con Loop suave (fade in/out) ────────────
function SmoothLoopVideo({ src, fallbackImage }) {
  const videoRef = useRef(null);
  const [opacity, setOpacity] = useState(0);
  const [hasError, setHasError] = useState(false);
  const rafRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const FADE_DURATION = 0.5; // segundos

    const monitorPlayback = () => {
      if (!video.duration || video.paused) {
        rafRef.current = requestAnimationFrame(monitorPlayback);
        return;
      }

      const currentTime = video.currentTime;
      const duration = video.duration;
      const timeLeft = duration - currentTime;

      // Fade in al inicio
      if (currentTime < FADE_DURATION) {
        setOpacity(currentTime / FADE_DURATION);
      }
      // Fade out al final
      else if (timeLeft < FADE_DURATION) {
        setOpacity(Math.max(0, timeLeft / FADE_DURATION));
      }
      // Visible normal
      else {
        setOpacity(1);
      }

      rafRef.current = requestAnimationFrame(monitorPlayback);
    };

    const handleEnded = () => {
      setOpacity(0);
      setTimeout(() => {
        video.currentTime = 0;
        video.play().catch(() => {});
      }, 100);
    };

    const handleCanPlay = () => {
      video.play().catch(() => {});
      rafRef.current = requestAnimationFrame(monitorPlayback);
    };

    const handleError = (e) => {
      console.error('[SmoothLoopVideo] Video failed to load:', e);
      setHasError(true);
    };

    video.addEventListener('ended', handleEnded);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    if (video.readyState >= 3) {
      handleCanPlay();
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [src]);

  if (!src || hasError) {
    return fallbackImage ? (
      <img
        src={fallbackImage}
        alt="Hero background"
        className="w-full h-full object-cover"
      />
    ) : null;
  }

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      playsInline
      autoPlay
      loop
      preload="auto"
      className="w-full h-full object-cover"
      style={{ opacity, transition: 'opacity 0.15s ease-out' }}
    />
  );
}

// ── Componente Principal ─────────────────────────────────────────
export default function HeroCinematic() {
  const { tenant } = useTenant();
  const hero = tenant.secciones?.hero || {};

  // Tipografía: carga la fuente Instrument Serif solo cuando se use este hero
  useEffect(() => {
    const id = 'hero-cinematic-font';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  return (
    <section
      id="hero"
      aria-label="Inicio"
      className="relative min-h-[100svh] w-full overflow-hidden flex flex-col"
      style={{ backgroundColor: '#FFFFFF' }}
    >
      {/* ── Video Background Layer ─────────────────────────────── */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <SmoothLoopVideo
          src={hero.video_url || ''}
          fallbackImage={hero.imagen_fondo || ''}
        />
        {/* Gradient overlays + wash-out overlay to protect text contrast */}
        <div className="absolute inset-0 bg-white/40 pointer-events-none z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/10 to-white pointer-events-none z-[2]" />
      </div>

      {/* ── Hero Content ───────────────────────────────────────── */}
      <div
        className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6"
        style={{ paddingTop: 'calc(8rem - 75px)', paddingBottom: '10rem' }}
      >
        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="max-w-[900px]"
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 'clamp(3rem, 8vw, 6.5rem)',
            lineHeight: 0.95,
            letterSpacing: '-2.46px',
            fontWeight: 400,
            color: '#000000',
          }}
        >
          {hero.titulo || 'Flores que'}{' '}
          <em style={{ color: '#6F6F6F', fontStyle: 'italic' }}>
            {hero.titulo_italic || 'enamoran'}
          </em>
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          className="max-w-[600px] mt-8"
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 'clamp(1rem, 2vw, 1.125rem)',
            lineHeight: 1.6,
            color: '#6F6F6F',
          }}
        >
          {hero.subtitulo || `Llegamos a toda el ${tenant.area_metropolitana} con arreglos frescos y a tiempo.`}
        </motion.p>

        {/* CTA Button */}
        <motion.a
          href="#catalogo"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="mt-12 inline-flex items-center"
          style={{
            backgroundColor: '#000000',
            color: '#FFFFFF',
            borderRadius: '9999px',
            padding: '1.25rem 3.5rem',
            fontSize: '1rem',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 500,
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          Ver catálogo
        </motion.a>
      </div>

      {/* ── Trust Bar ──────────────────────────────────────────── */}
      <div
        className="relative z-10 w-full border-t px-6 py-6"
        style={{ borderColor: 'rgba(0,0,0,0.06)', backgroundColor: '#FFFFFF' }}
      >
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {[
            {
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6" aria-hidden="true">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              ),
              title: hero.trust_bar_1 || 'Entrega en 3 horas',
              desc: 'Pedidos express todos los días',
            },
            {
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              ),
              title: 'Pago seguro',
              desc: 'Tarjeta, SPEI o efectivo',
            },
            {
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              ),
              title: 'Tarjeta personalizada',
              desc: 'Incluida con cada arreglo',
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="flex items-center gap-3"
            >
              <span style={{ color: '#000000' }}>{item.icon}</span>
              <div>
                <strong className="block text-sm font-semibold" style={{ color: '#000000' }}>{item.title}</strong>
                <span className="text-xs" style={{ color: '#6F6F6F' }}>{item.desc}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
