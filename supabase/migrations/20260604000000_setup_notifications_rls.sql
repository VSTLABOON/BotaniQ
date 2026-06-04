-- Habilitar RLS en la tabla notificaciones
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes para evitar conflictos
DROP POLICY IF EXISTS "users_select_notificaciones" ON public.notificaciones;
DROP POLICY IF EXISTS "users_update_notificaciones" ON public.notificaciones;

-- Política de lectura (SELECT): solo dueño, empleado y superadmin pueden leer de su tienda_id
CREATE POLICY "users_select_notificaciones" ON public.notificaciones
  FOR SELECT TO authenticated
  USING (
    tienda_id IN (
      SELECT tienda_id FROM public.perfiles 
      WHERE id = auth.uid() AND rol IN ('dueño', 'superadmin', 'empleado')
    )
  );

-- Política de edición (UPDATE): mismos roles anteriores
CREATE POLICY "users_update_notificaciones" ON public.notificaciones
  FOR UPDATE TO authenticated
  USING (
    tienda_id IN (
      SELECT tienda_id FROM public.perfiles 
      WHERE id = auth.uid() AND rol IN ('dueño', 'superadmin', 'empleado')
    )
  )
  WITH CHECK (
    tienda_id IN (
      SELECT tienda_id FROM public.perfiles 
      WHERE id = auth.uid() AND rol IN ('dueño', 'superadmin', 'empleado')
    )
  );
