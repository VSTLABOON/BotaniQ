-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Corrección de Fugas de Seguridad RLS y BOLA + RPC de Rastreo
-- ═══════════════════════════════════════════════════════════════════

-- Renombrar columna cliente_id a usuario_id para alinear base de datos con el codebase
ALTER TABLE public.pedidos 
  RENAME COLUMN cliente_id TO usuario_id;

-- ── 1. SEGURIDAD EN PEDIDOS (BOLA LEAK FIX) ──────────────────────────
-- Eliminar la política staff_read_pedidos obsoleta/insegura que permitía 
-- a cualquier usuario autenticado de la tienda (incluyendo clientes) leer todo.
DROP POLICY IF EXISTS "staff_read_pedidos" ON public.pedidos;

-- Crear política de lectura segura para pedidos (solo personal de la tienda)
CREATE POLICY "staff_read_pedidos" ON public.pedidos
  FOR SELECT TO authenticated
  USING (
    tienda_id IN (
      SELECT tienda_id FROM public.perfiles 
      WHERE id = auth.uid() AND rol IN ('dueño', 'empleado', 'superadmin', 'repartidor')
    )
  );

-- Crear política para que clientes puedan leer únicamente sus propios pedidos
DROP POLICY IF EXISTS "clientes_read_own_pedidos" ON public.pedidos;
CREATE POLICY "clientes_read_own_pedidos" ON public.pedidos
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
  );


-- ── 2. SEGURIDAD EN DETALLE DE PEDIDOS (BOLA LEAK FIX) ────────────────
-- Eliminar la política staff_read_pedido_items obsoleta/insegura
DROP POLICY IF EXISTS "staff_read_pedido_items" ON public.pedido_items;

-- Crear política de lectura segura para items de pedidos (solo personal de la tienda)
CREATE POLICY "staff_read_pedido_items" ON public.pedido_items
  FOR SELECT TO authenticated
  USING (
    pedido_id IN (
      SELECT p.id FROM public.pedidos p
      JOIN public.perfiles pf ON p.tienda_id = pf.tienda_id
      WHERE pf.id = auth.uid() AND pf.rol IN ('dueño', 'empleado', 'superadmin', 'repartidor')
    )
  );

-- Crear política para que clientes puedan leer los items de sus propios pedidos
DROP POLICY IF EXISTS "clientes_read_own_pedido_items" ON public.pedido_items;
CREATE POLICY "clientes_read_own_pedido_items" ON public.pedido_items
  FOR SELECT TO authenticated
  USING (
    pedido_id IN (
      SELECT id FROM public.pedidos WHERE usuario_id = auth.uid()
    )
  );


-- ── 3. SEGURIDAD EN REPARTIDORES (INFORMATION DISCLOSURE FIX) ────────
-- Modificar la política de lectura de repartidores para evitar que los clientes (rol cliente)
-- puedan consultar los datos sensibles del personal de reparto de la tienda.
DROP POLICY IF EXISTS "Lectura repartidores por tienda" ON public.repartidores;

CREATE POLICY "Lectura repartidores por tienda" ON public.repartidores
  FOR SELECT TO authenticated
  USING (
    tienda_id IN (
      SELECT tienda_id FROM public.perfiles 
      WHERE id = auth.uid() AND rol IN ('dueño', 'empleado', 'superadmin', 'repartidor')
    )
  );


-- ── 4. RPC DE RASTREO SEGURO PARA CLIENTES ANÓNIMOS (GUESTS) ─────────
-- Permite que los clientes anónimos obtengan el estado de su pedido sin tener
-- permisos de lectura directa (SELECT) en las tablas de pedidos y pedido_items.
CREATE OR REPLACE FUNCTION public.get_guest_order(
  p_order_id_prefix TEXT,
  p_phone_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- Permite saltar RLS controladamente bajo validación del backend
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_order_phone TEXT;
  v_clean_phone TEXT;
  v_result JSONB;
BEGIN
  -- 1. Limpiar el teléfono de entrada (quitar caracteres no numéricos)
  v_clean_phone := regexp_replace(p_phone_number, '\D', '', 'g');

  IF length(p_order_id_prefix) < 5 THEN
    RAISE EXCEPTION 'Número de pedido demasiado corto.';
  END IF;

  IF length(v_clean_phone) < 8 THEN
    RAISE EXCEPTION 'Teléfono inválido.';
  END IF;

  -- 2. Buscar el pedido que coincide con el prefijo del ID
  -- (Tomamos la primera coincidencia)
  SELECT id, regexp_replace(COALESCE(datos_envio->>'recipientPhone', ''), '\D', '', 'g')
  INTO v_order_id, v_order_phone
  FROM public.pedidos
  WHERE id::text ILIKE (p_order_id_prefix || '%')
  LIMIT 1;

  IF v_order_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 3. Validar coincidencia de teléfono (coincidencia parcial bilateral)
  IF NOT (v_order_phone LIKE ('%' || v_clean_phone || '%') OR v_clean_phone LIKE ('%' || v_order_phone || '%')) THEN
    RETURN NULL;
  END IF;

  -- 4. Construir el objeto JSON completo con los items y las imágenes del producto
  SELECT jsonb_build_object(
    'id', p.id,
    'tienda_id', p.tienda_id,
    'total', p.total,
    'estado', p.estado,
    'metodo_pago', p.metodo_pago,
    'datos_envio', p.datos_envio,
    'email_cliente', p.email_cliente,
    'created_at', p.created_at,
    'pedido_items', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pi.id,
            'nombre_producto', pi.nombre_producto,
            'cantidad', pi.cantidad,
            'precio_unitario', pi.precio_unitario,
            'producto_id', pi.producto_id,
            'variante_id', pi.variante_id,
            'productos', jsonb_build_object('imagenes', prod.imagenes)
          )
        )
        FROM public.pedido_items pi
        LEFT JOIN public.productos prod ON prod.id = pi.producto_id
        WHERE pi.pedido_id = p.id
      ),
      '[]'::jsonb
    )
  ) INTO v_result
  FROM public.pedidos p
  WHERE p.id = v_order_id;

  RETURN v_result;
END;
$$;

-- Otorgar permisos de ejecución para roles anon y authenticated
GRANT EXECUTE ON FUNCTION public.get_guest_order(TEXT, TEXT) TO anon, authenticated;
