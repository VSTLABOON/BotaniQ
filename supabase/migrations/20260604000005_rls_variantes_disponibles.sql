-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Restringir variantes públicas a productos disponibles
-- 
-- Objetivo: Evitar la exposición de stock, SKU y precios de variantes 
-- asociadas a productos en estado borrador (disponible = false).
-- Se reemplaza la política pública abierta (USING true) por una 
-- que valida que el producto padre esté publicado.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. LIMPIAR POLÍTICA EXISTENTE ──────────────────────────────────
DROP POLICY IF EXISTS "Variantes públicas" ON public.producto_variantes;

-- ── 2. CREAR NUEVA POLÍTICA SELECT SEGURA ──────────────────────────
CREATE POLICY "Variantes públicas" ON public.producto_variantes
  FOR SELECT TO anon, authenticated
  USING (
    producto_id IN (
      SELECT id FROM public.productos WHERE disponible = true
    )
  );
