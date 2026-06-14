import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Calendar,
  ChevronDown,
  AlertCircle,
  Loader2,
  Sliders,
  Sparkles
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { CARD } from './components/config/SharedUI';
import { fetchReportesData, ReportesData } from '../../services/reportesService';
import { logger } from '../../lib/logger';

export default function AdminReportes() {
  const { tenant } = useTenant();
  const tenantColor = tenant.color_primario || '#1a7f5a';
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '3m'>('7d');
  const [data, setData] = useState<ReportesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const loadData = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchReportesData(tenant.id, timeRange);
      setData(res);
    } catch (err) {
      logger.error('Error fetching reportes metrics:', err as Error);
      setError('No se pudieron cargar las estadísticas. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, timeRange, retryTrigger]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRetry = () => {
    setRetryTrigger(prev => prev + 1);
  };

  const chartGridColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-border-secondary').trim() || '#e5e7eb'
    : '#e5e7eb';

  const formatTick = (value: number, maxValue: number) => {
    if (maxValue >= 10000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    if (maxValue >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${value.toLocaleString('es-MX')}`;
  };

  const ChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const isProduct = payload[0].payload.name !== undefined;
      return (
        <div className="bg-[var(--color-background-primary)] border border-[var(--color-border-secondary)] rounded-xl shadow-xl p-3 text-xs">
          <p className="font-semibold text-[var(--color-text-primary)]">
            {isProduct ? payload[0].payload.name : payload[0].payload.fecha}
          </p>
          <p className="text-emerald-500 font-bold mt-1">
            {isProduct ? 'Unidades' : 'Ventas'}: {isProduct ? payload[0].value : `$${payload[0].value.toLocaleString('es-MX')}`}
          </p>
          {!isProduct && payload[0].payload.pedidos !== undefined && (
            <p className="text-[var(--color-text-tertiary)] mt-0.5">
              Pedidos: {payload[0].payload.pedidos}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // ── 1. Estado de Carga (Skeleton) ──────────────────────────────
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center gap-4">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-[var(--color-background-tertiary)] rounded-lg" />
            <div className="h-4 w-72 bg-[var(--color-background-tertiary)] rounded-lg" />
          </div>
          <div className="h-10 w-36 bg-[var(--color-background-tertiary)] rounded-lg" />
        </div>
        
        {/* KPIs Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`${CARD} p-5 h-24 bg-[var(--color-background-tertiary)] opacity-60 rounded-2xl`} />
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
          <div className={`${CARD} p-6 h-[380px] bg-[var(--color-background-tertiary)] opacity-60 rounded-2xl`} />
          <div className={`${CARD} p-6 h-[380px] bg-[var(--color-background-tertiary)] opacity-60 rounded-2xl`} />
        </div>
      </div>
    );
  }

  // ── 2. Estado de Error ─────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center py-32 gap-4 text-center font-sans">
        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 flex items-center justify-center text-red-500">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Error al cargar reportes</h3>
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

  // ── 3. Estado Vacío General (0 pedidos en total) ───────────────
  if (!data?.hasAnyPaidOrders) {
    return (
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center py-32 gap-4 text-center font-sans">
        <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 flex items-center justify-center text-emerald-500">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Aún no tienes pedidos registrados</h3>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1 max-w-md mx-auto">
            Cuando empieces a recibir pedidos, aquí verás tus estadísticas.
          </p>
        </div>
      </div>
    );
  }

  const kpis = [
    {
      title: 'Ventas Totales',
      value: `$${data.kpis.totalRevenue.toLocaleString('es-MX')}`,
      change: data.kpis.revenueChange === 0 ? 'Sin cambios' : `${data.kpis.revenueChange > 0 ? '+' : ''}${data.kpis.revenueChange}%`,
      positive: data.kpis.revenueChange >= 0,
      icon: DollarSign,
      color: tenantColor,
    },
    {
      title: 'Pedidos Completados',
      value: String(data.kpis.completedOrders),
      change: data.kpis.ordersChange === 0 ? 'Sin cambios' : `${data.kpis.ordersChange > 0 ? '+' : ''}${data.kpis.ordersChange}%`,
      positive: data.kpis.ordersChange >= 0,
      icon: ShoppingBag,
      color: tenantColor,
    },
    {
      title: 'Ticket Promedio',
      value: `$${Math.round(data.kpis.averageTicket).toLocaleString('es-MX')}`,
      change: data.kpis.ticketChange === 0 ? 'Sin cambios' : `${data.kpis.ticketChange > 0 ? '+' : ''}${data.kpis.ticketChange}%`,
      positive: data.kpis.ticketChange >= 0,
      icon: TrendingUp,
      color: tenantColor,
    },
    {
      title: 'Unidades Vendidas',
      value: String(data.kpis.totalProductsSold),
      change: data.kpis.productsSoldChange === 0 ? 'Sin cambios' : `${data.kpis.productsSoldChange > 0 ? '+' : ''}${data.kpis.productsSoldChange}%`,
      positive: data.kpis.productsSoldChange >= 0,
      icon: Sparkles,
      color: tenantColor,
    },
  ];

  const maxSalesVal = Math.max(...data.salesData.map(d => d.ventas), 0);
  const hasTimelineData = !data.salesData.every(d => d.ventas === 0);
  const hasProductsData = data.topProducts.length > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Reportes y Estadísticas</h1>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Analiza las ventas, pedidos y desempeño general de tu florería.
          </p>
        </div>

        {/* Selector de Rango */}
        <div className="relative">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="appearance-none bg-white/40 dark:bg-black/40 backdrop-blur-md border border-white/30 dark:border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm font-semibold text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer shadow-sm"
          >
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="3m">Últimos 3 meses</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)] pointer-events-none" />
        </div>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <div key={idx} className={`${CARD} p-5 flex items-center justify-between`}>
            <div className="space-y-1.5 min-w-0">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider block">
                {kpi.title}
              </span>
              <span className="text-2xl font-bold text-[var(--color-text-primary)] block">
                {kpi.value}
              </span>
              <span className={`text-xs font-bold flex items-center gap-1 ${
                kpi.positive ? 'text-emerald-500' : 'text-red-500'
              }`}>
                {kpi.positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {kpi.change} <span className="text-[var(--color-text-tertiary)] font-normal">vs. período anterior</span>
              </span>
            </div>
            <div
              style={{ backgroundColor: `${kpi.color}12`, color: kpi.color }}
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            >
              <kpi.icon size={22} />
            </div>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* Curva de Ventas */}
        <div className={`${CARD} p-6 space-y-4`}>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">Curva de Ingresos</h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">Visualización de ingresos diarios en el rango seleccionado</p>
            </div>
            <Calendar className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          </div>

          <div className="h-[300px] w-full flex items-center justify-center">
            {!hasTimelineData ? (
              <div className="flex flex-col items-center justify-center text-[var(--color-text-tertiary)] py-10">
                <BarChart3 className="w-10 h-10 mb-3" strokeWidth={1.5} />
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">Sin ventas en este periodo</p>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Intenta seleccionar otro rango de tiempo.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.salesData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={tenantColor} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={tenantColor} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                  <XAxis
                    dataKey="fecha"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }}
                    tickFormatter={(val) => formatTick(val, maxSalesVal)}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="ventas" name="Ventas ($)" stroke={tenantColor} strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Productos */}
        <div className={`${CARD} p-6 space-y-4`}>
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">Más Vendidos</h2>
            <p className="text-xs text-[var(--color-text-tertiary)]">Ranking de los arreglos con más volumen de ventas</p>
          </div>

          <div className="h-[300px] w-full flex items-center justify-center">
            {!hasProductsData ? (
              <div className="flex flex-col items-center justify-center text-[var(--color-text-tertiary)] py-10">
                <ShoppingBag className="w-10 h-10 mb-3" strokeWidth={1.5} />
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">Sin productos vendidos</p>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">No hay productos registrados en este periodo.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topProducts} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} horizontal={false} />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--color-text-tertiary)', fontSize: 10 }}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    width={110}
                    tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="cantidad" name="Vendidos" fill={tenantColor} radius={[0, 6, 6, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
