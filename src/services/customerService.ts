import { supabase } from '../lib/supabaseClient';

export interface CustomerProfileData {
  nombre_completo: string;
  telefono: string;
  direccion: string;
}

/**
 * Actualiza la información personal y de entrega del perfil del cliente.
 */
export async function updateCustomerProfile(profileId: string, data: CustomerProfileData): Promise<void> {
  const { error } = await supabase
    .from('perfiles')
    .update({
      nombre_completo: data.nombre_completo.trim(),
      telefono: data.telefono.trim(),
      direccion: data.direccion.trim(),
    })
    .eq('id', profileId);

  if (error) throw error;
}
