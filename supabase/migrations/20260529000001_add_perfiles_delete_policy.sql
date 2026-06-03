-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Función get_user_role y política DELETE en perfiles
-- ═══════════════════════════════════════════════════════════════════

-- 1. Crear función helper para obtener el rol del usuario autenticado sin recursión
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT rol FROM public.perfiles WHERE id = auth.uid();
$$;

-- 2. Eliminar política vieja si existiera para evitar conflictos
DROP POLICY IF EXISTS "Dueños pueden eliminar perfiles de su tienda" ON public.perfiles;

-- 3. Crear la política de eliminación para perfiles
CREATE POLICY "Dueños pueden eliminar perfiles de su tienda" 
ON public.perfiles FOR DELETE TO authenticated 
USING (
  tienda_id = public.get_user_tienda_id() 
  AND public.get_user_role() = 'dueño'::public.user_role
);
