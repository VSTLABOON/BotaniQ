// ─── ADMIN LAYOUT ───────────────────────────────────────────────
// Panel admin SaaS con sidebar acordeón, bottom nav mobile,
// dark mode sistémico y color del tenant integrado.
// ────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, Suspense, lazy } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import BottomNav from '../components/ui/BottomNav';
import { TIENDA_SHEET_ITEMS, MAS_SHEET_ITEMS, type BottomSheetItem } from '../components/ui/BottomSheetConfig';
import { toast } from '../store/toastStore';

const BottomSheet = lazy(() => import('../components/ui/BottomSheet'));
import { motion, AnimatePresence } from 'framer-motion';
import { useTenant } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';
import { isPlatformDomain, getSubdomainFromHostname, getPlatformDomain, getSubdomainUrl } from '../lib/domain';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';
import { useInactivityLogout } from '../hooks/useInactivityLogout';
import { getLuminance } from '../hooks/useTheming';
import ThemeToggle from '../components/ui/ThemeToggle';
import AnimatedBackground from '../components/ui/AnimatedBackground';
import SubscriptionExpiredScreen from '../components/SubscriptionExpiredScreen';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus';
import { usePendingOrdersCount } from '../hooks/usePendingOrdersCount';
import { useNotifications } from '../hooks/useNotifications';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Menu,
  X,
  Store,
  LogOut,
  ExternalLink,
  Plus,
  Home,
  MessageSquare,
  Truck,
  BarChart2,
  CheckCircle2,
  XCircle,
  Check,
} from 'lucide-react';

const OnboardingBot = lazy(() => import('../components/ui/OnboardingBot').then(m => ({ default: m.OnboardingBot })));

// ── Navegación plana y clara ────────────────────────────────────
interface NavItem { to: string; label: string; desc: string; icon: typeof LayoutDashboard; end?: boolean; badge?: 'pedidos'; }

const NAV_ITEMS: NavItem[] = [
  { to: '/admin',                label: 'Inicio',              desc: 'Tu resumen del día',         icon: LayoutDashboard, end: true },
  { to: '/admin/pedidos',        label: 'Pedidos',             desc: 'Revisa y gestiona ventas',   icon: ShoppingBag,     badge: 'pedidos' },
  { to: '/admin/catalogo',       label: 'Mi Vitrina',          desc: 'Agrega y edita arreglos',    icon: Package },
  { to: '/admin/repartidores',   label: 'Repartidores',        desc: 'Gestión de entregas y flota', icon: Truck },
  { to: '/admin/reportes',       label: 'Reportes',            desc: 'Ventas y estadísticas',       icon: BarChart2 },
  { to: '/admin/notificaciones', label: 'Notificaciones',      desc: 'Canales y alertas',           icon: Bell },
  { to: '/admin/equipo',         label: 'Mi Equipo',           desc: 'Empleados y permisos',       icon: Users },
  { to: '/admin/ajustes',        label: 'Personalizar Tienda', desc: 'Colores, logo y secciones',  icon: Settings },
];

// (MOBILE_NAV removido: migrado a BottomNav.tsx)

// ── Componente de Avatar ─────────────────────────────────────────
function Avatar({ name = 'Admin', size = 36 }: { name?: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="rounded-full bg-emerald-600 text-[var(--color-background-primary)] font-semibold flex items-center justify-center shrink-0 select-none"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-label={`Avatar de ${name}`}
    >
      {initials}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────
function Sidebar({
  tenantName,
  tenantColor,
  tenantLogo,
  isOpen,
  onClose,
  onLogout,
  pendingOrders,
  displayName,
  displayRole,
}: {
  tenantName: string;
  tenantColor: string;
  tenantLogo: string | null;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  pendingOrders: number;
  displayName: string;
  displayRole: string;
}) {
  const { tenant } = useTenant();
  const level = tenant?.subscription_level ?? 1;

  const filteredNavItems: NavItem[] = NAV_ITEMS.filter(item => {
    if (item.to === '/admin/equipo' && level < 2) return false;
    if (item.to === '/admin/repartidores' && level < 3) return false;
    return true;
  });

  // Contraste del texto sobre el color del tenant
  const lumWhite = 1;
  const lum = getLuminance(tenantColor);
  const brandTextColor = (lumWhite + 0.05) / (lum + 0.05) >= 4.5 ? '#fff' : '#1a1a1a';

  const handleLinkClick = () => {
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Overlay móvil */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64
          bg-[var(--color-background-primary)] border-r border-[var(--color-border-tertiary)]
          flex flex-col transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* ── Branding ── */}
        <div className="relative border-b border-[var(--color-border-tertiary)] shrink-0">
          <div className="flex items-center gap-3 px-5 h-16">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
              style={{ backgroundColor: tenantColor }}
            >
              {tenantLogo ? (
                <img src={tenantLogo} alt="" className="w-full h-full object-contain bg-[var(--color-background-primary)] rounded-[6px] p-0.5" />
              ) : (
                <Store className="w-4 h-4" style={{ color: brandTextColor }} strokeWidth={2.2} />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate leading-tight">
                {tenantName}
              </span>
              <span className="text-[0.65rem] text-[var(--color-text-tertiary)] font-medium tracking-wide uppercase">
                Panel Admin
              </span>
            </div>
            <button
              onClick={onClose}
              className="ml-auto lg:hidden p-1 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] transition-colors"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Sutil brillo de marca */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${tenantColor}00, ${tenantColor}60, ${tenantColor}00)` }} />
        </div>

        {/* ── Navegación plana y descriptiva ── */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1" aria-label="Navegación del panel">
          {filteredNavItems.map((item) => {
            const badge = item.badge === 'pedidos' && pendingOrders > 0 ? pendingOrders : null;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={handleLinkClick}
                className={({ isActive }) =>
                  `flex items-center gap-3 py-2.5 text-[0.82rem] font-medium transition-all duration-200 group relative ${
                    isActive
                      ? 'text-[var(--color-text-primary)] pl-3 pr-3 rounded-r-xl'
                      : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-background-secondary)] hover:text-[var(--color-text-secondary)] px-3 rounded-xl'
                  }`
                }
                style={({ isActive }) => isActive ? { backgroundColor: `${tenantColor}18`, color: tenantColor } : {}}
              >
                {({ isActive }) => (
                  <>
                    {/* Barra indicadora lateral de marca */}
                    {isActive && (
                      <span
                        className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full"
                        style={{ backgroundColor: tenantColor }}
                      />
                    )}
                    <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="leading-tight">{item.label}</span>
                      <span className={`text-[0.65rem] leading-tight ${isActive ? 'opacity-60' : 'text-[var(--color-text-tertiary)] opacity-70 group-hover:opacity-100'}`}>
                        {item.desc}
                      </span>
                    </div>
                    {badge && (
                      <span className="px-1.5 py-0.5 text-[0.6rem] font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 min-w-[20px] text-center">
                        {badge}
                      </span>
                    )}
                    {isActive && !badge && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tenantColor }} />}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* ── Ver mi tienda — siempre visible ── */}
        <div className="px-3 py-2 shrink-0">
          <a
            href={getSubdomainUrl(tenant.slug, '/')}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg text-[0.82rem] font-semibold transition-colors"
            style={{ backgroundColor: `${tenantColor}12`, color: tenantColor }}
          >
            <ExternalLink className="w-4 h-4" />
            Ver mi tienda
          </a>
        </div>

        {/* ── Footer del Sidebar ── */}
        <div className="px-3 py-3 border-t border-[var(--color-border-tertiary)] shrink-0">
          <div className="flex items-center gap-3 px-2">
            <Avatar name={displayName} size={32} />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium text-[var(--color-text-primary)] truncate leading-tight">{displayName}</span>
              <span className="text-[0.65rem] text-[var(--color-text-tertiary)] capitalize">{displayRole}</span>
            </div>
            <button
              id="sidebar-logout"
              onClick={onLogout}
              className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-all duration-200"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Topbar ────────────────────────────────────────────────────────
function Topbar({
  onMenuToggle,
  displayName,
  displayEmail,
  unreadCount,
  onLogout,
  notifications,
  onMarkAllRead,
  onMarkAsRead,
}: {
  onMenuToggle: () => void;
  displayName: string;
  displayEmail: string;
  unreadCount: number;
  onLogout: () => void;
  notifications: any[];
  onMarkAllRead: () => void;
  onMarkAsRead: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { tenant } = useTenant();

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    const handler = () => { setShowNotifications(false); setShowProfile(false); };
    if (showNotifications || showProfile) {
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [showNotifications, showProfile]);

  // Buscador: navegar a la sección que coincida
  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    if (q.includes('pedido') || q.includes('orden')) navigate('/admin/pedidos');
    else if (q.includes('product') || q.includes('catálogo') || q.includes('catalogo')) navigate('/admin/catalogo');
    else if (q.includes('equipo') || q.includes('miembro') || q.includes('staff')) navigate('/admin/equipo');
    else if (q.includes('ajuste') || q.includes('config') || q.includes('tema')) navigate('/admin/ajustes');
    else navigate('/admin/pedidos');
    setSearchQuery('');
  };

  const getNotificationIcon = (tipo: string, leida: boolean) => {
    const t = tipo?.toLowerCase() || '';
    if (t.includes('pago_exitoso') || t.includes('exitoso') || t.includes('pago.exitoso') || t.includes('pago_completo')) {
      return {
        icon: CheckCircle2,
        bg: leida ? 'bg-[var(--color-background-secondary)]' : 'bg-emerald-100 dark:bg-emerald-950/40',
        color: leida ? 'text-[var(--color-text-tertiary)]' : 'text-emerald-600 dark:text-emerald-400',
      };
    }
    if (t.includes('pago_fallido') || t.includes('fallido') || t.includes('pago.fallido')) {
      return {
        icon: XCircle,
        bg: leida ? 'bg-[var(--color-background-secondary)]' : 'bg-rose-100 dark:bg-rose-950/40',
        color: leida ? 'text-[var(--color-text-tertiary)]' : 'text-rose-600 dark:text-rose-400',
      };
    }
    return {
      icon: ShoppingBag,
      bg: leida ? 'bg-[var(--color-background-secondary)]' : 'bg-blue-100 dark:bg-blue-950/40',
      color: leida ? 'text-[var(--color-text-tertiary)]' : 'text-blue-600 dark:text-blue-400',
    };
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-[var(--color-background-primary)]/80 backdrop-blur-xl border-b border-[var(--color-border-secondary)] flex items-center gap-4 px-4 lg:px-8 shrink-0">
      {/* Hamburguesa (siempre visible para toggle) */}
      <button
        onClick={onMenuToggle}
        className="p-2 -ml-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] transition-colors hidden lg:block"
        aria-label="Alternar menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ── Buscador funcional ── */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" strokeWidth={2} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="Buscar pedidos, productos, equipo..."
            className="w-full h-9 pl-10 pr-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all duration-200"
            style={{ fontSize: '16px' }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <ThemeToggle />
        
        {/* Notificaciones — con dropdown */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}
            className="relative p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] transition-colors"
            aria-label="Notificaciones"
          >
            <Bell className="w-5 h-5" strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[0.65rem] font-bold text-white ring-2 ring-[var(--color-background-primary)]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown de notificaciones */}
          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 bg-[var(--color-background-primary)] rounded-xl shadow-xl border border-[var(--color-border-secondary)] overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-tertiary)]">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Notificaciones</h3>
                {unreadCount > 0 && (
                  <button onClick={onMarkAllRead} className="text-xs text-emerald-600 font-semibold hover:underline">
                    Marcar todas como leídas
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell className="w-8 h-8 text-[var(--color-text-tertiary)] mx-auto mb-2 opacity-40" />
                    <p className="text-xs text-[var(--color-text-tertiary)]">Sin notificaciones</p>
                  </div>
                ) : (
                  notifications.slice(0, 8).map((n: any, i: number) => {
                    const iconInfo = getNotificationIcon(n.tipo, n.leida);
                    return (
                      <button
                        key={n.id || i}
                        onClick={() => { navigate('/admin/pedidos'); setShowNotifications(false); }}
                        className={`w-full text-left px-4 py-3 hover:bg-[var(--color-background-secondary)] transition-colors flex items-start justify-between gap-3 border-b border-[var(--color-border-tertiary)] last:border-0 ${
                          !n.leida ? 'bg-emerald-50/10' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${iconInfo.bg}`}>
                            <iconInfo.icon className={`w-3.5 h-3.5 ${iconInfo.color}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm truncate ${!n.leida ? 'font-semibold text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                              {n.titulo || 'Notificación'}
                            </p>
                            <p className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">{n.mensaje || ''}</p>
                          </div>
                        </div>
                        {!n.leida && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkAsRead(n.id);
                            }}
                            title="Marcar como leída"
                            className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-emerald-600 hover:bg-[var(--color-background-tertiary)] transition-colors shrink-0 self-center"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Separador */}
        <div className="hidden md:block w-px h-6 bg-[var(--color-border-secondary)] mx-1" aria-hidden="true" />

        {/* Perfil — con dropdown */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }}
            className="flex items-center gap-2.5 p-1.5 pr-3 rounded-lg hover:bg-[var(--color-background-secondary)] transition-colors"
          >
            <Avatar name={displayName} size={32} />
            <div className="hidden md:flex flex-col items-start min-w-0">
              <span className="text-sm font-medium text-[var(--color-text-secondary)] truncate leading-tight max-w-[160px]">
                {displayName}
              </span>
              <span className="text-[0.65rem] text-[var(--color-text-tertiary)] leading-tight truncate max-w-[160px]">
                {displayEmail}
              </span>
            </div>
            <ChevronDown className={`hidden md:block w-4 h-4 text-[var(--color-text-tertiary)] transition-transform ${showProfile ? 'rotate-180' : ''}`} strokeWidth={2} />
          </button>

          {/* Dropdown de perfil */}
          {showProfile && (
            <div className="absolute right-0 top-14 w-56 bg-[var(--color-background-primary)] rounded-xl shadow-xl border border-[var(--color-border-secondary)] overflow-hidden z-50 py-1">
              <div className="px-4 py-3 border-b border-[var(--color-border-tertiary)]">
                <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{displayName}</p>
                <p className="text-xs text-[var(--color-text-tertiary)] truncate">{displayEmail}</p>
              </div>
              <button
                onClick={() => { window.location.href = getSubdomainUrl(tenant.slug, '/'); setShowProfile(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] transition-colors"
              >
                <Store className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                Ver mi tienda
              </button>
              <div className="border-t border-[var(--color-border-tertiary)]" />
              <button
                onClick={() => { onLogout(); setShowProfile(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ── Capitalizar rol como fallback de nombre ──────────────────────
function capitalizeRole(rol: string): string {
  return rol.charAt(0).toUpperCase() + rol.slice(1);
}

// ── Layout Principal ──────────────────────────────────────────────
export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const navigate = useNavigate();

  // FIX DT-08: Hooks llamados incondicionalmente a nivel superior.
  // TenantProvider siempre está presente (envuelve todo en main.jsx).
  const { tenant } = useTenant();
  const { profile } = useAuth();
  
  const level = tenant?.subscription_level ?? 1;

  const filteredTiendaSheetItems = TIENDA_SHEET_ITEMS.filter(item => {
    if (item.id === 'equipo' && level < 2) return false;
    if (item.id === 'repartidores' && level < 3) return false;
    return true;
  });

  // Inactivity logout (15 mins)
  useInactivityLogout();

  // Datos del usuario para el Topbar — con fallbacks seguros
  const displayName = profile?.nombre || (profile?.rol ? capitalizeRole(profile.rol) : 'Usuario');
  const displayEmail = profile?.email || '';

  // ── FIX: Realtime UI para Notificaciones ────────────────────────
  const { notifications, unreadCount, toasts, handleMarkAllRead, handleMarkAsRead } = useNotifications(tenant?.id);

  // FIX DT-07: Logout funcional con limpieza completa de sesión
  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      logger.info('👋 [AdminLayout] Sesión cerrada. Redirigiendo a /login.');
    } catch (err) {
      logger.error('❌ [AdminLayout] Error al cerrar sesión:', err as Error);
    } finally {
      // Redirigir siempre, incluso si signOut falla (sesión corrupta)
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // Limpiar parámetro reactivated=true y forzar reload
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reactivated') === 'true') {
      params.delete('reactivated');
      window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
      window.location.reload();
    }
  }, []);

  const pendingOrders = usePendingOrdersCount(tenant?.id);

  const tenantColor = tenant.color_primario || '#1a7f5a';
  const displayRole = profile?.rol ? capitalizeRole(profile.rol) : 'Usuario';

  const [activeSheet, setActiveSheet] = useState<'tienda' | 'mas' | null>(null);
  const location = useLocation();

  const handleSheetItemClick = useCallback((item: BottomSheetItem) => {
    if (item.path) {
      setActiveSheet(null);
      return;
    }

    if (item.id === 'logout') {
      setActiveSheet(null);
      handleLogout();
    } else if (item.id === 'soporte') {
      setActiveSheet(null);
      setIsChatOpen(true);
    } else {
      toast.info('Función en desarrollo', {
        message: 'Esta sección se encuentra en construcción y estará disponible próximamente.',
      });
    }
  }, [handleLogout]);

  const { isBlocked } = useSubscriptionStatus();

  if (isBlocked) {
    return <SubscriptionExpiredScreen />;
  }

  return (
    <div
      className="flex h-screen bg-transparent overflow-hidden text-[var(--color-text-primary)] relative"
      style={{
        fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
    >
      <AnimatedBackground />
      {/* ── Spacer for desktop ── */}
      <div className={`hidden lg:block transition-all duration-300 ease-out shrink-0 ${sidebarOpen ? 'w-64' : 'w-0'}`} />

      {/* ── Sidebar (Desktop) ── */}
      <div className="hidden lg:block">
        <Sidebar
          tenantName={tenant.nombre}
          tenantColor={tenantColor}
          tenantLogo={tenant.logo_url}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={handleLogout}
          pendingOrders={pendingOrders}
          displayName={displayName}
          displayRole={displayRole}
        />
      </div>

      {/* ── Área principal ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          displayName={displayName}
          displayEmail={displayEmail}
          unreadCount={unreadCount}
          onLogout={handleLogout}
          notifications={notifications}
          onMarkAllRead={handleMarkAllRead}
          onMarkAsRead={handleMarkAsRead}
        />

        {/* ── Contenido (rutas hijas) ── */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8 mobile-safe-pb">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile Bottom Navigation & Sheets ── */}
      <div className="lg:hidden">
        <BottomNav
          currentPath={location.pathname}
          tenantColor={tenantColor}
          activeSheet={activeSheet}
          onOpenSheet={(sheet) => setActiveSheet(sheet)}
        />
        <Suspense fallback={null}>
          <BottomSheet
            isOpen={activeSheet !== null}
            onClose={() => setActiveSheet(null)}
            title={activeSheet === 'tienda' ? 'Mi Tienda' : 'Más'}
            items={activeSheet === 'tienda' ? filteredTiendaSheetItems : MAS_SHEET_ITEMS}
            tenantColor={tenantColor}
            onItemClick={handleSheetItemClick}
          />
        </Suspense>
      </div>

      {/* ── Toasts de Notificaciones Realtime ── */}
      <div className="fixed top-20 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="bg-[var(--color-background-primary)] border-l-4 border-emerald-500 rounded-lg shadow-xl p-4 w-80 pointer-events-auto cursor-pointer"
              onClick={() => navigate('/admin/pedidos')}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/40 rounded-full shrink-0">
                  <ShoppingBag className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--color-text-primary)]">{t.titulo}</h4>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{t.mensaje}</p>
                  <p className="text-[0.65rem] text-emerald-600 font-semibold mt-2 uppercase tracking-wide">
                    Ver pedido →
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* Botón flotante para abrir el chat de Onboarding */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-[5.5rem] lg:bottom-6 right-4 lg:right-6 z-50 p-4 rounded-full bg-emerald-600 text-white shadow-xl hover:bg-emerald-700 transition-transform active:scale-95 flex items-center justify-center scale-100 opacity-100"
          aria-label="Ayuda y acompañamiento"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* ── Asistente de Onboarding (BotChat) ── */}
      <AnimatePresence>
        {isChatOpen && (
          <Suspense fallback={null}>
            <OnboardingBot onClose={() => setIsChatOpen(false)} />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}
