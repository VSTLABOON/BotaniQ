// ─── HERO GLASSMORPHIC — Variante Dark con Liquid Glass ──────────
// Estilo: Fondo oscuro, video boomerang, efectos de vidrio líquido,
// parallax sutil. Para florerías con estética luxury/moderna.
//
// Configuración dinámica desde tenant.secciones.hero:
//   - titulo, titulo_italic, subtitulo
//   - video_url (URL del video de fondo)
//   - imagen_fondo (fallback si no hay video)
//   - trust_bar_1
//
// NOTA: No usa GSAP para evitar agregar dependencias. El parallax
// se logra con CSS transform + onMouseMove nativo.
// ────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTenant } from '../../context/TenantContext.tsx';
import { motion } from 'framer-motion';

// ── Video Boomerang simplificado (loop con fade, sin frame capture) ──
function BoomerangVideo({ src, fallbackImage }) {
  const videoRef = useRef(null);
  const [opacity, setOpacity] = useState(0);
  const [hasError, setHasError] = useState(false);
  const rafRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const FADE_DURATION = 0.6;

    const monitor = () => {
      if (!video.duration || video.paused) {
        rafRef.current = requestAnimationFrame(monitor);
        return;
      }

      const t = video.currentTime;
      const d = video.duration;
      const remaining = d - t;

      if (t < FADE_DURATION) setOpacity(t / FADE_DURATION);
      else if (remaining < FADE_DURATION) setOpacity(Math.max(0, remaining / FADE_DURATION));
      else setOpacity(1);

      rafRef.current = requestAnimationFrame(monitor);
    };

    const onEnded = () => {
      setOpacity(0);
      setTimeout(() => { video.currentTime = 0; video.play().catch(() => {}); }, 120);
    };

    const onReady = () => {
      video.play().catch(() => {});
      rafRef.current = requestAnimationFrame(monitor);
    };

    const onError = (e) => {
      console.error('[BoomerangVideo] Video failed to load:', e);
      setHasError(true);
    };

    video.addEventListener('ended', onEnded);
    video.addEventListener('canplay', onReady);
    video.addEventListener('error', onError);
    if (video.readyState >= 3) onReady();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('error', onError);
    };
  }, [src]);

  if (!src || hasError) {
    return fallbackImage ? (
      <img src={fallbackImage} alt="" className="w-full h-full object-cover" />
    ) : (
      <div className="w-full h-full bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#1a0a15]" />
    );
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
      style={{ opacity, transition: 'opacity 0.2s ease-out' }}
    />
  );
}

// ── Liquid Glass CSS (inyectado dinámicamente) ───────────────────
const GLASS_STYLES = `
  .liquid-glass-hero {
    background: rgba(255,255,255,0.03);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: inset 0 1px 1px rgba(255,255,255,0.1), 0 4px 24px rgba(0,0,0,0.2);
    position: relative;
    overflow: hidden;
  }
  .liquid-glass-hero::before {
    content: "";
    position: absolute; inset: 0;
    border-radius: inherit;
    padding: 1.2px;
    background: linear-gradient(180deg,
      rgba(255,255,255,0.35) 0%,
      rgba(255,255,255,0.08) 30%,
      rgba(255,255,255,0) 50%,
      rgba(255,255,255,0.08) 70%,
      rgba(255,255,255,0.35) 100%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }
  .liquid-glass-cta {
    background: rgba(255,255,255,0.04);
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 0 0 0 rgba(255,255,255,0), inset 0 1px 1px rgba(255,255,255,0.15);
    transition: all 0.2s ease-out;
  }
  .liquid-glass-cta:hover {
    box-shadow: 0 0 24px 4px rgba(255,255,255,0.08), inset 0 1px 1px rgba(255,255,255,0.2);
    transform: scale(1.03);
  }
`;

// ── Componente Principal ─────────────────────────────────────────
export default function HeroGlassmorphic() {
  const { tenant } = useTenant();
  const hero = tenant.secciones?.hero || {};
  const bgRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  // Inyectar font + estilos glass
  useEffect(() => {
    setMounted(true);

    // Font
    const fontId = 'hero-glass-font';
    if (!document.getElementById(fontId)) {
      const link = document.createElement('link');
      link.id = fontId;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Barlow:wght@300;400;500;600&display=swap';
      document.head.appendChild(link);
    }

    // Glass styles
    const styleId = 'hero-glass-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = GLASS_STYLES;
      document.head.appendChild(style);
    }
  }, []);

  // Parallax sutil con mouse
  const handleMouseMove = useCallback((e) => {
    if (!bgRef.current) return;
    const strength = 15;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const x = ((e.clientX - cx) / cx) * strength;
    const y = ((e.clientY - cy) / cy) * strength;
    bgRef.current.style.transform = `scale(1.08) translate(${x}px, ${y}px)`;
  }, []);

  return (
    <section
      id="hero"
      aria-label="Inicio"
      className="relative min-h-[100svh] w-full overflow-hidden"
      style={{ backgroundColor: '#000000' }}
      onMouseMove={handleMouseMove}
    >
      {/* ── Video Background + Parallax ────────────────────────── */}
      <div
        ref={bgRef}
        className="absolute inset-0 w-full h-full z-0 origin-center overflow-hidden"
        style={{ transform: 'scale(1.08)', willChange: 'transform', transition: 'transform 0.15s ease-out' }}
      >
        <BoomerangVideo
          src={hero.video_url || ''}
          fallbackImage={hero.imagen_fondo || ''}
        />
        {/* Dark overlays to protect text contrast on bright videos */}
        <div className="absolute inset-0 bg-black/45 z-[1] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 z-[2] pointer-events-none" />
      </div>

      {/* ── Title (Centrado arriba) ────────────────────────────── */}
      <div
        className={`absolute left-0 right-0 z-20 w-full px-4 transition-all duration-1000 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
        style={{ top: '126px' }}
      >
        <h1
          className="select-none text-center text-white"
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: 'italic',
            fontSize: 'clamp(4rem, 16vw, 18rem)',
            lineHeight: 0.92,
            letterSpacing: '-0.02em',
          }}
        >
          {tenant.nombre}
        </h1>
      </div>

      {/* ── Bottom Content Row ─────────────────────────────────── */}
      <div
        className={`absolute bottom-12 left-0 right-0 px-6 md:px-10 flex flex-col md:flex-row items-end justify-between z-20 gap-6 transition-all duration-1000 delay-300 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        {/* Left description */}
        <p
          className="text-sm text-white/70 max-w-[240px] leading-relaxed hidden md:block"
          style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300 }}
        >
          {hero.subtitulo || `Envíos a domicilio en toda el ${tenant.area_metropolitana}. Flores frescas, entregadas a tiempo.`}
        </p>

        {/* Center CTAs */}
        <div className="flex items-center gap-3 md:absolute md:left-1/2 md:-translate-x-1/2 md:bottom-0">
          <a
            href="#catalogo"
            className="group relative overflow-hidden text-sm font-medium rounded-full px-6 py-3 active:scale-[0.97] transition-all duration-200"
            style={{
              backgroundColor: '#FFFFFF',
              color: '#000000',
              fontFamily: "'Barlow', sans-serif",
              fontWeight: 500,
              boxShadow: '0 0 0 0 rgba(255,255,255,0)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 24px 4px rgba(255,255,255,0.25)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 0 0 rgba(255,255,255,0)'; }}
          >
            <span className="relative z-10">Ver catálogo</span>
          </a>
          <a
            href={tenant.wa_base || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="liquid-glass-cta text-white text-sm font-medium rounded-full px-6 py-3 active:scale-[0.97]"
            style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 500 }}
          >
            WhatsApp
          </a>
        </div>

        {/* Right description */}
        <p
          className="text-sm text-white/70 max-w-[240px] leading-relaxed text-right hidden md:block"
          style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300 }}
        >
          {hero.trust_bar_1 || 'Entrega express en 3 horas'} · {tenant.ciudad}
        </p>
      </div>

      {/* ── Mobile bottom info ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="md:hidden absolute bottom-4 left-0 right-0 z-20 text-center"
      >
        <p
          className="text-xs text-white/40"
          style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300 }}
        >
          {hero.trust_bar_1 || 'Entrega express'} · {tenant.ciudad}
        </p>
      </motion.div>
    </section>
  );
}
