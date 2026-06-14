import { Link } from 'react-router-dom';
import {
  Home,
  ShoppingBag,
  Store,
  Settings2,
  Grid,
  Bell,
  type LucideIcon
} from 'lucide-react';

interface BottomNavProps {
  currentPath: string;
  tenantColor: string;
  activeSheet: 'tienda' | 'mas' | null;
  onOpenSheet: (sheet: 'tienda' | 'mas') => void;
  isOwnerOrSuper: boolean;
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  sheet?: 'tienda' | 'mas';
}

export default function BottomNav({
  currentPath,
  tenantColor,
  activeSheet,
  onOpenSheet,
  isOwnerOrSuper
}: BottomNavProps) {
  const navItems: NavItem[] = [
    { id: 'inicio',   label: 'Inicio',    icon: Home,        path: '/admin' },
    { id: 'pedidos',  label: 'Pedidos',   icon: ShoppingBag, path: '/admin/pedidos' },
    { id: 'vitrina',  label: 'Vitrina',   icon: Store,       path: '/admin/catalogo' },
    ...(isOwnerOrSuper 
      ? [{ id: 'tienda',   label: 'Mi Tienda', icon: Settings2,   sheet: 'tienda' as const }] 
      : [{ id: 'notificaciones', label: 'Notificaciones', icon: Bell, path: '/admin/notificaciones' }]
    ),
    { id: 'mas',      label: 'Más',       icon: Grid,        sheet: 'mas' as const },
  ];
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 'calc(64px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(15, 15, 15, 0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      }}
      className="flex items-center justify-around px-2 text-white/40"
    >
      {navItems.map((item) => {
        const isPathActive = item.path ? currentPath === item.path : false;
        const isSheetActive = item.sheet ? activeSheet === item.sheet : false;
        const isActive = isPathActive || isSheetActive;

        const content = (
          <div className="flex flex-col items-center justify-center gap-1 transition-all duration-200">
            <item.icon
              size={20}
              strokeWidth={isActive ? 2.2 : 1.8}
              style={{ color: isActive ? tenantColor : 'inherit' }}
              className="transition-transform duration-200 active:scale-90"
            />
            <span
              style={{
                fontSize: '10px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? tenantColor : 'inherit',
              }}
              className="leading-none tracking-wide"
            >
              {item.label}
            </span>
          </div>
        );

        if (item.path) {
          return (
            <Link
              key={item.id}
              to={item.path}
              className="flex flex-col items-center justify-center min-w-[48px] min-h-[48px] py-1 select-none"
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => item.sheet && onOpenSheet(item.sheet)}
            className="flex flex-col items-center justify-center min-w-[48px] min-h-[48px] py-1 select-none focus:outline-none"
          >
            {content}
          </button>
        );
      })}
    </nav>
  );
}
