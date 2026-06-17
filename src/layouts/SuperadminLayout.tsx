// ─── SUPERADMIN LAYOUT ──────────────────────────────────────────
// Layout exclusivo para el panel de Superadmin (dueño del SaaS).
// Diseño minimalista oscuro para diferenciarlo visualmente del
// panel de administrador de tienda (AdminLayout).
//
// Rutas hijas:
//   /superadmin       → Dashboard global
//   /superadmin/...   → Futuras sub-rutas
//
// RBAC: Solo accesible por rol 'superadmin'.
// ────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useInactivityLogout } from '../hooks/useInactivityLogout';
import BackButton from '../components/ui/BackButton';
import {
  LayoutDashboard,
  Store,
  CreditCard,
  Shield,
  LogOut,
  Menu,
  X,
  Zap,
} from 'lucide-react';
import { UI_COLORS } from '../lib/constants.ts';
import ThemeToggle from '../components/ui/ThemeToggle';

// ── Navegación del sidebar ───────────────────────────────────────
const NAV_ITEMS = [
  { to: '/superadmin',          label: 'Panel Global',  icon: LayoutDashboard, end: true },
  { to: '/superadmin/suscripciones', label: 'Suscripciones', icon: Zap, end: false },
  { to: '/superadmin/tiendas',  label: 'Tiendas',       icon: Store,           end: false },
  { to: '/superadmin/pagos',    label: 'Pagos',         icon: CreditCard,      end: false },
];

export default function SuperadminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  useInactivityLogout();

  const displayName = profile?.nombre || 'Superadmin';

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <div
      className="flex h-screen bg-[var(--color-background-secondary)]/50 dark:bg-[#0a0a0c] overflow-hidden text-[var(--color-text-primary)] dark:text-gray-100 transition-colors duration-200"
      style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" }}
    >
      {/* ── Overlay móvil ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 flex flex-col
          border-r border-[var(--color-border-secondary)] dark:border-white/5 bg-[var(--color-background-primary)] dark:bg-[#09090b]
          transition-transform duration-300 ease-out
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Branding */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-[var(--color-border-tertiary)] dark:border-white/5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[var(--color-background-primary)]" strokeWidth={2.2} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-[var(--color-text-primary)] dark:text-[var(--color-background-primary)] truncate">Landing-Base</span>
            <span className="text-[0.6rem] text-violet-600 dark:text-violet-400 font-semibold tracking-widest uppercase">
              Superadmin
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden p-1 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] dark:text-[var(--color-background-primary)]/40 dark:hover:text-[var(--color-background-primary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[0.82rem] font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                    : 'text-[var(--color-text-tertiary)] dark:text-[var(--color-background-primary)]/40 hover:bg-[var(--color-background-tertiary)] dark:hover:bg-[var(--color-background-primary)]/5 hover:text-[var(--color-text-primary)] dark:hover:text-[var(--color-background-primary)]/70'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                      isActive ? 'text-violet-600 dark:text-violet-400' : 'text-[var(--color-text-tertiary)] dark:text-[var(--color-background-primary)]/30 group-hover:text-[var(--color-text-primary)] dark:group-hover:text-[var(--color-background-primary)]/50'
                    }`}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                  {item.label}
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-500" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-[var(--color-border-tertiary)] dark:border-white/5 shrink-0 space-y-3">
          <div className="flex items-center gap-2.5 px-3">
            <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-[0.7rem] font-bold text-[var(--color-background-primary)]">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-[var(--color-text-primary)] dark:text-[var(--color-background-primary)]/80 truncate">{displayName}</span>
              <span className="text-[0.6rem] text-[var(--color-text-tertiary)] dark:text-[var(--color-background-primary)]/30">superadmin</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[0.82rem] font-medium text-[var(--color-text-tertiary)] dark:text-[var(--color-background-primary)]/30 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-all"
          >
            <LogOut className="w-[18px] h-[18px]" strokeWidth={1.8} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Área principal ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header 
          className="sticky top-0 z-30 h-14 bg-[var(--color-background-primary)]/80 dark:bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-[var(--color-border-secondary)] dark:border-white/5 flex items-center justify-between gap-4 px-4 lg:px-8 shrink-0"
        >
          <div className="flex items-center gap-4">
            {location.pathname !== '/superadmin' && (
              <BackButton to="/superadmin" label="Volver" />
            )}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-[var(--color-text-tertiary)] dark:text-[var(--color-background-primary)]/40 hover:text-[var(--color-text-primary)] dark:hover:text-[var(--color-background-primary)]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-600 dark:text-violet-400" strokeWidth={2.5} />
              <span className="text-sm font-semibold text-[var(--color-text-secondary)] dark:text-[var(--color-background-primary)]/60">Control Global del SaaS</span>
            </div>
          </div>
          <ThemeToggle />
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
