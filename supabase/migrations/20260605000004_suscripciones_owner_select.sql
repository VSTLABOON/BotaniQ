-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Política de lectura en suscripciones para el dueño de tienda
-- 
-- Objetivo: Permitir que los dueños de tiendas consulten el estado de 
-- su suscripción SaaS directamente desde el cliente.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Asegurar que RLS está habilitado en la tabla suscripciones
ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;

-- 2. Crear la política de lectura para dueños de tienda (de forma idempotente)
-- La columna de tenant en suscripciones es 'tenant_id'.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'suscripciones' AND policyname = 'Dueño lee su propia suscripción'
  ) THEN
    CREATE POLICY "Dueño lee su propia suscripción"
      ON public.suscripciones
      FOR SELECT TO authenticated
      USING (
        tenant_id IN (
          SELECT tienda_id FROM public.perfiles
          WHERE id = auth.uid()
            AND rol IN ('dueño', 'superadmin')
        )
      );
  END IF;
END $$;
