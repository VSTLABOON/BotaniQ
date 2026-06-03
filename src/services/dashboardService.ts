// ─── DASHBOARD SERVICE ──────────────────────────────────────────
// Capa de servicios para la obtención de métricas y KPIs del Admin Dashboard.
// Evita llamadas directas a Supabase desde la vista.
// ────────────────────────────────────────────────────────────────

import { supabase } from '../lib/supabaseClient';

export interface DashboardData {
  currentOrders: any[];
  prevOrders: any[];
  weekOrders: any[];
  todayOrders: any[];
  topItems: any[];
}

/**
 * Obtiene de forma paralela los datos requeridos para poblar los KPIs,
 * gráfico semanal y timelines de entregas del dashboard de administración.
 */
export async function fetchDashboardMetrics(
  tiendaId: string,
  dates: {
    startOfMonth: string;
    startOfPrevMonth: string;
    endOfPrevMonth: string;
    sevenDaysAgo: string;
    todayStart: string;
  }
): Promise<DashboardData> {
  const [
    currentOrdersResult,
    prevOrdersResult,
    weekOrdersResult,
    todayOrdersResult,
    topItemsResult
  ] = await Promise.all([
    supabase
      .from('pedidos')
      .select('id, total, estado, created_at')
      .eq('tienda_id', tiendaId)
      .gte('created_at', dates.startOfMonth),
    supabase
      .from('pedidos')
      .select('id, total')
      .eq('tienda_id', tiendaId)
      .gte('created_at', dates.startOfPrevMonth)
      .lte('created_at', dates.endOfPrevMonth),
    supabase
      .from('pedidos')
      .select('total, created_at')
      .eq('tienda_id', tiendaId)
      .gte('created_at', dates.sevenDaysAgo)
      .not('estado', 'eq', 'cancelado'),
    supabase
      .from('pedidos')
      .select('id, total, estado, created_at, email_cliente, datos_envio, pedido_items(id, nombre_producto, cantidad, precio_unitario, variante_id)')
      .eq('tienda_id', tiendaId)
      .gte('created_at', dates.todayStart)
      .order('created_at', { ascending: true })
      .limit(6),
    supabase
      .from('pedido_items')
      .select('nombre_producto, precio_unitario, cantidad, pedidos!inner(tienda_id, created_at)')
      .eq('pedidos.tienda_id', tiendaId)
      .gte('pedidos.created_at', dates.startOfMonth)
  ]);

  if (currentOrdersResult.error) throw currentOrdersResult.error;
  if (prevOrdersResult.error) throw prevOrdersResult.error;
  if (weekOrdersResult.error) throw weekOrdersResult.error;
  if (todayOrdersResult.error) throw todayOrdersResult.error;
  if (topItemsResult.error) throw topItemsResult.error;

  return {
    currentOrders: currentOrdersResult.data || [],
    prevOrders: prevOrdersResult.data || [],
    weekOrders: weekOrdersResult.data || [],
    todayOrders: todayOrdersResult.data || [],
    topItems: topItemsResult.data || []
  };
}
