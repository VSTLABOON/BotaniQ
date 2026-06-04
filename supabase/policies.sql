-- ─────────────────────────────────────────────────────────────────
-- REPOSITORIO DE POLÍTICAS RLS (Row Level Security)
-- ─────────────────────────────────────────────────────────────────
-- ADVERTENCIA: Este archivo es referencia histórica únicamente.
-- Las políticas activas y definitivas están definidas en supabase/migrations/.
-- No aplicar este archivo directamente en producción.
-- ─────────────────────────────────────────────────────────────────

-- Habilitar RLS en todas las tablas clave
ALTER TABLE public.tiendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_variantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- ═════════════════════════════════════════════════════════════════
-- 1. TABLA: tiendas
-- ═════════════════════════════════════════════════════════════════
-- Lectura: Público (necesario para el Storefront y resolución DNS)
CREATE POLICY "Tiendas son públicas para lectura" 
ON public.tiendas FOR SELECT TO public USING (true);

-- Inserción: Solo a través de funciones o Superadmin (o self-service si se habilita)
CREATE POLICY "Superadmin puede insertar tiendas" 
ON public.tiendas FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'superadmin'
  )
);

-- ═════════════════════════════════════════════════════════════════
-- 2. TABLA: productos y producto_variantes
-- ═════════════════════════════════════════════════════════════════
-- Lectura: Público (solo productos disponibles, o todos si es el dueño)
CREATE POLICY "Productos disponibles son públicos" 
ON public.productos FOR SELECT TO public 
USING (disponible = true OR auth.uid() IN (
  SELECT owner_id FROM tiendas WHERE id = tienda_id
));

-- Escritura/Modificación: Solo el dueño de la tienda correspondiente
CREATE POLICY "Dueños gestionan sus productos" 
ON public.productos FOR ALL TO authenticated 
USING (
  auth.uid() IN (SELECT owner_id FROM tiendas WHERE id = tienda_id)
) WITH CHECK (
  auth.uid() IN (SELECT owner_id FROM tiendas WHERE id = tienda_id)
);

-- Variantes siguen la misma regla de lectura (solo si el producto está disponible)
CREATE POLICY "Variantes públicas" 
ON public.producto_variantes FOR SELECT TO public 
USING (
  producto_id IN (
    SELECT id FROM public.productos WHERE disponible = true
  )
);

-- Variantes escritura: verificar a través del producto padre
CREATE POLICY "Dueños gestionan variantes" 
ON public.producto_variantes FOR ALL TO authenticated 
USING (
  auth.uid() IN (
    SELECT t.owner_id FROM tiendas t 
    JOIN productos p ON p.tienda_id = t.id 
    WHERE p.id = producto_id
  )
) WITH CHECK (
  auth.uid() IN (
    SELECT t.owner_id FROM tiendas t 
    JOIN productos p ON p.tienda_id = t.id 
    WHERE p.id = producto_id
  )
);

-- ═════════════════════════════════════════════════════════════════
-- 3. TABLA: pedidos y pedido_items
-- ═════════════════════════════════════════════════════════════════
-- Inserción: Público (clientes anónimos pueden crear pedidos)
CREATE POLICY "Cualquiera puede crear pedidos" 
ON public.pedidos FOR INSERT TO public WITH CHECK (true);

-- Lectura/Actualización: Solo el dueño de la tienda o empleados autorizados
CREATE POLICY "Dueños ven los pedidos de su tienda" 
ON public.pedidos FOR SELECT TO authenticated 
USING (
  auth.uid() IN (SELECT owner_id FROM tiendas WHERE id = tienda_id)
);

CREATE POLICY "Dueños actualizan pedidos de su tienda" 
ON public.pedidos FOR UPDATE TO authenticated 
USING (
  auth.uid() IN (SELECT owner_id FROM tiendas WHERE id = tienda_id)
) WITH CHECK (
  auth.uid() IN (SELECT owner_id FROM tiendas WHERE id = tienda_id)
);

-- pedido_items
CREATE POLICY "Cualquiera puede insertar items de pedido" 
ON public.pedido_items FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Dueños ven items de sus pedidos" 
ON public.pedido_items FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM pedidos p
    JOIN tiendas t ON t.id = p.tienda_id
    WHERE p.id = pedido_id AND t.owner_id = auth.uid()
  )
);

-- ═════════════════════════════════════════════════════════════════
-- 4. TABLA: system_logs
-- ═════════════════════════════════════════════════════════════════
-- Inserción: Service Role o Público (anon)
CREATE POLICY "Permitir inserción anónima de logs" 
ON public.system_logs FOR INSERT TO public WITH CHECK (true);

-- Lectura: Solo Superadmin
CREATE POLICY "Superadmin ve todos los logs" 
ON public.system_logs FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'superadmin'
  )
);

-- ═════════════════════════════════════════════════════════════════
-- 5. TABLA: rate_limits
-- ═════════════════════════════════════════════════════════════════
-- Exclusivo para Service Role (Bypass RLS o usar directiva estricta)
CREATE POLICY "Solo Service Role accede a rate_limits" 
ON public.rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);
