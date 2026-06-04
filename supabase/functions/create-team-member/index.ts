// ═══════════════════════════════════════════════════════════════════
// EDGE FUNCTION: create-team-member
// Deploy: supabase functions deploy create-team-member
//
// ┌─────────────────────────────────────────────────────────────────┐
// │  PROTOCOLO DE SEGURIDAD                                        │
// │                                                                │
// │  T1 — JWT obligatorio: Solo usuarios autenticados pueden       │
// │       invocar esta función (verify_jwt = true por defecto)     │
// │  T2 — Autorización RBAC: El solicitante DEBE ser 'dueño' de   │
// │       la tienda destino o 'superadmin'                         │
// │  T3 — Service Role encapsulado: La clave admin NUNCA llega     │
// │       al cliente; vive en los secrets de la Edge Function      │
// │  T4 — CORS allowlist: Misma política que las demás funciones   │
// │  T5 — El trigger `handle_new_user` auto-crea el perfil.        │
// │       Esta función solo hace UPDATE para vincularlo a la       │
// │       tienda, nunca INSERT manual en perfiles.                 │
// └─────────────────────────────────────────────────────────────────┘
//
// PAYLOAD ESPERADO:
// {
//   "tienda_id": "uuid",
//   "nombre":    "string",
//   "email":     "string",
//   "password":  "string",          // contraseña temporal (min 6 chars)
//   "rol":       "empleado" | "repartidor" | "admin"
// }
//
// RESPUESTA EXITOSA (201):
// {
//   "id":         "uuid",
//   "nombre":     "string",
//   "email":      "string",
//   "rol":        "string",
//   "tienda_id":  "uuid"
// }
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";
import { getCorsHeaders, forbiddenOriginResponse, isOriginAllowed } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

// ── Roles que un dueño puede asignar a su equipo ────────────────
// 'superadmin' está excluido deliberadamente — solo se puede asignar
// manualmente desde la BD o desde el panel de superadmin.
const ASSIGNABLE_ROLES = new Set(["admin", "empleado", "repartidor"]);

serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin");

  // For OPTIONS preflight — allow without DB check
  if (req.method === "OPTIONS") {
    const allowed = await isOriginAllowed(origin, true);
    if (!allowed) return forbiddenOriginResponse();
    return new Response("ok", { headers: getCorsHeaders(origin) });
  }

  // For real requests — full validation including DB
  const originAllowed = await isOriginAllowed(origin);
  if (!originAllowed) {
    console.warn(`⛔ Origin no autorizado: ${origin}`);
    return forbiddenOriginResponse();
  }

  const corsHeaders = getCorsHeaders(origin);

  // ── Helper: Respuesta JSON con CORS ──────────────────────────────
  const json = (body: Record<string, unknown>, status = 200) => {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  };

  // ── Verificar Rate Limiting ────────────────────────────────────
  const isAllowed = await checkRateLimit(req, 'create-team-member', 5, 1);
  if (!isAllowed) {
    return json({ error: "Demasiadas peticiones. Intenta de nuevo en un minuto." }, 429);
  }

  // ── Solo POST ─────────────────────────────────────────────────
  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    // ═══════════════════════════════════════════════════════════
    // PASO 1: VERIFICAR JWT DEL SOLICITANTE (T1)
    // ═══════════════════════════════════════════════════════════
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing or invalid Authorization header." }, 401);
    }

    const callerToken = authHeader.replace("Bearer ", "");

    // Cliente con la anon key para verificar el JWT del llamante
    const supabaseCallerClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${callerToken}` } } }
    );

    const { data: { user: callerUser }, error: callerAuthError } =
      await supabaseCallerClient.auth.getUser();

    if (callerAuthError || !callerUser) {
      console.error("⛔ JWT inválido:", callerAuthError?.message);
      return json({ error: "Unauthorized: invalid session." }, 401);
    }

    console.log(`👤 Solicitante verificado: ${callerUser.id}`);

    // ═══════════════════════════════════════════════════════════
    // PASO 2: PARSEAR Y VALIDAR PAYLOAD (T2)
    // ═══════════════════════════════════════════════════════════
    let payload: {
      tienda_id?: string;
      nombre?: string;
      email?: string;
      password?: string;
      rol?: string;
    };

    try {
      payload = await req.json();
    } catch {
      return json({ error: "Invalid JSON payload." }, 400);
    }

    const { tienda_id, nombre, email, password, rol } = payload;

    if (!tienda_id || !nombre || !email || !password || !rol) {
      return json(
        { error: "Faltan campos requeridos: tienda_id, nombre, email, password, rol." },
        400
      );
    }

    if (!email.includes("@")) {
      return json({ error: "El email proporcionado no es válido." }, 400);
    }

    if (password.length < 6) {
      return json({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);
    }

    if (!ASSIGNABLE_ROLES.has(rol)) {
      return json(
        { error: `Rol inválido. Roles permitidos: ${[...ASSIGNABLE_ROLES].join(", ")}.` },
        400
      );
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 3: AUTORIZACIÓN RBAC — ¿El solicitante es dueño? (T2)
    // ═══════════════════════════════════════════════════════════
    // Usar el cliente del solicitante para verificar su perfil.
    // Esto respeta el RLS: solo el solicitante puede leer su propio perfil.
    const { data: callerProfile, error: profileError } = await supabaseCallerClient
      .from("perfiles")
      .select("rol, tienda_id")
      .eq("id", callerUser.id)
      .single();

    if (profileError || !callerProfile) {
      console.error("❌ Error al cargar perfil del solicitante:", profileError?.message);
      return json({ error: "No se pudo verificar el perfil del solicitante." }, 403);
    }

    const isSuperadmin = callerProfile.rol === "superadmin";
    const isOwnerOfStore =
      callerProfile.rol === "dueño" &&
      callerProfile.tienda_id === tienda_id;

    if (!isSuperadmin && !isOwnerOfStore) {
      console.warn(
        `🚫 Acceso denegado: usuario ${callerUser.id} (rol=${callerProfile.rol}) ` +
        `intentó crear miembro en tienda ${tienda_id}.`
      );
      return json(
        { error: "Forbidden: No tienes permiso para gestionar el equipo de esta tienda." },
        403
      );
    }

    console.log(`✅ Autorización RBAC exitosa para tienda ${tienda_id}`);

    // ═══════════════════════════════════════════════════════════
    // PASO 4: CREAR USUARIO EN AUTH (T3 — Service Role)
    // ═══════════════════════════════════════════════════════════
    // El cliente admin usa la service_role key, que NUNCA sale del servidor.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Confirmar email automáticamente
        user_metadata: {
          nombre_completo: nombre.trim(),
        },
      });

    if (authError) {
      // Distinguir entre email duplicado y otros errores
      if (
        authError.message.toLowerCase().includes("already") ||
        authError.message.toLowerCase().includes("exists") ||
        authError.message.toLowerCase().includes("unique")
      ) {
        return json({ error: "Este email ya está registrado en el sistema." }, 409);
      }
      console.error("❌ Error al crear usuario en Auth:", authError.message);
      return json({ error: `Error al crear usuario: ${authError.message}` }, 500);
    }

    const newUserId = authData.user.id;
    console.log(`✅ Usuario Auth creado: ${newUserId}`);

    // ═══════════════════════════════════════════════════════════
    // PASO 5: VINCULAR PERFIL A LA TIENDA (T5)
    // ═══════════════════════════════════════════════════════════
    // El trigger `handle_new_user` ya habrá creado una fila en `perfiles`
    // con una tienda temporal. Usamos UPDATE (no INSERT) para vincular
    // al miembro a la tienda correcta y asignar el rol indicado.
    // Usamos supabaseAdmin para bypassear el trigger de anti-hijack.
    const { error: profileUpdateError } = await supabaseAdmin
      .from("perfiles")
      .update({
        tienda_id,
        rol,
        nombre_completo: nombre.trim(),
      })
      .eq("id", newUserId);

    if (profileUpdateError) {
      // Si falla el perfil, intentar limpiar el usuario Auth para no dejar huecos
      console.error("❌ Error al vincular perfil:", profileUpdateError.message);
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        console.warn(`🧹 Usuario Auth ${newUserId} eliminado por fallo en perfil.`);
      } catch (cleanupErr) {
        console.error("⚠️ No se pudo eliminar el usuario Auth tras el fallo:", cleanupErr);
      }
      return json(
        { error: `Error al configurar el perfil del nuevo miembro: ${profileUpdateError.message}` },
        500
      );
    }

    console.log(`✅ Perfil vinculado: usuario ${newUserId} → tienda ${tienda_id} (rol: ${rol})`);

    // ═══════════════════════════════════════════════════════════
    // PASO 6: RESPUESTA EXITOSA
    // ═══════════════════════════════════════════════════════════
    return new Response(
      JSON.stringify({
        id: newUserId,
        nombre: nombre.trim(),
        email,
        rol,
        tienda_id,
      }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("💥 Error crítico en create-team-member:", message);
    return json({ error: "Internal server error." }, 500);
  }
});
