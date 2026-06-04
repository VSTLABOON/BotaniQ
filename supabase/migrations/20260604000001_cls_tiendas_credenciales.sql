-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Column-Level Security (CLS) en tabla public.tiendas
-- 
-- Objetivo: Revocar el acceso de lectura completo de los roles anon y 
-- authenticated a la tabla public.tiendas y conceder acceso únicamente 
-- a las columnas no sensibles. Las credenciales privadas de pasarelas 
-- de pago (como openpay_private_key) quedarán restringidas de forma 
-- exclusiva para el rol service_role (Edge Functions).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. REVOCAR PERMISOS DE SELECT ──────────────────────────────────
REVOKE SELECT ON TABLE public.tiendas FROM anon, authenticated;

-- ── 2. OTORGAR PERMISOS SELECTIVOS (CLS) ──────────────────────────
-- Se incluyen todas las columnas públicas de visualización, ubicación,
-- configuraciones generales, config_ui, pasarelas públicas y
-- stripe_customer_id para evitar fallos de lectura en el dashboard de superadmin.
GRANT SELECT (
  id, 
  slug, 
  nombre, 
  logo_url, 
  color_primario, 
  color_secundario, 
  color_acento,
  ciudad, 
  estado, 
  area_metropolitana, 
  mapa_url, 
  direccion, 
  whatsapp, 
  wa_base,
  horarios, 
  redes_sociales, 
  nav_links, 
  campana, 
  anio_fundacion, 
  texto_nosotros,
  firma, 
  envio_costo, 
  colonias, 
  config_ui, 
  subscription_level, 
  custom_domain,
  currency, 
  created_at, 
  meta_title, 
  openpay_merchant_id, 
  openpay_public_key,
  openpay_sandbox_mode, 
  preferred_gateway,
  stripe_customer_id
) ON public.tiendas TO anon, authenticated;
