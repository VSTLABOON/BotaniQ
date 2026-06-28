-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Validar que el path de referencias-clientes corresponda a una tienda real
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Permitir insercion publica de referencias" ON storage.objects;

CREATE POLICY "Permitir insercion publica de referencias"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'referencias-clientes'
    AND EXISTS (
      SELECT 1 FROM public.tiendas
      WHERE id::text = (storage.foldername(name))[1]
    )
  );
