import { supabase } from '../lib/supabaseClient';

export interface Notification {
  id: string;
  tienda_id: string;
  destinatario_id: string | null;
  tipo: string;
  titulo: string;
  mensaje: string | null;
  leida: boolean;
  metadata: any;
  created_at: string;
}

/**
 * Devuelve las últimas 30 notificaciones ordenadas por created_at DESC.
 */
export async function fetchAdminNotifications(tiendaId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notificaciones')
    .select('id, tienda_id, destinatario_id, tipo, titulo, mensaje, leida, metadata, created_at')
    .eq('tienda_id', tiendaId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw error;
  return data || [];
}

/**
 * Actualiza leida = true para una notificación específica.
 */
export async function markNotificationAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Actualiza leida = true para todas las notificaciones de una tienda.
 */
export async function markAllAsRead(tiendaId: string): Promise<void> {
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('tienda_id', tiendaId)
    .eq('leida', false);

  if (error) throw error;
}
