import { supabase } from '../lib/supabaseClient';

export interface ReportesData {
  kpis: {
    totalRevenue: number;
    revenueChange: number;
    completedOrders: number;
    ordersChange: number;
    averageTicket: number;
    ticketChange: number;
    totalProductsSold: number;
    productsSoldChange: number;
  };
  salesData: {
    fecha: string;
    ventas: number;
    pedidos: number;
  }[];
  topProducts: {
    name: string;
    cantidad: number;
  }[];
  hasAnyPaidOrders: boolean;
}

export async function fetchReportesData(
  tiendaId: string,
  range: '7d' | '30d' | '3m'
): Promise<ReportesData> {
  const now = new Date();
  
  // Dates for KPIs (Current Month vs Previous Month)
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

  // Date for range filter
  const startDate = new Date();
  if (range === '7d') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (range === '30d') {
    startDate.setDate(startDate.getDate() - 30);
  } else if (range === '3m') {
    startDate.setMonth(startDate.getMonth() - 3);
  }
  startDate.setHours(0, 0, 0, 0);

  // Parallel fetch for current month, previous month, range orders, range items, and paid status
  const [currentMonthResult, prevMonthResult, rangeOrdersResult, rangeItemsResult, totalCheckResult] = await Promise.all([
    supabase
      .from('pedidos')
      .select('total, created_at, pedido_items(cantidad)')
      .eq('tienda_id', tiendaId)
      .eq('estado', 'pagado')
      .gte('created_at', startOfCurrentMonth)
      .lte('created_at', endOfCurrentMonth),
    supabase
      .from('pedidos')
      .select('total, created_at, pedido_items(cantidad)')
      .eq('tienda_id', tiendaId)
      .eq('estado', 'pagado')
      .gte('created_at', startOfPreviousMonth)
      .lte('created_at', endOfPreviousMonth),
    supabase
      .from('pedidos')
      .select('total, created_at')
      .eq('tienda_id', tiendaId)
      .eq('estado', 'pagado')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true }),
    supabase
      .from('pedido_items')
      .select(`
        cantidad,
        nombre_producto,
        productos(nombre),
        pedidos!inner(tienda_id, estado, created_at)
      `)
      .eq('pedidos.tienda_id', tiendaId)
      .eq('pedidos.estado', 'pagado')
      .gte('pedidos.created_at', startDate.toISOString()),
    supabase
      .from('pedidos')
      .select('id')
      .eq('tienda_id', tiendaId)
      .eq('estado', 'pagado')
      .limit(1)
  ]);

  if (currentMonthResult.error) throw currentMonthResult.error;
  if (prevMonthResult.error) throw prevMonthResult.error;
  if (rangeOrdersResult.error) throw rangeOrdersResult.error;
  if (rangeItemsResult.error) throw rangeItemsResult.error;
  if (totalCheckResult.error) throw totalCheckResult.error;

  const currentMonthOrders = currentMonthResult.data || [];
  const prevMonthOrders = prevMonthResult.data || [];
  const rangeOrders = rangeOrdersResult.data || [];
  const rangeItems = rangeItemsResult.data || [];
  const hasAnyPaidOrders = (totalCheckResult.data || []).length > 0;

  // Process Revenue KPI
  const currentRevenue = currentMonthOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const prevRevenue = prevMonthOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const revenueChange = prevRevenue > 0
    ? Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100)
    : currentRevenue > 0 ? 100 : 0;

  // Process Completed Orders KPI
  const currentCount = currentMonthOrders.length;
  const prevCount = prevMonthOrders.length;
  const ordersChange = prevCount > 0
    ? Math.round(((currentCount - prevCount) / prevCount) * 100)
    : currentCount > 0 ? 100 : 0;

  // Process Average Ticket KPI
  const currentAvgTicket = currentCount > 0 ? currentRevenue / currentCount : 0;
  const prevAvgTicket = prevCount > 0 ? prevRevenue / prevCount : 0;
  const ticketChange = prevAvgTicket > 0
    ? Math.round(((currentAvgTicket - prevAvgTicket) / prevAvgTicket) * 100)
    : currentAvgTicket > 0 ? 100 : 0;

  // Process Total Products Sold KPI
  const sumQuantity = (orders: any[]) => {
    return orders.reduce((sum, o) => {
      const items = Array.isArray(o.pedido_items) ? o.pedido_items : [o.pedido_items].filter(Boolean);
      const qty = items.reduce((s: number, item: any) => s + (item?.cantidad || 0), 0);
      return sum + qty;
    }, 0);
  };

  const currentProductsSold = sumQuantity(currentMonthOrders);
  const prevProductsSold = sumQuantity(prevMonthOrders);
  const productsSoldChange = prevProductsSold > 0
    ? Math.round(((currentProductsSold - prevProductsSold) / prevProductsSold) * 100)
    : currentProductsSold > 0 ? 100 : 0;

  // Generate continuous date mapping for timeline
  const salesMap: Record<string, { ventas: number; pedidos: number }> = {};
  const numDays = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    salesMap[key] = { ventas: 0, pedidos: 0 };
  }

  rangeOrders.forEach((o) => {
    const key = o.created_at.split('T')[0];
    if (salesMap[key]) {
      salesMap[key].ventas += o.total || 0;
      salesMap[key].pedidos += 1;
    }
  });

  const formatDateLabel = (dateStr: string, r: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    if (r === '7d') {
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      return days[date.getDay()];
    }
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  const salesData = Object.entries(salesMap).map(([dateStr, data]) => ({
    fecha: formatDateLabel(dateStr, range),
    ventas: data.ventas,
    pedidos: data.pedidos,
  }));

  // Process top items sold in range
  const productMap: Record<string, { name: string; cantidad: number }> = {};
  rangeItems.forEach((item: any) => {
    const pName = item.productos?.nombre || item.nombre_producto || 'Producto';
    if (!productMap[pName]) {
      productMap[pName] = { name: pName, cantidad: 0 };
    }
    productMap[pName].cantidad += item.cantidad || 1;
  });

  const topProducts = Object.values(productMap)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5);

  return {
    kpis: {
      totalRevenue: currentRevenue,
      revenueChange,
      completedOrders: currentCount,
      ordersChange,
      averageTicket: currentAvgTicket,
      ticketChange,
      totalProductsSold: currentProductsSold,
      productsSoldChange,
    },
    salesData,
    topProducts,
    hasAnyPaidOrders,
  };
}
