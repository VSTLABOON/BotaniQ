// ─── usePublicCatalog.js ────────────────────────────────────────
// Custom Hook para el catálogo público de una tienda Multi-tenant.
//
// Flujo:
// 1. Recibe el `slug` de la tienda (ej. 'flores-del-corazon')
// 2. Consulta la tabla `tiendas` para resolver slug → tienda_id
// 3. Consulta la tabla `productos` filtrando por ese tienda_id
// 4. Opcionalmente filtra por categoría
// 5. Si Supabase falla, hace fallback a datos locales (floreria.js)
//
// Ambas consultas operan con el rol `anon` de Supabase, protegidas
// por las políticas RLS que solo exponen productos con disponible=true.
// ────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';


/**
 * Transforma una fila de la tabla `productos` de Supabase
 * al formato que esperan los componentes React existentes
 * (ProductoCard, Modal, CartContext).
 *
 * Ajusta los nombres de campo según TU esquema real en Supabase.
 * Si tus columnas se llaman diferente, modifica SOLO esta función.
 */
function mapRow(row) {
  return {
    id:         row.id,
    slug:       row.slug ?? row.id,
    name:       row.nombre ?? row.name,
    short:      row.descripcion ?? '',
    precio:     row.precio ?? '',
    precioNum:  parseFloat(row.precio ?? 0),
    disponible: row.disponible ?? true,
    badge:      null,
    badgeClass: '',
    imgUrl:     row.imagen_url ?? '',
    desc:       row.descripcion ?? '',
    waMsg:      '',
    category:   row.categoria ?? 'general',
    disponibleHasta: row.disponible_hasta,
    notaInterna: row.nota_interna ?? '',
    notaPublica: row.nota_publica ?? false,
    porEncargo: row.por_encargo ?? false,
    ultimasUnidades: row.ultimas_unidades ?? false,
    variants:   (row.producto_variantes || []).map(v => ({
      id: v.id,
      name: v.nombre,
      price: v.precio !== null && v.price !== undefined ? parseFloat(v.precio) : null,
      isAvailable: v.disponible ?? true,
      sku: v.sku ?? '',
      image: v.imagen_url
    }))
  };
}

/**
 * Hook público para consumir el catálogo de una tienda.
 *
 * @param {string} slug - Slug de la tienda (ej. 'flores-del-corazon')
 * @param {Object} [options]
 * @param {string} [options.category] - Filtrar por categoría (ej. 'rosas')
 *
 * @returns {{
 *   productos: Array,
 *   tienda: Object|null,
 *   loading: boolean,
 *   error: string|null,
 *   source: 'supabase'|'local',
 *   refetch: Function
 * }}
 */
export function usePublicCatalog(slug, options = {}) {
  const { category } = options;

  const [productos, setProductos] = useState([]);
  const [tienda, setTienda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState('local');

  const fetchCatalog = useCallback(async (abortSignal) => {
    setLoading(true);
    setError(null);

    try {
      // ── Paso 1: Resolver slug → tienda ────────────────────
      let queryTienda = supabase
        .from('tiendas')
        .select('id, slug, nombre, logo_url, color_primario, color_secundario, color_acento, ciudad, estado, area_metropolitana, mapa_url, direccion, whatsapp, wa_base, horarios, redes_sociales, nav_links, campana, anio_fundacion, texto_nosotros, firma, envio_costo, colonias, subscription_level, custom_domain, currency, created_at, meta_title, config_ui')
        .eq('slug', slug);

      if (abortSignal) {
        queryTienda = queryTienda.abortSignal(abortSignal);
      }

      const { data: tiendaData, error: tiendaError } = await queryTienda.single();

      if (tiendaError) {
        logger.error('Error querying tiendas table in usePublicCatalog:', tiendaError);
        throw new Error(
          `Tienda con slug "${slug}" no encontrada: ${tiendaError.message}`
        );
      }

      if (abortSignal?.aborted) return;
      setTienda(tiendaData);

      // ── Paso 2: Fetch productos de esa tienda ─────────────
      // RLS ya filtra `disponible = true` a nivel de base de datos,
      // pero aplicamos el filtro aquí también como defensa en profundidad.
      let queryProd = supabase
        .from('productos')
        .select(`
          id, slug, nombre, descripcion, precio, disponible, imagen_url, categoria, disponible_hasta, nota_interna, nota_publica, orden, created_at, por_encargo, ultimas_unidades,
          producto_variantes (
            id,
            nombre,
            precio,
            disponible,
            sku,
            imagen_url
          )
        `)
        .eq('tienda_id', tiendaData.id)
        .eq('disponible', true);

      // Filtrar productos donde disponible_hasta sea nulo o mayor a ahora
      queryProd = queryProd.or(`disponible_hasta.is.null,disponible_hasta.gt.${new Date().toISOString()}`);

      // Ordenar por orden personalizado y fecha de creación
      queryProd = queryProd
        .order('orden', { ascending: true })
        .order('created_at', { ascending: false });

      // Filtro opcional por categoría
      if (category) {
        queryProd = queryProd.eq('categoria', category);
      }

      if (abortSignal) {
        queryProd = queryProd.abortSignal(abortSignal);
      }

      const { data: productosData, error: productosError } = await queryProd;

      if (productosError) {
        logger.error('Error querying productos table in usePublicCatalog:', productosError);
        throw new Error(
          `Error al cargar productos: ${productosError.message}`
        );
      }

      if (abortSignal?.aborted) return;

      if (productosData && productosData.length > 0) {
        setProductos(productosData.map(mapRow));
        setSource('supabase');
      } else {
        // Tabla vacía para esta tienda — usar fallback
        logger.warn(
          `⚠️ [usePublicCatalog] Sin productos en Supabase para "${slug}". Usando datos locales.`
        );
        setProductos([]);
        setSource('local');
      }
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || abortSignal?.aborted)) {
        return;
      }
      logger.warn(
        `⚠️ [usePublicCatalog] Fallback a array vacío. Razón: ${err instanceof Error ? err.message : String(err)}`
      );
      setProductos([]);
      setSource('local');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!abortSignal?.aborted) {
        setLoading(false);
      }
    }
  }, [slug, category]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCatalog(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchCatalog]);

  return { productos, tienda, loading, error, source, refetch: fetchCatalog };
}
