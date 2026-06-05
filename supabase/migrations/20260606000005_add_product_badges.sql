-- Migration: Add product badge fields (por_encargo and ultimas_unidades)
-- Date: 2026-06-06
-- Description: Adds por_encargo and ultimas_unidades boolean columns to the productos table.

ALTER TABLE productos 
  ADD COLUMN IF NOT EXISTS por_encargo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ultimas_unidades boolean NOT NULL DEFAULT false;
