-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Política de inserción en suscripciones para el dueño de tienda
-- 
-- Objetivo: Permitir que los dueños de tiendas registren su propia suscripción
-- (como la prueba gratuita de 14 días) durante el flujo de onboarding.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Eliminar la política si ya existe para evitar errores
DROP POLICY IF EXISTS "Dueño inserta su propia suscripción" ON public.suscripciones;

-- 2. Crear la nueva política de inserción
CREATE POLICY "Dueño inserta su propia suscripción"
  ON public.suscripciones
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tienda_id FROM public.perfiles
      WHERE id = auth.uid()
        AND rol IN ('dueño', 'superadmin')
    )
  );
