import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { useTenant } from '../../context/TenantContext';
import { logger } from '../../lib/logger';
import { toast } from '../../store/toastStore';
import ThemeToggle from '../../components/ui/ThemeToggle';
import AnimatedBackground from '../../components/ui/AnimatedBackground';
import BackButton from '../../components/ui/BackButton';
import { CARD } from '../admin/components/config/SharedUI';
import { LogOut, Package, ExternalLink, Calendar, MapPin, ChevronRight, Store, ShoppingBag, User, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { updateCustomerProfile } from '../../services/customerService';

type OrderStatus = 'pendiente' | 'preparando' | 'en_ruta' | 'entregado' | 'cancelado' | 'pagado';

interface OrderItem {
  id: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  imagen?: string;
}

interface Order {
  id: string;
  total: number;
  estado: OrderStatus;
  created_at: string;
  numero: string;
  datos_envio?: {
    deliveryDate?: string;
    deliveryAddress?: string;
  };
  pedido_items: OrderItem[];
}

const STATUS_CONFIG: Record<string, { label: string; colorClass: string; bgClass: string }> = {
  pagado:     { label: 'Pagado',         colorClass: 'text-emerald-700 dark:text-emerald-400', bgClass: 'bg-emerald-50 dark:bg-emerald-900/30' },
  pendiente:  { label: 'Pendiente',      colorClass: 'text-amber-700 dark:text-amber-400',     bgClass: 'bg-amber-50 dark:bg-amber-900/30' },
  preparando: { label: 'En Preparación', colorClass: 'text-blue-700 dark:text-blue-400',       bgClass: 'bg-blue-50 dark:bg-blue-900/30' },
  en_ruta:    { label: 'En Ruta',        colorClass: 'text-violet-700 dark:text-violet-400',   bgClass: 'bg-violet-50 dark:bg-violet-900/30' },
  entregado:  { label: 'Entregado',      colorClass: 'text-emerald-700 dark:text-emerald-400', bgClass: 'bg-emerald-50 dark:bg-emerald-900/30' },
  cancelado:  { label: 'Cancelado',      colorClass: 'text-red-700 dark:text-red-400',         bgClass: 'bg-red-50 dark:bg-red-900/30' },
};

export default function CustomerAccountPage() {
  const { profile } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'compras' | 'perfil'>('compras');
  
  // Formulario de perfil
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setNombre(profile.nombre || '');
      setTelefono(profile.telefono || '');
      setDireccion(profile.direccion || '');
    }
  }, [profile]);

  const fetchOrders = useCallback(async () => {
    if (!profile?.id || !tenant?.id) return;
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          id, total, estado, created_at, datos_envio,
          pedido_items (*)
        `)
        .eq('usuario_id', profile.id)
        .eq('tienda_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setOrders(data.map(o => ({
          ...o,
          numero: `#${o.id.slice(0, 8).toUpperCase()}`
        })) as Order[]);
      }
    } catch (err) {
      logger.error('Error fetching customer orders', err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id, tenant?.id]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      logger.error('Error al cerrar sesión:', err as Error);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    setIsSaving(true);
    try {
      await updateCustomerProfile(profile.id, {
        nombre_completo: nombre.trim(),
        telefono: telefono.trim(),
        direccion: direccion.trim(),
      });

      toast.success('Perfil actualizado', {
        message: 'Tus datos se actualizaron correctamente.',
      });

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      logger.error('Error saving customer profile', err as Error);
      toast.error('Error al guardar', {
        message: 'No se pudieron actualizar tus datos. Intenta de nuevo.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col font-sans transition-colors duration-200 relative">
      <AnimatedBackground />
      
      {/* ── Navbar ── */}
      <header className="bg-white/40 dark:bg-black/40 backdrop-blur-xl border-b border-white/20 dark:border-white/10 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-background-primary)] shadow-md" style={{ backgroundColor: tenant.color_primario }}>
                <Store className="w-4 h-4" strokeWidth={2.2} />
              </div>
              <span className="font-bold text-lg text-[var(--color-text-primary)] tracking-tight hidden sm:block drop-shadow-sm">
                {tenant.nombre}
              </span>
            </Link>
            <div className="w-px h-5 bg-black/10 dark:bg-white/10 hidden sm:block" />
            <BackButton to="/" label="Volver a la tienda" variant="link" tenantColor={tenant.color_primario} />
          </div>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="w-px h-5 bg-white/30 dark:bg-white/10" />
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-tertiary)] hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <span className="hidden sm:block">Cerrar sesión</span>
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Contenido Principal ── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Izquierdo */}
        <aside className="w-full md:w-64 shrink-0 space-y-6">
          <div className={`${CARD} p-5 text-center`}>
            <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-xl font-bold text-[var(--color-background-primary)] shadow-inner" style={{ backgroundColor: tenant.color_secundario }}>
              {profile?.nombre?.[0]?.toUpperCase() || 'C'}
            </div>
            <h2 className="text-[var(--color-text-primary)] font-bold text-lg">{profile?.nombre || 'Cliente'}</h2>
            <p className="text-[var(--color-text-tertiary)] text-xs">{profile?.email}</p>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => setActiveTab('compras')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium shadow-sm transition-all ${
                activeTab === 'compras'
                  ? 'bg-white/40 dark:bg-black/40 backdrop-blur-md border border-white/20 dark:border-white/10 text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-white/20 dark:hover:bg-white/5 border border-transparent'
              }`}
            >
              <ShoppingBag className="w-5 h-5 text-[var(--color-text-tertiary)]" />
              Mis compras
            </button>
            <button
              onClick={() => setActiveTab('perfil')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium shadow-sm transition-all ${
                activeTab === 'perfil'
                  ? 'bg-white/40 dark:bg-black/40 backdrop-blur-md border border-white/20 dark:border-white/10 text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-white/20 dark:hover:bg-white/5 border border-transparent'
              }`}
            >
              <User className="w-5 h-5 text-[var(--color-text-tertiary)]" />
              Mi perfil
            </button>
            <Link to="/" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--color-text-secondary)] hover:bg-white/20 dark:hover:bg-white/5 transition-colors border border-transparent font-medium">
              <Store className="w-5 h-5" />
              Ir a la tienda
            </Link>
          </nav>
        </aside>

        {/* Área de Compras o Perfil */}
        {activeTab === 'compras' ? (
          <div className="flex-1 min-w-0">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight drop-shadow-sm">Compras</h1>
              <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Historial de tus pedidos en {tenant.nombre}</p>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <div key={i} className={`${CARD} h-40 animate-pulse bg-white/10 dark:bg-white/5`} />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className={`${CARD} p-12 text-center flex flex-col items-center`}>
                <div className="w-16 h-16 bg-white/40 dark:bg-black/40 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-full flex items-center justify-center mb-4">
                  <Package className="w-8 h-8 text-[var(--color-text-tertiary)]" />
                </div>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">Aún no tienes compras</h3>
                <p className="text-[var(--color-text-tertiary)] text-sm max-w-sm mb-6">
                  Cuando realices un pedido en {tenant.nombre}, aparecerá aquí para que puedas darle seguimiento.
                </p>
                <Link
                  to="/"
                  className="px-6 py-2.5 rounded-lg text-[var(--color-background-primary)] font-medium transition-all hover:brightness-110 shadow-md hover:shadow-lg hover:scale-[1.02]"
                  style={{ backgroundColor: tenant.color_primario }}
                >
                  Explorar productos
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {orders.map(order => {
                    const statusConf = STATUS_CONFIG[order.estado] || STATUS_CONFIG.pendiente;
                    const date = new Date(order.created_at).toLocaleDateString('es-MX', { month: 'long', day: 'numeric', year: 'numeric' });
                    
                    return (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={CARD}
                      >
                        {/* Header Card */}
                        <div className="border-b border-white/20 dark:border-white/10 px-5 py-3 flex flex-wrap gap-4 items-center justify-between bg-white/10 dark:bg-black/10 backdrop-blur-sm">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-[var(--color-text-primary)]">{date}</span>
                            <div className="w-1 h-1 rounded-full bg-[var(--color-text-tertiary)] opacity-50" />
                            <span className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider font-mono">{order.numero}</span>
                          </div>
                          <div className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${statusConf.bgClass} ${statusConf.colorClass} border border-white/20 dark:border-white/5`}>
                            {statusConf.label}
                          </div>
                        </div>

                        {/* Body Card */}
                        <div className="p-5 flex flex-col md:flex-row gap-6 items-start md:items-center">
                          <div className="flex-1 space-y-4 w-full">
                            {order.pedido_items?.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-xl bg-white/40 dark:bg-black/40 backdrop-blur-md border border-white/20 dark:border-white/10 shrink-0 flex items-center justify-center shadow-inner">
                                  <Package className="w-6 h-6 text-[var(--color-text-tertiary)]" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-[var(--color-text-primary)] truncate">{item.nombre_producto}</p>
                                  <p className="text-sm text-[var(--color-text-tertiary)] mt-0.5">{item.cantidad} x ${item.precio_unitario}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="w-full md:w-px md:h-20 bg-white/20 dark:bg-white/10 md:block hidden" />

                          <div className="flex flex-col gap-3 w-full md:w-auto md:min-w-[180px] shrink-0">
                            <div className="flex flex-col">
                              <span className="text-xs text-[var(--color-text-tertiary)]">Total del pedido</span>
                              <span className="text-xl font-black text-[var(--color-text-primary)] drop-shadow-sm">${order.total.toLocaleString()}</span>
                            </div>
                            
                            <Link
                              to="/"
                              className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg bg-white/40 dark:bg-black/40 backdrop-blur-md border border-white/20 dark:border-white/10 text-[var(--color-text-primary)] text-sm font-medium hover:bg-white/50 dark:hover:bg-white/5 transition-colors shadow-sm"
                            >
                              Volver a comprar
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight drop-shadow-sm">Mi Perfil</h1>
              <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Actualiza tus datos de contacto y entrega</p>
            </div>

            <div className={`${CARD} p-6`}>
              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
                <div>
                  <label htmlFor="nombre_perfil" className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Nombre Completo</label>
                  <input
                    id="nombre_perfil"
                    type="text"
                    required
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    className="w-full px-4 py-2.5 border border-white/30 dark:border-white/10 rounded-xl text-sm bg-white/50 dark:bg-black/50 text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Ej: Juan Pérez"
                    style={{ fontSize: '16px' }}
                  />
                </div>

                <div>
                  <label htmlFor="email_perfil" className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Correo Electrónico (No editable)</label>
                  <input
                    id="email_perfil"
                    type="email"
                    disabled
                    value={profile?.email || ''}
                    className="w-full px-4 py-2.5 border border-white/10 dark:border-white/5 rounded-xl text-sm bg-white/10 dark:bg-black/10 text-[var(--color-text-tertiary)] outline-none cursor-not-allowed"
                    style={{ fontSize: '16px' }}
                  />
                </div>

                <div>
                  <label htmlFor="telefono_perfil" className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Teléfono de Contacto</label>
                  <input
                    id="telefono_perfil"
                    type="tel"
                    value={telefono}
                    onChange={e => setTelefono(e.target.value)}
                    className="w-full px-4 py-2.5 border border-white/30 dark:border-white/10 rounded-xl text-sm bg-white/50 dark:bg-black/50 text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Ej: +52 81 1234 5678"
                    style={{ fontSize: '16px' }}
                  />
                </div>

                <div>
                  <label htmlFor="direccion_perfil" className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Dirección de Envío Predeterminada</label>
                  <textarea
                    id="direccion_perfil"
                    value={direccion}
                    onChange={e => setDireccion(e.target.value)}
                    className="w-full px-4 py-2.5 border border-white/30 dark:border-white/10 rounded-xl text-sm bg-white/50 dark:bg-black/50 text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-emerald-500/20 min-h-[80px]"
                    placeholder="Calle, número, colonia, código postal"
                    style={{ fontSize: '16px' }}
                  />
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    type="submit"
                    disabled={isSaving}
                    style={{ backgroundColor: tenant.color_primario, color: '#fff' }}
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-97 transition-all shadow-sm focus:outline-none flex items-center gap-2"
                  >
                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
