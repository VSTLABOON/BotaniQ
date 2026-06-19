// ═══════════════════════════════════════════════════════════════════
// EDGE FUNCTION: send-email
// Runtime: Supabase Edge Functions (Deno)
// Deploy: pnpm supabase functions deploy send-email --no-verify-jwt
// ═══════════════════════════════════════════════════════════════════

// @ts-nocheck — Ejecutado en el runtime de Deno (Supabase Edge Functions)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getCorsHeaders, isOriginAllowed, forbiddenOriginResponse } from "../_shared/cors.ts";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

serve(async (req) => {
  const origin = req.headers.get("Origin");

  // Manejar preflight OPTIONS
  if (req.method === "OPTIONS") {
    const allowed = await isOriginAllowed(origin, true);
    if (!allowed) return forbiddenOriginResponse();
    return new Response("ok", { headers: getCorsHeaders(origin) });
  }

  // Si no es OPTIONS ni POST, denegar
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Validar origen (excepto peticiones desde el propio Supabase o servidor interno)
  if (origin) {
    const allowed = await isOriginAllowed(origin);
    if (!allowed) {
      return forbiddenOriginResponse();
    }
  }

  const corsHeaders = origin ? getCorsHeaders(origin) : { "Access-Control-Allow-Origin": "*" };

  try {
    const { toEmail, toName, templateId, params } = await req.json();

    if (!toEmail || !templateId) {
      return new Response(
        JSON.stringify({ error: "toEmail y templateId son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey) {
      console.error("❌ BREVO_API_KEY no configurada en las variables de entorno.");
      return new Response(
        JSON.stringify({ error: "Error de configuración de correo en el servidor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Petición a la API de Brevo
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify({
        sender: { name: "BotaniQ", email: "hola@botaniq.com.mx" }, // Remitente verificado en Brevo
        to: [{ email: toEmail, name: toName || "Comerciante" }],
        templateId: Number(templateId),
        params: params || {}
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error al enviar correo via Brevo: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Brevo API Error: ${response.status}`, details: errorText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ Error en la Edge Function send-email:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
