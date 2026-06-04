-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Eliminar política RLS rota en tiendas
-- 
-- Objetivo: Eliminar la política obsoleta "Dueños pueden actualizar su tienda"
-- que hace referencia a la columna inexistente owner_id, evitando fallos
-- de validación de PostgreSQL. La política correcta "Dueño actualiza su propia tienda"
-- (creada en la migración 20260511000001) permanece intacta y activa.
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Dueños pueden actualizar su tienda" ON public.tiendas;
