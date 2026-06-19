import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Package, MapPin, Calendar, Clock, ArrowLeft, Loader2, Store } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useTenant } from '../../context/TenantContext';
import { logger } from '../../lib/logger';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';

// Mismos colores de estado que en el Admin
const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  pendiente:  { label: 'Recibido',       dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  preparando: { label: 'En Preparación', dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50' },
  en_ruta:    { label: 'En Ruta',        dot: 'bg-violet-500',  text: 'text-violet-700',  bg: 'bg-violet-50' },
  entregado:  { label: 'Entregado',      dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  cancelado:  { label: 'Cancelado',      dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50' },
  pendiente_pago: { label: 'Pago Pendiente', dot: 'bg-gray-400', text: 'text-gray-700', bg: 'bg-gray-100' },
  pagado:     { label: 'Pago Confirmado', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' }
};

export default function GuestTrackingPage() {
  const { tenant } = useTenant();
  
  const [orderNumber, setOrderNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [order, setOrder] = useState<any>(null);

  const escapeSqlWildcards = (str: string) => {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber || !phoneNumber) {
      setError('Por favor, ingresa el número de pedido y tu teléfono.');
      return;
    }

    setLoading(true);
    setError(null);
    setOrder(null);

    try {
      const cleanOrderNumber = orderNumber.replace('#', '').trim().toLowerCase();
      const cleanPhone = phoneNumber.replace(/\D/g, ''); // Solo números

      if (cleanOrderNumber.length < 5) {
        throw new Error('Número de pedido inválido.');
      }

      if (cleanPhone.length < 8) {
        throw new Error('El teléfono ingresado es inválido (debe tener al menos 8 dígitos).');
      }

      const escapedOrderNumber = escapeSqlWildcards(cleanOrderNumber);

      // Buscamos el pedido usando el RPC seguro get_guest_order
      const { data, error: fetchError } = await supabase
        .rpc('get_guest_order', {
          p_order_id_prefix: escapedOrderNumber,
          p_phone_number: cleanPhone
        });

      if (fetchError) throw fetchError;

      if (!data) {
        throw new Error('No encontramos ningún pedido con ese número o el teléfono no coincide.');
      }

      setOrder({
        ...data,
        numero: `#${data.id.slice(0, 8).toUpperCase()}`
      });

    } catch (err: any) {
      logger.error('Error al rastrear pedido:', err);
      setError(err.message || 'No se pudo encontrar el pedido. Verifica tus datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background-secondary)] flex flex-col font-sans">
      <Helmet>
        <title>Rastrear Pedido | {tenant.nombre}</title>
      </Helmet>

      <Header />

      <main className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-xl">
          
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors mb-6 font-medium">
            <ArrowLeft className="w-4 h-4" />
            Volver a la tienda
          </Link>

          <AnimatePresence mode="wait">
            {!order ? (
              <motion.div 
                key="search"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[var(--color-background-primary)] rounded-3xl p-8 border border-[var(--color-border-secondary)] shadow-xl shadow-black/5"
              >
                <div className="w-16 h-16 bg-[var(--color-background-secondary)] rounded-2xl flex items-center justify-center mb-6 shadow-inner text-[var(--color-text-primary)]">
                  <Search className="w-8 h-8 opacity-80" strokeWidth={1.5} />
                </div>
                
                <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mb-2 tracking-tight">Rastrea tu pedido</h1>
                <p className="text-[var(--color-text-tertiary)] mb-8 text-sm leading-relaxed">
                  Ingresa tu número de pedido (ej. #FDC-49A2) y el teléfono que registraste para ver el estado de tu entrega.
                </p>

                <form onSubmit={handleSearch} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">Número de Pedido</label>
                    <input 
                      type="text" 
                      placeholder="#ABC-123" 
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] transition-all font-mono uppercase"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">Teléfono de contacto</label>
                    <input 
                      type="tel" 
                      placeholder="Ej. 5512345678" 
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] transition-all"
                      required
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800/30">
                      {error}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl text-white font-bold text-base transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center shadow-lg shadow-emerald-500/20"
                    style={{ backgroundColor: tenant.color_primario }}
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buscar Pedido'}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div 
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[var(--color-background-primary)] rounded-3xl overflow-hidden border border-[var(--color-border-secondary)] shadow-2xl shadow-black/5"
              >
                {/* Cabecera del Resultado */}
                <div className="p-6 md:p-8 border-b border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)]/50">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest mb-1 block">Pedido Encontrado</span>
                      <h2 className="text-3xl font-black text-[var(--color-text-primary)] tracking-tight font-mono">{order.numero}</h2>
                    </div>
                    
                    {(() => {
                      const conf = STATUS_CONFIG[order.estado] || STATUS_CONFIG.pendiente;
                      return (
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-current/10 ${conf.bg} ${conf.text} font-bold shadow-sm self-start md:self-auto`}>
                          <span className={`w-2 h-2 rounded-full ${conf.dot} animate-pulse`} />
                          {conf.label}
                        </div>
                      )
                    })()}
                  </div>
                </div>

                <div className="p-6 md:p-8 space-y-8">
                  {/* Info de Envío */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-0.5">Entrega para</p>
                        <p className="font-medium text-[var(--color-text-primary)]">{order.datos_envio?.recipientName}</p>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{order.datos_envio?.deliveryAddress}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-0.5">Fecha programada</p>
                        <p className="font-medium text-[var(--color-text-primary)]">{order.datos_envio?.deliveryDate || 'Pronto'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Resumen de Items */}
                  <div className="border-t border-[var(--color-border-tertiary)] pt-6">
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                      <Package className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                      Artículos
                    </h3>
                    <div className="space-y-3">
                      {order.pedido_items?.map((item: any) => {
                        const productImages = item.productos?.imagenes || [];
                        const imageUrl = productImages.length > 0 ? productImages[0] : 'https://placehold.co/100x100/f3f4f6/9ca3af?text=Sin+Imagen';
                        
                        return (
                          <div key={item.id} className="flex items-center gap-4 bg-[var(--color-background-secondary)]/50 p-3 rounded-2xl border border-[var(--color-border-tertiary)]">
                            <img src={imageUrl} alt={item.nombre_producto} className="w-14 h-14 rounded-xl object-cover" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-[var(--color-text-primary)] truncate">{item.nombre_producto}</p>
                              <p className="text-sm text-[var(--color-text-tertiary)]">Cant: {item.cantidad}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-6 border-t border-[var(--color-border-tertiary)]">
                    <Store className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                    <p className="text-sm text-[var(--color-text-tertiary)] flex-1">Gracias por comprar en <span className="font-semibold text-[var(--color-text-primary)]">{tenant.nombre}</span>.</p>
                    <button onClick={() => setOrder(null)} className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
                      Buscar otro
                    </button>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
