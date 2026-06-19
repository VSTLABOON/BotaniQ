import { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useLocation } from 'react-router-dom';
import { getNavLinksFromSecciones } from '../../lib/navLinks.js';

// ── Roles que acceden al panel de administración ────────────────
const ADMIN_ROLES = ['superadmin', 'dueño', 'empleado'];

// ── Resuelve el CTA del header según el estado de auth ──────────
function getAuthCTA(session, profile) {
  if (!session) {
    return { label: 'Iniciar Sesión', href: '/login' };
  }
  if (profile?.rol && ADMIN_ROLES.includes(profile.rol)) {
    return { label: 'Panel Admin', href: '/admin' };
  }
  return { label: 'Mi Cuenta', href: '/mi-cuenta' };
}

export default function Header() {
  const { tenant } = useTenant();
  const { session, profile } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const cta = getAuthCTA(session, profile);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Separar el nombre de la tienda en dos partes para estilizar
  // Ej: "Flores del Corazón" → "Flores" + "del Corazón"
  const nameParts = tenant.nombre.split(' ');
  const brandFirst = nameParts[0] || '';
  const brandRest = nameParts.slice(1).join(' ') || '';

  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '';

  const navLinks = getNavLinksFromSecciones(tenant?.config_ui?.orden_secciones, tenant?.nav_links);

  return (
    <header 
      style={{ top: 'var(--cd-height, 0px)' }}
      className={`fixed left-0 right-0 z-[900] transition-all duration-400 ease-out border-b
        ${isScrolled 
          ? 'bg-negro/[.88] backdrop-blur-[18px] border-white/[.06]' 
          : 'bg-transparent border-transparent'
        }
      `}
    >
      <div className="max-w-[1200px] mx-auto flex items-center gap-8 py-[1.1rem] px-6">
        <a href="#hero" className="flex items-baseline gap-[0.4rem] mr-auto" aria-label="Inicio">
          <span className="font-display text-[1.2rem] font-bold text-blanco">{brandFirst}</span>
          <span className="font-script text-[1.5rem] text-rosa leading-none">{brandRest}</span>
        </a>
        
        <nav className="hidden md:flex items-center gap-8" aria-label="Navegación principal">
          {navLinks.map((link) => {
            const href = isHome ? link.href : `/${location.search}${link.href}`;
            return (
              <a 
                key={link.label}
                href={href}
                className="text-[0.8rem] tracking-[0.12em] uppercase text-blanco/60 hover:text-blanco transition-colors duration-200"
              >
                {link.label}
              </a>
            );
          })}

          {/* ── CTA Auth — Desktop ────────────────────────────── */}
          <a
            id="header-auth-cta"
            href={cta.href}
            className="ml-2 px-5 py-[0.45rem] rounded-full text-[0.75rem] font-semibold tracking-[0.08em] uppercase
              border border-white/[.2] text-blanco bg-white/[.08]
              hover:bg-rosa hover:border-rosa hover:text-blanco
              backdrop-blur-[6px] transition-all duration-300 ease-out
              hover:shadow-[0_0_20px_rgba(217,79,110,0.25)]"
          >
            {cta.label}
          </a>
        </nav>

        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden flex flex-col justify-center gap-[5px] w-[36px] h-[36px] p-[6px]" 
          aria-label="Abrir menú" 
          aria-expanded={isMenuOpen}
        >
          <span className={`block h-[1.5px] bg-crema rounded-[2px] transition-all duration-300 ${isMenuOpen ? 'translate-y-[6.5px] rotate-45' : ''}`}></span>
          <span className={`block h-[1.5px] bg-crema rounded-[2px] transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`}></span>
          <span className={`block h-[1.5px] bg-crema rounded-[2px] transition-all duration-300 ${isMenuOpen ? '-translate-y-[6.5px] -rotate-45' : ''}`}></span>
        </button>
      </div>

      <nav 
        className={`md:hidden flex flex-col bg-negro/[.97] backdrop-blur-[20px] border-t border-white/[.05] transition-all duration-400 ease-out overflow-hidden
          ${isMenuOpen ? 'max-h-[400px] py-2 pb-6' : 'max-h-0 py-0'}
        `}
        aria-label="Menú móvil" 
        aria-hidden={!isMenuOpen}
      >
        {navLinks.map((link) => {
          const href = isHome ? link.href : `/${location.search}${link.href}`;
          return (
            <a 
              key={link.label}
              href={href}
              onClick={() => setIsMenuOpen(false)}
              className="py-[0.85rem] px-6 text-[0.9rem] tracking-[0.06em] text-blanco/70 hover:text-blanco hover:bg-white/[.04] transition-colors duration-200"
            >
              {link.label}
            </a>
          );
        })}

        {/* ── CTA Auth — Móvil ──────────────────────────────── */}
        <div className="px-4 pt-3 mt-1 border-t border-white/[.06]">
          <a
            id="header-auth-cta-mobile"
            href={cta.href}
            onClick={() => setIsMenuOpen(false)}
            className="block w-full text-center py-[0.7rem] rounded-xl text-[0.85rem] font-semibold tracking-[0.06em]
              bg-rosa text-blanco
              hover:brightness-110 transition-all duration-300
              shadow-[0_0_16px_rgba(217,79,110,0.2)]"
          >
            {cta.label}
          </a>
        </div>
      </nav>
    </header>
  );
}
