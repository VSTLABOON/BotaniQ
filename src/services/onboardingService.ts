import { supabase } from '../lib/supabaseClient';

export interface OnboardingStoreData {
  slug: string;
  nombre: string;
  ciudad: string;
  whatsapp: string;
  direccion: string;
}

export interface OnboardingProfileData {
  nombre_completo: string;
  telefono: string;
  direccion: string;
}

/**
 * Actualiza la información inicial de la tienda autoprovisionada.
 */
export async function createTiendaProfile(tiendaId: string, data: OnboardingStoreData): Promise<void> {
  const { error } = await supabase
    .from('tiendas')
    .update({
      slug: data.slug,
      nombre: data.nombre.trim(),
      ciudad: data.ciudad,
      whatsapp: data.whatsapp.trim(),
      direccion: data.direccion.trim(),
      color_primario: '#10b981',
      color_secundario: '#064e3b',
      color_acento: '#C49A3C',
    })
    .eq('id', tiendaId);

  if (error) throw error;
}

/**
 * Actualiza la información inicial del perfil del usuario fundador.
 */
export async function assignUserRole(userId: string, data: OnboardingProfileData): Promise<void> {
  const { error } = await supabase
    .from('perfiles')
    .update({
      nombre_completo: data.nombre_completo.trim(),
      telefono: data.telefono.trim(),
      direccion: data.direccion.trim(),
    })
    .eq('id', userId);

  if (error) throw error;
}
