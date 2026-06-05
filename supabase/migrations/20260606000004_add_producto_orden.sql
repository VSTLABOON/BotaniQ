-- Migration: Add orden column and index to products
-- File: supabase/migrations/20260606000004_add_producto_orden.sql

DO $$
BEGIN
    -- 1. Agregar columna orden si no existe
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'productos'
          AND column_name = 'orden'
    ) THEN
        ALTER TABLE public.productos ADD COLUMN orden integer NOT NULL DEFAULT 0;
    END IF;
END $$;

-- 2. Crear índice si no existe
CREATE INDEX IF NOT EXISTS idx_productos_tienda_orden 
ON public.productos(tienda_id, orden);
