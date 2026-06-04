import { useEffect, useRef, useState } from 'react';
import { useTenant } from '../../context/TenantContext.tsx';
import { logger } from '../../lib/logger';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export function Cursor() {
  const curRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let mouseX = 0, mouseY = 0;
    let ringX = 0, ringY = 0;

    const handleMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (curRef.current) {
        curRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      }
    };

    const animateRing = () => {
      ringX += (mouseX - ringX) * 0.15;
      ringY += (mouseY - ringY) * 0.15;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      }
      requestAnimationFrame(animateRing);
    };

    window.addEventListener('mousemove', handleMouseMove);
    const rafId = requestAnimationFrame(animateRing);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      <div 
        ref={curRef} 
        className="fixed top-0 left-0 w-[6px] h-[6px] bg-rosa rounded-full pointer-events-none z-[9999] -ml-[3px] -mt-[3px] hidden md:block" 
        aria-hidden="true" 
      />
      <div 
        ref={ringRef} 
        className="fixed top-0 left-0 w-8 h-8 border border-rosa/60 rounded-full pointer-events-none z-[9998] -ml-4 -mt-4 transition-opacity duration-150 hidden md:block mix-blend-screen" 
        aria-hidden="true" 
      />
    </>
  );
}

export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPx = document.documentElement.scrollTop;
      const winHeightPx = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (scrollPx / winHeightPx) * 100;
      setProgress(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div 
      className="fixed top-0 left-0 h-[3px] bg-rosa z-[10000] transition-all duration-150 ease-out origin-left" 
      style={{ width: `${progress}%` }}
      role="progressbar" 
      aria-hidden="true"
    />
  );
}

export function CountdownBanner() {
  const { tenant } = useTenant();
  const [timeLeft, setTimeLeft] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [productAvailable, setProductAvailable] = useState(true);
  const bannerRef = useRef(null);

  const evento = tenant?.evento;

  useEffect(() => {
    if (!evento || !evento.activo || !evento.producto || !tenant?.id) {
      setProductAvailable(true);
      return;
    }

    let active = true;
    async function verifyProduct() {
      try {
        const { data, error } = await supabase
          .from('productos')
          .select('id, disponible')
          .eq('tienda_id', tenant.id)
          .or(`slug.eq.${evento.producto},id.eq.${evento.producto}`)
          .maybeSingle();

        if (error) throw error;
        if (active) {
          setProductAvailable(!!(data && data.disponible));
        }
      } catch (err) {
        logger.error('Error verifying event banner product availability', err);
        if (active) {
          setProductAvailable(false);
        }
      }
    }
    verifyProduct();
    return () => { active = false; };
  }, [evento, tenant?.id]);

  useEffect(() => {
    // Si no hay evento activo, no mostrar el banner
    if (!evento || !evento.activo || !productAvailable) {
      document.documentElement.style.setProperty('--cd-height', '0px');
      setIsVisible(false);
      return;
    }

    const fecha = evento.fecha_fin;
    logger.info('[EventBanner] fecha raw:', fecha);

    // Validar que la fecha existe y no es un string vacío
    if (!fecha || typeof fecha !== 'string' || fecha.trim() === '') {
      document.documentElement.style.setProperty('--cd-height', '0px');
      return;
    }

    // datetime-local produce "YYYY-MM-DDTHH:mm" sin timezone.
    // Si no tiene zona horaria (Z, +, -), tratarla como hora local.
    const normalizedFecha = (!fecha.includes('Z') && !fecha.includes('+') && !/T\d{2}:\d{2}.*-/.test(fecha))
      ? fecha  // new Date() ya trata strings sin TZ como local en formato datetime-local
      : fecha;

    const fechaObj = new Date(normalizedFecha);
    const esValida = !isNaN(fechaObj.getTime()) && fechaObj > new Date();

    if (!esValida) {
      document.documentElement.style.setProperty('--cd-height', '0px');
      return;
    }

    if (sessionStorage.getItem('cd-closed')) {
      document.documentElement.style.setProperty('--cd-height', '0px');
      return;
    }
    setIsVisible(true);

    const targetDate = fechaObj;
    const pad = n => String(n).padStart(2, '0');

    const tick = () => {
      const diff = targetDate - Date.now();
      if (diff <= 0) {
        setTimeLeft(null); // Fecha límite superada
        setIsVisible(false);
        document.documentElement.style.setProperty('--cd-height', '0px');
        return;
      }
      setTimeLeft({
        d: pad(Math.floor(diff / 86400000)),
        h: pad(Math.floor((diff % 86400000) / 3600000)),
        m: pad(Math.floor((diff % 3600000) / 60000)),
        s: pad(Math.floor((diff % 60000) / 1000))
      });
    };

    tick();
    const timer = setInterval(tick, 1000);
    
    return () => clearInterval(timer);
  }, [evento]);

  useEffect(() => {
    if (isVisible && bannerRef.current && productAvailable) {
      const adjustOffset = () => {
        document.documentElement.style.setProperty('--cd-height', `${bannerRef.current.offsetHeight}px`);
      };
      // Short delay to ensure DOM has rendered styles
      setTimeout(adjustOffset, 50);
      window.addEventListener('resize', adjustOffset);
      return () => window.removeEventListener('resize', adjustOffset);
    } else {
      document.documentElement.style.setProperty('--cd-height', '0px');
    }
  }, [isVisible, productAvailable]);

  if (!isVisible || !timeLeft || !productAvailable) return null;

  const handleClose = () => {
    setIsVisible(false);
    sessionStorage.setItem('cd-closed', '1');
  };

  return (
    <div 
      ref={bannerRef}
      className="fixed top-0 left-0 right-0 z-[1000] bg-gradient-to-r from-verde-dark via-rosa to-dorado text-[var(--color-background-primary)] flex items-center justify-center py-2 pr-12 pl-4 animate-fade-in shadow-md"
    >
      <div className="flex items-center gap-4 flex-wrap justify-center">
        <div className="flex items-center gap-1.5 text-[0.72rem] font-semibold tracking-[0.1em] uppercase whitespace-nowrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {evento?.titulo || '¡Evento Especial!'}
        </div>
        <div className="flex items-center gap-1">
          {[
            { label: 'días', val: timeLeft.d },
            { label: 'hrs', val: timeLeft.h },
            { label: 'min', val: timeLeft.m },
            { label: 'seg', val: timeLeft.s }
          ].map((u, i) => (
            <div key={u.label} className="flex items-center gap-1">
              <div className="flex flex-col items-center bg-[var(--color-background-primary)]/20 rounded-[6px] px-2 py-1 min-w-[38px]">
                <span className="font-display text-[1.1rem] font-bold leading-none tracking-[0.04em]">{u.val}</span>
                <small className="text-[0.5rem] tracking-[0.12em] uppercase opacity-75 mt-0.5">{u.label}</small>
              </div>
              {i < 3 && <span className="font-bold opacity-50 text-base">:</span>}
            </div>
          ))}
        </div>
      </div>
      <button onClick={handleClose} aria-label="Cerrar banner" className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--color-background-primary)]/20 text-[var(--color-background-primary)] flex items-center justify-center transition-colors hover:bg-[var(--color-background-primary)]/35">
        <X className="w-3 h-3 text-[var(--color-background-primary)]" />
      </button>
    </div>
  );
}

export default function GlobalFeatures() {
  return (
    <>
      <ScrollProgress />
      <Cursor />
      <CountdownBanner />
    </>
  );
}
