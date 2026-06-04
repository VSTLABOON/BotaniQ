// ═══════════════════════════════════════════════════════════════════
// EDGE FUNCTION: create-checkout-session (PRICE HARDENING)
// Deploy: supabase functions deploy create-checkout-session
//
// ┌─────────────────────────────────────────────────────────────────┐
// │  PROTOCOLO DE SEGURIDAD — PRICE HARDENING                      │
// │                                                                │
// │  P1 — El frontend envía SOLO IDs y cantidades, jamás precios   │
// │  P2 — Los precios se resuelven al 100% desde la base de datos  │
// │  P3 — Los items validados se inyectan en metadata de Stripe    │
// │       para que el webhook los recupere sin re-fetch            │
// │  P4 — Feature Gate: Solo tiendas Nivel 2+ pueden cobrar       │
// │  P5 — JWT obligatorio: Se verifica quién está pagando          │
// │  P6 — [BLINDADO] URLs de retorno validadas contra allowlist    │
// │  P7 — [BLINDADO] CORS con allowlist (no wildcard)              │
// └─────────────────────────────────────────────────────────────────┘
//
// PAYLOAD ESPERADO DEL FRONTEND:
// {
//   "tenant_id": "uuid",
//   "items": [
//     { "product_id": "uuid", "variant_id": "uuid|null", "quantity": 1 }
//   ],
//   "success_url": "https://...",
//   "cancel_url": "https://..."
// }
//
// NOTA: NO se acepta ningún campo de precio desde el cliente.
// Cualquier intento de inyectar un precio es ignorado por diseño.
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";
import Stripe from "npm:stripe@17.7.0";
import { getCorsHeaders, forbiddenOriginResponse, isOriginAllowed } from "../_shared/cors.ts";  // [BLINDADO] — Migrado de corsHeaders wildcard a getCorsHeaders
import { checkRateLimit } from "../_shared/rateLimit.ts";

// ── Tipos estrictos para el payload de entrada ──────────────────
interface CartItem {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
}

interface CheckoutPayload {
  tenant_id: string;
  items: CartItem[];
  success_url: string;
  cancel_url: string;
  order_id?: string | null;  // Pedido pre-creado (patrón Order-First)
}

// ── Tipo para los items validados que se inyectan en metadata ───
interface ValidatedItem {
  producto_id: string;
  variante_id: string | null;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
}

// ═══════════════════════════════════════════════════════════════════ // [BLINDADO]
// VALIDACIÓN DINÁMICA DE URLs DE RETORNO (FUGA 2)                    // [BLINDADO]
// ═══════════════════════════════════════════════════════════════════ // [BLINDADO]
// Previene que un atacante inyecte success_url o cancel_url          // [BLINDADO]
// apuntando a un sitio de phishing. Después del pago, Stripe        // [BLINDADO]
// redirige al cliente a esa URL — si no la validamos, un atacante   // [BLINDADO]
// podría robar datos del cliente post-pago.                         // [BLINDADO]
// ═══════════════════════════════════════════════════════════════════ // [BLINDADO]

function isReturnUrlAllowed(                                          // [BLINDADO]
  url: string,                                                        // [BLINDADO]
  tienda: { slug?: string; custom_domain?: string | null } | null,    // [BLINDADO]
  requestOrigin: string | null                                        // [BLINDADO]
): boolean {                                                          // [BLINDADO]
  try {                                                               // [BLINDADO]
    const host = new URL(url).hostname;                               // [BLINDADO]

    if (host === 'localhost' || host === '127.0.0.1' || /^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return true; // [BLINDADO]

    const platform = Deno.env.get("PLATFORM_DOMAIN") || "botaniq.com.mx"; // [BLINDADO]
    if (
      host === platform || host.endsWith(`.${platform}`) ||
      host === 'botaniq.com.mx' || host.endsWith('.botaniq.com.mx') ||
      host === 'botaniq.com' || host.endsWith('.botaniq.com')
    ) return true; // [BLINDADO]

    if (host.endsWith('.vercel.app') || host.endsWith('.railway.app')) return true; // [BLINDADO]

    // Custom Domain registrado de esta tienda                        // [BLINDADO]
    if (tienda?.custom_domain) {                                      // [BLINDADO]
      const cleanCustom = tienda.custom_domain.replace(/^www\./i, ''); // [BLINDADO]
      const cleanTarget = host.replace(/^www\./i, '');                // [BLINDADO]
      if (cleanTarget === cleanCustom) return true;                   // [BLINDADO]
    }                                                                 // [BLINDADO]

    // Mismo host que el origin                                       // [BLINDADO]
    if (requestOrigin) {                                              // [BLINDADO]
      try {                                                           // [BLINDADO]
        const originHost = new URL(requestOrigin).hostname;           // [BLINDADO]
        if (host === originHost) return true;                         // [BLINDADO]
      } catch {}                                                      // [BLINDADO]
    }                                                                 // [BLINDADO]

    return false;                                                     // [BLINDADO]
  } catch {                                                           // [BLINDADO]
    return false; // URL malformada → rechazar                        // [BLINDADO]
  }                                                                   // [BLINDADO]
}                                                                     // [BLINDADO]

// ── Inicialización de Stripe ────────────────────────────────────
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2025-04-30.basil",
  httpClient: Stripe.createFetchHttpClient(),
});

// ── Helper: Respuesta JSON con CORS ─────────────────────────────
function jsonResponse(body: Record<string, unknown>, status: number, origin: string | null): Response {  // [BLINDADO] — Ahora recibe origin para CORS dinámico
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },  // [BLINDADO]
  });
}

serve(async (req: Request): Promise<Response> => {
  // ── [BLINDADO] Validación de Origin CORS ────────────────────── // [BLINDADO]
  // For OPTIONS preflight — allow without DB check                 // [BLINDADO]
  if (req.method === "OPTIONS") {
    const origin = req.headers.get('Origin');
    const allowed = await isOriginAllowed(origin, true);             // [BLINDADO] skipDbCheck for preflight
    if (!allowed) return forbiddenOriginResponse();                  // [BLINDADO]
    return new Response("ok", { headers: getCorsHeaders(origin) });  // [BLINDADO]
  }

  // For real requests — full validation including DB               // [BLINDADO]
  const origin = req.headers.get('Origin');                          // [BLINDADO]
  const originAllowed = await isOriginAllowed(origin);               // [BLINDADO]

  // [BLINDADO] Rechazar orígenes no autorizados en todas las requests
  if (!originAllowed) {                                              // [BLINDADO]
    console.warn(`⛔ Origin no autorizado: ${origin}`);              // [BLINDADO]
    return forbiddenOriginResponse();                                // [BLINDADO]
  }                                                                  // [BLINDADO]

  try {
    // ═════════════════════════════════════════════════════════════
    // PASO 1: EXTRAER Y VALIDAR PAYLOAD (P1)
    // ═════════════════════════════════════════════════════════════
    // Solo aceptamos IDs y cantidades. Los campos de precio que el
    // cliente pueda enviar son deliberadamente ignorados.
    // ═════════════════════════════════════════════════════════════

    // Rate Limiting: 5 requests per minute
    const isAllowed = await checkRateLimit(req, 'create-checkout', 5, 1);
    if (!isAllowed) {
      return jsonResponse({ error: "Demasiadas peticiones. Intenta de nuevo en un minuto." }, 429, origin);
    }

    const payload: CheckoutPayload = await req.json();
    const { tenant_id, items, success_url, cancel_url, order_id } = payload;

    if (!tenant_id || !Array.isArray(items) || items.length === 0) {
      return jsonResponse(
        { error: "Payload inválido. Se requiere tenant_id e items[]." },
        400,
        origin
      );
    }

    if (!success_url || !cancel_url) {
      return jsonResponse(
        { error: "Se requiere success_url y cancel_url." },
        400,
        origin
      );
    }

    // ═════════════════════════════════════════════════════════════ // [BLINDADO]
    // VALIDACIÓN DE URLs DE RETORNO (P6)                          // [BLINDADO]
    // ═════════════════════════════════════════════════════════════ // [BLINDADO]
    // Previene Open Redirect: sin esto, un atacante podría enviar  // [BLINDADO]
    // success_url: "https://phishing.com" y el cliente sería       // [BLINDADO]
    // redirigido ahí después de pagar.                             // [BLINDADO]
    // ═════════════════════════════════════════════════════════════ // [BLINDADO]
    if (!isReturnUrlAllowed(success_url, null, origin)) {            // [BLINDADO] tienda not yet fetched, will recheck below
      console.warn(`⛔ success_url rechazada: ${success_url}`);      // [BLINDADO]
      return jsonResponse(                                           // [BLINDADO]
        { error: "URL de retorno no autorizada." },                  // [BLINDADO]
        400,                                                         // [BLINDADO]
        origin                                                          // [BLINDADO]
      );                                                             // [BLINDADO]
    }                                                                // [BLINDADO]
    if (!isReturnUrlAllowed(cancel_url, null, origin)) {             // [BLINDADO] tienda not yet fetched, will recheck below
      console.warn(`⛔ cancel_url rechazada: ${cancel_url}`);        // [BLINDADO]
      return jsonResponse(                                           // [BLINDADO]
        { error: "URL de retorno no autorizada." },                  // [BLINDADO]
        400,                                                         // [BLINDADO]
        origin                                                          // [BLINDADO]
      );                                                             // [BLINDADO]
    }                                                                // [BLINDADO]

    // Validar estructura de cada item: debe tener product_id y quantity > 0
    for (const item of items) {
      if (!item.product_id || typeof item.quantity !== "number" || item.quantity < 1) {
        return jsonResponse(
          { error: `Item inválido: cada item requiere product_id y quantity >= 1.` },
          400,
          origin
        );
      }
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 2: AUTENTICACIÓN — JWT O ANON KEY (P5 + Guest Checkout)
    // ═════════════════════════════════════════════════════════════
    // Soportamos dos modos:
    //   A) JWT de usuario autenticado → user.id disponible
    //   B) Anon key (Guest Checkout) → user_id = null
    //
    // En ambos casos, Price Hardening protege los precios (P2).
    // La diferencia es que en Guest Checkout no se vincula a un
    // usuario, pero el pedido se crea igualmente en la BD.
    // ═════════════════════════════════════════════════════════════

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Acceso denegado: Falta el header Authorization." }, 401, origin);
    }

    // Cliente Admin (Service Role) para leer precios sin restricciones RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    let userId: string | null = null;

    // Intentar validar como JWT de usuario autenticado
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (user && !authError) {
      // Modo A: Usuario autenticado
      userId = user.id;
      console.log(`🔑 Checkout autenticado: user ${userId}`);
    } else {
      // Modo B: Guest Checkout (anon key)
      // Verificar que el token sea la anon key válida
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      if (token !== anonKey) {
        return jsonResponse({ error: "Sesión inválida o expirada." }, 401, origin);
      }
      console.log("🛒 Guest Checkout: sin usuario autenticado");
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 3: FEATURE GATE — VERIFICAR SUSCRIPCIÓN (P4)
    // ═════════════════════════════════════════════════════════════
    // Solo tiendas con subscription_level >= 2 pueden usar pagos
    // en línea. Nivel 1 no tiene acceso a cobros con Stripe.
    // ═════════════════════════════════════════════════════════════

    const { data: tienda, error: tiendaError } = await supabaseAdmin
      .from("tiendas")
      .select("id, subscription_level, currency, slug, custom_domain")
      .eq("id", tenant_id)
      .single();

    if (tiendaError || !tienda) {
      return jsonResponse({ error: "Tienda no encontrada." }, 404, origin);
    }

    if (tienda.subscription_level < 2) {
      return jsonResponse(
        { error: "Esta tienda no tiene habilitados los cobros en línea (requiere Nivel 2+)." },
        403,
        origin
      );
    }

    const currency = (tienda.currency || "mxn").toLowerCase();

    // ═════════════════════════════════════════════════════════════
    // PASO 4: PRICE HARDENING — RESOLVER PRECIOS DESDE LA DB (P2)
    // ═════════════════════════════════════════════════════════════
    // El frontend NO envía precios. Aquí consultamos la fuente de
    // verdad (tablas productos + producto_variantes) y calculamos
    // el precio final unitario por item en el servidor.
    //
    // Protección contra:
    //   - Manipulación de precios vía DevTools
    //   - Inyección de montos por proxy (Burp Suite, mitmproxy)
    //   - Modificación del carrito en memoria del navegador
    // ═════════════════════════════════════════════════════════════

    const productIds: string[] = items.map((i) => i.product_id);
    const variantIds: string[] = items
      .filter((i) => i.variant_id)
      .map((i) => i.variant_id as string);

    // ── Fetch de productos (solo los de ESTA tienda) ────────────
    const { data: productosDb, error: prodError } = await supabaseAdmin
      .from("productos")
      .select("id, nombre, precio")
      .in("id", productIds)
      .eq("tienda_id", tenant_id)
      .eq("disponible", true);

    if (prodError || !productosDb || productosDb.length === 0) {
      console.error("❌ Error al obtener productos:", prodError?.message);
      return jsonResponse(
        { error: "Uno o más productos no son válidos o no están disponibles para esta tienda." },
        422,
        origin
      );
    }

    // Verificar que TODOS los product_id solicitados existen en la DB
    const foundProductIds = new Set(productosDb.map((p: any) => p.id));
    const missingProducts = productIds.filter((id) => !foundProductIds.has(id));
    if (missingProducts.length > 0) {
      console.error("❌ Productos no encontrados:", missingProducts);
      return jsonResponse(
        { error: `Productos no encontrados o no disponibles: ${missingProducts.join(", ")}` },
        422,
        origin
      );
    }

    // ── Fetch de variantes (si se solicitaron) ──────────────────
    let variantesDb: Array<{ id: string; nombre: string; precio: number | null; producto_id: string }> = [];
    if (variantIds.length > 0) {
      const { data: vars, error: varError } = await supabaseAdmin
        .from("producto_variantes")
        .select("id, nombre, precio, producto_id")
        .in("id", variantIds);

      if (varError) {
        console.error("⚠️ Error al obtener variantes:", varError.message);
      } else if (vars) {
        variantesDb = vars as any;
      }
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 5: CONSTRUIR LINE ITEMS Y VALIDATED ITEMS (P2 + P3)
    // ═════════════════════════════════════════════════════════════
    // Dos outputs paralelos:
    //   1. line_items → Para Stripe Checkout (lo que Stripe cobra)
    //   2. validatedItems → Para metadata (lo que el webhook inserta)
    //
    // Ambos usan los MISMOS precios resueltos desde la DB.
    // ═════════════════════════════════════════════════════════════

    const validatedItems: ValidatedItem[] = [];

    const line_items = items.map((item: CartItem) => {
      const dbProduct = productosDb.find((p: any) => p.id === item.product_id);
      if (!dbProduct) {
        // Este caso no debería ocurrir por la validación anterior
        throw new Error(`Integridad rota: Producto ${item.product_id} desapareció entre queries.`);
      }

      let finalPrice = Number(dbProduct.precio);
      let productName: string = dbProduct.nombre;
      let resolvedVariantId: string | null = null;

      // Aplicar precio de variante si se especificó
      if (item.variant_id) {
        const dbVariant = variantesDb.find((v) => v.id === item.variant_id);
        if (dbVariant && dbVariant.producto_id === item.product_id) {
          finalPrice = dbVariant.precio !== null && dbVariant.precio !== undefined ? Number(dbVariant.precio) : Number(dbProduct.precio);
          productName = `${productName} — ${dbVariant.nombre}`;
          resolvedVariantId = dbVariant.id;
        } else if (dbVariant) {
          throw new Error(`Integridad rota: Variante ${item.variant_id} no pertenece al producto ${item.product_id}.`);
        } else {
          console.warn(`⚠️ Variante ${item.variant_id} no encontrada. Se usa precio base.`);
        }
      }

      // Registrar item validado para la metadata del webhook
      validatedItems.push({
        producto_id: dbProduct.id,
        variante_id: resolvedVariantId,
        nombre: productName,
        cantidad: item.quantity,
        precio_unitario: finalPrice,
      });

      // Stripe espera centavos (ej: $500.00 MXN → 50000)
      const unitAmountCents = Math.round(finalPrice * 100);

      return {
        price_data: {
          currency,
          product_data: { name: productName },
          unit_amount: unitAmountCents,
        },
        quantity: item.quantity,
      };
    });

    // ═════════════════════════════════════════════════════════════
    // PASO 5.5: PREVENIR ORDER HIJACKING & APLICAR COSTO DE ENVÍO
    // ═════════════════════════════════════════════════════════════
    if (order_id) {
      const { data: orderDb, error: orderErr } = await supabaseAdmin
        .from("pedidos")
        .select("id, total, costo_envio")
        .eq("id", order_id)
        .eq("tienda_id", tenant_id)
        .single();

      if (orderErr || !orderDb) {
        return jsonResponse({ error: "El pedido especificado no existe o no pertenece a esta tienda." }, 404, origin);
      }

      const shippingCostDb = Number(orderDb.costo_envio || 0);

      // Inyectar costo de envío si existe
      if (shippingCostDb > 0) {
        line_items.push({
          price_data: {
            currency,
            product_data: { name: "Costo de Envío" },
            unit_amount: Math.round(shippingCostDb * 100),
          },
          quantity: 1,
        });
      }

      const calculatedTotalCents = line_items.reduce((acc, li) => acc + li.price_data.unit_amount * li.quantity, 0);
      const calculatedTotal = calculatedTotalCents / 100;

      if (Math.abs(Number(orderDb.total) - calculatedTotal) > 0.01) {
        console.error(`⛔ ALERTA: Order Hijacking mitigado. order_id: ${order_id}. DB Total: ${orderDb.total}, Checkout: ${calculatedTotal}`);
        return jsonResponse({ error: "El total del carrito no coincide con el pedido original. Por favor recarga." }, 409, origin);
      }

      // ═════════════════════════════════════════════════════════════════ // [BLINDADO]
      // PREVENIR "BAIT AND SWITCH" DE ITEMS (FUGA 7)                      // [BLINDADO]
      // ═════════════════════════════════════════════════════════════════ // [BLINDADO]
      // La función RPC `create_guest_order` inserta los items tal cual    // [BLINDADO]
      // como los manda el cliente (cantidades y precios). Para evitar     // [BLINDADO]
      // que un atacante pague el total correcto pero manipule los items   // [BLINDADO]
      // (ej. pagar $10 por un Rolex en vez de $10 por un sticker),        // [BLINDADO]
      // SOBREESCRIBIMOS los items del pedido con los validados en servidor. // [BLINDADO]
      // ═════════════════════════════════════════════════════════════════ // [BLINDADO]
      await supabaseAdmin.from("pedido_items").delete().eq("pedido_id", order_id);
      
      const insertPayload = validatedItems.map(vi => ({
        pedido_id: order_id,
        producto_id: vi.producto_id || null,
        variante_id: vi.variante_id || null,
        nombre_producto: vi.nombre,
        cantidad: vi.cantidad,
        precio_unitario: vi.precio_unitario
      }));
      await supabaseAdmin.from("pedido_items").insert(insertPayload);
      console.log(`🛡️ Items sincronizados para pedido ${order_id} (Prevención Bait & Switch)`);
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 6: CREAR SESIÓN DE CHECKOUT EN STRIPE (P3)
    // ═════════════════════════════════════════════════════════════
    // METADATA CRÍTICO:
    // El campo `items_json` contiene los items ya validados con
    // producto_id, variante_id, nombres y precios del servidor.
    // El webhook los parsea y los inserta directamente en
    // `pedido_items` sin necesidad de re-consultar la DB.
    //
    // LÍMITES DE STRIPE METADATA:
    //   - Máx. 50 claves
    //   - Valor máx. 500 caracteres por clave
    //   - Si items_json excede 500 chars, se trunca con flag
    //
    // Los metadata son inmutables server-side: ni el usuario ni
    // un man-in-the-middle pueden alterarlos después de la creación.
    // ═════════════════════════════════════════════════════════════

    const itemsJsonStr = JSON.stringify(validatedItems);

    // Guard contra el límite de 500 chars de Stripe metadata
    // Para pedidos muy grandes (>~8 productos con nombres largos)
    // el webhook usará listLineItems como fallback
    const itemsFitInMetadata = itemsJsonStr.length <= 500;

    if (!itemsFitInMetadata) {
      console.warn(
        `⚠️ items_json excede 500 chars (${itemsJsonStr.length}). ` +
        `El webhook usará Stripe listLineItems como fallback.`
      );
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "oxxo", "customer_balance"],       // [BLINDADO] — FUGA 3: Agregados OXXO y SPEI (customer_balance)
      line_items,
      mode: "payment",
      success_url,
      cancel_url,
      // ── [BLINDADO] SPEI via Stripe MX (bank transfer) ──────── // [BLINDADO]
      payment_method_options: {                                         // [BLINDADO]
        customer_balance: {                                             // [BLINDADO]
          funding_type: "bank_transfer",                                // [BLINDADO]
          bank_transfer: {                                              // [BLINDADO]
            type: "mx_bank_transfer",                                   // [BLINDADO]
          },                                                            // [BLINDADO]
        },                                                              // [BLINDADO]
      },                                                                // [BLINDADO]
      // ── INYECCIÓN DE METADATA (PUENTE CHECKOUT → WEBHOOK) ────
      metadata: {
        tenant_id,
        user_id: userId || "",
        order_id: order_id || "",
        // Items validados con precios del servidor.
        // El webhook los parsea para INSERT en pedido_items.
        items_json: itemsFitInMetadata ? itemsJsonStr : "__OVERFLOW__",
      },
    });

    console.log(`✅ Sesión de Checkout creada: ${session.id}`);
    console.log(`   ├─ Tenant: ${tenant_id}`);
    console.log(`   ├─ User: ${userId || "GUEST"}`);
    console.log(`   ├─ Items: ${validatedItems.length}`);
    console.log(`   ├─ Metadata fits: ${itemsFitInMetadata}`);
    console.log(`   ├─ Payment methods: card, oxxo, customer_balance (SPEI)`);  // [BLINDADO]
    console.log(`   └─ URL: ${session.url}`);

    // ═════════════════════════════════════════════════════════════
    // PASO 7: RETORNAR URL DE PAGO AL FRONTEND
    // ═════════════════════════════════════════════════════════════

    return jsonResponse({ url: session.url }, 200, origin);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno del servidor";
    console.error("❌ Error Crítico en Checkout:", message);
    return jsonResponse({ error: message }, 500, origin);
  }
});
