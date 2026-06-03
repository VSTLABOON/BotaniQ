// ─── ADMIN DASHBOARD PAGE ───────────────────────────────────────
// Panel de control con KPIs, gráfico de ventas, timeline de entregas
// y ranking de productos — todo conectado a Supabase en vivo.
// ────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown,
  ShoppingBag, Truck, Clock, MapPin, Heart, Package, Loader2, Bell, AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer, Area, AreaChart,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { UI_COLORS } from '../../lib/constants.ts';
import { logger } from '../../lib/logger';
import { subscribeToPushNotifications } from '../../lib/pushNotifications';
import { fetchDashboardMetrics } from '../../services/dashboardService';

import { CARD as BASE_CARD } from './components/config/SharedUI';

const CARD = `${BASE_CARD} p-5`;

// ── Tipos ────────────────────────────────────────────────────────
interface KPI {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  icon: typeof TrendingUp;
  iconBg: string;
  iconColor: string;
}

interface DaySales {
  day: string;
  ventas: number;
}

interface DeliveryItem {
  id: string;
  time: string;
  recipient: string;
  arrangement: string;
  dedication: string | null;
  status: 'entregado' | 'en_ruta' | 'preparando' | 'pendiente';
}

interface TopProduct {
  name: string;
  units: number;
  price: string;
  img: string;
}

// ── Status config ────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  entregado:  { label: 'Entregado',  dot: 'bg-emerald-500', text: 'text-emerald-700' },
  en_ruta:    { label: 'En camino',  dot: 'bg-blue-500',    text: 'text-blue-700' },
  preparando: { label: 'Preparando', dot: 'bg-amber-500',   text: 'text-amber-700' },
  pendiente:  { label: 'Pendiente',  dot: 'bg-[var(--color-border-primary)]',    text: 'text-[var(--color-text-secondary)]' },
};

// ── Tooltip personalizado ────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-text-primary)] text-[var(--color-background-primary)] px-3 py-2 rounded-lg shadow-lg text-sm">
      <p className="font-medium">{label}</p>
      <p className="font-semibold" style={{ color: 'var(--color-primario)' }}>
        ${payload[0].value.toLocaleString()}
      </p>
    </div>
  );
}

// ── Helper: Nombre del día ───────────────────────────────────────
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ── Componente Principal ─────────────────────────────────────────
export default function AdminDashboardPage() {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [weeklySales, setWeeklySales] = useState<DaySales[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  // Saludo por hora
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const userName = profile?.nombre ? profile.nombre.split(' ')[0] : 'Equipo';
  const isEmployee = profile?.rol === 'empleado';

  useEffect(() => {
    let active = true;

    if (!tenant?.id || tenant.id === 'local-fallback') return;

    async function fetchDashboardData() {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const metrics = await fetchDashboardMetrics(tenant.id, {
          startOfMonth,
          startOfPrevMonth,
          endOfPrevMonth,
          sevenDaysAgo: sevenDaysAgo.toISOString(),
          todayStart: todayStart.toISOString()
        });

        if (!active) return;

        const currentOrders = metrics.currentOrders;
        const prevOrders = metrics.prevOrders;
        const weekOrders = metrics.weekOrders;
        const todayOrders = metrics.todayOrders;
        const topItems = metrics.topItems;

        // ── Procesar 1. KPIs: Pedidos del mes actual y anterior ──────
        const currentTotal = (currentOrders || []).reduce((sum, o) => sum + (o.total || 0), 0);
        const prevTotal = (prevOrders || []).reduce((sum, o) => sum + (o.total || 0), 0);
        const revenueChange = prevTotal > 0
          ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100)
          : currentTotal > 0 ? 100 : 0;

        const currentCount = currentOrders?.length || 0;
        const prevCount = prevOrders?.length || 0;
        const orderChange = prevCount > 0
          ? Math.round(((currentCount - prevCount) / prevCount) * 100)
          : currentCount > 0 ? 100 : 0;

        const pendingCount = (currentOrders || []).filter(
          o => o.estado === 'pendiente' || o.estado === 'preparando'
        ).length;

        const kpiList = [];
        if (!isEmployee) {
          kpiList.push({
            label: 'Ingresos del Mes',
            value: `$${currentTotal.toLocaleString()}`,
            change: revenueChange === 0 ? 'Sin cambios' : `${revenueChange > 0 ? '+' : ''}${revenueChange}%`,
            positive: revenueChange >= 0,
            icon: TrendingUp,
            iconBg: 'bg-emerald-500/10',
            iconColor: 'text-emerald-500',
          });
        }
        kpiList.push(
          {
            label: 'Pedidos del Mes',
            value: String(currentCount),
            change: orderChange === 0 ? 'Sin cambios' : `${orderChange > 0 ? '+' : ''}${orderChange}%`,
            positive: orderChange >= 0,
            icon: ShoppingBag,
            iconBg: 'bg-blue-500/10',
            iconColor: 'text-blue-500',
          },
          {
            label: 'Entregas Pendientes',
            value: String(pendingCount),
            change: pendingCount === 0 ? 'Al día' : `${pendingCount} por resolver`,
            positive: pendingCount === 0,
            icon: Truck,
            iconBg: 'bg-amber-500/10',
            iconColor: 'text-amber-500',
          }
        );
        setKpis(kpiList);

        // ── Procesar 2. Ventas de la semana (últimos 7 días) ──────
        const salesByDay: Record<string, number> = {};
        for (let i = 0; i < 7; i++) {
          const d = new Date(sevenDaysAgo);
          d.setDate(d.getDate() + i);
          const key = d.toISOString().split('T')[0];
          salesByDay[key] = 0;
        }
        (weekOrders || []).forEach(o => {
          const key = o.created_at.split('T')[0];
          if (salesByDay[key] !== undefined) {
            salesByDay[key] += o.total || 0;
          }
        });

        setWeeklySales(
          Object.entries(salesByDay).map(([dateStr, ventas]) => ({
            day: DAY_NAMES[new Date(dateStr + 'T12:00:00').getDay()],
            ventas,
          }))
        );

        // ── Procesar 3. Entregas de hoy ───────────────────────────
        if (todayOrders) {
          setDeliveries(
            todayOrders.map(o => {
              const envio = (o.datos_envio as any) || {};
              const firstItem = o.pedido_items?.[0];
              return {
                id: o.id,
                time: new Date(o.created_at).toLocaleTimeString('es-MX', {
                  hour: '2-digit', minute: '2-digit',
                }),
                recipient: envio.recipientName || o.email_cliente || 'Cliente',
                arrangement: firstItem?.nombre_producto || 'Arreglo personalizado',
                dedication: envio.customMessage || null,
                status: o.estado as DeliveryItem['status'],
              };
            })
          );
        }

        // ── Procesar 4. Top productos (más vendidos del mes) ──────
        if (topItems) {
          // Agrupar por nombre de producto
          const productMap: Record<string, { units: number; price: number }> = {};
          topItems.forEach((item: any) => {
            const name = item.nombre_producto || 'Producto';
            if (!productMap[name]) productMap[name] = { units: 0, price: item.precio_unitario || 0 };
            productMap[name].units += item.cantidad || 1;
          });

          const sortedProducts = Object.entries(productMap)
            .sort(([, a], [, b]) => b.units - a.units)
            .slice(0, 4)
            .map(([name, data]) => ({
              name,
              units: data.units,
              price: `$${data.price.toLocaleString()}`,
              img: '', // No tenemos la imagen desde pedido_items
            }));

          setTopProducts(sortedProducts);
        }

      } catch (err) {
        if (!active) return;
        logger.error('[Dashboard] Error loading data:', err as Error);
        setError('No se pudieron cargar las métricas. Intenta de nuevo más tarde.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchDashboardData();

    return () => {
      active = false;
    };
  }, [tenant?.id, profile?.rol, retryTrigger]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRetryTrigger(prev => prev + 1);
  };

  // ── Error state ────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center py-32 gap-4 text-center font-sans">
        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 flex items-center justify-center text-red-500">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Error al cargar el panel</h3>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1 max-w-md mx-auto">
            {error}
          </p>
        </div>
        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm active:scale-95 cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // ── Loading state ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center py-32 gap-3 text-[var(--color-text-tertiary)]">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Cargando métricas...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans">
      {/* ── Encabezado ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1 flex flex-wrap items-center gap-2">
            {greeting}, 
            <span className="bg-[var(--color-primario)] text-[var(--color-primario-texto)] px-2.5 py-0.5 rounded-lg text-xl shadow-sm">
              {userName}
            </span>
          </h1>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Resumen de actividad · {new Date().toLocaleDateString('es-MX', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </p>
        </div>
        
        <button 
          onClick={() => subscribeToPushNotifications(profile?.id || '', tenant?.id || '')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-colors w-full md:w-auto shadow-sm shrink-0"
          style={{ backgroundColor: 'var(--color-primario)', color: 'var(--color-primario-texto)' }}
        >
          <Bell className="w-4 h-4" />
          Activar Notificaciones
        </button>
      </div>

      {/* ═══ KPIs ═══ */}
      <div className={`grid grid-cols-1 gap-4 ${isEmployee ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        {kpis.map((kpi) => (
          <motion.div layout key={kpi.label} className={`${CARD} flex items-start gap-4`} transition={{ duration: 0.4, ease: "easeOut" }}>
            <div className={`w-11 h-11 rounded-xl ${kpi.iconBg} flex items-center justify-center shrink-0`}>
              <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} strokeWidth={1.8} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-[var(--color-text-tertiary)] font-medium tracking-wide">{kpi.label}</span>
              <span className="text-2xl font-bold text-[var(--color-text-primary)] leading-tight mt-0.5">{kpi.value}</span>
              <span className={`inline-flex items-center gap-1 mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-md w-fit ${
                kpi.positive ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10'
              }`}>
                {kpi.positive
                  ? <TrendingUp className="w-3 h-3" strokeWidth={2.5} />
                  : <TrendingDown className="w-3 h-3" strokeWidth={2.5} />
                }
                {kpi.change}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ═══ GRÁFICO + ENTREGAS ═══ */}
      <div className={`grid grid-cols-1 gap-6 ${isEmployee ? '' : 'xl:grid-cols-[1fr_340px]'}`}>
        {/* ── Gráfico de Ventas ── */}
        {!isEmployee && (
          <div className={CARD}>
            <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Ventas de la Semana</h2>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">Ingresos diarios en MXN (últimos 7 días)</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-primario)' }} />
              <span className="text-xs text-[var(--color-text-tertiary)] font-medium">Esta semana</span>
            </div>
          </div>
          <div className="h-[280px] -ml-2">
            {weeklySales.every(d => d.ventas === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-tertiary)]">
                <Package className="w-10 h-10 mb-3 text-[var(--color-text-tertiary)]" strokeWidth={1.5} />
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">Aún no hay ventas registradas</p>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1 mb-4 text-center max-w-[250px]">
                  Configura tu catálogo para empezar a recibir pedidos.
                </p>
                <Link to="/admin/catalogo" className="text-xs font-semibold bg-emerald-505/10 text-emerald-500 px-4 py-2 rounded-lg hover:bg-emerald-500/20 transition-colors">
                  Ir al catálogo
                </Link>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklySales} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primario)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--color-primario)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.CHART_GRID} vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: UI_COLORS.CHART_TICK, fontSize: 12 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: UI_COLORS.CHART_TICK, fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={45} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="ventas" stroke="var(--color-primario)" strokeWidth={2.5} fill="url(#salesGradient)" dot={false}
                    activeDot={{ r: 5, fill: 'var(--color-primario)', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        )}

        {/* ── Entregas de Hoy (Timeline) ── */}
        <div className={`${CARD} flex flex-col`}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Entregas de Hoy</h2>
            <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
              {deliveries.length} pedidos
            </span>
          </div>

          {deliveries.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10">
              <Truck className="w-10 h-10 mb-3 text-[var(--color-text-tertiary)]" strokeWidth={1.5} />
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">No hay entregas para hoy</p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1 mb-4 text-center max-w-[200px]">
                Puedes revisar el historial de pedidos pasados.
              </p>
              <Link to="/admin/pedidos" className="text-xs font-semibold bg-blue-500/10 text-blue-500 px-4 py-2 rounded-lg hover:bg-blue-500/20 transition-colors">
                Ver historial
              </Link>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto -mr-2 pr-2 space-y-0">
              {deliveries.map((delivery, i) => {
                const status = STATUS_CONFIG[delivery.status] || STATUS_CONFIG.pendiente;
                const isLast = i === deliveries.length - 1;
                return (
                  <motion.div layout key={delivery.id} transition={{ duration: 0.4, ease: "easeOut" }} className="flex gap-3 group">
                    <div className="flex flex-col items-center shrink-0 pt-1">
                      <div className={`w-2.5 h-2.5 rounded-full ${status.dot} ring-4 ring-white z-10`} />
                      {!isLast && <div className="w-px flex-1 bg-[var(--color-border-secondary)] my-1" />}
                    </div>
                    <div className={`flex-1 ${!isLast ? 'pb-5' : 'pb-1'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-[var(--color-text-tertiary)] flex items-center gap-1">
                          <Clock className="w-3 h-3" strokeWidth={2} />
                          {delivery.time}
                        </span>
                        <span className={`text-[0.65rem] font-semibold ${status.text}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-1 leading-tight">
                        {delivery.arrangement}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" strokeWidth={2} />
                        Para <span className="font-medium text-[var(--color-text-secondary)]">{delivery.recipient}</span>
                      </p>
                      {delivery.dedication && (
                        <div className="mt-2 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex items-start gap-2">
                          <Heart className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" strokeWidth={2.5} />
                          <p className="text-xs text-rose-700 italic leading-relaxed">
                            "{delivery.dedication}"
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ TOP PRODUCTOS ═══ */}
      <div className={CARD}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Productos Top del Mes</h2>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">Los más vendidos este periodo</p>
          </div>
          <Link to="/admin/catalogo" className="text-xs text-emerald-600 font-semibold hover:underline">
            Ver catálogo completo →
          </Link>
        </div>

        {topProducts.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center">
            <Package className="w-10 h-10 text-[var(--color-text-tertiary)] mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">Sin datos de ventas este mes</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1 mb-4">Los productos top aparecerán aquí cuando recibas pedidos.</p>
            <Link to="/admin/catalogo" className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg hover:bg-emerald-105 transition-colors">
              Agregar productos
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {topProducts.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-background-secondary)] transition-colors group">
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-[var(--color-background-tertiary)] flex items-center justify-center">
                    {item.img ? (
                      <img src={item.img} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <Package className="w-6 h-6 text-[var(--color-text-tertiary)]" />
                    )}
                  </div>
                  <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-[var(--color-text-primary)] text-[var(--color-background-primary)] text-[0.6rem] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{item.name}</span>
                  <span className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{item.price} MXN</span>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-lg font-bold text-[var(--color-text-primary)] leading-none">{item.units}</span>
                  <span className="text-[0.6rem] text-[var(--color-text-tertiary)] uppercase tracking-wider mt-0.5">ventas</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
