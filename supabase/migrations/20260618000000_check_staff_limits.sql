-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Hardening de Equipo (Aura) e Integración de Correos
-- ═══════════════════════════════════════════════════════════════════

-- 1. Crear función de verificación de límites de equipo
CREATE OR REPLACE FUNCTION public.check_staff_limits()
RETURNS TRIGGER AS $$
DECLARE
  v_subscription_level INTEGER;
  v_staff_count INTEGER;
BEGIN
  IF NEW.tienda_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT subscription_level INTO v_subscription_level 
  FROM public.tiendas 
  WHERE id = NEW.tienda_id;

  -- Nivel 2: Aura. Limitar a máximo 1 colaborador activo (excluyendo al dueño)
  IF v_subscription_level = 2 AND NEW.rol <> 'dueño' THEN
    SELECT COUNT(*) INTO v_staff_count 
    FROM public.perfiles 
    WHERE tienda_id = NEW.tienda_id 
      AND rol <> 'dueño'
      AND id <> NEW.id;

    IF v_staff_count >= 1 THEN
      RAISE EXCEPTION 'El plan Aura permite un máximo de 1 colaborador adicional.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Vincular trigger a la tabla perfiles
DROP TRIGGER IF EXISTS trg_check_staff_limits ON public.perfiles;
CREATE TRIGGER trg_check_staff_limits
  BEFORE INSERT OR UPDATE OF rol, tienda_id ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.check_staff_limits();


-- 3. Crear tabla de cola de correos (Email Queue)
CREATE TABLE IF NOT EXISTS public.cola_correos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  to_name TEXT NOT NULL,
  template_id INTEGER NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  procesado BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  procesado_at TIMESTAMPTZ
);

-- Habilitar RLS en cola_correos y restringir lectura/escritura a service_role (backend)
ALTER TABLE public.cola_correos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to cola_correos" ON public.cola_correos;
CREATE POLICY "Service role has full access to cola_correos" 
  ON public.cola_correos FOR ALL TO service_role USING (true) WITH CHECK (true);


-- 4. Columna de control para recordatorio de expiración
ALTER TABLE public.suscripciones 
  ADD COLUMN IF NOT EXISTS recordatorio_expiracion_enviado BOOLEAN DEFAULT false;


-- 5. Función de recordatorio de expiración de pruebas (48 horas antes)
CREATE OR REPLACE FUNCTION public.process_trial_expiry_reminders()
RETURNS void AS $$
DECLARE
  v_sub RECORD;
  v_email TEXT;
  v_nombre TEXT;
BEGIN
  -- Buscar suscripciones en estado 'prueba' que expiren en las próximas 48 horas (y no se ha enviado recordatorio)
  FOR v_sub IN 
    SELECT s.id, s.tenant_id, s.fecha_renovacion, t.nombre AS tienda_nombre
    FROM public.suscripciones s
    JOIN public.tiendas t ON t.id = s.tenant_id
    WHERE s.estado = 'prueba' 
      AND s.fecha_renovacion BETWEEN NOW() AND (NOW() + INTERVAL '48 hours')
      AND s.recordatorio_expiracion_enviado = false
  LOOP
    -- Obtener datos del dueño de la tienda
    SELECT p.email, p.nombre_completo INTO v_email, v_nombre
    FROM public.perfiles p
    WHERE p.tienda_id = v_sub.tenant_id AND p.rol = 'dueño'
    LIMIT 1;

    IF v_email IS NOT NULL THEN
      -- Insertar en la cola de correos para que sea enviado por la Edge Function
      INSERT INTO public.cola_correos (to_email, to_name, template_id, params)
      VALUES (
        v_email,
        COALESCE(v_nombre, 'Comerciante'),
        2, -- ID de Plantilla de Recordatorio en Brevo
        jsonb_build_object(
          'nombre', COALESCE(v_nombre, 'Comerciante'),
          'tienda_nombre', v_sub.tienda_nombre,
          'fecha_expiracion', to_char(v_sub.fecha_renovacion, 'DD/MM/YYYY')
        )
      );

      -- Marcar como enviado para no repetir el proceso en la siguiente ejecución del cron
      UPDATE public.suscripciones 
      SET recordatorio_expiracion_enviado = true 
      WHERE id = v_sub.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DO $$
BEGIN
  -- Intentar desprogramar si existe
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Desprogramar si ya existe
    BEGIN
      PERFORM cron.unschedule('send-trial-expiry-reminders');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- Programar el cron
    PERFORM cron.schedule(
      'send-trial-expiry-reminders',
      '0 8 * * *',
      'SELECT public.process_trial_expiry_reminders();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignorar errores de pg_cron si la extensión no está activa localmente o no hay permisos
  RAISE NOTICE 'No se pudo configurar pg_cron (puede que la extensión no esté cargada).';
END $$;
