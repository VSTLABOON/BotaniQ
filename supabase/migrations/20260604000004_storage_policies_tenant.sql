-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Blindaje de políticas de Storage por Tenant (Multi-tenant) - CORREGIDO
-- 
-- Objetivo: Restringir que el staff de una tienda solo pueda subir,
-- actualizar o eliminar archivos (imágenes de productos y logotipos)
-- dentro del directorio correspondiente a su propia tienda (tenant_id).
-- Se utiliza la función de ayuda `storage.foldername(name)` para 
-- obtener el primer segmento de la ruta del archivo y contrastarlo
-- con el tienda_id del perfil del usuario autenticado.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. LIMPIAR POLÍTICAS DE STORAGE EXISTENTES ─────────────────────
DROP POLICY IF EXISTS "Staff sube imagenes de productos" ON storage.objects;
DROP POLICY IF EXISTS "Staff borra imagenes de productos" ON storage.objects;
DROP POLICY IF EXISTS "Staff actualiza imagenes de productos" ON storage.objects;

DROP POLICY IF EXISTS "Staff sube logos" ON storage.objects;
DROP POLICY IF EXISTS "Staff borra logos" ON storage.objects;
DROP POLICY IF EXISTS "Staff actualiza logos" ON storage.objects;

-- ── 2. POLÍTICAS PARA EL BUCKET: productos ─────────────────────────

CREATE POLICY "Staff sube imagenes de productos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'productos'
  AND (storage.foldername(name))[1] = (
    SELECT tienda_id::text FROM public.perfiles
    WHERE id = auth.uid()
    AND rol IN ('dueño', 'empleado', 'superadmin')
  )
);

CREATE POLICY "Staff borra imagenes de productos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'productos'
  AND (storage.foldername(name))[1] = (
    SELECT tienda_id::text FROM public.perfiles
    WHERE id = auth.uid()
    AND rol IN ('dueño', 'empleado', 'superadmin')
  )
);

CREATE POLICY "Staff actualiza imagenes de productos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'productos'
  AND (storage.foldername(name))[1] = (
    SELECT tienda_id::text FROM public.perfiles
    WHERE id = auth.uid()
    AND rol IN ('dueño', 'empleado', 'superadmin')
  )
)
WITH CHECK (
  bucket_id = 'productos'
  AND (storage.foldername(name))[1] = (
    SELECT tienda_id::text FROM public.perfiles
    WHERE id = auth.uid()
    AND rol IN ('dueño', 'empleado', 'superadmin')
  )
);

-- ── 3. POLÍTICAS PARA EL BUCKET: logos ─────────────────────────────

CREATE POLICY "Staff sube logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (
    SELECT tienda_id::text FROM public.perfiles
    WHERE id = auth.uid()
    AND rol IN ('dueño', 'empleado', 'superadmin')
  )
);

CREATE POLICY "Staff borra logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (
    SELECT tienda_id::text FROM public.perfiles
    WHERE id = auth.uid()
    AND rol IN ('dueño', 'empleado', 'superadmin')
  )
);

CREATE POLICY "Staff actualiza logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (
    SELECT tienda_id::text FROM public.perfiles
    WHERE id = auth.uid()
    AND rol IN ('dueño', 'empleado', 'superadmin')
  )
)
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (
    SELECT tienda_id::text FROM public.perfiles
    WHERE id = auth.uid()
    AND rol IN ('dueño', 'empleado', 'superadmin')
  )
);
