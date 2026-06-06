-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Agregar credenciales de Stripe para multi-tenant (Storefront)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.tiendas
  ADD COLUMN IF NOT EXISTS stripe_secret_key text NULL,
  ADD COLUMN IF NOT EXISTS stripe_publishable_key text NULL,
  ADD COLUMN IF NOT EXISTS stripe_webhook_secret text NULL;

-- Revocar acceso completo actual
REVOKE SELECT ON TABLE public.tiendas FROM anon, authenticated;

-- Re-otorgar solo columnas no sensibles (copiado de 20260604000001_cls_tiendas_credenciales.sql con stripe_publishable_key al final)
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
  stripe_customer_id,
  stripe_publishable_key
) ON public.tiendas TO anon, authenticated;
