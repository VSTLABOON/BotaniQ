-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Habilitar RLS para Catálogo (productos y variantes)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_variantes ENABLE ROW LEVEL SECURITY;
