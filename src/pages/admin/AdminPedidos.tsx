// ─── ADMIN PEDIDOS — GESTOR DE PEDIDOS ──────────────────────────
// Panel de gestión de pedidos con tabla completa, filtros por estado
// y panel lateral de detalle que muestra datos_envio + pedido_items.
//
// SAAS_FLAG: NIVEL 1 - Esta página requiere Nivel 1+.
//
// Dependencias:
//   lucide-react — Iconografía
//   types.ts     — ShippingData
// ────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTenant } from '../../context/TenantContext';
import { logger } from '../../lib/logger';
import {
  Package, Search, ChevronRight, X,
  MapPin, Heart, Clock, User, Phone,
  Calendar, CreditCard, MessageSquare, ShoppingBag,
  Plus, CheckCircle, Loader2, Save, RefreshCw
} from 'lucide-react';
import { toast } from '../../store/toastStore';
import { supabase } from '../../lib/supabaseClient';

import { CARD } from './components/config/SharedUI';
import { ManualOrderModal } from './components/ManualOrderModal';
import {
  fetchAdminOrders,
  updateOrderStatus,
  liquidateOrder,
  createManualOrder
} from '../../services/orderService';

// ── Tipos locales ────────────────────────────────────────────────

type OrderStatus = 'pendiente' | 'pagado' | 'preparando' | 'en_ruta' | 'entregado' | 'cancelado' | 'pendiente_pago';

interface OrderItem {
  id: string;
  nombre: string;
  variante: string;
  cantidad: number;
  precio_unitario: number;
  imagen: string;
}

interface ShippingInfo {
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  deliveryDate: string;
  customMessage: string;
  tipo_pago?: 'pendiente' | 'anticipo' | 'pagado';
  monto_anticipo?: number;
  monto_pendiente?: number;
  metodo_pago_manual?: string;
}

interface Order {
  id: string;
  numero: string;           // Número visible (ej. #FDC-0042)
  fecha: string;             // ISO 8601
  cliente_nombre: string;
  cliente_email: string;
  total: number;
  estado: OrderStatus;
  datos_envio: ShippingInfo;
  items: OrderItem[];
}

// ── Configuración visual de estados ──────────────────────────────

const STATUS_CONFIG: Record<OrderStatus, { label: string; dot: string; bg: string; text: string }> = {
  pendiente:  { label: 'Pendiente',      dot: 'bg-amber-500',   bg: 'bg-amber-50 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-400' },
  pagado:     { label: 'Pagado',         dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  preparando: { label: 'En Preparación', dot: 'bg-blue-500',    bg: 'bg-blue-50 dark:bg-blue-900/30',    text: 'text-blue-700 dark:text-blue-400' },
  en_ruta:    { label: 'En Ruta',        dot: 'bg-violet-500',  bg: 'bg-violet-50 dark:bg-violet-900/30',  text: 'text-violet-700 dark:text-violet-400' },
  entregado:  { label: 'Entregado',      dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  cancelado:  { label: 'Cancelado',      dot: 'bg-red-500',     bg: 'bg-red-50 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-400' },
  pendiente_pago: { label: 'Carrito Abandonado', dot: 'bg-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
};

const ALL_STATUSES: OrderStatus[] = ['pendiente_pago', 'pendiente', 'pagado', 'preparando', 'en_ruta', 'entregado', 'cancelado'];

// ── Formateo de fecha ────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit',
  });
}

// ═══════════════════════════════════════════════════════════════════
// ██ PANEL LATERAL — DETALLE DE PEDIDO
// ═══════════════════════════════════════════════════════════════════

function OrderDetailPanel({
  order, onClose, onStatusChange, onLiquidate,
}: {
  order: Order;
  onClose: () => void;
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void;
  onLiquidate?: (orderId: string) => Promise<void>;
}) {
  const status = STATUS_CONFIG[order.estado];

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[9998] lg:hidden" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 z-[9999] h-full w-full max-w-md bg-[var(--color-background-primary)]/90 backdrop-blur-2xl border-l border-[var(--color-border-secondary)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-tertiary)] shrink-0">
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{order.numero}</h3>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{formatDate(order.fecha)} · {formatTime(order.fecha)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── Estado + Selector ── */}
          <div>
            <label className="block text-[0.7rem] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">Estado del pedido</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.filter(s => s !== 'cancelado').map(s => {
                const conf = STATUS_CONFIG[s];
                return (
                  <button key={s} onClick={() => onStatusChange(order.id, s)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[36px]
                      ${order.estado === s ? `${conf.bg} ${conf.text} ring-1 ring-current/20` : 'bg-[var(--color-background-secondary)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-background-tertiary)] hover:text-[var(--color-text-secondary)]'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${order.estado === s ? conf.dot : 'bg-[var(--color-border-primary)]'}`} />
                    {conf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Desglose de Anticipo / Pago Parcial ── */}
          {order.datos_envio.tipo_pago === 'anticipo' && (
            <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/40 dark:border-amber-800/30 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <CreditCard className="w-5 h-5" />
                <h4 className="font-semibold text-sm">Control de Anticipo</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[0.65rem] text-[var(--color-text-tertiary)] uppercase tracking-wider block">Abonado</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    ${order.datos_envio.monto_anticipo?.toLocaleString()} MXN
                  </span>
                </div>
                <div>
                  <span className="text-[0.65rem] text-[var(--color-text-tertiary)] uppercase tracking-wider block">Saldo Pendiente</span>
                  <span className="text-sm font-bold text-rose-500">
                    ${order.datos_envio.monto_pendiente?.toLocaleString()} MXN
                  </span>
                </div>
              </div>
              {order.estado !== 'cancelado' && order.estado !== 'entregado' && onLiquidate && (
                <button
                  onClick={() => onLiquidate(order.id)}
                  className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm active:scale-[0.98]"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Registrar Liquidación (Pago Completo)
                </button>
              )}
            </div>
          )}

          {/* ── Recuperación Carrito Abandonado ── */}
          {order.estado === 'pendiente_pago' && order.datos_envio.recipientPhone && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h4 className="font-semibold text-emerald-800 dark:text-emerald-300">Recuperar Carrito</h4>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400/80">
                El cliente inició el checkout pero no completó el pago en Stripe. Puedes enviarle un mensaje para ayudarle a cerrar la compra.
              </p>
              <a
                href={`https://wa.me/${order.datos_envio.recipientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${order.cliente_nombre}, vimos que dejaste unos hermosos arreglos en tu carrito. ¿Tuviste algún problema con el pago? ¡Estamos aquí para ayudarte!`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[#25D366] hover:bg-[#1EBA57] text-white text-sm font-bold transition-all shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                Recuperar por WhatsApp
              </a>
            </div>
          )}

          {/* ── Cliente ── */}
          <div className="bg-[var(--color-background-secondary)] rounded-xl p-4 space-y-2">
            <h4 className="text-[0.7rem] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Cliente</h4>
            <div className="flex items-center gap-2 text-sm">
              <User className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] shrink-0" />
              <span className="font-medium text-[var(--color-text-primary)]">{order.cliente_nombre}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
              <MessageSquare className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] shrink-0" />
              {order.cliente_email}
            </div>
          </div>

          {/* ── Datos de Envío (datos_envio JSON) ── */}
          <div className="bg-[var(--color-background-secondary)] rounded-xl p-4 space-y-3">
            <h4 className="text-[0.7rem] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Datos de Envío</h4>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2 text-sm">
                <User className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[0.65rem] text-[var(--color-text-tertiary)] uppercase tracking-wider block">Destinatario</span>
                  <span className="font-medium text-[var(--color-text-primary)]">{order.datos_envio.recipientName}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <Phone className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[0.65rem] text-[var(--color-text-tertiary)] uppercase tracking-wider block">Teléfono</span>
                  <span className="text-[var(--color-text-secondary)]">{order.datos_envio.recipientPhone}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[0.65rem] text-[var(--color-text-tertiary)] uppercase tracking-wider block">Dirección</span>
                  <span className="text-[var(--color-text-secondary)]">{order.datos_envio.deliveryAddress}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <Calendar className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[0.65rem] text-[var(--color-text-tertiary)] uppercase tracking-wider block">Fecha de entrega</span>
                  <span className="text-[var(--color-text-secondary)]">{order.datos_envio.deliveryDate}</span>
                </div>
              </div>
            </div>

            {/* Dedicatoria */}
            {order.datos_envio.customMessage && (
              <div className="mt-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/40 rounded-lg px-4 py-3 flex items-start gap-2.5">
                <Heart className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" strokeWidth={2.5} />
                <div>
                  <span className="text-[0.65rem] text-rose-400 uppercase tracking-wider font-semibold block mb-0.5">Dedicatoria</span>
                  <p className="text-sm text-rose-700 dark:text-rose-300 italic leading-relaxed">
                    "{order.datos_envio.customMessage}"
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Artículos del Pedido (pedido_items) ── */}
          <div>
            <h4 className="text-[0.7rem] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
              Artículos ({order.items.length})
            </h4>
            <div className="space-y-3">
              {order.items.map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-[var(--color-background-secondary)] rounded-xl p-3">
                  <div className="w-12 h-12 rounded-lg bg-[var(--color-background-tertiary)] overflow-hidden shrink-0">
                    <img src={item.imagen} alt={item.nombre} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{item.nombre}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">{item.variante} × {item.cantidad}</p>
                  </div>
                  <span className="text-sm font-bold text-[var(--color-text-primary)] shrink-0">
                    ${(item.precio_unitario * item.cantidad).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer — Total */}
        <div className="px-6 py-4 border-t border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] shrink-0 space-y-2">
          {order.datos_envio.tipo_pago === 'anticipo' ? (
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between text-[var(--color-text-tertiary)]">
                <span>Total del Pedido:</span>
                <span>${order.total.toLocaleString()} MXN</span>
              </div>
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                <span>Abono Recibido:</span>
                <span>-${order.datos_envio.monto_anticipo?.toLocaleString()} MXN</span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold text-rose-500 pt-1 border-t border-[var(--color-border-tertiary)]">
                <span>Saldo por Liquidar:</span>
                <span>${order.datos_envio.monto_pendiente?.toLocaleString()} MXN</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--color-text-tertiary)]">Total del pedido</span>
              <span className="text-xl font-bold text-[var(--color-text-primary)]">${order.total.toLocaleString()} <span className="text-xs font-normal text-[var(--color-text-tertiary)]">MXN</span></span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ██ COMPONENTE PRINCIPAL — ADMIN PEDIDOS
// ═══════════════════════════════════════════════════════════════════

export default function AdminPedidos() {
  const { tenant } = useTenant();
  const [orders, setOrders]           = useState<Order[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'todos'>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [showManualModal, setShowManualModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Estados de Realtime (Módulo 2)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [retryCount, setRetryCount] = useState(0);
  const [subscriptionTrigger, setSubscriptionTrigger] = useState(0);

  // Estados de paginación
  const [loadedLimit, setLoadedLimit] = useState(20);
  const [hasMore, setHasMore] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);

  // Resetear el límite al cambiar de tienda
  useEffect(() => {
    setLoadedLimit(20);
  }, [tenant?.id]);

  useEffect(() => {
    let active = true;

    async function fetchOrders() {
      if (!tenant?.id) return;
      
      if (orders.length === 0) {
        setLoading(true);
      } else {
        setFetchingMore(true);
      }

      try {
        const data = await fetchAdminOrders(tenant.id, loadedLimit);

        if (!active) return;

        if (data) {
          const mappedOrders: Order[] = data.map((row) => {
            const rawEnvio = row.datos_envio || {};
            const datos_envio: ShippingInfo = {
              recipientName: rawEnvio.recipientName || row.cliente_nombre || 'Sin nombre',
              recipientPhone: rawEnvio.recipientPhone || 'Sin teléfono',
              deliveryAddress: rawEnvio.deliveryAddress || 'Recoger en tienda',
              deliveryDate: rawEnvio.deliveryDate || new Date(row.created_at).toLocaleDateString(),
              customMessage: rawEnvio.customMessage || '',
              tipo_pago: rawEnvio.tipo_pago,
              monto_anticipo: rawEnvio.monto_anticipo,
              monto_pendiente: rawEnvio.monto_pendiente,
              metodo_pago_manual: rawEnvio.metodo_pago_manual,
            };

            const items: OrderItem[] = (row.pedido_items || []).map((item: any) => {
              const productImages = item.productos?.imagenes || [];
              const imageUrl = productImages.length > 0 ? productImages[0] : 'https://placehold.co/150x150/f3f4f6/9ca3af?text=Sin+Imagen';
              
              return {
                id: item.id,
                nombre: item.nombre_producto,
                variante: item.variante_id ? 'Variante específica' : 'Estándar',
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario,
                imagen: imageUrl,
              };
            });

            return {
              id: row.id,
              numero: `#${row.id.slice(0, 8).toUpperCase()}`,
              fecha: row.created_at,
              cliente_nombre: row.cliente_nombre || rawEnvio.recipientName || 'Cliente anónimo',
              cliente_email: row.email_cliente || 'Sin email',
              total: row.total,
              estado: row.estado as OrderStatus,
              datos_envio,
              items,
            };
          });
          setOrders(mappedOrders);
          setHasMore(data.length === loadedLimit);
        }
      } catch (err) {
        if (!active) return;
        logger.error('Error fetching orders:', err as Error);
      } finally {
        if (active) {
          setLoading(false);
          setFetchingMore(false);
        }
      }
    }

    fetchOrders();

    return () => {
      active = false;
    };
  }, [tenant?.id, refreshTrigger, loadedLimit]);

  // ── Suscripción a Supabase Realtime (Módulo 2) ──────────────────
  useEffect(() => {
    if (!tenant?.id) return;

    let active = true;
    let retryTimeoutId: any = null;
    let currentChannel: any = null;

    const subscribeWithRetry = (attempt: number) => {
      if (!active) return;
      setConnectionStatus('connecting');

      const channel = supabase
        .channel(`pedidos-realtime-${tenant.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pedidos',
            filter: `tienda_id=eq.${tenant.id}`,
          },
          async (payload) => {
            if (!active) return;

            if (payload.eventType === 'INSERT') {
              const newOrderRaw = payload.new;
              try {
                // Pequeña espera para evitar condición de carrera con pedido_items
                await new Promise((resolve) => setTimeout(resolve, 200));

                const { data: row, error } = await supabase
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
                  .eq('id', newOrderRaw.id)
                  .single();

                if (error) throw error;

                if (row && active) {
                  const rawEnvio = row.datos_envio || {};
                  const datos_envio: ShippingInfo = {
                    recipientName: rawEnvio.recipientName || row.cliente_nombre || 'Sin nombre',
                    recipientPhone: rawEnvio.recipientPhone || 'Sin teléfono',
                    deliveryAddress: rawEnvio.deliveryAddress || 'Recoger en tienda',
                    deliveryDate: rawEnvio.deliveryDate || new Date(row.created_at).toLocaleDateString(),
                    customMessage: rawEnvio.customMessage || '',
                    tipo_pago: rawEnvio.tipo_pago,
                    monto_anticipo: rawEnvio.monto_anticipo,
                    monto_pendiente: rawEnvio.monto_pendiente,
                    metodo_pago_manual: rawEnvio.metodo_pago_manual,
                  };

                  const items: OrderItem[] = (row.pedido_items || []).map((item: any) => {
                    const productImages = item.productos?.imagenes || [];
                    const imageUrl = productImages.length > 0 ? productImages[0] : 'https://placehold.co/150x150/f3f4f6/9ca3af?text=Sin+Imagen';
                    
                    return {
                      id: item.id,
                      nombre: item.nombre_producto,
                      variante: item.variante_id ? 'Variante específica' : 'Estándar',
                      cantidad: item.cantidad,
                      precio_unitario: item.precio_unitario,
                      imagen: imageUrl,
                    };
                  });

                  const mappedOrder: Order = {
                    id: row.id,
                    numero: `#${row.id.slice(0, 8).toUpperCase()}`,
                    fecha: row.created_at,
                    cliente_nombre: row.cliente_nombre || rawEnvio.recipientName || 'Cliente anónimo',
                    cliente_email: row.email_cliente || 'Sin email',
                    total: row.total,
                    estado: row.estado as OrderStatus,
                    datos_envio,
                    items,
                  };

                  setOrders((prev) => {
                    if (prev.some((o) => o.id === mappedOrder.id)) return prev;
                    return [mappedOrder, ...prev];
                  });

                  toast.success(`Nuevo pedido recibido: ${mappedOrder.numero}`);
                }
              } catch (err) {
                logger.error('Error fetching new order details in Realtime:', err as Error);
              }
            } else if (payload.eventType === 'UPDATE') {
              const updatedRow = payload.new;
              setOrders((prev) =>
                prev.map((o) =>
                  o.id === updatedRow.id
                    ? { ...o, estado: updatedRow.estado as OrderStatus }
                    : o
                )
              );
              setSelectedOrder((prev) =>
                prev?.id === updatedRow.id
                  ? { ...prev, estado: updatedRow.estado as OrderStatus }
                  : prev
              );
            }
          }
        )
        .subscribe((status) => {
          if (!active) return;

          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
            setRetryCount(0);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setConnectionStatus('disconnected');

            if (attempt < 3) {
              const delay = Math.pow(2, attempt) * 1000;
              logger.warn(`[RealtimePedidos] Falló suscripción. Reintentando en ${delay}ms...`);

              if (currentChannel) {
                supabase.removeChannel(currentChannel);
              }

              retryTimeoutId = setTimeout(() => {
                if (active) {
                  setRetryCount(attempt + 1);
                  subscribeWithRetry(attempt + 1);
                }
              }, delay);
            } else {
              logger.error('[RealtimePedidos] Se superó el límite de reintentos de conexión en tiempo real.');
            }
          }
        });

      currentChannel = channel;
    };

    subscribeWithRetry(0);

    return () => {
      active = false;
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      if (currentChannel) {
        supabase.removeChannel(currentChannel);
      }
    };
  }, [tenant?.id, subscriptionTrigger]);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (filterStatus !== 'todos' && o.estado !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return o.numero.toLowerCase().includes(q) ||
               o.cliente_nombre.toLowerCase().includes(q) ||
               o.datos_envio.recipientName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [orders, filterStatus, searchQuery]);

  /**
   * Actualizar estado de un pedido (optimista local + BD).
   */
  const handleStatusChange = useCallback(async (orderId: string, newStatus: OrderStatus) => {
    // Optimista UI
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, estado: newStatus } : o));
    setSelectedOrder(prev => prev?.id === orderId ? { ...prev, estado: newStatus } : prev);

    try {
      await updateOrderStatus(orderId, newStatus);
    } catch (error) {
      logger.error('Error updating order status:', error as Error);
    }
  }, []);

  /**
   * Registrar liquidación (pago completo) para anticipos.
   */
  const handleLiquidate = useCallback(async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const updatedEnvio = {
      ...order.datos_envio,
      tipo_pago: 'pagado' as const,
      monto_pendiente: 0,
    };

    // Optimista UI
    setOrders(prev => prev.map(o => o.id === orderId ? {
      ...o,
      estado: 'pagado' as const,
      datos_envio: updatedEnvio
    } : o));
    setSelectedOrder(prev => prev?.id === orderId ? {
      ...prev,
      estado: 'pagado' as const,
      datos_envio: updatedEnvio
    } : prev);

    try {
      await liquidateOrder(orderId, updatedEnvio);
      toast.success('Pago liquidado correctamente');
    } catch (error) {
      logger.error('Error liquidating order:', error as Error);
      toast.error('Error al liquidar el pago');
      setRefreshTrigger(prev => prev + 1);
    }
  }, [orders]);

  /**
   * Guardar venta manual (Nota Express).
   */
  const handleSaveManualOrder = useCallback(async (orderData: {
    recipientName: string;
    recipientPhone: string;
    deliveryAddress: string;
    deliveryDate: string;
    customMessage: string;
    emailCliente: string;
    detalleVenta: string;
    montoTotal: number;
    metodoPago: 'efectivo' | 'transferencia';
    tipoPago: 'pendiente' | 'anticipo' | 'pagado';
    montoAnticipo: number;
  }) => {
    if (!tenant?.id) return;

    try {
      const datos_envio = {
        recipientName: orderData.recipientName,
        recipientPhone: orderData.recipientPhone || 'Sin teléfono',
        deliveryAddress: orderData.deliveryAddress || 'Recoger en tienda',
        deliveryDate: orderData.deliveryDate,
        customMessage: orderData.customMessage || '',
        tipo_pago: orderData.tipoPago,
        monto_anticipo: orderData.montoAnticipo,
        monto_pendiente: orderData.tipoPago === 'anticipo' 
          ? Math.max(0, orderData.montoTotal - orderData.montoAnticipo)
          : (orderData.tipoPago === 'pagado' ? 0 : orderData.montoTotal),
        metodo_pago_manual: orderData.metodoPago,
      };

      const dbEstado = orderData.tipoPago === 'pagado' ? 'pagado' : 'pendiente';

      await createManualOrder(tenant.id, {
        total: orderData.montoTotal,
        estado: dbEstado,
        metodoPago: orderData.metodoPago,
        datos_envio,
        emailCliente: orderData.emailCliente || null,
        detalleVenta: orderData.detalleVenta
      });

      toast.success('Nota Express registrada exitosamente');
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      logger.error('Error saving manual order:', err as Error);
      toast.error('Error al registrar la venta manual');
      throw err;
    }
  }, [tenant?.id]);

  // Contadores por estado
  const counts = useMemo(() => {
    return orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.estado] = (acc[o.estado] || 0) + 1;
      return acc;
    }, {});
  }, [orders]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Encabezado ── */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Pedidos</h1>
        <p className="text-sm text-[var(--color-text-tertiary)]">
          Gestiona y da seguimiento a todos los pedidos de tu tienda
        </p>
      </div>

      {/* Banner de desconexión en tiempo real */}
      {connectionStatus === 'disconnected' && retryCount >= 3 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 animate-pulse text-amber-600 dark:text-amber-400" />
            <div className="text-sm">
              <span className="font-semibold">Conexión en tiempo real perdida.</span>
              <span className="block sm:inline sm:ml-1 text-xs opacity-90">Los nuevos pedidos podrían no aparecer automáticamente.</span>
            </div>
          </div>
          <button
            onClick={() => {
              setRetryCount(0);
              setSubscriptionTrigger(prev => prev + 1);
              setRefreshTrigger(prev => prev + 1);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm active:scale-[0.98]"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
            Reconectar y Actualizar
          </button>
        </div>
      )}

      {/* ── Filtros por estado ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setFilterStatus('todos')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[36px] ${
            filterStatus === 'todos' ? 'bg-[var(--color-text-primary)] text-[var(--color-background-primary)]' : 'bg-[var(--color-background-secondary)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-background-tertiary)]'
          }`}>
          Todos <span className="ml-1 opacity-60">{orders.length}</span>
        </button>
        {ALL_STATUSES.map(s => {
          const conf = STATUS_CONFIG[s];
          return (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[36px] ${
                filterStatus === s ? `${conf.bg} ${conf.text}` : 'bg-[var(--color-background-secondary)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-background-tertiary)]'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
              {conf.label} <span className="ml-1 opacity-60">{counts[s] || 0}</span>
            </button>
          );
        })}
      </div>

      {/* ── Buscador + Acciones ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
          <input type="text" placeholder="Buscar por # pedido, cliente o destinatario…" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-[var(--color-background-primary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all shadow-sm"
            style={{ fontSize: '16px' }} />
        </div>

        <button
          onClick={() => setShowManualModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm active:scale-[0.98] shrink-0"
        >
          <Plus className="w-4 h-4" />
          + Nota Express
        </button>
      </div>

      {/* ═══ TABLA DE PEDIDOS ═══ */}
      <div className={`${CARD} overflow-hidden`}>
        {/* Header */}
        <div className="hidden md:grid grid-cols-[100px_1fr_180px_120px_130px_40px] gap-4 px-5 py-3 bg-[var(--color-background-secondary)] border-b border-[var(--color-border-tertiary)] text-[0.7rem] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
          <span># Pedido</span>
          <span>Cliente / Destinatario</span>
          <span>Fecha</span>
          <span className="text-right">Total</span>
          <span className="text-center">Estado</span>
          <span></span>
        </div>

        {/* Rows */}
        <div className="flex flex-col gap-4 md:gap-0 md:divide-y md:divide-[var(--color-border-tertiary)] p-4 md:p-0">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
              <p className="text-sm text-[var(--color-text-tertiary)]">Cargando pedidos en vivo...</p>
            </div>
          ) : filtered.map(order => {
            const statusConf = STATUS_CONFIG[order.estado];
            return (
              <motion.div layout key={order.id}
                transition={{ duration: 0.4, ease: "easeOut" }}
                onClick={() => setSelectedOrder(order)}
                className="bg-[var(--color-background-primary)] md:bg-transparent border border-[var(--color-border-secondary)] md:border-0 rounded-2xl md:rounded-none flex flex-col md:grid md:grid-cols-[100px_1fr_180px_120px_130px_40px] gap-4 p-5 md:px-5 md:py-4 hover:bg-[var(--color-background-secondary)]/50 cursor-pointer transition-colors group shadow-sm md:shadow-none items-start md:items-center">
                
                {/* ── Móvil Header (Número + Estado) ── */}
                <div className="flex md:hidden items-center justify-between w-full border-b border-[var(--color-border-tertiary)] pb-3">
                  <span className="text-sm font-bold text-[var(--color-text-primary)] font-mono">{order.numero}</span>
                  <span className={`inline-flex items-center gap-1.5 text-[0.65rem] font-semibold px-2 py-0.5 rounded-full ${statusConf.bg} ${statusConf.text} uppercase tracking-wider`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
                    {statusConf.label}
                  </span>
                </div>

                {/* Número (Desktop) */}
                <span className="hidden md:block text-sm font-bold text-[var(--color-text-primary)] font-mono">{order.numero}</span>
                
                {/* Cliente */}
                <div className="min-w-0 w-full md:w-auto">
                  <p className="text-sm font-bold md:font-medium text-[var(--color-text-primary)] truncate">{order.cliente_nombre}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)] truncate flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 shrink-0" />
                    Para: {order.datos_envio.recipientName}
                  </p>
                </div>
                
                {/* Fecha */}
                <div className="flex md:flex items-center gap-1.5 text-xs md:text-sm text-[var(--color-text-tertiary)] w-full md:w-auto">
                  <Clock className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] shrink-0" />
                  {formatDate(order.fecha)} · {formatTime(order.fecha)}
                </div>
                
                {/* Móvil Footer (Total + Acciones) */}
                <div className="flex md:hidden items-center justify-between w-full pt-1 border-t border-[var(--color-border-tertiary)] mt-1">
                  <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Total pagado</span>
                  <div>
                    <span className="text-sm font-bold text-[var(--color-text-primary)]">${order.total.toLocaleString()}</span>
                    <span className="text-[0.65rem] text-[var(--color-text-tertiary)] ml-0.5">MXN</span>
                  </div>
                </div>

                {/* Total (Desktop) */}
                <div className="hidden md:block text-right">
                  <span className="text-sm font-bold text-[var(--color-text-primary)]">${order.total.toLocaleString()}</span>
                  <span className="text-[0.65rem] text-[var(--color-text-tertiary)] ml-0.5">MXN</span>
                </div>
                
                {/* Estado (Desktop) */}
                <div className="hidden md:flex justify-center">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${statusConf.bg} ${statusConf.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
                    {statusConf.label}
                  </span>
                </div>
                
                {/* Chevron */}
                <div className="hidden md:flex justify-end">
                  <ChevronRight className="w-4 h-4 text-[var(--color-border-primary)] group-hover:text-[var(--color-text-tertiary)] transition-colors" />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Botón de Cargar Más */}
        {hasMore && filtered.length > 0 && (
          <div className="flex justify-center mt-6 pb-6">
            <button
              onClick={() => setLoadedLimit(prev => prev + 20)}
              disabled={loading || fetchingMore}
              className="px-6 py-2.5 rounded-xl border border-[var(--color-border-secondary)] hover:bg-[var(--color-background-secondary)] text-sm font-medium text-[var(--color-text-primary)] transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {fetchingMore ? (
                <>
                  <div className="w-4 h-4 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                  Cargando...
                </>
              ) : (
                'Cargar más pedidos'
              )}
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 px-4">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <ShoppingBag className="w-10 h-10 text-emerald-500" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Sin pedidos por ahora</h3>
            <p className="text-sm text-[var(--color-text-tertiary)] max-w-md mx-auto leading-relaxed">
              {searchQuery 
                ? 'No encontramos ningún pedido que coincida con tu búsqueda. Intenta con otro término.' 
                : 'Aún no tienes pedidos registrados en esta tienda. Comparte tu link en redes sociales para atraer tus primeros clientes.'}
            </p>
          </div>
        )}
      </div>

      {/* ═══ PANEL LATERAL DE DETALLE ═══ */}
      {selectedOrder && (
        <OrderDetailPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
          onLiquidate={handleLiquidate}
        />
      )}

      {/* ═══ MODAL REGISTRO MANUAL ═══ */}
      {showManualModal && (
        <ManualOrderModal
          onClose={() => setShowManualModal(false)}
          onSave={handleSaveManualOrder}
        />
      )}
    </div>
  );
}
