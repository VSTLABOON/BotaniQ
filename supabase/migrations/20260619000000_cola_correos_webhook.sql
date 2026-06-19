-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Procesador de Cola de Correos via pg_net
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.process_email_queue_item()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_payload JSONB;
  v_http_id bigint;
BEGIN
  -- Intentar recuperar de vault si está disponible
  BEGIN
    SELECT decrypted_secret INTO v_service_role_key 
    FROM vault.decrypted_secrets 
    WHERE name = 'service_role_key' 
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Fallback a firma dinámica si no se encuentra en vault (Evita hardcodear secretos)
  IF v_service_role_key IS NULL THEN
    BEGIN
      v_service_role_key := extensions.sign(
        json_build_object(
          'role', 'service_role',
          'iss', 'supabase',
          'exp', extract(epoch from (now() + interval '1 hour'))::integer
        ),
        current_setting('app.settings.jwt_secret')
      );
    EXCEPTION WHEN OTHERS THEN
      v_service_role_key := NULL;
    END;
  END IF;

  IF v_service_role_key IS NULL THEN
    RAISE EXCEPTION 'Supabase service_role_key no configurada en vault y la firma dinamica fallo.';
  END IF;

  v_supabase_url := 'https://ygnxjgyihdtnybvhhxmi.supabase.co';

  v_payload := jsonb_build_object(
    'toEmail', NEW.to_email,
    'toName', NEW.to_name,
    'templateId', NEW.template_id,
    'params', NEW.params
  );

  -- Realizar llamada asíncrona a la Edge Function
  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := v_payload
  ) INTO v_http_id;

  -- Marcar como procesado
  UPDATE public.cola_correos
  SET procesado = true,
      procesado_at = NOW()
  WHERE id = NEW.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Guardar el mensaje de error en la cola
  UPDATE public.cola_correos
  SET error = SQLERRM,
      procesado = false
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS trg_process_email_queue_item ON public.cola_correos;

-- Crear el trigger para activarse en cada inserción
CREATE TRIGGER trg_process_email_queue_item
  AFTER INSERT ON public.cola_correos
  FOR EACH ROW
  WHEN (NEW.procesado = false)
  EXECUTE FUNCTION public.process_email_queue_item();
