// ─── LOGIN PAGE (PREMIUM REDESIGN) ──────────────────────────────
// Página de autenticación universal del SaaS.
//
// Características:
//   • Glassmorphism con fondo de gradiente animado
//   • Toggle Login / Registro en la misma tarjeta
//   • framer-motion para transiciones suaves
//   • Redirección inteligente por rol (DT-04)
//   • Mensajes de error en español
//   • Lucide Icons (sin emojis)
//
// Roles:
//   • 'cliente'                         → /mi-cuenta
//   • 'dueño', 'empleado', 'superadmin' → /admin
//   • 'superadmin'                      → /superadmin (acceso extra)
// ────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getSubdomainUrl } from '../../lib/domain';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Loader2,
  AlertCircle,
  Flower2,
  Flower,
  Eye,
  EyeOff,
  ChevronLeft,
} from 'lucide-react';
import type { UserRole } from '../../types';
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';

// ── Roles que acceden al panel de administración ────────────────
const ADMIN_ROLES: UserRole[] = ['superadmin', 'dueño', 'empleado'];

// ── Mensajes amigables ──────────────────────────────────────────
const FRIENDLY: Record<string, string> = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Confirma tu correo electrónico antes de iniciar sesión.',
  'Too many requests': 'Demasiados intentos. Espera unos minutos.',
  'User already registered': 'Este correo ya está registrado. Intenta iniciar sesión.',
  'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
};

const getHost = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

const getRelativePath = (url: string): string => {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return '/admin';
  }
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, profile, isLoading: authLoading } = useAuth();
  const { tenant, status } = useTenant();

  const isPlatform = status === 'platform';
  const brandName = isPlatform ? 'BotaniQ' : (tenant.nombre || 'Plataforma SaaS');
  const brandPrimaryColor = isPlatform ? '#526243' : (tenant.color_primario || '#526243');
  const brandAccentColor = isPlatform ? '#ffd7db' : (tenant.color_acento || '#ffd7db');

  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get('reason') === 'inactivity' ? 'Tu sesión cerró por inactividad. Ingresa de nuevo.' : null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (session) {
      const plan = searchParams.get('plan');

      const doRedirect = async () => {
        if (!profile) return; // Esperar a que el perfil se resuelva

        const userRole = profile.rol as UserRole;
        const hasAdminRole = ADMIN_ROLES.includes(userRole);

        // 1. Si tiene tienda y tiene rol administrativo ('dueño', 'empleado', 'superadmin')
        if (profile.tienda_id && hasAdminRole) {
          try {
            const { data: tienda } = await supabase
              .from('tiendas')
              .select('slug, nombre')
              .eq('id', profile.tienda_id)
              .single();

            if (tienda) {
              // Solo forzar onboarding para dueños en la plataforma central si no tienen slug real
              if (userRole === 'dueño') {
                const isDefault = tienda.slug.startsWith('tienda-') || tienda.nombre === 'Mi Nueva Florería';
                if (isDefault && isPlatform) {
                  navigate(`/onboarding${plan ? `?plan=${plan}` : ''}`, { replace: true });
                  return;
                }
              }

              // Redirección inteligente: si el usuario pertenece a otra tienda (subdominio o local override)
              if (profile.tienda_id !== tenant.id) {
                const newUrl = getSubdomainUrl(tienda.slug, '/admin');
                const newHost = getHost(newUrl);

                if (newHost === window.location.hostname) {
                  // Local: mantener el mismo host y query param
                  const relative = getRelativePath(newUrl);
                  navigate(relative, { replace: true });
                  return;
                }

                // Producción: redirigir al subdominio correcto
                window.location.href = newUrl;
                return;
              }
            }
          } catch (err) {
            console.error('Error fetching tienda for redirect:', err);
          }

          // Si pertenece a la tienda actual -> admin
          if (profile.tienda_id === tenant.id) {
            navigate('/admin', { replace: true });
            return;
          }
        }

        // 2. Si no tiene tienda
        // 2a. Si es superadmin sin tienda -> superadmin
        if (userRole === 'superadmin') {
          navigate('/superadmin', { replace: true });
          return;
        }

        // 2b. Si es dueño sin tienda -> onboarding (solo en la plataforma central)
        if (userRole === 'dueño' && isPlatform) {
          navigate(`/onboarding${plan ? `?plan=${plan}` : ''}`, { replace: true });
          return;
        }

        // 3. Fallback: vista de cliente
        navigate('/mi-cuenta', { replace: true });
      };

      doRedirect();
    }
  }, [authLoading, session, profile, tenant, navigate, searchParams]);

  // ── Handler de login ──────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(FRIENDLY[msg] || `Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Handler de registro ───────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { nombre_completo: nombre.trim() },
        },
      });
      if (authError) throw authError;

      setSuccess('Cuenta creada. Revisa tu correo para confirmar tu cuenta.');
      setMode('login');
      setPassword('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(FRIENDLY[msg] || `Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────
  if (authLoading || session) {
    return (
      <div className="login-page">
        <div className="login-page__bg" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', zIndex: 10 }}>
          <Loader2 className="login-spinner" style={{ width: 32, height: 32, color: 'white' }} />
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>
            {session ? 'Redirigiendo...' : 'Verificando sesión...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      {/* ── Background animado ── */}
      <div className="login-page__bg" />
      <div className="login-page__orb login-page__orb--1" />
      <div className="login-page__orb login-page__orb--2" />
      <div className="login-page__orb login-page__orb--3" />

      {/* ── Botón volver ── */}
      <Link to="/" className="login-back-link">
        <ChevronLeft style={{ width: 16, height: 16 }} />
        {isPlatform ? 'Volver al inicio' : 'Volver a la tienda'}
      </Link>

      {/* ── Card principal ── */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="login-card"
      >
        {/* Header Compacto */}
        <div className="login-card__header">
          <div
            className="login-card__logo"
            style={{ backgroundColor: '#ffffff', border: '1px solid rgba(82, 98, 67, 0.15)' }}
          >
            {!isPlatform && tenant.logo_url ? (
              <img src={tenant.logo_url} alt={brandName} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'inherit' }} />
            ) : (
              <img src="/logo.webp" alt="BotaniQ Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
            )}
          </div>
          <p className="login-card__subtitle">
            {brandName}
          </p>
        </div>

        {/* ── Tabs Superiores (Toggle Login/Registro) ── */}
        <div className="login-tabs">
          <div
            className="login-tabs__indicator"
            style={{
              transform: mode === 'login' ? 'translateX(0%)' : 'translateX(100%)',
              background: `linear-gradient(135deg, ${brandPrimaryColor}, ${brandPrimaryColor}dd)`
            }}
          />
          <button
            type="button"
            className={`login-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
          >
            Ingresar
          </button>
          <button
            type="button"
            className={`login-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError(null); setSuccess(null); }}
          >
            Registrarse
          </button>
        </div>

        {/* Mensajes de Alerta */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: '1rem' }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="login-alert login-alert--error"
            >
              <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
              <span>{error}</span>
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: '1rem' }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="login-alert login-alert--success"
            >
              <span>{success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Contenedor de Sliding Form ── */}
        <div className="login-slider-container">
          <motion.div
            className="login-slider-track"
            initial={false}
            animate={{ x: mode === 'login' ? '0%' : '-50%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* ── Formulario de LOGIN ── */}
            <div className="login-slider-pane">
              <form onSubmit={handleLogin} className="login-form">
                <div className="login-field">
                  <div className="login-input-wrap">
                    <Mail className="login-input-icon" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Correo electrónico"
                      required
                      autoComplete="email"
                      disabled={loading}
                      className="login-input"
                    />
                  </div>
                </div>

                <div className="login-field">
                  <div className="login-input-wrap">
                    <Lock className="login-input-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Contraseña"
                      required
                      autoComplete="current-password"
                      disabled={loading}
                      className="login-input"
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="login-eye-btn"
                      tabIndex={-1}
                    >
                      {showPassword
                        ? <EyeOff style={{ width: 14, height: 14 }} />
                        : <Eye style={{ width: 14, height: 14 }} />
                      }
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="login-submit"
                  style={{
                    background: loading
                      ? 'rgba(255,255,255,0.1)'
                      : `linear-gradient(135deg, ${brandPrimaryColor}, ${brandPrimaryColor}dd)`,
                  }}
                >
                  {loading ? (
                    <Loader2 className="login-spinner" style={{ width: 18, height: 18 }} />
                  ) : (
                    <>Ingresar <ArrowRight style={{ width: 16, height: 16 }} /></>
                  )}
                </button>
              </form>
            </div>

            {/* ── Formulario de REGISTRO ── */}
            <div className="login-slider-pane">
              <form onSubmit={handleRegister} className="login-form">
                <div className="login-field">
                  <div className="login-input-wrap">
                    <User className="login-input-icon" />
                    <input
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Nombre completo"
                      required
                      disabled={loading}
                      className="login-input"
                    />
                  </div>
                </div>

                <div className="login-field">
                  <div className="login-input-wrap">
                    <Mail className="login-input-icon" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Correo electrónico"
                      required
                      autoComplete="email"
                      disabled={loading}
                      className="login-input"
                    />
                  </div>
                </div>

                <div className="login-field">
                  <div className="login-input-wrap">
                    <Lock className="login-input-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Contraseña"
                      required
                      autoComplete="new-password"
                      disabled={loading}
                      className="login-input"
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="login-eye-btn"
                      tabIndex={-1}
                    >
                      {showPassword
                        ? <EyeOff style={{ width: 14, height: 14 }} />
                        : <Eye style={{ width: 14, height: 14 }} />
                      }
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="login-submit"
                  style={{
                    background: loading
                      ? 'rgba(255,255,255,0.1)'
                      : `linear-gradient(135deg, ${brandPrimaryColor}, ${brandPrimaryColor}dd)`,
                  }}
                >
                  {loading ? (
                    <Loader2 className="login-spinner" style={{ width: 18, height: 18 }} />
                  ) : (
                    <>Crear cuenta <ArrowRight style={{ width: 16, height: 16 }} /></>
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        </div>

        {/* Social Login Compacto */}
        <div className="mt-4">
          <SocialLoginButtons />
        </div>
      </motion.div>

      {/* ── Styles (scoped) ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
 
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          position: relative;
          overflow: hidden;
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
        }
 
        .login-page__bg {
          position: fixed;
          inset: 0;
          background: linear-gradient(135deg, #F8F6F2 0%, #F5F1E9 50%, #F8F6F2 100%);
          z-index: 0;
        }
 
        .login-page__orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.25;
          z-index: 1;
          animation: orbFloat 20s ease-in-out infinite;
          will-change: transform;
        }
        .login-page__orb--1 {
          width: 500px; height: 500px;
          background: ${brandPrimaryColor};
          top: -150px; right: -100px;
          animation-delay: 0s;
        }
        .login-page__orb--2 {
          width: 300px; height: 300px;
          background: ${brandAccentColor};
          bottom: -100px; left: -50px;
          animation-delay: -7s;
        }
        .login-page__orb--3 {
          width: 250px; height: 250px;
          background: #e8dfd8;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          animation-delay: -14s;
          opacity: 0.2;
        }
 
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 15px) scale(0.95); }
        }
 
        .login-back-link {
          position: fixed;
          top: 1.5rem;
          left: 1.5rem;
          z-index: 20;
          display: flex;
          align-items: center;
          gap: 0.35rem;
          color: rgba(82, 98, 67, 0.7);
          text-decoration: none;
          font-size: 0.8125rem;
          font-weight: 600;
          transition: color 0.2s;
        }
        .login-back-link:hover { color: rgba(82, 98, 67, 1); }
 
        .login-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 380px;
          background: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(40px) saturate(180%);
          -webkit-backdrop-filter: blur(40px) saturate(180%);
          border: 1px solid rgba(82, 98, 67, 0.15);
          border-radius: 24px;
          padding: 1.75rem 1.5rem;
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.5),
            0 20px 40px -10px rgba(82, 98, 67, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
          overflow: hidden;
        }
 
        .login-card__header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
        }
 
        .login-card__logo {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px -4px rgba(82, 98, 67, 0.1);
        }
 
        .login-card__subtitle {
          font-size: 0.8125rem;
          font-weight: 600;
          color: rgba(82, 98, 67, 0.7);
          margin: 0;
          letter-spacing: 0.02em;
        }
 
        /* ── TABS ── */
        .login-tabs {
          position: relative;
          display: flex;
          background: rgba(82, 98, 67, 0.06);
          border-radius: 12px;
          padding: 0.3rem;
          margin-bottom: 1.5rem;
          box-shadow: inset 0 2px 4px rgba(82, 98, 67, 0.05), 0 1px 0 rgba(255, 255, 255, 0.5);
        }
 
        .login-tabs__indicator {
          position: absolute;
          top: 0.3rem;
          bottom: 0.3rem;
          left: 0.3rem;
          width: calc(50% - 0.3rem);
          border-radius: 9px;
          transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1);
          box-shadow: 0 4px 12px rgba(82, 98, 67, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.2);
        }
 
        .login-tab {
          position: relative;
          flex: 1;
          background: none;
          border: none;
          color: rgba(82, 98, 67, 0.6);
          font-size: 0.8125rem;
          font-weight: 600;
          padding: 0.5rem 0;
          cursor: pointer;
          z-index: 1;
          transition: color 0.3s;
          font-family: inherit;
        }
        .login-tab.active { color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.1); }
 
        .login-alert {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.6rem 0.8rem;
          border-radius: 10px;
          font-size: 0.75rem;
          overflow: hidden;
        }
        .login-alert--error {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.15);
          color: #b91c1c;
        }
        .login-alert--success {
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.15);
          color: #15803d;
        }
 
        /* ── SLIDING FORM EFFECT ── */
        .login-slider-container {
          width: 100%;
          overflow: hidden;
          position: relative;
        }
 
        .login-slider-track {
          display: flex;
          width: 200%;
          align-items: flex-start;
        }
 
        .login-slider-pane {
          width: 50%;
          padding: 0 0.15rem;
        }
 
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          width: 100%;
        }
 
        .login-field {
          display: flex;
          flex-direction: column;
        }
 
        .login-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
 
        .login-input-icon {
          position: absolute;
          left: 1rem;
          width: 16px;
          height: 16px;
          color: rgba(82, 98, 67, 0.5);
          pointer-events: none;
          transition: color 0.3s;
        }
 
        .login-input {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 2.75rem;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(82, 98, 67, 0.18);
          border-radius: 12px;
          font-size: 0.85rem;
          color: #1F241C;
          outline: none;
          transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
          box-sizing: border-box;
          font-family: inherit;
          box-shadow: inset 0 1px 2px rgba(82, 98, 67, 0.05), 0 1px 0 rgba(255, 255, 255, 0.5);
        }
        .login-input::placeholder { color: rgba(82, 98, 67, 0.4); }
        .login-input:focus {
          border-color: #526243;
          background: #ffffff;
          box-shadow: inset 0 1px 2px rgba(82, 98, 67, 0.05), 0 0 0 4px rgba(82, 98, 67, 0.08);
        }
        .login-input:focus + .login-input-icon,
        .login-input:focus ~ .login-input-icon {
          color: #526243;
        }
 
        .login-eye-btn {
          position: absolute;
          right: 0.75rem;
          background: none;
          border: none;
          color: rgba(82, 98, 67, 0.5);
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          border-radius: 8px;
          transition: all 0.2s;
        }
        .login-eye-btn:hover { 
          color: #526243; 
          background: rgba(82, 98, 67, 0.08);
        }
 
        .login-submit {
          width: 100%;
          padding: 0.8rem 1.5rem;
          border-radius: 12px;
          border: none;
          color: white;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 0.5rem;
          transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
          font-family: inherit;
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.2), 0 4px 16px -4px rgba(82, 98, 67, 0.15);
          position: relative;
          overflow: hidden;
        }
        .login-submit::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.1), transparent);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .login-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.3), 0 8px 24px -4px rgba(82, 98, 67, 0.2);
        }
        .login-submit:hover:not(:disabled)::after {
          opacity: 1;
        }
        .login-submit:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.1), 0 2px 8px -2px rgba(82, 98, 67, 0.1);
        }
        .login-submit:disabled {
          cursor: not-allowed;
          opacity: 0.5;
          filter: grayscale(0.5);
        }
 
        .login-spinner {
          animation: spin 0.8s linear infinite;
        }
 
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
 
        @media (max-width: 480px) {
          .login-page {
            padding: 0.75rem;
          }
          .login-card {
            padding: 1.5rem 1.25rem;
            border-radius: 20px;
          }
          .login-back-link {
            top: 1rem;
            left: 1rem;
            font-size: 0.75rem;
          }
          .login-tabs {
            margin-bottom: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
}