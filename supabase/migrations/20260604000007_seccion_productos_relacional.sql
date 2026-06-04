-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Estructura relacional para secciones de productos
-- 
-- Objetivo: Crear la tabla intermedia seccion_productos que permite 
-- asociar de forma relacional y tipada los productos reales del catálogo
-- con agrupaciones o secciones dinámicas del storefront (como "servicios"),
-- eliminando la redundancia y pérdida de integridad de los arrays JSONB.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. CREAR TABLA INTERMEDIA ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seccion_productos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tienda_id    uuid NOT NULL REFERENCES public.tiendas(id) ON DELETE CASCADE,
  seccion_key  text NOT NULL,
  producto_id  uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  orden        integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tienda_id, seccion_key, producto_id)
);

-- ── 2. HABILITAR ROW LEVEL SECURITY ───────────────────────────────
ALTER TABLE public.seccion_productos ENABLE ROW LEVEL SECURITY;

-- ── 3. LIMPIAR POLÍTICAS EXISTENTES ────────────────────────────────
DROP POLICY IF EXISTS "Lectura pública seccion_productos" ON public.seccion_productos;
DROP POLICY IF EXISTS "Staff gestiona seccion_productos" ON public.seccion_productos;

-- ── 4. POLÍTICAS DE ACCESO ─────────────────────────────────────────

-- Lectura (SELECT): Disponible públicamente si la tienda está activa
CREATE POLICY "Lectura pública seccion_productos" ON public.seccion_productos
  FOR SELECT TO anon, authenticated
  USING (
    tienda_id IN (
      SELECT id FROM public.tiendas WHERE subscription_level >= 0
    )
  );

-- Escritura (ALL): Solo el personal administrativo que pertenece a la tienda
CREATE POLICY "Staff gestiona seccion_productos" ON public.seccion_productos
  FOR ALL TO authenticated
  USING (
    tienda_id IN (
      SELECT tienda_id FROM public.perfiles
      WHERE id = auth.uid() AND rol IN ('dueño', 'empleado', 'superadmin')
    )
  )
  WITH CHECK (
    tienda_id IN (
      SELECT tienda_id FROM public.perfiles
      WHERE id = auth.uid() AND rol IN ('dueño', 'empleado', 'superadmin')
    )
  );

-- ── 5. CREACIÓN DE ÍNDICES ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_seccion_productos_tienda 
  ON public.seccion_productos(tienda_id);

CREATE INDEX IF NOT EXISTS idx_seccion_productos_seccion 
  ON public.seccion_productos(tienda_id, seccion_key);
