// ─── PRODUCT SERVICE ──────────────────────────────────────────────
// Capa de servicios para la administración del catálogo de productos y variantes.
// ────────────────────────────────────────────────────────────────

import { supabase } from '../lib/supabaseClient';
import type { Product } from '../types';

/**
 * Obtiene todos los productos de una tienda con sus variantes de manera estructurada.
 */
export async function fetchAdminProducts(tiendaId: string): Promise<Product[]> {
  const { data: dbProducts, error: prodErr } = await supabase
    .from('productos')
    .select(`
      id,
      tienda_id,
      slug,
      nombre,
      descripcion,
      precio,
      imagen_url,
      disponible,
      sku,
      nota_interna,
      nota_publica,
      disponible_hasta,
      orden,
      categoria,
      producto_variantes (
        id,
        producto_id,
        nombre,
        precio,
        disponible,
        sku,
        imagen_url
      )
    `)
    .eq('tienda_id', tiendaId)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: false });

  if (prodErr) throw prodErr;

  return (dbProducts || []).map(p => ({
    id: p.id,
    tienda_id: p.tienda_id,
    slug: p.slug ?? '',
    name: p.nombre,
    description: p.descripcion || '',
    basePrice: Number(p.precio) || 0,
    images: p.imagen_url ? [p.imagen_url] : [],
    isAvailable: p.disponible ?? true,
    sku: p.sku || '',
    nota_interna: p.nota_interna || '',
    nota_publica: p.nota_publica ?? false,
    disponible_hasta: p.disponible_hasta || '',
    orden: p.orden ?? 0,
    categoria: p.categoria || '',
    variants: (p.producto_variantes || []).map((v: any) => ({
      id: v.id,
      productId: v.producto_id,
      name: v.nombre,
      price: v.precio !== null && v.precio !== undefined ? Number(v.precio) : null,
      isAvailable: v.disponible ?? true,
      sku: v.sku || '',
      image: v.imagen_url || undefined
    }))
  }));
}

/**
 * Actualiza la disponibilidad (disponible = true/false) de un producto.
 */
export async function updateProductAvailability(productId: string, isAvailable: boolean): Promise<void> {
  const { error } = await supabase
    .from('productos')
    .update({ disponible: isAvailable })
    .eq('id', productId);

  if (error) throw error;
}

/**
 * Persiste un producto y maneja las adiciones, actualizaciones y eliminaciones de sus variantes.
 */
export async function saveAdminProduct(
  tiendaId: string,
  product: Product,
  toDeleteVariantIds: string[]
): Promise<void> {
  const productRow = {
    id: product.id,
    tienda_id: tiendaId,
    nombre: product.name,
    slug: product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
    descripcion: product.description,
    precio: product.basePrice,
    imagen_url: product.images[0] || null,
    disponible: product.isAvailable,
    sku: product.sku || null,
    nota_interna: product.nota_interna || null,
    nota_publica: product.nota_publica ?? false,
    disponible_hasta: product.disponible_hasta || null,
    orden: product.orden ?? 0,
    categoria: product.categoria || null
  };

  const { error: prodError } = await supabase
    .from('productos')
    .upsert(productRow);

  if (prodError) throw prodError;

  // Eliminar variantes solicitadas
  if (toDeleteVariantIds.length > 0) {
    const { error: delErr } = await supabase
      .from('producto_variantes')
      .delete()
      .in('id', toDeleteVariantIds);
    if (delErr) throw delErr;
  }

  // Upsert variantes activas
  if (product.variants.length > 0) {
    const variantsRows = product.variants.map(v => ({
      id: v.id,
      producto_id: product.id,
      nombre: v.name,
      precio: v.price,
      disponible: v.isAvailable,
      sku: v.sku || null,
      imagen_url: v.image || null
    }));

    const { error: varError } = await supabase
      .from('producto_variantes')
      .upsert(variantsRows);
    if (varError) throw varError;
  }
}

/**
 * Elimina un producto y todas sus variantes de forma atómica.
 */
export async function deleteAdminProduct(productId: string): Promise<void> {
  // Eliminar variantes primero
  const { error: varErr } = await supabase
    .from('producto_variantes')
    .delete()
    .eq('producto_id', productId);
    
  if (varErr) throw varErr;

  // Eliminar producto
  const { error: prodErr } = await supabase
    .from('productos')
    .delete()
    .eq('id', productId);
    
  if (prodErr) throw prodErr;
}

/**
 * Reordena los productos en batch actualizando el campo `orden`.
 */
export async function reorderProductos(tiendaId: string, orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((id, index) => ({
    id,
    tienda_id: tiendaId,
    orden: index
  }));

  const { error } = await supabase
    .from('productos')
    .upsert(updates, { onConflict: 'id' });

  if (error) throw error;
}
