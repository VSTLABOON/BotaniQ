// ─── ORDER SERVICE ──────────────────────────────────────────────
// Capa de servicios para el flujo de Guest Checkout y la administración de pedidos.
//
// IMPORTANTE: Esta función `createGuestOrder` NO realiza inserciones múltiples.
// Toda la lógica transaccional (crear pedido + insertar items)
// está encapsulada en la función PL/pgSQL `create_guest_order`
// del lado del servidor. El frontend solo envía UNA llamada RPC.
//
// La función de base de datos garantiza atomicidad: si algo falla,
// se hace rollback automático y ningún dato queda huérfano.
// ────────────────────────────────────────────────────────────────

import { supabase } from '../lib/supabaseClient';
import type { CheckoutState, ShippingData } from '../types';
import { logger } from '../lib/logger';

/**
 * Crea un pedido anónimo (guest checkout) invocando una ÚNICA
 * función RPC en Supabase.
 */
export async function createGuestOrder(
  checkout: CheckoutState,
  shipping: ShippingData,
  tenantId: string
): Promise<{ success: boolean; orderId: string }> {

  // Mapear los items del carrito al formato que espera la función RPC
  const itemsPayload = checkout.items.map((item) => ({
    producto_id: item.productId,
    variante_id: item.variantId,
    nombre: item.name,
    cantidad: item.quantity,
    precio_unitario: item.unitPrice,
  }));

  // ── ÚNICA llamada a la base de datos ──────────────────────────
  // La función PL/pgSQL `create_guest_order` recibe todos los datos
  // y ejecuta las inserciones dentro de una transacción atómica
  const { data, error } = await supabase.rpc('create_guest_order', {
    p_tienda_id: tenantId,
    p_total: checkout.total,
    p_datos_envio: shipping,
    p_items: itemsPayload,
    p_costo_envio: checkout.shippingCost,
  });

  if (error) {
    logger.error('Error al crear pedido en RPC:', error);
    throw new Error('No se pudo procesar tu pedido. Por favor, intenta de nuevo más tarde.');
  }

  return { success: true, orderId: data };
}

/**
 * Obtiene pedidos de una tienda junto con sus items y el primer elemento del producto (para la imagen).
 */
export async function fetchAdminOrders(tiendaId: string, limit: number): Promise<any[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      id,
      tienda_id,
      total,
      estado,
      metodo_pago,
      datos_envio,
      email_cliente,
      cliente_nombre,
      created_at,
      pedido_items (
        id,
        nombre_producto,
        variante_id,
        cantidad,
        precio_unitario,
        productos (
          imagenes
        )
      )
    `)
    .eq('tienda_id', tiendaId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Actualiza el estado de un pedido en la base de datos.
 */
export async function updateOrderStatus(orderId: string, newStatus: string): Promise<void> {
  const { error } = await supabase
    .from('pedidos')
    .update({ estado: newStatus })
    .eq('id', orderId);

  if (error) throw error;
}

/**
 * Registra la liquidación (pago completo) actualizando el estado y la metadata de envío.
 */
export async function liquidateOrder(orderId: string, updatedEnvio: any): Promise<void> {
  const { error } = await supabase
    .from('pedidos')
    .update({
      estado: 'pagado',
      datos_envio: updatedEnvio
    })
    .eq('id', orderId);

  if (error) throw error;
}

/**
 * Registra un pedido manual (Nota Express) insertando el pedido y su item.
 */
export async function createManualOrder(
  tiendaId: string,
  payload: {
    total: number;
    estado: string;
    metodoPago: string;
    datos_envio: any;
    emailCliente: string | null;
    detalleVenta: string;
  }
): Promise<void> {
  const { data: orderRow, error: orderError } = await supabase
    .from('pedidos')
    .insert({
      tienda_id: tiendaId,
      total: payload.total,
      estado: payload.estado,
      metodo_pago: payload.metodoPago,
      datos_envio: payload.datos_envio,
      email_cliente: payload.emailCliente || null,
    })
    .select('id')
    .single();

  if (orderError) throw orderError;
  if (!orderRow?.id) throw new Error('No se pudo obtener el ID del pedido creado');

  const { error: itemError } = await supabase
    .from('pedido_items')
    .insert({
      pedido_id: orderRow.id,
      nombre_producto: payload.detalleVenta,
      cantidad: 1,
      precio_unitario: payload.total,
    });

  if (itemError) {
    // Si falla la inserción de items, intentamos remover el pedido huérfano
    await supabase.from('pedidos').delete().eq('id', orderRow.id);
    throw itemError;
  }
}
