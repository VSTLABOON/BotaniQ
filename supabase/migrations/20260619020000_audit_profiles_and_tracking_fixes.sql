-- ---------------------------------------------------------------------
-- MIGRACION: Correccion de fuga en perfiles y aseguramiento de tracking_pedidos
-- ---------------------------------------------------------------------

-- 1. CORRECCION DE FUGA DE INFORMACION EN PERFILES (BOLA FIX)
-- Reemplazar la politica "Lectura de perfiles autorizada" para evitar que 
-- los clientes (rol = 'cliente') puedan listar perfiles de otros clientes.
DROP POLICY IF EXISTS "Lectura de perfiles autorizada" ON public.perfiles;

CREATE POLICY "Lectura de perfiles autorizada"
ON public.perfiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR 
  (
    tienda_id = public.get_user_tienda_id() 
    AND public.get_user_role()::text IN ('dueño', 'empleado', 'superadmin', 'repartidor')
  )
);


-- 2. ASEGURAMIENTO DE TABLA tracking_pedidos (RLS & POLICIES)
-- Habilitar RLS en la tabla tracking_pedidos
ALTER TABLE public.tracking_pedidos ENABLE ROW LEVEL SECURITY;

-- Limpiar cualquier politica previa
DROP POLICY IF EXISTS "Service role has full access to tracking_pedidos" ON public.tracking_pedidos;
DROP POLICY IF EXISTS "Staff can read tracking_pedidos of their tienda" ON public.tracking_pedidos;
DROP POLICY IF EXISTS "Drivers can manage their own tracking_pedidos" ON public.tracking_pedidos;
DROP POLICY IF EXISTS "Customers can read tracking_pedidos of their own orders" ON public.tracking_pedidos;

-- Politica 1: Acceso total para service_role
CREATE POLICY "Service role has full access to tracking_pedidos"
  ON public.tracking_pedidos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Politica 2: El staff de la tienda (dueño, empleado, superadmin) puede leer tracking de sus pedidos
CREATE POLICY "Staff can read tracking_pedidos of their tienda"
  ON public.tracking_pedidos
  FOR SELECT
  TO authenticated
  USING (
    pedido_id IN (
      SELECT id FROM public.pedidos
      WHERE tienda_id = public.get_user_tienda_id()
    )
  );

-- Politica 3: El repartidor asignado puede ver y actualizar su tracking
CREATE POLICY "Drivers can manage their own tracking_pedidos"
  ON public.tracking_pedidos
  FOR ALL
  TO authenticated
  USING (
    repartidor_id IN (
      SELECT id FROM public.repartidores
      WHERE perfil_id = auth.uid()
    )
  )
  WITH CHECK (
    repartidor_id IN (
      SELECT id FROM public.repartidores
      WHERE perfil_id = auth.uid()
    )
  );

-- Politica 4: Los clientes pueden ver el tracking de sus propios pedidos
CREATE POLICY "Customers can read tracking_pedidos of their own orders"
  ON public.tracking_pedidos
  FOR SELECT
  TO authenticated
  USING (
    pedido_id IN (
      SELECT id FROM public.pedidos
      WHERE usuario_id = auth.uid()
    )
  );
