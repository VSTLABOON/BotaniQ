import { supabase } from '../lib/supabaseClient';

export interface RepartidorData {
  id: string;
  nombre: string;
  activo: boolean;
  perfil_id?: string | null;
  perfiles?: {
    telefono: string | null;
  } | null;
}

/**
 * Obtiene todos los repartidores asociados a una tienda.
 */
export async function fetchRepartidores(tiendaId: string): Promise<RepartidorData[]> {
  const { data, error } = await supabase
    .from('repartidores')
    .select(`
      id,
      nombre,
      activo,
      perfil_id,
      perfiles (
        telefono
      )
    `)
    .eq('tienda_id', tiendaId);

  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.id,
    nombre: r.nombre,
    activo: r.activo,
    perfil_id: r.perfil_id,
    perfiles: Array.isArray(r.perfiles) 
      ? (r.perfiles[0] || null) 
      : (r.perfiles || null)
  }));
}

/**
 * Crea un nuevo repartidor asociado a una tienda.
 */
export async function createRepartidor(
  tiendaId: string,
  nombre: string,
  activo: boolean
): Promise<{ id: string; nombre: string; activo: boolean }> {
  const { data, error } = await supabase
    .from('repartidores')
    .insert({
      tienda_id: tiendaId,
      nombre: nombre.trim(),
      activo: activo
    })
    .select('id, nombre, activo')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Actualiza el estatus activo/inactivo de un repartidor.
 */
export async function updateRepartidorEstatus(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase
    .from('repartidores')
    .update({ activo: activo })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Elimina un repartidor de la base de datos.
 */
export async function deleteRepartidor(id: string): Promise<void> {
  const { error } = await supabase
    .from('repartidores')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
