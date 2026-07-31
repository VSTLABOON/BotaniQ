-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Corrección Crítica de Seguridad y Precio Hardening (1.1 y 1.2)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. RPC FIX 1.2: Validar pertenencia y disponibilidad de producto en create_guest_order ──
CREATE OR REPLACE FUNCTION public.create_guest_order(
  p_tienda_id   UUID,
  p_total       NUMERIC,
  p_datos_envio JSONB,
  p_items       JSONB,
  p_costo_envio NUMERIC DEFAULT 0.00
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido_id UUID;
  v_item      JSONB;
  v_prod_id   UUID;
BEGIN
  -- 1. Validar que la tienda existe
  IF NOT EXISTS (SELECT 1 FROM public.tiendas WHERE id = p_tienda_id) THEN
    RAISE EXCEPTION 'Tienda no encontrada: %', p_tienda_id;
  END IF;

  -- 2. Validar que hay items
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido debe contener al menos un item';
  END IF;

  -- 3. Insertar el pedido
  INSERT INTO public.pedidos (
    tienda_id,
    total,
    estado,
    metodo_pago,
    datos_envio,
    costo_envio
  ) VALUES (
    p_tienda_id,
    p_total,
    'pendiente',
    'efectivo',
    p_datos_envio,
    p_costo_envio
  )
  RETURNING id INTO v_pedido_id;

  -- 4. Insertar items validando pertenencia a la tienda y disponibilidad
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := NULLIF(v_item->>'producto_id', '')::UUID;

    IF v_prod_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.productos
      WHERE id = v_prod_id
        AND tienda_id = p_tienda_id
        AND disponible = true
    ) THEN
      RAISE EXCEPTION 'El producto % no pertenece a la tienda % o no está disponible',
        v_prod_id, p_tienda_id;
    END IF;

    INSERT INTO public.pedido_items (
      pedido_id,
      producto_id,
      variante_id,
      nombre_producto,
      cantidad,
      precio_unitario
    ) VALUES (
      v_pedido_id,
      v_prod_id,
      NULLIF(v_item->>'variante_id', '')::UUID,
      COALESCE(v_item->>'nombre', v_item->>'nombre_producto', 'Producto'),
      COALESCE((v_item->>'cantidad')::INTEGER, 1),
      COALESCE((v_item->>'precio_unitario')::NUMERIC, 0)
    );
  END LOOP;

  -- 5. Retornar ID del pedido
  RETURN v_pedido_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_guest_order(UUID, NUMERIC, JSONB, JSONB, NUMERIC) TO anon, authenticated;

-- ── 2. RPC FIX 1.1: Sincronización atómica y server-calculated de pedido_items ──
CREATE OR REPLACE FUNCTION public.sync_pedido_items(
  p_order_id UUID,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tienda_id UUID;
BEGIN
  -- Obtener tienda_id del pedido para validar aislamiento multi-tenant
  SELECT tienda_id INTO v_tienda_id FROM public.pedidos WHERE id = p_order_id;
  IF v_tienda_id IS NULL THEN
    RAISE EXCEPTION 'Pedido no encontrado: %', p_order_id;
  END IF;

  -- 1. Borrar items existentes dentro de la misma transacción
  DELETE FROM public.pedido_items WHERE pedido_id = p_order_id;

  -- 2. Inserción atómica re-calculando precios directamente desde la BD
  INSERT INTO public.pedido_items (
    pedido_id,
    producto_id,
    variante_id,
    nombre_producto,
    cantidad,
    precio_unitario
  )
  SELECT
    p_order_id,
    p.id AS producto_id,
    pv.id AS variante_id,
    CASE 
      WHEN pv.id IS NOT NULL THEN p.nombre || ' — ' || pv.nombre
      ELSE p.nombre
    END AS nombre_producto,
    COALESCE((item->>'cantidad')::INT, 1) AS cantidad,
    COALESCE(pv.precio, p.precio) AS precio_unitario
  FROM jsonb_array_elements(p_items) AS item
  JOIN public.productos p ON p.id = (item->>'producto_id')::UUID AND p.tienda_id = v_tienda_id
  LEFT JOIN public.producto_variantes pv 
    ON pv.id = NULLIF(item->>'variante_id', '')::UUID 
   AND pv.producto_id = p.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_pedido_items(UUID, JSONB) TO anon, authenticated, service_role;
