// ═══════════════════════════════════════════════════════════════════
// EDGE FUNCTION: gemini-chat
// Runtime: Supabase Edge Functions (Deno)
// ═══════════════════════════════════════════════════════════════════

// @ts-nocheck — Deno runtime imports
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getCorsHeaders, isOriginAllowed, forbiddenOriginResponse } from "../_shared/cors.ts";

serve(async (req) => {
  const origin = req.headers.get("Origin");

  // Preflight check
  if (req.method === "OPTIONS") {
    const allowed = await isOriginAllowed(origin, true);
    if (!allowed) return forbiddenOriginResponse();
    return new Response("ok", { headers: getCorsHeaders(origin) });
  }

  const allowed = await isOriginAllowed(origin);
  if (!allowed) {
    return forbiddenOriginResponse();
  }

  const corsHeaders = getCorsHeaders(origin);

  try {
    const { history, systemInstruction } = await req.json();

    if (!history || !Array.isArray(history)) {
      return new Response(
        JSON.stringify({ error: "history es requerido y debe ser un arreglo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("VITE_GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Clave de API de Gemini no configurada en el servidor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Consultar directamente a la API de Google Gemini (v1beta)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const requestBody = {
      contents: history,
      systemInstruction: systemInstruction ? {
        parts: [{ text: systemInstruction }]
      } : undefined,
      generationConfig: {
        temperature: 0.7,
      }
    };

    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorData = await res.json();
      return new Response(
        JSON.stringify({ error: "Error en la API de Gemini", detail: errorData }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const botResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(
      JSON.stringify({ text: botResponseText }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Error interno", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
