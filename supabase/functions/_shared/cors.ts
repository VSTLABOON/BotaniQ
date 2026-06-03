// ═══════════════════════════════════════════════════════════════════
// CORS HEADERS — VALIDACIÓN DINÁMICA DE ORÍGENES
// ═══════════════════════════════════════════════════════════════════
// [BLINDADO] Valida orígenes dinámicamente contra:
//   1. Localhost / IPs locales (dev)
//   2. Dominio base de la plataforma y subdominios (*.botaniq.com)
//   3. Staging (Vercel / Railway)
//   4. Custom domains registrados en BD (con cache de 5 min)
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@2.39.0";                // [BLINDADO]

// Cache en memoria con TTL de 5 minutos para custom domains validados.     // [BLINDADO]
// Evita una query a Supabase por cada request de un dominio ya conocido.   // [BLINDADO]
const customDomainCache = new Map<string, { allowed: boolean; expiresAt: number }>();  // [BLINDADO]
const CACHE_TTL_MS = 5 * 60 * 1000;                                          // [BLINDADO]

/**
 * Verifica si un origin está autorizado.
 * Para preflights OPTIONS, usar skipDbCheck=true para evitar latencia de BD.
 */                                                                           // [BLINDADO]
export async function isOriginAllowed(                                        // [BLINDADO]
  origin: string | null,                                                      // [BLINDADO]
  skipDbCheck = false                                                         // [BLINDADO]
): Promise<boolean> {                                                         // [BLINDADO]
  if (!origin) return false;                                                  // [BLINDADO]

  let host: string;                                                           // [BLINDADO]
  try {                                                                       // [BLINDADO]
    host = new URL(origin).hostname;                                          // [BLINDADO]
  } catch {                                                                   // [BLINDADO]
    return false;                                                             // [BLINDADO]
  }                                                                           // [BLINDADO]

  // 1. Localhost / IP local                                                  // [BLINDADO]
  if (                                                                        // [BLINDADO]
    host === 'localhost' ||                                                   // [BLINDADO]
    host === '127.0.0.1' ||                                                   // [BLINDADO]
    /^(\d{1,3}\.){3}\d{1,3}$/.test(host)                                     // [BLINDADO]
  ) return true;                                                              // [BLINDADO]

  // 2. Plataforma base y subdominios                                         // [BLINDADO]
  const platform = Deno.env.get("PLATFORM_DOMAIN") || "botaniq.com.mx";          // [BLINDADO]
  if (
    host === platform || host.endsWith(`.${platform}`) ||
    host === 'botaniq.com.mx' || host.endsWith('.botaniq.com.mx') ||
    host === 'botaniq.com' || host.endsWith('.botaniq.com')
  ) return true;        // [BLINDADO]

  // 3. Staging (Vercel / Railway)                                            // [BLINDADO]
  if (host.endsWith('.vercel.app') || host.endsWith('.railway.app')) {         // [BLINDADO]
    return true;                                                              // [BLINDADO]
  }                                                                           // [BLINDADO]

  // 4. Custom Domains — no consultar BD en preflights OPTIONS                // [BLINDADO]
  if (skipDbCheck) return false;                                              // [BLINDADO]

  // Revisar cache primero                                                    // [BLINDADO]
  const cached = customDomainCache.get(host);                                 // [BLINDADO]
  if (cached && Date.now() < cached.expiresAt) return cached.allowed;         // [BLINDADO]

  // Query a Supabase                                                         // [BLINDADO]
  const supabase = createClient(                                              // [BLINDADO]
    Deno.env.get("SUPABASE_URL") || "",                                       // [BLINDADO]
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""                            // [BLINDADO]
  );                                                                          // [BLINDADO]
  const { data } = await supabase                                             // [BLINDADO]
    .from("tiendas")                                                          // [BLINDADO]
    .select("id")                                                             // [BLINDADO]
    .eq("custom_domain", host)                                                // [BLINDADO]
    .maybeSingle();                                                           // [BLINDADO]

  const allowed = !!data;                                                     // [BLINDADO]
  customDomainCache.set(host, { allowed, expiresAt: Date.now() + CACHE_TTL_MS }); // [BLINDADO]
  return allowed;                                                             // [BLINDADO]
}                                                                             // [BLINDADO]

/**
 * Genera headers CORS para un origin específico.
 * Retorna los headers apropiados para incluir en la respuesta.
 */                                                                           // [BLINDADO]
export function getCorsHeaders(origin: string | null): Record<string, string> { // [BLINDADO]
  return {                                                                    // [BLINDADO]
    'Access-Control-Allow-Origin': origin || '',                              // [BLINDADO]
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', // [BLINDADO]
    'Access-Control-Allow-Methods': 'POST, OPTIONS',                          // [BLINDADO]
    'Vary': 'Origin',                                                         // [BLINDADO]
  };                                                                          // [BLINDADO]
}

/**
 * Respuesta 403 para orígenes no autorizados.
 */                                                                           // [BLINDADO]
export function forbiddenOriginResponse(): Response {                         // [BLINDADO]
  return new Response(                                                        // [BLINDADO]
    JSON.stringify({ error: 'Origin not allowed.' }),                         // [BLINDADO]
    {                                                                         // [BLINDADO]
      status: 403,                                                            // [BLINDADO]
      headers: { 'Content-Type': 'application/json' },                        // [BLINDADO]
    }                                                                         // [BLINDADO]
  );                                                                          // [BLINDADO]
}
