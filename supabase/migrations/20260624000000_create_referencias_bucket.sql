-- ═══════════════════════════════════════════════════════════════════
-- STORAGE: Bucket para fotos de referencia de pedidos a medida
-- 
-- Crea el bucket 'referencias-clientes' de forma pública para descarga/lectura
-- por URL, pero restringe la inserción a cualquier usuario (público)
-- y limita la visualización en listados y eliminación solo al staff de la tienda.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Crear el bucket público (acceso público a objetos por URL directa)
INSERT INTO storage.buckets (id, name, public)
VALUES ('referencias-clientes', 'referencias-clientes', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Limpiar políticas existentes si acaso
DROP POLICY IF EXISTS "Permitir insercion publica de referencias" ON storage.objects;
DROP POLICY IF EXISTS "Staff lee referencias-clientes" ON storage.objects;
DROP POLICY IF EXISTS "Staff borra referencias-clientes" ON storage.objects;

-- 3. Permitir que cualquier persona (incluidos clientes anónimos) suba imágenes de referencia
CREATE POLICY "Permitir insercion publica de referencias"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'referencias-clientes'
);

-- 4. Permitir que solo el staff de la tienda correspondiente (dueño, empleado, superadmin) pueda ver metadatos (SELECT)
CREATE POLICY "Staff lee referencias-clientes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'referencias-clientes'
  AND (storage.foldername(name))[1] = (
    SELECT tienda_id::text FROM public.perfiles
    WHERE id = auth.uid()
    AND rol IN ('dueño', 'empleado', 'superadmin')
  )
);

-- 5. Permitir que solo el staff de la tienda pueda borrar archivos
CREATE POLICY "Staff borra referencias-clientes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'referencias-clientes'
  AND (storage.foldername(name))[1] = (
    SELECT tienda_id::text FROM public.perfiles
    WHERE id = auth.uid()
    AND rol IN ('dueño', 'empleado', 'superadmin')
  )
);
