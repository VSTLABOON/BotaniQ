-- Migration: Remove stock and add disponible column to product variants
-- File: supabase/migrations/20260606000001_remove_stock_add_disponible_variante.sql

DO $$
BEGIN
    -- 1. Eliminar columna stock si existe
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'producto_variantes'
          AND column_name = 'stock'
    ) THEN
        ALTER TABLE public.producto_variantes DROP COLUMN stock;
    END IF;

    -- 2. Agregar columna disponible si no existe
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'producto_variantes'
          AND column_name = 'disponible'
    ) THEN
        ALTER TABLE public.producto_variantes ADD COLUMN disponible boolean NOT NULL DEFAULT true;
    END IF;
END $$;
