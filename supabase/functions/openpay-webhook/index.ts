// ═══════════════════════════════════════════════════════════════════
// EDGE FUNCTION: openpay-webhook
// Deploy: supabase functions deploy openpay-webhook --no-verify-jwt
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";
import { getCorsHeaders } from "../_shared/cors.ts";

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

  // 1. Basic Auth Obligatorio de seguridad para OpenPay Webhook (Zero-Trust Security)
  const webhookUser = Deno.env.get("OPENPAY_WEBHOOK_USERNAME");
  const webhookPass = Deno.env.get("OPENPAY_WEBHOOK_PASSWORD");

  if (!webhookUser || !webhookPass) {
    console.error("⛔ ERROR CRÍTICO DE CONFIGURACIÓN: Las variables OPENPAY_WEBHOOK_USERNAME o OPENPAY_WEBHOOK_PASSWORD no están configuradas en las variables de entorno de Supabase. El procesamiento del webhook ha sido bloqueado para prevenir vulneraciones/saltos de pago.");
    return jsonResponse({ error: "Server authentication configuration error." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    console.warn("⛔ Webhook de OpenPay rechazado: Credenciales ausentes.");
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  try {
    const credentials = atob(authHeader.replace("Basic ", "")).split(":");
    if (credentials[0] !== webhookUser || credentials[1] !== webhookPass) {
      console.warn("⛔ Webhook de OpenPay rechazado: Credenciales incorrectas.");
      return jsonResponse({ error: "Unauthorized credentials" }, 401);
    }
  } catch {
    return jsonResponse({ error: "Unauthorized credentials parse error" }, 401);
  }

  try {
    const payload = await req.json();
    const { type, transaction } = payload;

    if (!type || !transaction) {
      console.warn("⚠️ Webhook recibido con formato inválido.");
      return jsonResponse({ error: "Payload inválido." }, 400);
    }

    const openpayId = transaction.id;
    const orderId = transaction.order_id;
    const amount = transaction.amount;
    const status = transaction.status;

    console.log(`📡 Evento OpenPay Recibido: ${type} [Transacción: ${openpayId}]`);

    if (type !== "charge.succeeded" && type !== "charge.failed") {
      console.log(`ℹ️ Evento no gestionado: ${type}`);
      return jsonResponse({ received: true, processed: false }, 200);
    }

    // Inicializar Supabase Admin (Service Role)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Buscar pedido por ID de OpenPay o por UUID del pedido
    let query = supabaseAdmin.from("pedidos").select("id, tienda_id, total, estado");
    if (openpayId) {
      query = query.eq("openpay_id", openpayId);
    } else if (orderId) {
      query = query.eq("id", orderId);
    }

    const { data: pedido, error: fetchErr } = await query.maybeSingle();

    if (fetchErr) {
      console.error("❌ Error al consultar el pedido en la BD:", fetchErr.message);
      return jsonResponse({ error: "Error al buscar el pedido." }, 500);
    }

    if (!pedido) {
      console.warn(`⚠️ Pedido no encontrado en la base de datos para la transacción: ${openpayId} / ${orderId}`);
      return jsonResponse({ error: "Pedido no registrado." }, 404);
    }

    // Si ya está procesado, retornar
    if (pedido.estado === "pagado" && type === "charge.succeeded") {
      console.log(`⚡ Idempotencia: El pedido ${pedido.id} ya figura como pagado.`);
      return jsonResponse({ received: true, already_processed: true }, 200);
    }

    if (type === "charge.succeeded") {
      console.log(`💳 Pago exitoso recibido para pedido: ${pedido.id}`);

      // Actualizar pedido a pagado atómicamente si no estaba pagado previamente
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("pedidos")
        .update({ estado: "pagado" })
        .eq("id", pedido.id)
        .neq("estado", "pagado")
        .select("id, total")
        .maybeSingle();

      if (updateErr) {
        console.error("❌ Error al actualizar el estado del pedido:", updateErr.message);
        return jsonResponse({ error: "Error al actualizar estado del pedido." }, 500);
      }

      if (!updated) {
        console.log(`⚡ Idempotencia atómica: El pedido ${pedido.id} ya fue procesado por otra petición.`);
        return jsonResponse({ received: true, already_processed: true }, 200);
      }

      // Generar notificación en el dashboard del florista
      await supabaseAdmin.from("notificaciones").insert({
        tienda_id: pedido.tienda_id,
        tipo: "pago_confirmado",
        titulo: "Pago Recibido (OpenPay)",
        mensaje: `El pago del pedido #${pedido.id.slice(0, 8).toUpperCase()} por $${updated.total} fue recibido exitosamente.`,
        leida: false,
        metadata: { pedido_id: pedido.id, openpay_id: openpayId }
      });

      return jsonResponse({ received: true, processed: true, order_id: pedido.id, status: "pagado" }, 200);

    } else if (type === "charge.failed") {
      console.log(`❌ Pago fallido recibido para pedido: ${pedido.id}`);

      // Actualizar pedido a cancelado o fallido
      await supabaseAdmin
        .from("pedidos")
        .update({ estado: "cancelado" })
        .eq("id", pedido.id);

      // Generar notificación de pago fallido
      await supabaseAdmin.from("notificaciones").insert({
        tienda_id: pedido.tienda_id,
        tipo: "pago_fallido",
        titulo: "Pago Rechazado / Fallido (OpenPay)",
        mensaje: `El cobro del pedido #${pedido.id.slice(0, 8).toUpperCase()} ha fallado o fue declinado.`,
        leida: false,
        metadata: { pedido_id: pedido.id, openpay_id: openpayId }
      });

      return jsonResponse({ received: true, processed: true, order_id: pedido.id, status: "cancelado" }, 200);
    }

    return jsonResponse({ received: true, processed: false }, 200);

  } catch (err: unknown) {
    console.error("[openpay-webhook] Error crítico:", err);
    return jsonResponse({ error: "Internal webhook processing error." }, 500);
  }
});
