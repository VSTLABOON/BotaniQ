CREATE POLICY "Productos visibles públicamente"
  ON public.productos
  FOR SELECT TO anon, authenticated
  USING (
    disponible = true
    AND (disponible_hasta IS NULL OR disponible_hasta > NOW())
  );
