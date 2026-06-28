-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Corregir RLS de producto_variantes sin filtro de disponibilidad
-- ═══════════════════════════════════════════════════════════════════
-- NOTA/MOTIVO DE SOBRESCRITURA:
-- Se identificó que la base de datos contenía dos políticas SELECT públicas concurrentes:
-- 1. "Variantes públicas" (creada en la migración 20260604000005 con el filtro correcto).
-- 2. "Público puede ver variantes" (con USING true, creada manualmente en la base de datos o en setups antiguos).
-- Debido a que PostgreSQL evalúa políticas RLS múltiples con OR, la regla insegura (USING true)
-- invalidaba completamente a la regla segura. Para corregirlo, limpiamos ambas y recreamos
-- la política principal de forma totalmente blindada.

DROP POLICY IF EXISTS "Público puede ver variantes" ON public.producto_variantes;
DROP POLICY IF EXISTS "Variantes públicas" ON public.producto_variantes;

CREATE POLICY "Público puede ver variantes"
  ON public.producto_variantes
  FOR SELECT
  TO anon, authenticated
  USING (
    producto_id IN (
      SELECT id FROM public.productos WHERE disponible = true
    )
  );
