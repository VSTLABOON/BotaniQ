ALTER TABLE public.producto_variantes
  ADD COLUMN IF NOT EXISTS descripcion text NULL;
