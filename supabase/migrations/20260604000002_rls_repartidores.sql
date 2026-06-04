-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: RLS y políticas en la tabla repartidores
-- 
-- Objetivo: Asegurar que la tabla repartidores cuente con la columna 
-- tienda_id no nula y tenga políticas de RLS habilitadas para 
-- prevenir que una tienda acceda o modifique repartidores de otra.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. ASEGURAR COLUMNA TIENDA_ID ──────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'repartidores' AND column_name = 'tienda_id'
  ) THEN
    ALTER TABLE public.repartidores 
      ADD COLUMN tienda_id UUID NOT NULL REFERENCES public.tiendas(id) ON DELETE CASCADE;
  ELSE
    -- Asegurar que la restricción NOT NULL está aplicada
    ALTER TABLE public.repartidores 
      ALTER COLUMN tienda_id SET NOT NULL;
  END IF;
END $$;

-- ── 2. HABILITAR ROW LEVEL SECURITY ───────────────────────────────
ALTER TABLE public.repartidores ENABLE ROW LEVEL SECURITY;

-- ── 3. LIMPIAR POLÍTICAS EXISTENTES ────────────────────────────────
DROP POLICY IF EXISTS "Lectura repartidores por tienda" ON public.repartidores;
DROP POLICY IF EXISTS "Modificacion repartidores por tienda" ON public.repartidores;

-- ── 4. POLÍTICA DE LECTURA (SELECT) ────────────────────────────────
-- Solo el personal o repartidores de la misma tienda pueden verlos.
CREATE POLICY "Lectura repartidores por tienda" ON public.repartidores
  FOR SELECT TO authenticated
  USING (
    tienda_id IN (
      SELECT tienda_id FROM public.perfiles 
      WHERE id = auth.uid()
    )
  );

-- ── 5. POLÍTICA DE ESCRITURA (ALL) ─────────────────────────────────
-- Solo el staff administrativo (dueño, empleado, superadmin) puede gestionar.
CREATE POLICY "Modificacion repartidores por tienda" ON public.repartidores
  FOR ALL TO authenticated
  USING (
    tienda_id IN (
      SELECT tienda_id FROM public.perfiles 
      WHERE id = auth.uid() AND rol IN ('dueño', 'empleado', 'superadmin')
    )
  )
  WITH CHECK (
    tienda_id IN (
      SELECT tienda_id FROM public.perfiles 
      WHERE id = auth.uid() AND rol IN ('dueño', 'empleado', 'superadmin')
    )
  );
