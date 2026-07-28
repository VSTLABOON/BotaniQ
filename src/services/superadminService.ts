import { supabase } from '../lib/supabaseClient';

export interface SubscriptionUpdate {
  plan?: 'basico' | 'aura' | 'pro' | 'premium' | 'enterprise';
  estado?: 'activo' | 'vencido' | 'prueba' | 'cancelado' | 'past_due' | 'unpaid' | 'pago_fallido';
  fecha_inicio?: string;
  fecha_renovacion?: string | null;
  monto_mensual?: number;
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
  currency?: string;
  country?: string | null;
  stripe_tax_id?: string | null;
}

function getSubscriptionLevel(plan: string, estado: string): number {
  if (estado === 'cancelado' || estado === 'vencido' || estado === 'unpaid' || estado === 'pago_fallido') {
    return 0; // Bloqueado / Inactivo
  }
  switch (plan) {
    case 'basico': return 1; // Esencia
    case 'aura': return 2;   // Aura
    case 'pro': return 3;    // Alquimia (Pro)
    case 'premium': return 4; // Edén (Premium)
    default: return 1;
  }
}

/**
 * Actualiza el nivel de suscripción SaaS de una tienda (gating de funcionalidades).
 */
export async function updateStoreSubscriptionLevel(storeId: string, level: number): Promise<void> {
  const { error } = await supabase
    .from('tiendas')
    .update({ subscription_level: level })
    .eq('id', storeId);

  if (error) throw error;
}

/**
 * Actualiza el plan y estado de facturación de suscripción para una tienda en suscripciones.
 * Si la suscripción no existe, se inserta una nueva fila automáticamente (comportamiento upsert).
 * También actualiza el campo tiendas.subscription_level correspondiente de forma sincronizada.
 */
export async function updateSubscription(tenantId: string, updates: SubscriptionUpdate): Promise<void> {
  // 1. Obtener la suscripción actual para validar si existe y combinar valores
  const { data: currentSub, error: fetchErr } = await supabase
    .from('suscripciones')
    .select('plan, estado')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;

  const finalPlan = updates.plan || currentSub?.plan || 'basico';
  const finalEstado = updates.estado || currentSub?.estado || 'prueba';
  const finalLevel = getSubscriptionLevel(finalPlan, finalEstado);

  // 2. Realizar la operación upsert sobre la tabla de suscripciones
  if (currentSub) {
    const { error } = await supabase
      .from('suscripciones')
      .update(updates)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('suscripciones')
      .insert({
        tenant_id: tenantId,
        plan: finalPlan,
        estado: finalEstado,
        monto_mensual: updates.monto_mensual ?? 0,
        ...updates
      });
    if (error) throw error;
  }

  // 3. Sincronizar el nivel de suscripción en la tabla tiendas
  const { error: storeError } = await supabase
    .from('tiendas')
    .update({ subscription_level: finalLevel })
    .eq('id', tenantId);

  if (storeError) throw storeError;
}
