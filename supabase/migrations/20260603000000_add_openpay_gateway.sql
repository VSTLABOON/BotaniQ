-- ── MIGRACIÓN: Agregar soporte para pasarela de pago OpenPay a la tabla tiendas y pedidos ──

ALTER TABLE public.tiendas
  ADD COLUMN IF NOT EXISTS openpay_merchant_id TEXT,
  ADD COLUMN IF NOT EXISTS openpay_public_key TEXT,
  ADD COLUMN IF NOT EXISTS openpay_private_key TEXT,
  ADD COLUMN IF NOT EXISTS openpay_sandbox_mode BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS preferred_gateway TEXT DEFAULT 'openpay';

-- Añadir constraint de validación para preferred_gateway si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_tiendas_preferred_gateway'
  ) THEN
    ALTER TABLE public.tiendas
      ADD CONSTRAINT chk_tiendas_preferred_gateway CHECK (preferred_gateway IN ('stripe', 'openpay'));
  END IF;
END $$;

-- Agregar columnas de OpenPay a la tabla de pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS openpay_id TEXT,
  ADD COLUMN IF NOT EXISTS openpay_clabe TEXT,
  ADD COLUMN IF NOT EXISTS openpay_reference TEXT,
  ADD COLUMN IF NOT EXISTS openpay_barcode_url TEXT,
  ADD COLUMN IF NOT EXISTS openpay_pdf_url TEXT;

-- Crear índice para búsqueda rápida e idempotencia del webhook de OpenPay
CREATE INDEX IF NOT EXISTS idx_pedidos_openpay_id ON public.pedidos(openpay_id)
  WHERE openpay_id IS NOT NULL;
