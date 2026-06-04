// ═══════════════════════════════════════════════════════════════════
// EDGE FUNCTION: create-openpay-checkout
// Deploy: supabase functions deploy create-openpay-checkout --no-verify-jwt
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";
import { getCorsHeaders, forbiddenOriginResponse, isOriginAllowed } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

interface CartItem {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
}

interface OpenpayCheckoutPayload {
  tenant_id: string;
  items: CartItem[];
  success_url: string;
  cancel_url: string;
  order_id: string; // Pedido obligatorio (Order-First)
  payment_method_type: "card" | "spei" | "store";
  device_data: string; // Token antifraude de OpenPay
  token_id?: string; // Requerido para pagos con tarjeta
  customer: {
    name: string;
    email: string;
    phone: string;
  };
}

interface ValidatedItem {
  producto_id: string;
  variante_id: string | null;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
}

function isReturnUrlAllowed(
  url: string,
  tienda: { slug?: string; custom_domain?: string | null } | null,
  requestOrigin: string | null
): boolean {
  try {
    const host = new URL(url).hostname;
    if (host === 'localhost' || host === '127.0.0.1' || /^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return true;

    const platform = Deno.env.get("PLATFORM_DOMAIN") || "botaniq.com.mx";
    if (
      host === platform || host.endsWith(`.${platform}`) ||
      host === 'botaniq.com.mx' || host.endsWith('.botaniq.com.mx') ||
      host === 'botaniq.com' || host.endsWith('.botaniq.com')
    ) return true;

    if (host.endsWith('.vercel.app') || host.endsWith('.railway.app')) return true;

    if (tienda?.custom_domain) {
      const cleanCustom = tienda.custom_domain.replace(/^www\./i, '');
      const cleanTarget = host.replace(/^www\./i, '');
      if (cleanTarget === cleanCustom) return true;
    }

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

function jsonResponse(body: Record<string, unknown>, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
  });
}

serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('Origin');

  // Preflight
  if (req.method === "OPTIONS") {
    const allowed = await isOriginAllowed(origin, true);
    if (!allowed) return forbiddenOriginResponse();
    return new Response("ok", { headers: getCorsHeaders(origin) });
  }

  const originAllowed = await isOriginAllowed(origin);
  if (!originAllowed) {
    console.warn(`⛔ Origin no autorizado: ${origin}`);
    return forbiddenOriginResponse();
  }

  try {
    // Rate Limiting: 5 requests per minute
    const isAllowed = await checkRateLimit(req, 'create-openpay-checkout', 5, 1);
    if (!isAllowed) {
      return jsonResponse({ error: "Demasiadas peticiones. Intenta de nuevo en un minuto." }, 429, origin);
    }

    const payload: OpenpayCheckoutPayload = await req.json();
    const {
      tenant_id,
      items,
      success_url,
      cancel_url,
      order_id,
      payment_method_type,
      device_data,
      token_id,
      customer
    } = payload;

    // Validar payload
    if (!tenant_id || !order_id || !payment_method_type || !device_data || !customer) {
      return jsonResponse({ error: "Faltan campos obligatorios en el payload." }, 400, origin);
    }

    if (!Array.isArray(items) || items.length === 0) {
      return jsonResponse({ error: "El carrito no puede estar vacío." }, 400, origin);
    }

    if (payment_method_type === "card" && !token_id) {
      return jsonResponse({ error: "Se requiere un token_id para pagos con tarjeta." }, 400, origin);
    }

    // Inicializar Supabase Admin
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Obtener configuración de OpenPay de la tienda
    const { data: tienda, error: tiendaError } = await supabaseAdmin
      .from("tiendas")
      .select("id, slug, nombre, custom_domain, subscription_level, currency, openpay_merchant_id, openpay_public_key, openpay_private_key, openpay_sandbox_mode")
      .eq("id", tenant_id)
      .single();

    if (tiendaError || !tienda) {
      return jsonResponse({ error: "Tienda no encontrada." }, 404, origin);
    }

    // Feature Gate
    if (tienda.subscription_level < 2) {
      return jsonResponse({ error: "Esta tienda no tiene habilitados los cobros en línea." }, 403, origin);
    }

    // Validar credenciales de OpenPay
    if (!tienda.openpay_merchant_id || !tienda.openpay_private_key) {
      return jsonResponse({ error: "Esta tienda no tiene configurado OpenPay." }, 400, origin);
    }

    // Validar URLs de retorno
    if (!isReturnUrlAllowed(success_url, tienda, origin) || !isReturnUrlAllowed(cancel_url, tienda, origin)) {
      return jsonResponse({ error: "URLs de retorno no autorizadas." }, 400, origin);
    }

    // ── PRICE HARDENING: Resolver precios desde la BD ──
    const productIds = items.map(i => i.product_id);
    const variantIds = items.filter(i => i.variant_id).map(i => i.variant_id as string);

    const { data: productosDb, error: prodError } = await supabaseAdmin
      .from("productos")
      .select("id, nombre, precio")
      .in("id", productIds)
      .eq("tienda_id", tenant_id)
      .eq("disponible", true);

    if (prodError || !productosDb || productosDb.length === 0) {
      return jsonResponse({ error: "Productos inválidos o no disponibles." }, 422, origin);
    }

    // Validar que todos los productos existen
    const foundProductIds = new Set(productosDb.map(p => p.id));
    const missingProducts = productIds.filter(id => !foundProductIds.has(id));
    if (missingProducts.length > 0) {
      return jsonResponse({ error: `Productos no encontrados: ${missingProducts.join(", ")}` }, 422, origin);
    }

    // Obtener variantes
    let variantesDb: any[] = [];
    if (variantIds.length > 0) {
      const { data: vars } = await supabaseAdmin
        .from("producto_variantes")
        .select("id, nombre, precio, producto_id")
        .in("id", variantIds);
      variantesDb = vars || [];
    }

    const validatedItems: ValidatedItem[] = [];
    let itemsSubtotal = 0;

    for (const item of items) {
      const dbProduct = productosDb.find(p => p.id === item.product_id);
      if (!dbProduct) throw new Error("Integridad rota.");

      let finalPrice = Number(dbProduct.precio);
      let productName = dbProduct.nombre;
      let resolvedVariantId: string | null = null;

      if (item.variant_id) {
        const dbVariant = variantesDb.find(v => v.id === item.variant_id);
        if (dbVariant && dbVariant.producto_id === item.product_id) {
          finalPrice = dbVariant.precio !== null && dbVariant.precio !== undefined ? Number(dbVariant.precio) : Number(dbProduct.precio);
          productName = `${productName} — ${dbVariant.nombre}`;
          resolvedVariantId = dbVariant.id;
        }
      }

      validatedItems.push({
        producto_id: dbProduct.id,
        variante_id: resolvedVariantId,
        nombre: productName,
        cantidad: item.quantity,
        precio_unitario: finalPrice
      });

      itemsSubtotal += finalPrice * item.quantity;
    }

    // Obtener costo de envío del pedido
    const { data: orderDb, error: orderErr } = await supabaseAdmin
      .from("pedidos")
      .select("id, total, costo_envio")
      .eq("id", order_id)
      .eq("tienda_id", tenant_id)
      .single();

    if (orderErr || !orderDb) {
      return jsonResponse({ error: "Pedido no encontrado o no pertenece a esta tienda." }, 404, origin);
    }

    const shippingCost = Number(orderDb.costo_envio || 0);
    const finalAmount = Number((itemsSubtotal + shippingCost).toFixed(2));

    // Validar total con el pedido guardado (Mitigar Order Hijacking)
    if (Math.abs(Number(orderDb.total) - finalAmount) > 0.05) {
      console.error(`⛔ ALERTA: Order Hijacking mitigado en OpenPay. order_id: ${order_id}. DB Total: ${orderDb.total}, Calculado: ${finalAmount}`);
      return jsonResponse({ error: "El total no coincide con el pedido original." }, 409, origin);
    }

    // Sincronizar items validados contra la DB para evitar Bait and Switch
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

    // Dividir nombre del cliente para OpenPay
    const nameParts = customer.name.trim().split(" ");
    const firstName = nameParts[0] || "Cliente";
    const lastName = nameParts.slice(1).join(" ") || "BotaniQ";

    // Credenciales de OpenPay
    const isSandbox = tienda.openpay_sandbox_mode ?? true;
    const baseUrl = isSandbox 
      ? `https://sandbox-api.openpay.mx/v1/${tienda.openpay_merchant_id}`
      : `https://api.openpay.mx/v1/${tienda.openpay_merchant_id}`;

    const authHeaderValue = "Basic " + btoa(tienda.openpay_private_key + ":");

    // Construir llamada de cargo a OpenPay
    const openpayPayload: Record<string, any> = {
      amount: finalAmount,
      description: `Pedido #${order_id.slice(0, 8).toUpperCase()} en ${tienda.nombre}`,
      order_id: order_id,
      customer: {
        name: firstName,
        last_name: lastName,
        email: customer.email,
        phone_number: customer.phone.replace(/[^0-9]/g, "").slice(0, 10)
      }
    };

    if (payment_method_type === "card") {
      openpayPayload.method = "card";
      openpayPayload.source_id = token_id;
      openpayPayload.device_session_id = device_data;
      openpayPayload.use_3d_secure = true;
      openpayPayload.redirect_url = success_url;
    } else if (payment_method_type === "spei") {
      openpayPayload.method = "bank_account";
    } else if (payment_method_type === "store") {
      openpayPayload.method = "store";
    }

    console.log(`📡 Enviando cargo a OpenPay (${payment_method_type}) - Sandbox: ${isSandbox}`);
    const openpayRes = await fetch(`${baseUrl}/charges`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeaderValue
      },
      body: JSON.stringify(openpayPayload)
    });

    const openpayData = await openpayRes.json();

    if (!openpayRes.ok) {
      console.error("❌ Error de API OpenPay:", JSON.stringify(openpayData));
      return jsonResponse({
        error: openpayData.description || "Error de comunicación con la pasarela de pagos."
      }, openpayRes.status, origin);
    }

    console.log(`✅ Cargo creado en OpenPay: ${openpayData.id} [Estado: ${openpayData.status}]`);

    // Guardar detalles en la base de datos de pedidos
    const updateDbPayload: Record<string, any> = {
      openpay_id: openpayData.id,
      metodo_pago: payment_method_type === "card" ? "tarjeta" : payment_method_type,
      email_cliente: customer.email
    };

    if (payment_method_type === "spei" && openpayData.payment_method) {
      updateDbPayload.openpay_clabe = openpayData.payment_method.clabe;
      updateDbPayload.openpay_reference = openpayData.payment_method.reference;
      updateDbPayload.estado = "pendiente_pago";
    } else if (payment_method_type === "store" && openpayData.payment_method) {
      updateDbPayload.openpay_reference = openpayData.payment_method.reference;
      updateDbPayload.openpay_barcode_url = openpayData.payment_method.barcode_url;
      updateDbPayload.openpay_pdf_url = openpayData.payment_method.pdf_url;
      updateDbPayload.estado = "pendiente_pago";
    } else if (payment_method_type === "card") {
      // 3D Secure redirección
      updateDbPayload.estado = openpayData.status === "completed" ? "pagado" : "pendiente_pago";
    }

    const { error: dbUpdateErr } = await supabaseAdmin
      .from("pedidos")
      .update(updateDbPayload)
      .eq("id", order_id);

    if (dbUpdateErr) {
      console.error("❌ Error al guardar datos de OpenPay en pedido:", dbUpdateErr.message);
    }

    // Retornar respuesta
    if (payment_method_type === "card") {
      return jsonResponse({
        id: openpayData.id,
        status: openpayData.status,
        redirect_url: openpayData.payment_method?.url || success_url
      }, 200, origin);
    } else if (payment_method_type === "spei") {
      return jsonResponse({
        id: openpayData.id,
        status: openpayData.status,
        clabe: openpayData.payment_method?.clabe,
        bank: openpayData.payment_method?.bank || "STP",
        reference: openpayData.payment_method?.reference
      }, 200, origin);
    } else { // store
      return jsonResponse({
        id: openpayData.id,
        status: openpayData.status,
        reference: openpayData.payment_method?.reference,
        barcode_url: openpayData.payment_method?.barcode_url,
        pdf_url: openpayData.payment_method?.pdf_url
      }, 200, origin);
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno de servidor.";
    console.error("❌ Error en Edge Function OpenPay Checkout:", message);
    return jsonResponse({ error: message }, 500, origin);
  }
});
