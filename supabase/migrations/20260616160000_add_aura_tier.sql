-- ── MIGRACIÓN: Introducción del Plan Aura (Nivel 2) y Desplazamiento de Niveles ──
-- 1a. Actualizar constraint de subscription_level en tiendas para permitir nivel 4 (Edén)
ALTER TABLE public.tiendas
  DROP CONSTRAINT IF EXISTS tiendas_subscription_level_check;

ALTER TABLE public.tiendas
  ADD CONSTRAINT tiendas_subscription_level_check
  CHECK (subscription_level BETWEEN 0 AND 4);

-- 1b. Desplazar tiendas existentes en orden descendente para evitar conflictos de nivel
-- Mover nivel 3 (Edén) -> 4
UPDATE public.tiendas SET subscription_level = 4 WHERE subscription_level = 3;

-- Mover nivel 2 (Alquimia) -> 3
UPDATE public.tiendas SET subscription_level = 3 WHERE subscription_level = 2;

-- 1c. Actualizar constraint en tabla suscripciones si tiene check de plan
ALTER TABLE public.suscripciones
  DROP CONSTRAINT IF EXISTS suscripciones_plan_check;

ALTER TABLE public.suscripciones
  ADD CONSTRAINT suscripciones_plan_check
  CHECK (plan IN ('basico', 'aura', 'pro', 'premium', 'enterprise'));
