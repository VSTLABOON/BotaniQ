-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Corregir referencia de columna en get_guest_order
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_guest_order(p_order_id_prefix text, p_phone_number text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
            'productos', jsonb_build_object('imagen_url', prod.imagen_url)
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
$function$;
