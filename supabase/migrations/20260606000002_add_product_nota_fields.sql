-- Migration: Add internal and public note fields to products
-- File: supabase/migrations/20260606000002_add_product_nota_fields.sql

DO $$
BEGIN
    -- 1. Agregar columna nota_interna si no existe
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'productos'
          AND column_name = 'nota_interna'
    ) THEN
        ALTER TABLE public.productos ADD COLUMN nota_interna text NULL;
    END IF;

    -- 2. Agregar columna nota_publica si no existe
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'productos'
          AND column_name = 'nota_publica'
    ) THEN
        ALTER TABLE public.productos ADD COLUMN nota_publica boolean NOT NULL DEFAULT false;
    END IF;
END $$;
