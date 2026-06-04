// ─── CHECKOUT SERVICE (Stripe) ──────────────────────────────────
// Servicio que conecta el carrito del frontend con la Edge Function
// `create-checkout-session`, la cual implementa Price Hardening.
//
// FLUJO COMPLETO:
//   1. Frontend envía SOLO IDs + cantidades (jamás precios)
//   2. Edge Function resuelve precios desde la DB (Zero-Trust)
//   3. Edge Function crea sesión de Stripe Checkout
//   4. Este servicio redirige al usuario a la URL de pago de Stripe
//   5. Stripe confirma el pago y dispara el webhook
//   6. El webhook inserta/actualiza el pedido en la DB automáticamente
//
// GUEST CHECKOUT: Usuarios no autenticados usan la anon key de
// Supabase. La Edge Function acepta tanto JWT como anon key.
// La seguridad se mantiene vía Price Hardening (precios server-side).
// ────────────────────────────────────────────────────────────────

import { supabase } from '../lib/supabaseClient';

interface CheckoutItem {
  product_id: string;
  variant_id: string | null;
  quantity: number;
}

interface CheckoutParams {
  tenantId: string;
  items: CheckoutItem[];
  successUrl: string;
  cancelUrl: string;
  orderId?: string;   // ID del pedido pre-creado (patrón Order-First)
}

/**
 * Inicia el flujo de pago seguro con Stripe.
 *
 * Llama a la Edge Function `create-checkout-session` que:
 * - Verifica que la tienda tenga Nivel 2+ (Feature Gate)
 * - Calcula precios desde la DB (Price Hardening)
 * - Crea una sesión de Stripe Checkout
 * - Retorna la URL de pago
 *
 * Soporta tanto usuarios autenticados (JWT) como Guest Checkout (anon key).
 *
 * @returns URL de Stripe Checkout para redirigir al usuario
 * @throws Error si el pago no puede iniciarse
 */
export async function initiateStripeCheckout({
  tenantId,
  items,
  successUrl,
  cancelUrl,
  orderId,
}: CheckoutParams): Promise<string> {
  // Intentar obtener el token JWT del usuario actual
  const { data: { session } } = await supabase.auth.getSession();

  // Construir el header de autorización:
  // - Si hay sesión → Bearer JWT (usuario autenticado)
  // - Si no → Bearer anon key (Guest Checkout)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const authToken = session?.access_token || supabaseAnonKey;

  if (!authToken) {
    throw new Error('No se pudo autenticar la solicitud de pago.');
  }

  // Construir la URL de la Edge Function
  const functionUrl = `${supabaseUrl}/functions/v1/create-checkout-session`;

  // Llamar a la Edge Function con el payload seguro (sin precios)
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      items,
      success_url: successUrl,
      cancel_url: cancelUrl,
      order_id: orderId || null,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error al crear la sesión de pago.');
  }

  if (!data.url) {
    throw new Error('No se recibió la URL de pago de Stripe.');
  }

  return data.url;
}

interface OpenpayCheckoutParams extends CheckoutParams {
  paymentMethodType: "card" | "spei" | "store";
  deviceData: string;
  tokenId?: string | null;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
}

export async function initiateOpenpayCheckout({
  tenantId,
  items,
  successUrl,
  cancelUrl,
  orderId,
  paymentMethodType,
  deviceData,
  tokenId,
  customer
}: OpenpayCheckoutParams): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const authToken = session?.access_token || supabaseAnonKey;

  if (!authToken) {
    throw new Error('No se pudo autenticar la solicitud de pago.');
  }

  const functionUrl = `${supabaseUrl}/functions/v1/create-openpay-checkout`;

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      items,
      success_url: successUrl,
      cancel_url: cancelUrl,
      order_id: orderId || null,
      payment_method_type: paymentMethodType,
      device_data: deviceData,
      token_id: tokenId || null,
      customer
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error al procesar el pago con OpenPay.');
  }

  return data;
}
