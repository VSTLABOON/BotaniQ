import { supabase } from '../lib/supabaseClient';

export interface SubscriptionUpdate {
  plan?: 'basico' | 'pro' | 'premium' | 'enterprise';
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
 */
export async function updateSubscription(tenantId: string, updates: SubscriptionUpdate): Promise<void> {
  const { error } = await supabase
    .from('suscripciones')
    .update(updates)
    .eq('tenant_id', tenantId);

  if (error) throw error;
}
