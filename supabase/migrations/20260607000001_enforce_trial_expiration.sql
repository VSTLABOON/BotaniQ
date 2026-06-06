-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Control de Expiración de Prueba Gratuita (Backend)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Función para verificar si la prueba del tenant ha expirado
-- Se evalúa la suscripción más reciente por fecha de creación (created_at DESC).
-- Si es de tipo 'prueba' y su fecha de renovación ha pasado, se considera expirada.
-- Si hay una suscripción activa posterior (pago exitoso), no está expirada.
CREATE OR REPLACE FUNCTION public.is_trial_expired(p_tienda_id uuid)
RETURNS boolean AS $$
DECLARE
  v_expired boolean := false;
  v_estado text;
  v_fecha_renovacion timestamptz;
BEGIN
  SELECT s.estado, s.fecha_renovacion INTO v_estado, v_fecha_renovacion
  FROM public.suscripciones s
  WHERE s.tenant_id = p_tienda_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_estado = 'prueba' AND v_fecha_renovacion < NOW() THEN
    v_expired := true;
  END IF;

  RETURN v_expired;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Trigger para la tabla productos
-- Bloquea las inserciones o modificaciones de catálogo si la prueba del tenant venció.
CREATE OR REPLACE FUNCTION public.check_trial_before_product_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF public.is_trial_expired(NEW.tienda_id) THEN
    RAISE EXCEPTION 'trial_expired'
      USING HINT = 'Tu período de prueba ha expirado. Activa tu plan para continuar.',
            ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_trial_productos ON public.productos;
CREATE TRIGGER trg_check_trial_productos
  BEFORE INSERT OR UPDATE ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public.check_trial_before_product_mutation();


-- 3. Trigger para la tabla tiendas
-- Bloquea las modificaciones de la tienda (ajustes visuales/secciones) si la prueba del tenant venció.
-- Exceptúa las modificaciones internas realizadas por Deno Edge Functions (service_role).
CREATE OR REPLACE FUNCTION public.check_trial_before_tienda_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Permitir siempre a service_role (Stripe/OpenPay Webhooks y superadmin)
  IF current_setting('role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_trial_expired(NEW.id) THEN
    RAISE EXCEPTION 'trial_expired'
      USING HINT = 'Tu período de prueba ha expirado. Activa tu plan para continuar.',
            ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_trial_tiendas ON public.tiendas;
CREATE TRIGGER trg_check_trial_tiendas
  BEFORE UPDATE ON public.tiendas
  FOR EACH ROW EXECUTE FUNCTION public.check_trial_before_tienda_update();


-- 4. Función RPC para consultar el estado de la suscripción desde el cliente
-- Permite al panel leer la vigencia en días restantes y estado del ciclo de vida de Stripe de forma segura.
CREATE OR REPLACE FUNCTION public.get_subscription_status(p_tienda_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'estado', s.estado,
    'plan', s.plan,
    'fecha_renovacion', s.fecha_renovacion,
    'is_trial_expired', public.is_trial_expired(p_tienda_id),
    'dias_restantes', GREATEST(0, EXTRACT(DAY FROM (s.fecha_renovacion - NOW()))::int)
  ) INTO v_result
  FROM public.suscripciones s
  WHERE s.tenant_id = p_tienda_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  RETURN COALESCE(v_result, jsonb_build_object(
    'estado', 'sin_suscripcion',
    'is_trial_expired', false,
    'dias_restantes', 0
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Conceder permisos de ejecución para roles públicos y autenticados
GRANT EXECUTE ON FUNCTION public.is_trial_expired(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_status(uuid) TO anon, authenticated;
