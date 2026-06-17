// ═══════════════════════════════════════════════════════════════════
// EDGE FUNCTION: stripe-webhook (ZERO-TRUST PROTOCOL v2 + SaaS Global)
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.0";
import Stripe from "npm:stripe@17.7.0";
import { getCorsHeaders, forbiddenOriginResponse } from "../_shared/cors.ts";

interface MetadataItem {
  producto_id: string;
  variante_id: string | null;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
}

// Inicialización de Stripe
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2025-04-30.basil",
  httpClient: Stripe.createFetchHttpClient(),
});

// Supabase Admin (Service Role → bypass de RLS)
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") as string;

// Divisas zero-decimal soportadas por Stripe
const ZERO_DECIMAL_CURRENCIES = [
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
  'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'
];

function resolveMetodoPago(session: Stripe.Checkout.Session): string {
  const type = session.payment_method_types?.[0] ?? 'card';
  const map: Record<string, string> = {
    'customer_balance': 'spei',
    'oxxo': 'oxxo',
    'card': 'tarjeta',
  };
  return map[type] ?? 'tarjeta';
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("Origin");
    return new Response("ok", { headers: getCorsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.error("⛔ Webhook rechazado: Header stripe-signature ausente.");
      return jsonResponse({ error: "Missing stripe-signature header." }, 400);
    }

    if (!WEBHOOK_SECRET) {
      console.error("⛔ STRIPE_WEBHOOK_SECRET no configurado en el servidor.");
      return jsonResponse({ error: "Server misconfiguration." }, 500);
    }

    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        WEBHOOK_SECRET,
        undefined,
        Stripe.createSubtleCryptoProvider(),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`⛔ Firma criptográfica inválida: ${msg}`);
      return jsonResponse({ error: "Invalid signature. Event rejected." }, 400);
    }

    console.log(`✅ Evento verificado: ${event.type} [${event.id}]`);

    const HANDLED_EVENTS = [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.payment_failed"
    ];

    if (!HANDLED_EVENTS.includes(event.type)) {
      console.log(`ℹ️ Evento ignorado: ${event.type}`);
      return jsonResponse({ received: true, processed: false }, 200);
    }

    // ── Enrutar los eventos de ciclo de vida de Suscripción SaaS ───
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      return await handleSubscriptionUpdated(subscription);
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      return await handleSubscriptionDeleted(subscription);
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      return await handleInvoicePaymentFailed(invoice);
    }

    // ── Manejar Checkout Sessions (completed / async_payment_succeeded) ──
    const session = event.data.object as Stripe.Checkout.Session;
    const stripeSessionId = session.id;
    const isAsyncPaymentSucceeded = event.type === "checkout.session.async_payment_succeeded";
    const isAsyncPaymentFailed    = event.type === "checkout.session.async_payment_failed";

    // Detectar si es un checkout de suscripción SaaS
    const isSaaSCheckout = session.metadata?.tipo_pago === 'saas_subscription';

    if (event.type === 'checkout.session.completed' && isSaaSCheckout) {
      return await handleSaaSSubscriptionCompleted(session);
    }

    // --- FLUJO DE VENTAS / PEDIDOS DE TIENDA (EXISTENTE) ---
    // Verificar idempotencia para pedidos de tienda
    const { data: existingOrder, error: existCheckError } = await supabaseAdmin
      .from("pedidos")
      .select("id, estado")
      .eq("stripe_session_id", stripeSessionId)
      .maybeSingle();

    if (existCheckError) {
      console.warn("⚠️ Error al verificar idempotencia:", existCheckError.message);
    }

    if (existingOrder && isAsyncPaymentSucceeded) {
      console.log(`💳 Pago asíncrono confirmado para pedido ${existingOrder.id}`);

      await supabaseAdmin
        .from("pedidos")
        .update({ estado: "pagado" })
        .eq("id", existingOrder.id);

      await supabaseAdmin.from("notificaciones").insert({
        tienda_id: session.metadata?.tenant_id,
        tipo: "pago_confirmado",
        titulo: "Pago Confirmado",
        mensaje: `El pago del pedido #${existingOrder.id.slice(0, 8).toUpperCase()} fue recibido exitosamente.`,
        leida: false,
        metadata: { pedido_id: existingOrder.id, stripe_session_id: stripeSessionId },
      });

      return jsonResponse({ received: true, async_succeeded: true, order_id: existingOrder.id }, 200);
    }

    if (existingOrder && isAsyncPaymentFailed) {
      console.log(`❌ Pago asíncrono fallido para pedido ${existingOrder.id}`);

      await supabaseAdmin
        .from("pedidos")
        .update({ estado: "cancelado" })
        .eq("id", existingOrder.id);

      await supabaseAdmin.from("notificaciones").insert({
        tienda_id: session.metadata?.tenant_id,
        tipo: "pago_fallido",
        titulo: "Voucher Expirado / Pago Fallido",
        mensaje: `El pago del pedido #${existingOrder.id.slice(0, 8).toUpperCase()} ha expirado o fallado.`,
        leida: false,
        metadata: { pedido_id: existingOrder.id, stripe_session_id: stripeSessionId },
      });

      return jsonResponse({ received: true, async_failed: true, order_id: existingOrder.id }, 200);
    }

    if (existingOrder && !isAsyncPaymentSucceeded) {
      console.log(`⚡ Idempotencia: Pedido ya existe para sesión ${stripeSessionId}`);
      return jsonResponse({ received: true, duplicate: true, order_id: existingOrder.id }, 200);
    }

    const tenantId = session.metadata?.tenant_id;
    const userId = session.metadata?.user_id || null;
    const orderId = session.metadata?.order_id || null;
    const itemsJsonRaw = session.metadata?.items_json || null;
    const customerEmail = session.customer_details?.email ?? null;
    const paymentIntentId = (session.payment_intent as string) ?? null;
    const amountTotal = (session.amount_total ?? 0) / 100;
    const currency = session.currency?.toUpperCase() ?? "MXN";
    const metodoPago = resolveMetodoPago(session);

    if (!tenantId) {
      console.error("❌ metadata.tenant_id ausente — bug en create-checkout-session");
      return jsonResponse({ error: "Incomplete metadata: tenant_id missing." }, 400);
    }

    let parsedItems: MetadataItem[] = [];
    let usedFallback = false;

    if (itemsJsonRaw && itemsJsonRaw !== "__OVERFLOW__") {
      try {
        parsedItems = JSON.parse(itemsJsonRaw) as MetadataItem[];
      } catch (parseErr) {
        console.error("⚠️ Error al parsear items_json de metadata:", parseErr);
      }
    }

    if (parsedItems.length === 0) {
      usedFallback = true;
      console.warn("⚠️ items_json no disponible en metadata. Usando Stripe listLineItems como fallback.");
      try {
        const lineItems = await stripe.checkout.sessions.listLineItems(stripeSessionId, { limit: 100 });
        parsedItems = lineItems.data.map((li) => ({
          producto_id: "",
          variante_id: null,
          nombre: li.description || "Producto",
          cantidad: li.quantity ?? 1,
          precio_unitario: (li.price?.unit_amount ?? 0) / 100,
        }));
      } catch (listErr: unknown) {
        const msg = listErr instanceof Error ? listErr.message : "Unknown";
        console.error("⚠️ Error en listLineItems fallback:", msg);
      }
    }

    const estadoInicial = isAsyncPaymentSucceeded
      ? "pagado"
      : (metodoPago === "oxxo" || metodoPago === "spei" ? "pendiente_pago" : "pagado");
    let pedidoId: string;

    if (orderId) {
      console.log(`📋 Order-First: Actualizando pedido pre-creado ${orderId}`);
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("pedidos")
        .update({
          estado: estadoInicial,
          metodo_pago: metodoPago,
          total: amountTotal,
          usuario_id: userId,
          email_cliente: customerEmail,
          stripe_session_id: stripeSessionId,
          stripe_payment_intent_id: paymentIntentId,
        })
        .eq("id", orderId)
        .eq("tienda_id", tenantId)
        .select("id")
        .single();

      if (updateError || !updated) {
        console.error("❌ Error al actualizar pedido pre-creado:", JSON.stringify(updateError));
        console.warn(`⚠️ [DEPRECADO] No se pudo actualizar order_id ${orderId}. Pedido NO creado sin datos de envío.`);
        return jsonResponse({ received: true, warning: "order_id not found, legacy flow deprecated" }, 200);
      } else {
        pedidoId = updated.id;
      }
    } else {
      console.warn(
        `⚠️ [DEPRECADO] Pago recibido sin order_id en metadata. ` +
        `Session: ${stripeSessionId}, Tenant: ${tenantId}. ` +
        `Pedido NO creado — flujo legacy sin datos de envío deprecado.`
      );
      return jsonResponse({
        received: true,
        warning: "Legacy flow deprecated: order_id required in metadata",
      }, 200);
    }

    const skipItemsInsert = !!orderId;

    if (!skipItemsInsert && parsedItems.length > 0) {
      const itemsPayload = parsedItems.map((item) => ({
        pedido_id: pedidoId,
        producto_id: item.producto_id || null,
        variante_id: item.variante_id || null,
        nombre_producto: item.nombre,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
      }));

      const { error: itemsError } = await supabaseAdmin
        .from("pedido_items")
        .insert(itemsPayload);

      if (itemsError) {
        console.error("⚠️ Error al insertar pedido_items:", JSON.stringify(itemsError));
      }
    }

    try {
      const shortId = pedidoId.slice(0, 8).toUpperCase();
      const formattedTotal = `$${amountTotal.toFixed(2)} ${currency}`;
      const metodoPagoLabel: Record<string, string> = {
        tarjeta: 'Tarjeta',
        oxxo: 'OXXO (pendiente)',
        spei: 'SPEI (pendiente)',
      };

      await supabaseAdmin
        .from("notificaciones")
        .insert({
          tienda_id: tenantId,
          tipo: "nuevo_pedido",
          titulo: "¡Nuevo Pedido Recibido!",
          mensaje: `Pedido #${shortId} por ${formattedTotal} — ${metodoPagoLabel[metodoPago] ?? metodoPago}${customerEmail ? ` — ${customerEmail}` : ""}`,
          leida: false,
          metadata: {
            pedido_id: pedidoId,
            total: amountTotal,
            currency,
            metodo_pago: metodoPago,
            items_count: parsedItems.length,
            stripe_session_id: stripeSessionId,
          },
        });
    } catch (notiErr: unknown) {
      console.warn("⚠️ Error inesperado en notificaciones:", notiErr);
    }

    return jsonResponse({ received: true, order_id: pedidoId }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("💥 Error crítico en stripe-webhook:", message);
    return jsonResponse({ error: "Internal webhook processing error." }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// HANDLERS PARA SUSCRIPCIÓN SAAS GLOBAL
// ═══════════════════════════════════════════════════════════════════

const PLAN_LEVELS: Record<string, number> = {
  basico: 1,
  aura: 2,
  pro: 3,
  premium: 4,
};

async function handleSaaSSubscriptionCompleted(session: Stripe.Checkout.Session) {
  const tenantId = session.metadata?.tenant_id;
  const plan = session.metadata?.plan;
  const currency = session.metadata?.currency || 'mxn';
  const country = session.metadata?.country || null;
  const subscriptionId = session.subscription as string;

  if (!tenantId || !plan || !subscriptionId) {
    console.error("❌ Metadata incompleta en webhook de suscripción SaaS.");
    return jsonResponse({ error: "Incomplete SaaS metadata." }, 400);
  }

  try {
    // 1. Obtener detalles de la suscripción de Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Obtener la divisa real cobrada en la suscripción de Stripe para evitar discordancias
    const resolvedCurrency = (subscription.currency || session.currency || currency).toLowerCase();
    
    const rawAmount = subscription.items.data[0]?.plan?.amount ?? 0;
    const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(resolvedCurrency);
    const montoMensual = isZeroDecimal ? rawAmount : rawAmount / 100;

    const taxId = session.customer_details?.tax_ids?.[0]?.value || null;

    // 2. Registro idempotente de la suscripción (idempotencia dual: BD constraint)
    const { error: subError } = await supabaseAdmin
      .from("suscripciones")
      .upsert({
        tenant_id: tenantId,
        plan: plan,
        estado: 'activo',
        fecha_inicio: new Date(subscription.current_period_start * 1000).toISOString(),
        fecha_renovacion: new Date(subscription.current_period_end * 1000).toISOString(),
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: subscription.customer as string,
        monto_mensual: montoMensual,
        currency: resolvedCurrency,
        country: country,
        stripe_tax_id: taxId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'stripe_subscription_id' });

    if (subError) {
      console.error("❌ Error al insertar suscripción:", subError.message);
      return jsonResponse({ error: "Database error registering subscription." }, 500);
    }

    // 3. Actualizar el nivel de suscripción de la tienda
    const subLevel = PLAN_LEVELS[plan] ?? 1;
    const { error: tenantError } = await supabaseAdmin
      .from("tiendas")
      .update({ subscription_level: subLevel })
      .eq("id", tenantId);

    if (tenantError) {
      console.error("❌ Error al actualizar nivel de suscripción de la tienda:", tenantError.message);
    }

    // 4. Crear notificación en tiempo real para el comerciante
    await supabaseAdmin.from("notificaciones").insert({
      tienda_id: tenantId,
      tipo: "pago_confirmado",
      titulo: `¡Plan ${plan.toUpperCase()} Activado!`,
      mensaje: `Felicidades. Tu tienda ya cuenta con los beneficios del plan ${plan.toUpperCase()}.`,
      leida: false,
      metadata: {
        stripe_subscription_id: subscriptionId,
        plan,
        currency
      }
    });

    console.log(`✅ Suscripción SaaS completada con éxito: tienda=${tenantId}, plan=${plan}`);
    return jsonResponse({ received: true, subscription_active: true }, 200);
  } catch (err: any) {
    console.error("❌ Error en handleSaaSSubscriptionCompleted:", err.message);
    return jsonResponse({ error: "Internal processing error." }, 500);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const { data: existingSub, error: queryErr } = await supabaseAdmin
      .from("suscripciones")
      .select("id, tenant_id, plan")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();

    if (queryErr || !existingSub) {
      console.warn(`ℹ️ Suscripción no encontrada para actualizar: ${subscription.id}`);
      return jsonResponse({ received: true, ignored: true }, 200);
    }

    // Mapear estado
    let mappedEstado = 'activo';
    if (subscription.status === 'active') mappedEstado = 'activo';
    else if (subscription.status === 'past_due') mappedEstado = 'past_due';
    else if (subscription.status === 'unpaid') mappedEstado = 'unpaid';
    else if (subscription.status === 'canceled') mappedEstado = 'cancelado';
    else mappedEstado = 'past_due';

    // Actualizar suscripción
    const { error: updateErr } = await supabaseAdmin
      .from("suscripciones")
      .update({
        estado: mappedEstado,
        fecha_inicio: new Date(subscription.current_period_start * 1000).toISOString(),
        fecha_renovacion: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("stripe_subscription_id", subscription.id);

    if (updateErr) {
      console.error(`❌ Error actualizando suscripción ${subscription.id}:`, updateErr.message);
      return jsonResponse({ error: "Failed to update subscription status." }, 500);
    }

    // Si vuelve a estar activa, aseguramos que el nivel de la tienda esté restaurado
    if (mappedEstado === 'activo') {
      const subLevel = PLAN_LEVELS[existingSub.plan] ?? 1;
      await supabaseAdmin
        .from("tiendas")
        .update({ subscription_level: subLevel })
        .eq("id", existingSub.tenant_id);
    }

    // Notificaciones urgentes por estados de facturación (manteniendo acceso bajo período de gracia)
    if (mappedEstado === 'past_due' || mappedEstado === 'unpaid') {
      await supabaseAdmin.from("notificaciones").insert({
        tienda_id: existingSub.tenant_id,
        tipo: "pago_fallido",
        titulo: "Cobro Atrasado (Período de Gracia)",
        mensaje: "No pudimos procesar tu pago periódico. Tu tienda sigue activa, pero por favor actualiza tus datos bancarios.",
        leida: false,
        metadata: { stripe_subscription_id: subscription.id, status: subscription.status }
      });
    }

    console.log(`✅ Suscripción SaaS actualizada: id=${subscription.id}, estado=${mappedEstado}`);
    return jsonResponse({ received: true, updated: true }, 200);
  } catch (err: any) {
    console.error("❌ Error en handleSubscriptionUpdated:", err.message);
    return jsonResponse({ error: "Internal processing error." }, 500);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const { data: existingSub, error: queryErr } = await supabaseAdmin
      .from("suscripciones")
      .select("id, tenant_id")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();

    if (queryErr || !existingSub) {
      console.warn(`ℹ️ Suscripción no encontrada para eliminar: ${subscription.id}`);
      return jsonResponse({ received: true, ignored: true }, 200);
    }

    // 1. Marcar estado como cancelado en suscripciones
    await supabaseAdmin
      .from("suscripciones")
      .update({
        estado: 'cancelado',
        updated_at: new Date().toISOString()
      })
      .eq("stripe_subscription_id", subscription.id);

    // 2. Degradar tienda a nivel 0 (Bloqueo/Inactivo)
    await supabaseAdmin
      .from("tiendas")
      .update({ subscription_level: 0 })
      .eq("id", existingSub.tenant_id);

    // 3. Notificación de degradación
    await supabaseAdmin.from("notificaciones").insert({
      tienda_id: existingSub.tenant_id,
      tipo: "pago_fallido",
      titulo: "Suscripción Finalizada",
      mensaje: "Tu suscripción ha finalizado. Tu acceso ha sido suspendido.",
      leida: false,
      metadata: { stripe_subscription_id: subscription.id }
    });

    console.log(`✅ Suscripción cancelada y tienda degradada: id=${subscription.id}, tienda=${existingSub.tenant_id}`);
    return jsonResponse({ received: true, deleted: true }, 200);
  } catch (err: any) {
    console.error("❌ Error en handleSubscriptionDeleted:", err.message);
    return jsonResponse({ error: "Internal processing error." }, 500);
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) {
    return jsonResponse({ received: true, ignored: true, reason: 'not subscription invoice' }, 200);
  }

  try {
    const { data: existingSub, error: queryErr } = await supabaseAdmin
      .from("suscripciones")
      .select("id, tenant_id")
      .eq("stripe_subscription_id", invoice.subscription as string)
      .maybeSingle();

    if (queryErr || !existingSub) {
      console.warn(`ℹ️ Suscripción no encontrada para cobro fallido: ${invoice.subscription}`);
      return jsonResponse({ received: true, ignored: true }, 200);
    }

    // 1. Actualizar estado a pago_fallido
    await supabaseAdmin
      .from("suscripciones")
      .update({
        estado: 'pago_fallido',
        updated_at: new Date().toISOString()
      })
      .eq("stripe_subscription_id", invoice.subscription as string);

    // 2. Crear notificación crítica
    const monto = invoice.amount_due / 100;
    await supabaseAdmin.from("notificaciones").insert({
      tienda_id: existingSub.tenant_id,
      tipo: "pago_fallido",
      titulo: "Intento de Pago Fallido",
      mensaje: `No pudimos procesar el cobro recurrente de tu plan por un monto de $${monto.toFixed(2)} ${invoice.currency.toUpperCase()}. Revisa tu método de pago.`,
      leida: false,
      metadata: {
        stripe_subscription_id: invoice.subscription as string,
        invoice_id: invoice.id,
        amount: monto,
        currency: invoice.currency
      }
    });

    console.log(`✅ Registro de factura fallida procesado: sub=${invoice.subscription}`);
    return jsonResponse({ received: true, payment_failed: true }, 200);
  } catch (err: any) {
    console.error("❌ Error en handleInvoicePaymentFailed:", err.message);
    return jsonResponse({ error: "Internal processing error." }, 500);
  }
}
