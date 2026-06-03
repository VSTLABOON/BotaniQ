-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Política DELETE en pedidos (Rollback manual de Express)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Eliminar política vieja si existiera para evitar conflictos
DROP POLICY IF EXISTS "Dueños y empleados pueden anular pedidos de su tienda" ON public.pedidos;

-- 2. Crear la política de eliminación para pedidos
CREATE POLICY "Dueños y empleados pueden anular pedidos de su tienda" 
ON public.pedidos FOR DELETE TO authenticated 
USING (
  tienda_id IN (
    SELECT tienda_id FROM public.perfiles 
    WHERE id = auth.uid() AND rol IN ('dueño', 'superadmin', 'empleado')
  )
);
