-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Índices de rendimiento para el catálogo
-- 
-- Objetivo: Acelerar las consultas frecuentes en el storefront y CMS
-- para evitar escaneos secuenciales (Seq Scans) en producción.
-- ═══════════════════════════════════════════════════════════════════

-- Índice para filtrar productos por tienda (consultas de catálogo público y admin)
-- Verifica si ya existe y lo crea si no.
CREATE INDEX IF NOT EXISTS idx_productos_tienda_id
  ON public.productos(tienda_id);

-- Índice para filtrar productos disponibles por tienda (storefront)
-- Optimiza la consulta principal de la landing del catálogo.
CREATE INDEX IF NOT EXISTS idx_productos_tienda_disponible
  ON public.productos(tienda_id, disponible);

-- Índice para obtener variantes de un producto (join en ProductDetailPage y checkout)
-- Acelera los lookups de variantes por producto.
CREATE INDEX IF NOT EXISTS idx_variantes_producto_id
  ON public.producto_variantes(producto_id);

-- Índice para seccion_productos (consultas por tienda y sección en storefront)
-- Mejora el tiempo de carga del agrupador relacional de secciones.
CREATE INDEX IF NOT EXISTS idx_seccion_productos_tienda_seccion
  ON public.seccion_productos(tienda_id, seccion_key);

-- Índice para pedidos por tienda (AdminPedidos y Realtime)
-- Permite que el staff administrativo filtre pedidos rápidamente.
CREATE INDEX IF NOT EXISTS idx_pedidos_tienda_id
  ON public.pedidos(tienda_id);

-- Índice para notificaciones no leídas por tienda (badge del header)
-- Optimiza el conteo en tiempo real del badge administrativo.
CREATE INDEX IF NOT EXISTS idx_notificaciones_tienda_leida
  ON public.notificaciones(tienda_id, leida);
