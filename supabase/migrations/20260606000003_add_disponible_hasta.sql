-- Migration: Add disponible_hasta and sku to products
-- File: supabase/migrations/20260606000003_add_disponible_hasta.sql

DO $$
BEGIN
    -- 1. Agregar columna disponible_hasta si no existe
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'productos'
          AND column_name = 'disponible_hasta'
    ) THEN
        ALTER TABLE public.productos ADD COLUMN disponible_hasta timestamptz NULL;
    END IF;

    -- 2. Agregar columna sku si no existe
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'productos'
          AND column_name = 'sku'
    ) THEN
        ALTER TABLE public.productos ADD COLUMN sku text NULL;
    END IF;
END $$;
