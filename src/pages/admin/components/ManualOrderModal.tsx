import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Phone, MapPin, Calendar, CreditCard,
  Plus, X, Loader2, Save, MessageSquare, AlertCircle
} from 'lucide-react';
import { toast } from '../../../store/toastStore';
import { logger } from '../../../lib/logger';

interface ManualOrderModalProps {
  onClose: () => void;
  onSave: (orderData: {
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
  }) => Promise<void>;
}

export function ManualOrderModal({ onClose, onSave }: ManualOrderModalProps) {
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [emailCliente, setEmailCliente] = useState('');
  const [detalleVenta, setDetalleVenta] = useState('');
  const [montoTotal, setMontoTotal] = useState<number>(0);
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [tipoPago, setTipoPago] = useState<'pendiente' | 'anticipo' | 'pagado'>('pendiente');
  const [montoAnticipo, setMontoAnticipo] = useState<number>(0);
  const [deliveryAddress, setDeliveryAddress] = useState('Recoger en tienda');
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [customMessage, setCustomMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim()) {
      toast.error('El nombre del cliente/destinatario es obligatorio');
      return;
    }
    if (!detalleVenta.trim()) {
      toast.error('El detalle de la venta (concepto) es obligatorio');
      return;
    }
    if (montoTotal <= 0) {
      toast.error('El monto total debe ser mayor a 0');
      return;
    }
    if (tipoPago === 'anticipo') {
      if (montoAnticipo <= 0) {
        toast.error('El monto del anticipo debe ser mayor a 0');
        return;
      }
      if (montoAnticipo >= montoTotal) {
        toast.error('El anticipo debe ser menor al total. Selecciona "Pagado" si se liquidó por completo.');
        return;
      }
    }

    setSaving(true);
    try {
      await onSave({
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        deliveryDate,
        customMessage: customMessage.trim(),
        emailCliente: emailCliente.trim(),
        detalleVenta: detalleVenta.trim(),
        montoTotal,
        metodoPago,
        tipoPago,
        montoAnticipo: tipoPago === 'anticipo' ? montoAnticipo : 0,
      });
      onClose();
    } catch (err) {
      logger.error('Error in handleSubmit manual order:', err as Error);
    } finally {
      setSaving(false);
    }
  };

  const montoPendiente = Math.max(0, montoTotal - montoAnticipo);

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[3px] z-[9998]" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[680px] md:max-h-[85vh] bg-[var(--color-background-primary)] md:bg-[var(--color-background-primary)]/90 md:backdrop-blur-2xl md:rounded-2xl shadow-2xl z-[9999] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-tertiary)] shrink-0">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Registrar Nota Express</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Cliente Info */}
          <div className="bg-[var(--color-background-secondary)]/50 rounded-2xl p-4 border border-[var(--color-border-secondary)]/40 space-y-4">
            <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Información del Cliente</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Nombre Destinatario / Cliente *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
                  <input
                    type="text"
                    required
                    placeholder="Ej. María López"
                    value={recipientName}
                    onChange={e => setRecipientName(e.target.value)}
                    className="w-full h-10 pl-9 pr-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Teléfono Cliente</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
                  <input
                    type="tel"
                    placeholder="Ej. +52 5512345678"
                    value={recipientPhone}
                    onChange={e => setRecipientPhone(e.target.value)}
                    className="w-full h-10 pl-9 pr-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Email Cliente (Opcional)</label>
                <input
                  type="email"
                  placeholder="cliente@ejemplo.com"
                  value={emailCliente}
                  onChange={e => setEmailCliente(e.target.value)}
                  className="w-full h-10 px-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Venta Info */}
          <div className="bg-[var(--color-background-secondary)]/50 rounded-2xl p-4 border border-[var(--color-border-secondary)]/40 space-y-4">
            <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Detalle del Pedido</h4>
            
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Concepto / Descripción del Producto *</label>
              <textarea
                required
                rows={2}
                placeholder="Ramo de 24 rosas rojas con listón de seda y tarjeta dedicatoria..."
                value={detalleVenta}
                onChange={e => setDetalleVenta(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Monto Total *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--color-text-tertiary)]">$</span>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={montoTotal || ''}
                    onChange={e => setMontoTotal(parseFloat(e.target.value) || 0)}
                    className="w-full h-10 pl-7 pr-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Método de Pago</label>
                <select
                  value={metodoPago}
                  onChange={e => setMetodoPago(e.target.value as any)}
                  className="w-full h-10 px-3 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                </select>
              </div>
            </div>

            {/* Estado de Pago */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">Estado del Pago</label>
              <div className="grid grid-cols-3 gap-2">
                {(['pendiente', 'anticipo', 'pagado'] as const).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setTipoPago(option);
                      if (option !== 'anticipo') setMontoAnticipo(0);
                    }}
                    className={`h-11 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-0.5
                      ${tipoPago === option 
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30' 
                        : 'bg-[var(--color-background-secondary)] border-[var(--color-border-secondary)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-background-tertiary)]'}`}
                  >
                    <span className="capitalize">{option === 'anticipo' ? 'Anticipo' : option === 'pagado' ? 'Pagado' : 'Pendiente'}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Input dinámico para Anticipo */}
            {tipoPago === 'anticipo' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--color-border-tertiary)]/50"
              >
                <div>
                  <label className="block text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Monto del Anticipo *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-emerald-600">$</span>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={montoAnticipo || ''}
                      onChange={e => setMontoAnticipo(parseFloat(e.target.value) || 0)}
                      className="w-full h-10 pl-7 pr-4 bg-emerald-500/5 border border-emerald-500/30 rounded-xl text-sm text-emerald-700 dark:text-emerald-400 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col justify-end pb-1.5">
                  <span className="text-[0.65rem] text-[var(--color-text-tertiary)] uppercase tracking-wider block">Saldo Restante Pendiente</span>
                  <span className="text-lg font-bold text-rose-500">
                    ${montoPendiente.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                  </span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Envío/Entrega Info */}
          <div className="bg-[var(--color-background-secondary)]/50 rounded-2xl p-4 border border-[var(--color-border-secondary)]/40 space-y-4">
            <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Entrega y Envío</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Dirección de Entrega</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
                  <input
                    type="text"
                    placeholder="Ej. Av. Reforma 123, Col. Centro"
                    value={deliveryAddress}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    className="w-full h-10 pl-9 pr-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Fecha de Entrega *</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
                  <input
                    type="date"
                    required
                    value={deliveryDate}
                    onChange={e => setDeliveryDate(e.target.value)}
                    className="w-full h-10 pl-9 pr-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Dedicatoria (Opcional)</label>
              <textarea
                rows={2}
                placeholder="Escribe el mensaje para la tarjeta..."
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all resize-none"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] shrink-0 pb-safe md:pb-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-[var(--color-text-primary)] text-[var(--color-background-primary)] hover:bg-[var(--color-text-primary)] transition-all active:scale-[0.97] shadow-lg shadow-black/5 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Guardar Pedido
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
