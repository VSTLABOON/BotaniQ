import {
  Layout,
  Palette,
  Globe,
  CreditCard,
  Clock,
  Users,
  Truck,
  Bell,
  BarChart2,
  Sliders,
  HelpCircle,
  LogOut,
  type LucideIcon
} from 'lucide-react';

export interface BottomSheetItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  destructive?: boolean;
}

export const TIENDA_SHEET_ITEMS: BottomSheetItem[] = [
  { id: 'builder',        label: 'Store Builder',   icon: Layout,      path: '/admin/contenido' },
  { id: 'tema',           label: 'Colores y Tema',  icon: Palette,     path: '/admin/diseno' },
  { id: 'dominio',        label: 'Identidad y SEO', icon: Globe,       path: '/admin/seo' },
  { id: 'pagos',          label: 'Pagos',           icon: CreditCard,  path: '/admin/pagos' },
  { id: 'horarios',       label: 'Horarios',        icon: Clock,       path: '/admin/horarios' },
  { id: 'equipo',         label: 'Mi Equipo',       icon: Users,       path: '/admin/equipo' },
  { id: 'repartidores',   label: 'Repartidores',    icon: Truck },
  { id: 'notificaciones', label: 'Notificaciones',  icon: Bell,        path: '/admin/notificaciones' },
];

export const MAS_SHEET_ITEMS: BottomSheetItem[] = [
  { id: 'reportes',       label: 'Reportes',        icon: BarChart2,   path: '/admin/reportes' },
  { id: 'configuracion',  label: 'Configuración',   icon: Sliders,     path: '/admin/diseno' },
  { id: 'soporte',        label: 'Soporte',         icon: HelpCircle },
  { id: 'logout',         label: 'Cerrar Sesión',   icon: LogOut,      destructive: true },
];
