// ═══════════════════════════════════════════════════════════════════
// EDGE FUNCTION: create-saas-checkout
// Deploy: supabase functions deploy create-saas-checkout
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";
import Stripe from "npm:stripe@17.7.0";
import { getCorsHeaders, forbiddenOriginResponse, isOriginAllowed } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

interface SaasCheckoutPayload {
  plan: 'basico' | 'aura' | 'pro' | 'premium';
  tenant_id: string;
  currency: string;  // 'mxn', 'usd', 'eur', 'gbp'
  locale: string;    // e.g. 'es-MX', 'en-US'
  success_url: string;
  cancel_url: string;
}

// Validación dinámica de URLs de retorno para prevenir Open Redirects (Fuga 2)
function isReturnUrlAllowed(url: string, requestOrigin: string | null): boolean {
  try {
    const host = new URL(url).hostname;

    // Localhost / IP local
    if (host === 'localhost' || host === '127.0.0.1' || /^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return true;

    // Dominio base o subdominio
    const platform = Deno.env.get("PLATFORM_DOMAIN") || "botaniq.com.mx";
    if (
      host === platform || host.endsWith(`.${platform}`) ||
      host === 'botaniq.com.mx' || host.endsWith('.botaniq.com.mx') ||
      host === 'botaniq.com' || host.endsWith('.botaniq.com')
    ) return true;

    // Staging
    if (host.endsWith('.vercel.app') || host.endsWith('.railway.app')) return true;

    // Mismo host que el origin de la petición
    if (requestOrigin) {
      try {
        const originHost = new URL(requestOrigin).hostname;
        if (host === originHost) return true;
      } catch {}
    }

    return false;
  } catch {
    return false;
  }
}

const VALID_STRIPE_LOCALES = [
  "auto", "bg", "cs", "da", "de", "el", "en", "en-GB", "es", "es-419",
  "et", "fi", "fil", "fr", "fr-CA", "hr", "hu", "id", "it", "ja", "ko",
  "lt", "lv", "ms", "mt", "nb", "nl", "pl", "pt", "pt-BR", "ro", "ru",
  "sk", "sl", "sv", "th", "tr", "vi", "zh", "zh-HK", "zh-TW"
];

function sanitizeStripeLocale(locale: string | undefined | null): string {
  if (!locale) return "auto";
  
  // Limpiar espacios y estandarizar guiones
  const clean = locale.trim().replace('_', '-');
  
  // Coincidencia exacta
  if (VALID_STRIPE_LOCALES.includes(clean)) {
    return clean;
  }
  
  // Coincidencia insensible a mayúsculas/minúsculas
  const cleanLower = clean.toLowerCase();
  const matched = VALID_STRIPE_LOCALES.find(val => val.toLowerCase() === cleanLower);
  if (matched) return matched;
  
  // Mapear variaciones regionales de español a es-419 o es
  if (cleanLower.startsWith('es-')) {
    const latamCodes = ['mx', 'co', 'ar', 'pe', 've', 'cl', 'ec', 'gt', 'cu', 'bo', 'do', 'hn', 'py', 'sv', 'ni', 'cr', 'pa', 'uy', 'pr'];
    const parts = cleanLower.split('-');
    if (parts[1] && latamCodes.includes(parts[1])) {
      return 'es-419';
    }
    return 'es';
  }
  
  // Mapear variaciones regionales de inglés
  if (cleanLower.startsWith('en-')) {
    if (cleanLower === 'en-gb') return 'en-GB';
    return 'en';
  }
  
  // Mapear variaciones regionales de portugués
  if (cleanLower.startsWith('pt-')) {
    if (cleanLower === 'pt-br') return 'pt-BR';
    return 'pt';
  }
  
  // Mapear variaciones regionales de francés
  if (cleanLower.startsWith('fr-')) {
    if (cleanLower === 'fr-ca') return 'fr-CA';
    return 'fr';
  }

  // Mapear variaciones regionales de chino
  if (cleanLower.startsWith('zh-')) {
    if (cleanLower === 'zh-hk') return 'zh-HK';
    if (cleanLower === 'zh-tw') return 'zh-TW';
    return 'zh';
  }
  
  // Intentar con el idioma base (ej. "fr-FR" -> "fr")
  const baseLang = cleanLower.split('-')[0];
  const matchedBase = VALID_STRIPE_LOCALES.find(val => val.toLowerCase() === baseLang);
  if (matchedBase) return matchedBase;
  
  return "auto";
}

// Inicialización de Stripe
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2025-04-30.basil",
  httpClient: Stripe.createFetchHttpClient(),
});

function jsonResponse(body: Record<string, unknown>, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
  });
}

serve(async (req: Request): Promise<Response> => {
  // For OPTIONS preflight — allow without DB check
  if (req.method === "OPTIONS") {
    const origin = req.headers.get('Origin');
    const allowed = await isOriginAllowed(origin, true); // skipDbCheck for preflight
    if (!allowed) return forbiddenOriginResponse();
    return new Response("ok", { headers: getCorsHeaders(origin) });
  }

  // For real requests — full validation including DB
  const origin = req.headers.get('Origin');
  const originAllowed = await isOriginAllowed(origin);
  if (!originAllowed) {
    console.warn(`⛔ Origin no autorizado: ${origin}`);
    return forbiddenOriginResponse();
  }

  try {
    // 1. Rate Limiting: Máximo 5 peticiones por minuto por identificador
    const isAllowed = await checkRateLimit(req, 'create-saas-checkout', 5, 1);
    if (!isAllowed) {
      return jsonResponse({ error: "Demasiadas peticiones. Intenta de nuevo en un minuto." }, 429, origin);
    }

    const payload: SaasCheckoutPayload = await req.json();
    const { plan, tenant_id, currency, locale, success_url, cancel_url } = payload;

    // Validar parámetros obligatorios
    if (!plan || !tenant_id || !currency || !locale || !success_url || !cancel_url) {
      return jsonResponse({ error: "Faltan campos requeridos en el payload." }, 400, origin);
    }

    if (plan !== 'basico' && plan !== 'aura' && plan !== 'pro' && plan !== 'premium') {
      return jsonResponse({ error: "Plan inválido. Debe ser 'basico', 'aura', 'pro' o 'premium'." }, 400, origin);
    }

    const allowedCurrencies = ['mxn', 'usd', 'eur', 'gbp'];
    const cur = currency.toLowerCase();
    if (!allowedCurrencies.includes(cur)) {
      return jsonResponse({ error: "Divisa no soportada." }, 400, origin);
    }

    // Validar URLs de retorno para evitar Open Redirects
    if (!isReturnUrlAllowed(success_url, origin) || !isReturnUrlAllowed(cancel_url, origin)) {
      return jsonResponse({ error: "URL de retorno no autorizada." }, 400, origin);
    }

    // 2. Autenticación y Autorización de Usuario (JWT)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Falta el header de autorización." }, 401, origin);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: "Usuario no autenticado o token inválido." }, 401, origin);
    }

    // Validar que el usuario sea el dueño de la tienda (Multi-tenant Security)
    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from("perfiles")
      .select("tienda_id, rol")
      .eq("id", user.id)
      .single();

    if (perfilError || !perfil) {
      return jsonResponse({ error: "Perfil no encontrado." }, 404, origin);
    }

    if (perfil.tienda_id !== tenant_id || (perfil.rol !== 'dueño' && perfil.rol !== 'owner')) {
      return jsonResponse({ error: "No tienes permisos para suscribir esta tienda." }, 403, origin);
    }

    // 3. Resolución de Price ID según Plan (Stripe resuelve la divisa de forma nativa)
    const PRICE_IDS: Record<string, string | undefined> = {
      basico: Deno.env.get('STRIPE_BASICO_PRICE_ID'),
      aura: Deno.env.get('STRIPE_AURA_PRICE_ID'),
      pro: Deno.env.get('STRIPE_PRO_PRICE_ID'),
      premium: Deno.env.get('STRIPE_PREMIUM_PRICE_ID'),
    };

    const stripePriceId = PRICE_IDS[plan];
    if (!stripePriceId) {
      console.error(`[create-saas-checkout] Price ID no configurado para plan: ${plan}`);
      return jsonResponse(
        { error: 'Configuración de plan no disponible. Contacta al soporte.' },
        503,
        origin
      );
    }

    console.log(`🛒 Creando sesión SaaS Checkout: user=${user.id}, tienda=${tenant_id}, plan=${plan}, cur=${cur}, price=${stripePriceId}`);

    // Extraer código de país del locale si está disponible
    const countryCode = locale.includes('-') ? locale.split('-')[1].toUpperCase() : '';

    // 4. Crear Checkout Session de Suscripción en Stripe
    const stripeLocale = sanitizeStripeLocale(locale) as Stripe.Checkout.SessionCreateParams.Locale;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel'
          }
        },
        metadata: {
          tenant_id: tenant_id,
          plan: plan
        }
      },
      locale: stripeLocale,
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      metadata: {
        tipo_pago: "saas_subscription",
        tenant_id,
        plan,
        user_id: user.id,
        currency: cur,
        country: countryCode,
      },
      success_url,
      cancel_url,
    });

    return jsonResponse({ url: session.url }, 200, origin);
  } catch (err: any) {
    console.error("Error en create-saas-checkout:", err);
    return jsonResponse({ error: err.message || "Error interno del servidor." }, 500, origin);
  }
});
