// ═══════════════════════════════════════════════════════════════════
// EDGE FUNCTION: sync-instagram
// Runtime: Supabase Edge Functions (Deno)
// Deploy: supabase functions deploy sync-instagram --no-verify-jwt
// ═══════════════════════════════════════════════════════════════════

// @ts-nocheck — Este archivo se ejecuta en Deno (Supabase Edge Functions),
// no en Node.js. Los imports de URL y el global `Deno` son nativos del runtime.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, isOriginAllowed, forbiddenOriginResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const IG_GRAPH_URL = "https://graph.instagram.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  const origin = req.headers.get("Origin");

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
    const { tienda_id } = await req.json();

    if (!tienda_id) {
      return new Response(
        JSON.stringify({ error: "tienda_id es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obtener token de Instagram
    const { data: tokenRow, error: tokenError } = await supabase
      .from("instagram_tokens")
      .select("access_token, ig_user_id, token_expires")
      .eq("tienda_id", tienda_id)
      .single();

    if (tokenError || !tokenRow) {
      return new Response(
        JSON.stringify({ error: "Token de Instagram no encontrado", detail: tokenError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { access_token, token_expires } = tokenRow;

    // Refrescar token si expira en menos de 7 días
    if (token_expires) {
      const daysLeft = (new Date(token_expires).getTime() - Date.now()) / (1000 * 60 * 60 * 24);

      if (daysLeft < 7 && daysLeft > 0) {
        const refreshRes = await fetch(
          `${IG_GRAPH_URL}/refresh_access_token?grant_type=ig_refresh_token&access_token=${access_token}`
        );
        const refreshData = await refreshRes.json();

        if (refreshData.access_token) {
          await supabase
            .from("instagram_tokens")
            .update({
              access_token: refreshData.access_token,
              token_expires: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("tienda_id", tienda_id);
        }
      }
    }

    // Consultar Instagram Graph API
    const fields = "id,media_type,media_url,thumbnail_url,permalink,caption,timestamp";
    const igRes = await fetch(
      `${IG_GRAPH_URL}/me/media?fields=${fields}&limit=25&access_token=${access_token}`
    );

    if (!igRes.ok) {
      const igError = await igRes.json();
      return new Response(
        JSON.stringify({ error: "Error en Instagram API", detail: igError.error?.message }),
        { status: igRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const igData = await igRes.json();
    const posts = igData.data || [];

    if (posts.length === 0) {
      return new Response(
        JSON.stringify({ message: "Sin posts en Instagram", synced: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UPSERT en cache
    const rows = posts.map((post) => ({
      tienda_id,
      ig_post_id: post.id,
      media_type: post.media_type || "IMAGE",
      media_url: post.media_url || "",
      thumbnail_url: post.thumbnail_url || null,
      permalink: post.permalink || "",
      caption: post.caption || "",
      timestamp: post.timestamp,
      cached_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from("instagram_cache")
      .upsert(rows, { onConflict: "tienda_id,ig_post_id", ignoreDuplicates: false });

    if (upsertError) {
      return new Response(
        JSON.stringify({ error: "Error al guardar en caché", detail: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limpieza: mantener solo 25 posts por tienda
    const { data: allCached } = await supabase
      .from("instagram_cache")
      .select("id")
      .eq("tienda_id", tienda_id)
      .order("timestamp", { ascending: false });

    if (allCached && allCached.length > 25) {
      const idsToDelete = allCached.slice(25).map((r) => r.id);
      await supabase.from("instagram_cache").delete().in("id", idsToDelete);
    }

    return new Response(
      JSON.stringify({ message: "Feed sincronizado", synced: posts.length, tienda_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Error interno", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
