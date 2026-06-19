import { supabase } from '../lib/supabaseClient';
import { TrialExpiredError, isDbTrialExpiredError } from '../lib/errors';

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
  // NOTA: El subscription_level se inicializa automáticamente en 1 (Básico)
  // en la base de datos a través de los triggers/RPC de creación de tienda (Fase de trial).
  // No se actualiza aquí desde el cliente para mantener Column-Level Security (CLS) y mitigar fugas.
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

  if (error) {
    if (isDbTrialExpiredError(error)) {
      throw new TrialExpiredError();
    }
    throw error;
  }
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

/**
 * Registra un registro de prueba gratuita en la tabla suscripciones.
 */
export async function createTrialSubscription(tiendaId: string, plan: string): Promise<void> {
  const fechaInicio = new Date();
  const fechaRenovacion = new Date(fechaInicio.getTime() + 14 * 24 * 60 * 60 * 1000);

  const { error } = await supabase
    .from('suscripciones')
    .insert({
      tenant_id: tiendaId,
      plan: plan === 'gratis' ? 'basico' : plan,
      estado: 'prueba',
      fecha_inicio: fechaInicio.toISOString(),
      fecha_renovacion: fechaRenovacion.toISOString(),
      monto_mensual: 0.00,
    });

  if (error) throw new Error(`Error al registrar prueba gratuita: ${error.message}`);

  // Disparar correo de bienvenida e inicio de prueba
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (user?.email) {
      const [tiendaRes, perfilRes] = await Promise.all([
        supabase.from('tiendas').select('nombre').eq('id', tiendaId).maybeSingle(),
        supabase.from('perfiles').select('nombre_completo').eq('id', user.id).maybeSingle()
      ]);

      const tiendaNombre = tiendaRes.data?.nombre || 'Tu Tienda';
      const nombreCompleto = perfilRes.data?.nombre_completo || user.user_metadata?.nombre_completo || 'Comerciante';

      await supabase.functions.invoke('send-email', {
        body: {
          toEmail: user.email,
          toName: nombreCompleto,
          templateId: 1, // Plantilla de bienvenida/trial iniciado
          params: {
            nombre: nombreCompleto,
            tienda_nombre: tiendaNombre,
          }
        }
      });
    }
  } catch (emailErr: any) {
    console.error('No se pudo enviar el correo de bienvenida/trial:', emailErr.message);
  }
}
