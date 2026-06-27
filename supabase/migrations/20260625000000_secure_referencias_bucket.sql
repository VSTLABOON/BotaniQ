-- ═══════════════════════════════════════════════════════════════════
-- STORAGE: Asegurar bucket 'referencias-clientes' con límites de tamaño y tipo
-- ═══════════════════════════════════════════════════════════════════

UPDATE storage.buckets
SET 
  file_size_limit = 5242880, -- 5MB en bytes (5 * 1024 * 1024)
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
WHERE id = 'referencias-clientes';
