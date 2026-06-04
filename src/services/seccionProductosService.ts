import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';

export interface SeccionProductoAsoc {
  id: string;
  tienda_id: string;
  seccion_key: string;
  producto_id: string;
  orden: number;
  created_at: string;
}

/**
 * Obtiene los productos vinculados a una seccion especifica de una tienda.
 * Si onlyAvailable es true, se retornan únicamente los productos que estén marcados como disponibles.
 */
export async function fetchSeccionProductos(
  tiendaId: string,
  seccionKey: string,
  onlyAvailable = false
): Promise<any[]> {
  try {
    let query = supabase
      .from('seccion_productos')
      .select(`
        id,
        orden,
        producto_id,
        productos (
          id,
          slug,
          nombre,
          descripcion,
          precio,
          disponible,
          imagen_url,
          categoria,
          created_at
        )
      `)
      .eq('tienda_id', tiendaId)
      .eq('seccion_key', seccionKey)
      .order('orden', { ascending: true });

    if (onlyAvailable) {
      query = query.filter('productos.disponible', 'eq', true);
    }

    const { data, error } = await query;

    if (error) {
      logger.error(`Error fetching seccion productos for key ${seccionKey}:`, error);
      throw error;
    }

    // Filtrar nulos si hay productos borrados/desactivados y mapear la respuesta
    return (data || [])
      .filter((item: any) => item.productos !== null)
      .map((item: any) => ({
        id: item.productos.id,
        slug: item.productos.slug ?? item.productos.id,
        nombre: item.productos.nombre,
        descripcion: item.productos.descripcion,
        precio: Number(item.productos.precio) || 0,
        disponible: item.productos.disponible,
        imagen_url: item.productos.imagen_url,
        categoria: item.productos.categoria,
        created_at: item.productos.created_at,
        orden: item.orden,
        seccion_producto_id: item.id
      }));
  } catch (err) {
    logger.error(`Failed to fetch products for seccion ${seccionKey}:`, err as Error);
    throw err;
  }
}

/**
 * Vincula un producto existente a una seccion.
 */
export async function addProductoToSeccion(
  tiendaId: string,
  seccionKey: string,
  productoId: string,
  orden: number
): Promise<SeccionProductoAsoc> {
  try {
    const { data, error } = await supabase
      .from('seccion_productos')
      .upsert({
        tienda_id: tiendaId,
        seccion_key: seccionKey,
        producto_id: productoId,
        orden: orden
      }, {
        onConflict: 'tienda_id,seccion_key,producto_id'
      })
      .select('id, tienda_id, seccion_key, producto_id, orden, created_at')
      .single();

    if (error) {
      logger.error('Error adding product to section:', error);
      throw error;
    }

    return data;
  } catch (err) {
    logger.error(`Failed to add product ${productoId} to seccion ${seccionKey}:`, err as Error);
    throw err;
  }
}

/**
 * Elimina el vinculo de un producto con una seccion.
 */
export async function removeProductoFromSeccion(
  tiendaId: string,
  seccionKey: string,
  productoId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('seccion_productos')
      .delete()
      .eq('tienda_id', tiendaId)
      .eq('seccion_key', seccionKey)
      .eq('producto_id', productoId);

    if (error) {
      logger.error('Error removing product from section:', error);
      throw error;
    }
  } catch (err) {
    logger.error(`Failed to remove product ${productoId} from seccion ${seccionKey}:`, err as Error);
    throw err;
  }
}

/**
 * Reordena los productos de una seccion actualizando el campo orden.
 * Elimina cualquier asociacion que no este en orderedIds.
 */
export async function reorderSeccionProductos(
  tiendaId: string,
  seccionKey: string,
  orderedIds: string[]
): Promise<void> {
  try {
    if (orderedIds.length === 0) {
      const { error } = await supabase
        .from('seccion_productos')
        .delete()
        .eq('tienda_id', tiendaId)
        .eq('seccion_key', seccionKey);
      
      if (error) {
        logger.error('Error clearing products for section:', error);
        throw error;
      }
      return;
    }

    // 1. Eliminar asociaciones que no estan en la lista ordenada
    const { error: deleteError } = await supabase
      .from('seccion_productos')
      .delete()
      .eq('tienda_id', tiendaId)
      .eq('seccion_key', seccionKey)
      .not('producto_id', 'in', `(${orderedIds.join(',')})`);

    if (deleteError) {
      logger.error('Error cleaning up removed products from section:', deleteError);
      throw deleteError;
    }

    // 2. Upsertar con el nuevo orden
    const rows = orderedIds.map((productoId, index) => ({
      tienda_id: tiendaId,
      seccion_key: seccionKey,
      producto_id: productoId,
      orden: index
    }));

    const { error: upsertError } = await supabase
      .from('seccion_productos')
      .upsert(rows, {
        onConflict: 'tienda_id,seccion_key,producto_id'
      });

    if (upsertError) {
      logger.error('Error upserting reordered section products:', upsertError);
      throw upsertError;
    }
  } catch (err) {
    logger.error(`Failed to reorder products for seccion ${seccionKey}:`, err as Error);
    throw err;
  }
}
