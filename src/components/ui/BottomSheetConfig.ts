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
  { id: 'builder',        label: 'Store Builder',   icon: Layout,      path: '/admin/ajustes?tab=contenido' },
  { id: 'tema',           label: 'Colores y Tema',  icon: Palette,     path: '/admin/ajustes?tab=tema' },
  { id: 'dominio',        label: 'Dominio',         icon: Globe,       path: '/admin/ajustes?tab=general' },
  { id: 'pagos',          label: 'Pagos',           icon: CreditCard,  path: '/admin/ajustes?tab=pagos' },
  { id: 'horarios',       label: 'Horarios',        icon: Clock,       path: '/admin/ajustes?tab=horarios' },
  { id: 'equipo',         label: 'Mi Equipo',       icon: Users,       path: '/admin/equipo' },
  { id: 'repartidores',   label: 'Repartidores',    icon: Truck },
  { id: 'notificaciones', label: 'Notificaciones',  icon: Bell,        path: '/admin/notificaciones' },
];

export const MAS_SHEET_ITEMS: BottomSheetItem[] = [
  { id: 'reportes',       label: 'Reportes',        icon: BarChart2,   path: '/admin/reportes' },
  { id: 'configuracion',  label: 'Configuración',   icon: Sliders,     path: '/admin/ajustes' },
  { id: 'soporte',        label: 'Soporte',         icon: HelpCircle },
  { id: 'logout',         label: 'Cerrar Sesión',   icon: LogOut,      destructive: true },
];
