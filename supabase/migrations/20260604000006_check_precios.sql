-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: CHECK constraints de precio
-- 
-- Objetivo: Añadir restricciones de validación a nivel de base de datos
-- para garantizar que los precios de productos no puedan ser negativos.
-- Se añade el constraint en public.productos.precio y se verifica
-- dinámicamente si la tabla public.producto_variantes tiene la columna
-- precio para aplicarlo de forma correspondiente.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. CONSTRAINT EN TABLA: productos ──────────────────────────────
ALTER TABLE public.productos 
  DROP CONSTRAINT IF EXISTS chk_precio_positivo;

ALTER TABLE public.productos 
  ADD CONSTRAINT chk_precio_positivo CHECK (precio >= 0);

-- ── 2. CONSTRAINT DINÁMICO EN TABLA: producto_variantes ─────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'producto_variantes' AND column_name = 'precio'
  ) THEN
    ALTER TABLE public.producto_variantes 
      DROP CONSTRAINT IF EXISTS chk_variante_precio_positivo;
      
    ALTER TABLE public.producto_variantes 
      ADD CONSTRAINT chk_variante_precio_positivo CHECK (precio >= 0);
  END IF;
END $$;
