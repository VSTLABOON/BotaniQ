// ─── ONBOARDING PAGE ────────────────────────────────────────────
// Flujo post-registro para nuevos dueños de florería.
// Paso 1: Datos personales y de la florería
// Paso 2: Confirmación del subdominio y resumen
// Paso 3: Redirección a pago (Stripe) o directo al panel
//
// Los datos se guardan en Supabase antes de la redirección,
// para que al completar el pago la tienda ya exista.
// ────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { getLocaleAndCurrency } from '../../lib/stripeHelpers';
import { getSubdomainUrl, getPlatformDomain } from '../../lib/domain';
import {
  User, Store, Globe, ArrowRight, ArrowLeft,
  Loader2, CheckCircle2, Sparkles, AlertCircle, Flower, MapPin, LogOut, XCircle
} from 'lucide-react';
import { createTiendaProfile, assignUserRole, createTrialSubscription } from '../../services/onboardingService';

// ── Utilidades ──────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

const PLAN_LABELS: Record<string, { name: string; color: string; accent: string }> = {
  gratis:  { name: 'BotaniQ Inicio (Prueba Gratis)', color: 'from-emerald-500/30 to-teal-500/10', accent: 'text-emerald-300 font-bold' },
  basico:  { name: 'BotaniQ Esencia',  color: 'from-gray-500/30 to-gray-400/10',   accent: 'text-rose-300' },
  pro:     { name: 'BotaniQ Alquimia',  color: 'from-violet-500/30 to-fuchsia-500/10', accent: 'text-[#D94F6E] font-bold' },
  premium: { name: 'BotaniQ Edén', color: 'from-amber-500/30 to-orange-500/10',  accent: 'text-purple-400 font-bold' },
};

const CIUDADES = [
  'Monterrey', 'Guadalajara', 'Ciudad de México', 'Puebla', 'Querétaro',
  'Mérida', 'León', 'Tijuana', 'Cancún', 'Otra',
];

function CrossfadeVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let animFrame: number;
    
    const fadeIn = () => {
      let start: number | null = null;
      const duration = 500;
      
      const animate = (timestamp: number) => {
        if (!start) start = timestamp;
        const elapsed = timestamp - start;
        const progress = Math.min(elapsed / duration, 1);
        setOpacity(progress);
        if (progress < 1) {
          animFrame = requestAnimationFrame(animate);
        }
      };
      animFrame = requestAnimationFrame(animate);
    };

    const fadeOut = () => {
      let start: number | null = null;
      const duration = 500;
      const initialOpacity = video.style.opacity ? parseFloat(video.style.opacity) : 1;
      
      const animate = (timestamp: number) => {
        if (!start) start = timestamp;
        const elapsed = timestamp - start;
        const progress = Math.min(elapsed / duration, 1);
        setOpacity(initialOpacity * (1 - progress));
        if (progress < 1) {
          animFrame = requestAnimationFrame(animate);
        }
      };
      animFrame = requestAnimationFrame(animate);
    };

    const handleCanPlay = () => {
      video.play().catch(() => {});
      fadeIn();
    };

    const handleTimeUpdate = () => {
      const remaining = video.duration - video.currentTime;
      if (remaining <= 0.55 && opacity === 1) {
        fadeOut();
      }
    };

    const handleEnded = () => {
      setOpacity(0);
      setTimeout(() => {
        if (video) {
          video.currentTime = 0;
          video.play().catch(() => {});
          fadeIn();
        }
      }, 100);
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      cancelAnimationFrame(animFrame);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      src={src}
      className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none transition-opacity duration-300"
      style={{ opacity }}
      muted
      autoPlay
      playsInline
      preload="auto"
    />
  );
}

// ── Componente Principal ────────────────────────────────────────

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, user, profile } = useAuth();

  const [currentPlan, setCurrentPlan] = useState<string>(() => {
    return searchParams.get('plan') || 'gratis';
  });
  const planInfo = useMemo(() => PLAN_LABELS[currentPlan] || PLAN_LABELS.gratis, [currentPlan]);

  // Steps
  const [step, setStep] = useState(1);
  const totalSteps = 2;

  // Form state
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [nombreFloreria, setNombreFloreria] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [direccion, setDireccion] = useState('');

  // Derived / Editable Slug
  const [slugManual, setSlugManual] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  // validation state
  const [triedStep1, setTriedStep1] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // UI / Guard
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  // Handle mobile resize
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Pre-fill name from auth metadata
  useEffect(() => {
    if (user?.user_metadata?.nombre_completo) {
      setNombreCompleto(user.user_metadata.nombre_completo);
    } else if (user?.user_metadata?.full_name) {
      setNombreCompleto(user.user_metadata.full_name);
    }
  }, [user]);

  // Redirect if not logged in
  useEffect(() => {
    if (!session && !user) {
      navigate('/login', { replace: true });
    }
  }, [session, user, navigate]);

  // Guard contra re-onboarding de tienda ya configurada
  useEffect(() => {
    if (!profile) return;

    if (!profile.tienda_id) {
      setCheckingConfig(false);
      return;
    }

    const checkTiendaConfigurada = async () => {
      try {
        const { data: tienda } = await supabase
          .from('tiendas')
          .select('slug, nombre')
          .eq('id', profile.tienda_id)
          .single();

        if (tienda && tienda.nombre && tienda.nombre !== 'Mi Nueva Florería' && !tienda.slug.startsWith('tienda-')) {
          // Tienda ya configurada — redirigir al panel
          const adminUrl = getSubdomainUrl(tienda.slug, '/admin');
          window.location.href = adminUrl;
          return; // Mantener checkingConfig en true para evitar flash visual
        }
      } catch (err) {
        console.error('Error checking tienda configurada:', err);
      }
      setCheckingConfig(false);
    };

    checkTiendaConfigurada();
  }, [profile]);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Error logging out from onboarding:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sync manual slug with floreria name changes
  useEffect(() => {
    setSlugManual(slugify(nombreFloreria));
  }, [nombreFloreria]);

  // Check slug availability with debounce
  useEffect(() => {
    if (!slugManual || slugManual.length < 3) {
      setSlugAvailable(null);
      return;
    }

    setCheckingSlug(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('tiendas')
        .select('id')
        .eq('slug', slugManual)
        .maybeSingle();

      setSlugAvailable(!data);
      setCheckingSlug(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [slugManual]);

  // ── Validación por paso ───────────────────────────────────────
  const isStep1Valid = nombreCompleto.trim().length >= 2
    && nombreFloreria.trim().length >= 2
    && ciudad.trim().length > 0
    && whatsapp.trim().length >= 10
    && direccion.trim().length >= 5;

  const isStep2Valid = slugManual.length >= 3 && slugAvailable === true;

  // ── Submit final ──────────────────────────────────────────────
  const handleFinish = async (skipPayment = false) => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      let tiendaId = profile?.tienda_id;

      if (!tiendaId) {
        // Aprovisionar tienda para el usuario legacy
        const { data: newTiendaId, error: rpcError } = await supabase.rpc('provision_store_for_legacy_user');
        if (rpcError) throw rpcError;
        if (!newTiendaId) {
          throw new Error('No se pudo inicializar la tienda para tu usuario.');
        }
        tiendaId = newTiendaId;
      }

      const finalTiendaId = tiendaId as string;

      // 1. Actualizar la tienda existente en Supabase (auto-provisionada por el trigger o la RPC)
      // La seguridad se preserva al NO permitir la actualización del subscription_level desde el cliente (Fuga 1 Mitigada).
      await createTiendaProfile(finalTiendaId, {
        slug: slugManual,
        nombre: nombreFloreria.trim(),
        ciudad: ciudad,
        whatsapp: whatsapp.trim(),
        direccion: direccion.trim(),
      });

      // 2. Actualizar el perfil del usuario (nombre completo, teléfono, dirección)
      await assignUserRole(user.id, {
        nombre_completo: nombreCompleto.trim(),
        telefono: whatsapp.trim(),
        direccion: direccion.trim(),
      });

      if (skipPayment || currentPlan === 'gratis') {
        // Registrar suscripción de prueba de 14 días
        await createTrialSubscription(finalTiendaId, currentPlan);
        // Redirigir directamente al panel de administración del nuevo subdominio
        const adminUrl = getSubdomainUrl(slugManual, '/admin?registration=complete');
        
        setShowConfirmation(true);
        setTimeout(() => {
          window.location.href = adminUrl;
        }, 3000);
        return;
      }

      // 3. Redirigir al Checkout de Stripe
      const { locale, currency } = getLocaleAndCurrency();
      const successUrl = getSubdomainUrl(slugManual, `/admin?session_id={CHECKOUT_SESSION_ID}&saas_success=true`);
      const cancelUrl = getSubdomainUrl(slugManual, `/onboarding?plan=${currentPlan}&saas_cancel=true`);

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        throw new Error('Sesión de usuario no encontrada.');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-saas-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentSession.access_token}`,
          },
          body: JSON.stringify({
            plan: currentPlan,
            tenant_id: finalTiendaId,
            currency,
            locale,
            success_url: successUrl,
            cancel_url: cancelUrl
          })
        }
      );

      const resData = await response.json();
      if (!response.ok || !resData.url) {
        throw new Error(resData.error || 'No se pudo iniciar el flujo de pago con Stripe.');
      }
      window.location.href = resData.url;
    } catch (err: any) {
      if (err?.message?.includes('duplicate')) {
        setError('Ese nombre de tienda ya está registrado. Intenta con otro.');
      } else {
        setError(err?.message || 'Hubo un error actualizando tu tienda. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────

  if (!session || !profile || checkingConfig) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090b] gap-4">
        <Loader2 className="w-8 h-8 text-[#D94F6E] animate-spin" />
        <p className="text-white/60 text-sm">Verificando configuración...</p>
      </div>
    );
  }

  if (showConfirmation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090b] text-white px-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="flex flex-col items-center max-w-md gap-6"
        >
          <div className="p-4 rounded-full bg-[#D94F6E]/10 text-[#D94F6E] border border-[#D94F6E]/20">
            <CheckCircle2 className="w-16 h-16" />
          </div>
          
          <h1 className="text-3xl font-bold tracking-tight">¡Tu tienda está lista!</h1>
          
          <p className="text-sm text-white/70 leading-relaxed">
            Hemos activado tus 14 días de prueba gratuita. En un momento te llevamos a tu panel.
          </p>
          
          {/* Progress bar container */}
          <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden mt-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 3, ease: 'linear' }}
              className="h-full bg-[#D94F6E] rounded-full"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="onb-split-container">
      {/* Lado Izquierdo: Hero/Video/Branding */}
      <div className="onb-hero-side">
        <div className="absolute inset-0 z-0 overflow-hidden">
          {isDesktop && (
            <CrossfadeVideo src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent z-10 pointer-events-none" />
        </div>

        <div className="relative z-20 flex flex-col justify-between h-full w-full">
          {/* Brand Header */}
          <div className="flex items-center gap-2">
            <Flower className="w-8 h-8 text-[#D94F6E] animate-pulse" />
            <span className="font-bold text-2xl tracking-wider font-serif italic text-white">BotaniQ</span>
          </div>

          {/* Copy and benefits */}
          <div className="max-w-md my-auto">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-4xl font-bold text-white mb-8 leading-tight font-serif italic"
            >
              Estás a un paso de tu florería digital
            </motion.h2>
            
            <ul className="space-y-6">
              <motion.li 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="flex items-start gap-4"
              >
                <div className="p-2 rounded-xl bg-[#D94F6E]/15 text-[#D94F6E] mt-1">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-base">Catálogo digital profesional</h4>
                  <p className="text-sm text-white/50 mt-1">Organiza y personaliza tus productos de forma sencilla.</p>
                </div>
              </motion.li>

              <motion.li 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="flex items-start gap-4"
              >
                <div className="p-2 rounded-xl bg-[#D94F6E]/15 text-[#D94F6E] mt-1">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-base">Pedidos por WhatsApp y Web</h4>
                  <p className="text-sm text-white/50 mt-1">Recibe notificaciones automáticas y procesa ventas rápido.</p>
                </div>
              </motion.li>

              <motion.li 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="flex items-start gap-4"
              >
                <div className="p-2 rounded-xl bg-[#D94F6E]/15 text-[#D94F6E] mt-1">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-base">Dominio y Subdominio propio</h4>
                  <p className="text-sm text-white/50 mt-1">Tu marca visible con tu nombre único en la web.</p>
                </div>
              </motion.li>
            </ul>
          </div>

          {/* Footer copy */}
          <p className="text-xs text-white/40">
            BotaniQ © 2026 — Plataforma e-commerce para florerías.
          </p>
        </div>
      </div>

      {/* Lado Derecho: Formulario fijo */}
      <div className="onb-form-side">
        {/* Botón superior de Cerrar Sesión */}
        <div className="absolute top-6 right-6 z-30">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/50 hover:text-white hover:bg-white/5 transition-all border border-white/10 hover:border-white/20"
          >
            <LogOut style={{ width: 14, height: 14 }} />
            Cerrar Sesión
          </button>
        </div>

        {/* Mobile Background Video (Visible solo cuando no está el Hero) */}
        <div className="onb-mobile-bg">
          {!isDesktop && (
            <CrossfadeVideo src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4" />
          )}
          <div className="absolute inset-0 bg-black/85 z-10 pointer-events-none" />
        </div>

        <div className="onb-form-container">
          {/* Mobile Logo */}
          <div className="onb-mobile-logo">
            <Flower className="w-6 h-6 text-[#D94F6E] animate-pulse" />
            <span className="font-bold text-xl tracking-wider font-serif italic text-white">BotaniQ</span>
          </div>

          {/* Header */}
          <div className="onb-header">
            <div className="onb-header__icon">
              <Sparkles style={{ width: 20, height: 20, color: 'white' }} />
            </div>
            <div>
              <h1 className="onb-header__title">Configura tu <em className="font-serif italic text-white/80 font-normal">florería</em></h1>
              <p className="onb-header__sub">
                Plan seleccionado: <span className={planInfo.accent}>{planInfo.name}</span>
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="onb-progress">
            <div className="onb-progress__bar" style={{ width: `${(step / totalSteps) * 100}%` }} />
          </div>
          <p className="onb-step-label">Paso {step} de {totalSteps}</p>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="onb-alert"
              >
                <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Steps */}
          <div className="onb-body">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.3 }}
                  className="onb-form"
                >
                  {/* Banner de prueba gratuita */}
                  <div className="p-4 rounded-xl bg-[#ffd7db]/5 border border-[#ffd7db]/10 flex flex-col gap-1 mb-6">
                    <div className="flex items-center gap-2 text-[#D94F6E] text-xs font-bold uppercase tracking-widest">
                      <Sparkles className="w-4 h-4" />
                      Estás configurando tu prueba gratuita de 14 días de BotaniQ
                    </div>
                    <p className="text-[11px] text-white/50 pl-6">
                      Sin tarjeta de crédito. Cancela cuando quieras.
                    </p>
                  </div>

                  {/* Nombre completo */}
                  <div className="onb-field">
                    <label className="onb-label">Tu nombre completo</label>
                    <div className="onb-input-wrap">
                      <User className="onb-input-icon" />
                      <input
                        type="text"
                        value={nombreCompleto}
                        onChange={e => setNombreCompleto(e.target.value)}
                        placeholder="Ej: María García López"
                        className="onb-input"
                      />
                    </div>
                    {triedStep1 && nombreCompleto.trim().length === 0 && (
                      <span className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Ingresa tu nombre completo
                      </span>
                    )}
                  </div>

                  {/* Nombre de la florería */}
                  <div className="onb-field">
                    <label className="onb-label">Nombre de tu florería</label>
                    <div className="onb-input-wrap">
                      <Store className="onb-input-icon" />
                      <input
                        type="text"
                        value={nombreFloreria}
                        onChange={e => setNombreFloreria(e.target.value)}
                        placeholder="Ej: Flores del Corazón"
                        className="onb-input"
                      />
                    </div>
                    {triedStep1 && nombreFloreria.trim().length < 2 && (
                      <span className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> El nombre de tu florería debe tener al menos 2 caracteres
                      </span>
                    )}
                  </div>

                  {/* Ciudad */}
                  <div className="onb-field">
                    <label className="onb-label">Ciudad</label>
                    <div className="onb-input-wrap">
                      <Globe className="onb-input-icon" />
                      <select
                        value={ciudad}
                        onChange={e => setCiudad(e.target.value)}
                        className="onb-input onb-select"
                      >
                        <option value="">Selecciona tu ciudad</option>
                        {CIUDADES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    {triedStep1 && ciudad.trim().length === 0 && (
                      <span className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Selecciona tu ciudad
                      </span>
                    )}
                  </div>

                  {/* WhatsApp */}
                  <div className="onb-field">
                    <label className="onb-label">Tu WhatsApp (con lada)</label>
                    <div className="onb-input-wrap">
                      <span className="onb-input-icon" style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.3)' }}>+52</span>
                      <input
                        type="tel"
                        value={whatsapp}
                        onChange={e => setWhatsapp(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="8112345678"
                        maxLength={10}
                        className="onb-input"
                      />
                    </div>
                    {triedStep1 && whatsapp.trim().length < 10 && (
                      <span className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Ingresa un número de WhatsApp válido con 10 dígitos
                      </span>
                    )}
                  </div>

                  {/* Dirección */}
                  <div className="onb-field">
                    <label className="onb-label">Dirección física de tu tienda</label>
                    <div className="onb-input-wrap">
                      <MapPin className="onb-input-icon" />
                      <input
                        type="text"
                        value={direccion}
                        onChange={e => setDireccion(e.target.value)}
                        placeholder="Calle, número, colonia, CP"
                        className="onb-input"
                      />
                    </div>
                    {triedStep1 && direccion.trim().length < 5 && (
                      <span className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Ingresa la dirección de tu tienda
                      </span>
                    )}
                  </div>

                  {/* Plan Seleccionado */}
                  <div className="onb-field">
                    <label className="onb-label">Plan Seleccionado</label>
                    <div className="onb-input-wrap">
                      <Sparkles className="onb-input-icon animate-pulse text-[#D94F6E]" />
                      <select
                        value={currentPlan}
                        onChange={e => setCurrentPlan(e.target.value)}
                        className="onb-input onb-select"
                        style={{ paddingLeft: '2.5rem' }}
                      >
                        <option value="gratis">BotaniQ Inicio (Prueba Gratis 14 días)</option>
                        <option value="basico">BotaniQ Esencia (Básico — $400/mes)</option>
                        <option value="pro">BotaniQ Alquimia (Pro — $900/mes — Recomendado)</option>
                        <option value="premium">BotaniQ Edén (Premium — $1,300/mes)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setTriedStep1(true);
                      if (isStep1Valid) {
                        setStep(2);
                        setError(null);
                      }
                    }}
                    className="onb-btn onb-btn--primary"
                  >
                    Siguiente <ArrowRight style={{ width: 16, height: 16 }} />
                  </button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.3 }}
                  className="onb-form"
                >
                  {/* Subdominio editable */}
                  <div className="onb-field">
                    <label className="onb-label">Subdominio deseado</label>
                    <div className="onb-input-wrap">
                      <Globe className="onb-input-icon" />
                      <input
                        type="text"
                        value={slugManual}
                        onChange={e => setSlugManual(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40))}
                        placeholder="ej-mi-floreria"
                        className="onb-input"
                      />
                    </div>
                    <div className="onb-slug-status">
                      {checkingSlug && (
                        <span className="flex items-center gap-1 text-xs text-white/50">
                          <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> Verificando...
                        </span>
                      )}
                      {!checkingSlug && slugAvailable === true && (
                        <span className="onb-slug-ok"><CheckCircle2 style={{ width: 12, height: 12 }} /> ¡Disponible!</span>
                      )}
                      {!checkingSlug && slugAvailable === false && (
                        <span className="onb-slug-taken"><XCircle style={{ width: 12, height: 12 }} /> Este subdominio ya está en uso. Elige otro.</span>
                      )}
                    </div>

                    <label className="onb-label mt-2">Tu dirección web será:</label>
                    <div className="onb-subdomain-preview">
                      <Globe style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.4)' }} />
                      <span className="onb-subdomain-slug">{slugManual || '...'}</span>
                      <span className="onb-subdomain-base">.botaniq.com.mx</span>
                    </div>
                  </div>

                  {/* Resumen */}
                  <div className="onb-summary">
                    <h3 className="onb-summary__title">Resumen</h3>
                    <div className="onb-summary__row"><span>Dueño/a</span><span>{nombreCompleto}</span></div>
                    <div className="onb-summary__row"><span>Florería</span><span>{nombreFloreria}</span></div>
                    <div className="onb-summary__row"><span>Ciudad</span><span>{ciudad}</span></div>
                    <div className="onb-summary__row"><span>WhatsApp</span><span>+52 {whatsapp}</span></div>
                    <div className="onb-summary__row"><span>Dirección</span><span>{direccion}</span></div>
                    <div className="onb-summary__row"><span>Plan</span><span className={planInfo.accent}>{planInfo.name}</span></div>
                  </div>

                  {/* Aceptación de Términos y Aviso de Privacidad */}
                  <div className="onb-consent">
                    <input
                      type="checkbox"
                      id="accept-terms"
                      checked={acceptedTerms}
                      onChange={e => setAcceptedTerms(e.target.checked)}
                      className="onb-checkbox"
                    />
                    <label htmlFor="accept-terms" className="onb-consent-label">
                      Acepto los <a href="/terminos.html" target="_blank" rel="noopener noreferrer" className="onb-link">Términos y Condiciones</a>, la <a href="/devoluciones.html" target="_blank" rel="noopener noreferrer" className="onb-link">Política de Cancelación</a> y he leído el <a href="/privacidad.html" target="_blank" rel="noopener noreferrer" className="onb-link">Aviso de Privacidad</a>.
                    </label>
                  </div>

                  <div className="onb-actions">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="onb-btn onb-btn--ghost"
                    >
                      <ArrowLeft style={{ width: 16, height: 16 }} /> Atrás
                    </button>
                    <button
                      type="button"
                      disabled={!isStep2Valid || !acceptedTerms || loading}
                      onClick={() => handleFinish(currentPlan === 'gratis')}
                      className="onb-btn onb-btn--primary"
                    >
                      {loading ? (
                        <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
                      ) : currentPlan === 'gratis' ? (
                        <>Crear mi tienda <ArrowRight style={{ width: 16, height: 16 }} /></>
                      ) : (
                        <>Proceder al pago <ArrowRight style={{ width: 16, height: 16 }} /></>
                      )}
                    </button>
                  </div>

                  {currentPlan !== 'gratis' && (
                    <>
                      <button
                        type="button"
                        disabled={!isStep2Valid || !acceptedTerms || loading}
                        onClick={() => handleFinish(true)}
                        className="onb-btn-secondary w-full py-3 px-4 border border-[var(--color-border-secondary)] hover:border-[var(--color-text-secondary)] text-[var(--color-text-secondary)] hover:text-white rounded-xl text-sm font-semibold transition-all mt-4"
                      >
                        Comenzar prueba gratuita de 14 días
                      </button>
                      <p className="text-[10px] text-center text-white/40 mt-1.5">
                        Sin tarjeta de crédito. Cancela cuando quieras.
                      </p>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Scoped Styles ── */}
      <style>{`
        .onb-split-container {
          display: flex;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          position: relative;
          font-family: var(--font-body), system-ui, sans-serif;
          background: #09090b;
        }

        .onb-hero-side {
          flex: 1.2;
          position: relative;
          padding: 3.5rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-right: 1px solid rgba(255, 255, 255, 0.05);
        }

        .onb-form-side {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 3rem 4rem;
          background: rgba(9, 9, 11, 0.98);
          position: relative;
          overflow-y: auto;
          min-height: 100vh;
          box-sizing: border-box;
        }

        .onb-mobile-bg {
          display: none;
        }

        .onb-mobile-logo {
          display: none;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 2rem;
        }

        .onb-form-container {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 400px;
          margin: auto;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .onb-header {
          display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;
        }
        .onb-header__icon {
          width: 38px; height: 38px; border-radius: 10px;
          background: linear-gradient(135deg, #D94F6E, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 16px -4px rgba(217,79,110,0.4);
          flex-shrink: 0;
        }
        .onb-header__title {
          font-size: 1.35rem; font-weight: 700; color: white; margin: 0;
          letter-spacing: -0.02em;
        }
        .onb-header__sub {
          font-size: 0.75rem; color: rgba(255,255,255,0.45); margin: 0.15rem 0 0;
        }

        .onb-progress {
          width: 100%; height: 4px; border-radius: 4px;
          background: rgba(255,255,255,0.06); overflow: hidden;
          margin-bottom: 0.5rem;
        }
        .onb-progress__bar {
          height: 100%; border-radius: 4px;
          background: linear-gradient(90deg, #D94F6E, #8b5cf6);
          transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .onb-step-label {
          font-size: 0.65rem; font-weight: 700; color: rgba(255,255,255,0.3);
          text-transform: uppercase; letter-spacing: 0.1em;
          margin: 0 0 1.25rem;
        }

        .onb-alert {
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.75rem 0.9rem; border-radius: 12px;
          background: rgba(217,79,110,0.08); border: 1px solid rgba(217,79,110,0.2);
          color: #fecdd3; font-size: 0.75rem;
          margin-bottom: 1.25rem;
        }

        .onb-body { min-height: 310px; }

        .onb-form { display: flex; flex-direction: column; gap: 1rem; }

        .onb-field { display: flex; flex-direction: column; gap: 0.35rem; }

        .onb-label {
          font-size: 0.65rem; font-weight: 700; color: rgba(255,255,255,0.4);
          text-transform: uppercase; letter-spacing: 0.08em;
        }

        .onb-input-wrap {
          position: relative; display: flex; align-items: center;
        }
        .onb-input-icon {
          position: absolute; left: 0.95rem;
          width: 15px; height: 15px; color: rgba(255,255,255,0.35);
          pointer-events: none;
        }
        .onb-input {
          width: 100%; padding: 0.75rem 1rem 0.75rem 2.5rem;
          background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px; font-size: 0.875rem; color: white;
          outline: none; transition: all 0.3s; font-family: inherit;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.4);
        }
        .onb-input::placeholder { color: rgba(255,255,255,0.2); }
        .onb-input:focus {
          border-color: rgba(217, 79, 110, 0.5);
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.4), 0 0 0 3px rgba(217, 79, 110, 0.15);
        }
        .onb-select {
          appearance: none; cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='rgba(255,255,255,0.3)' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.95rem center;
          padding-right: 2.5rem;
        }
        .onb-select option { background: #09090b; color: white; }

        .onb-subdomain-preview {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.75rem 1rem; border-radius: 12px;
          background: rgba(217, 79, 110, 0.04); border: 1px solid rgba(217, 79, 110, 0.15);
        }
        .onb-subdomain-slug {
          font-size: 0.95rem; font-weight: 700; color: #D94F6E;
        }
        .onb-subdomain-base {
          font-size: 0.8rem; color: rgba(255,255,255,0.35);
        }
        .onb-slug-status {
          display: flex; align-items: center; gap: 0.35rem;
          font-size: 0.7rem; font-weight: 600; margin-top: 0.3rem;
          min-height: 1rem;
        }
        .onb-slug-ok { color: #34d399; display: flex; align-items: center; gap: 0.3rem; }
        .onb-slug-taken { color: #f87171; display: flex; align-items: center; gap: 0.3rem; }

        .onb-summary {
          background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.04);
          border-radius: 14px; padding: 1rem;
        }
        .onb-summary__title {
          font-size: 0.65rem; font-weight: 700; color: rgba(255,255,255,0.4);
          text-transform: uppercase; letter-spacing: 0.1em;
          margin: 0 0 0.65rem;
        }
        .onb-summary__row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0.4rem 0; border-bottom: 1px solid rgba(255,255,255,0.04);
          font-size: 0.8rem;
        }
        .onb-summary__row span:first-child { color: rgba(255,255,255,0.4); }
        .onb-summary__row span:last-child { color: white; font-weight: 600; }
        .onb-summary__row:last-child { border: none; }

        .onb-consent {
          display: flex;
          align-items: flex-start;
          gap: 0.65rem;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          padding: 0.5rem 0.25rem;
        }

        .onb-checkbox {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.04);
          cursor: pointer;
          accent-color: #D94F6E;
          margin-top: 0.15rem;
          outline: none;
          flex-shrink: 0;
        }

        .onb-checkbox:checked {
          background: #D94F6E;
          border-color: #D94F6E;
        }

        .onb-consent-label {
          font-size: 0.725rem;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.45;
          cursor: pointer;
          user-select: none;
        }

        .onb-link {
          color: #D94F6E;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.2s;
        }

        .onb-link:hover {
          color: #e6627f;
          text-decoration: underline;
        }

        .onb-actions { display: flex; gap: 0.75rem; margin-top: 0.5rem; }

        .onb-btn {
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          padding: 0.75rem 1.5rem; border-radius: 12px; border: none;
          font-size: 0.875rem; font-weight: 600; cursor: pointer;
          transition: all 0.3s; font-family: inherit;
        }
        .onb-btn--primary {
          flex: 1; color: white;
          background: linear-gradient(135deg, #D94F6E, #8b5cf6);
          box-shadow: 0 4px 16px -4px rgba(217,79,110,0.4), inset 0 1px 1px rgba(255,255,255,0.15);
        }
        .onb-btn--primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px -4px rgba(217,79,110,0.5), inset 0 1px 1px rgba(255,255,255,0.2);
        }
        .onb-btn--primary:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
        .onb-btn--ghost {
          color: rgba(255,255,255,0.5);
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
        }
        .onb-btn--ghost:hover { color: white; background: rgba(255,255,255,0.08); }

        .onb-btn-skip {
          width: 100%;
          margin-top: 0.75rem;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .onb-btn-skip:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.05);
          color: white;
          border-color: rgba(255, 255, 255, 0.1);
        }
        .onb-btn-skip:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .onb-btn-secondary {
          width: 100%;
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .onb-btn-secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.3);
          color: white;
        }
        .onb-btn-secondary:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .onb-input {
            font-size: 16px !important;
          }
        }

        .animate-spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 1024px) {
          .onb-hero-side {
            display: none !important;
          }
          .onb-split-container {
            flex-direction: column;
            height: auto;
            overflow-y: auto;
          }
          .onb-form-side {
            min-height: 100vh;
            width: 100%;
            padding: 2.5rem 1.5rem 8rem;
            background: transparent;
          }
          .onb-mobile-bg {
            display: block;
            position: absolute;
            inset: 0;
          }
          .onb-mobile-logo {
            display: flex;
          }
          .onb-form-container {
            max-width: 440px;
          }
          .onb-header__title {
            font-size: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
}
