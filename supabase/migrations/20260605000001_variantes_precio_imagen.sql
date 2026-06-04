-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Precios Absolutos e Imágenes en Variantes de Productos
-- 
-- Contexto: Reemplaza el sistema de precio relativo (precio_base + diferencia)
-- por precios absolutos independientes por variante, y agrega soporte de imagen
-- de referencia individual por variante.
--
-- Comportamiento de campos:
--   - productos.precio: Actúa como el precio de referencia cuando no hay variantes,
--                       o el precio base orientativo (ej: "desde $X") cuando sí las tiene.
--   - producto_variantes.precio: Precio absoluto e independiente de la variante.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. LIMPIAR COLUMNA DE PRECIO RELATIVO (SI EXISTE) ──────────────
DO $$
BEGIN
  -- Verificar modificador_precio
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'producto_variantes' AND column_name = 'modificador_precio'
  ) THEN
    ALTER TABLE public.producto_variantes DROP COLUMN modificador_precio;
  END IF;

  -- Verificar otros posibles nombres heredados
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'producto_variantes' AND column_name = 'precio_diferencia'
  ) THEN
    ALTER TABLE public.producto_variantes DROP COLUMN precio_diferencia;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'producto_variantes' AND column_name = 'precio_extra'
  ) THEN
    ALTER TABLE public.producto_variantes DROP COLUMN precio_extra;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'producto_variantes' AND column_name = 'precio_offset'
  ) THEN
    ALTER TABLE public.producto_variantes DROP COLUMN precio_offset;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'producto_variantes' AND column_name = 'diferencia'
  ) THEN
    ALTER TABLE public.producto_variantes DROP COLUMN diferencia;
  END IF;
END $$;

-- ── 2. AGREGAR COLUMNA DE PRECIO ABSOLUTO (SI NO EXISTE) ──────────
ALTER TABLE public.producto_variantes 
  ADD COLUMN IF NOT EXISTS precio numeric(10,2);

-- ── 3. AGREGAR COLUMNA DE IMAGEN DE REFERENCIA (SI NO EXISTE) ─────
ALTER TABLE public.producto_variantes 
  ADD COLUMN IF NOT EXISTS imagen_url text NULL;

-- ── 4. ASEGURAR CHECK CONSTRAINT DE PRECIO POSITIVO ──────────────
ALTER TABLE public.producto_variantes 
  DROP CONSTRAINT IF EXISTS chk_variante_precio_positivo;

ALTER TABLE public.producto_variantes 
  ADD CONSTRAINT chk_variante_precio_positivo CHECK (precio >= 0);
