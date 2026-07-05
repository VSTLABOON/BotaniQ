import React, { useState } from 'react';
import { 
  CreditCard, Check, AlertCircle, Eye, EyeOff, 
  Copy, AlertTriangle, ShieldCheck, HelpCircle, X, ExternalLink
} from 'lucide-react';
import { Accordion } from './SharedUI';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../../../../store/toastStore';

// ── Compilación de Explicación de Ayuda ───────────────────────────
function HelperDropdown({ 
  title, children 
}: { 
  title: string; children: React.ReactNode 
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-white/10 rounded-xl bg-white/5 overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-white/5 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
          {title}
        </span>
        <span className={`text-[10px] transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {isOpen && (
        <div className="px-4 pb-3 pt-1 text-xs text-[var(--color-text-tertiary)] leading-relaxed border-t border-white/5 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ██ MODAL: CONFIGURAR STRIPE
// ═══════════════════════════════════════════════════════════════════
function StripeConfigModal({
  isOpen,
  onClose,
  initialPublishableKey,
  initialSecretKey,
  initialWebhookSecret,
  onApply,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialPublishableKey: string;
  initialSecretKey: string;
  initialWebhookSecret: string;
  onApply: (pub: string, sec: string, web: string) => void;
}) {
  const [pubKey, setPubKey] = useState(initialPublishableKey);
  const [secKey, setSecKey] = useState(initialSecretKey);
  const [webSecret, setWebSecret] = useState(initialWebhookSecret);

  const [showSecret, setShowSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = 'https://vivero.botaniq.com.mx/functions/v1/stripe-webhook';

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success('Copiado', { message: 'URL del webhook copiada al portapapeles.' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onApply(pubKey.trim(), secKey.trim(), webSecret.trim());
    toast.success('Credenciales aplicadas', { 
      message: 'Recuerda guardar los cambios generales para aplicar a producción.' 
    });
    onClose();
  };

  // Validaciones visuales simples en caliente
  const isPubInvalid = pubKey.length > 0 && !pubKey.startsWith('pk_');
  const isSecInvalid = secKey.length > 0 && !secKey.startsWith('sk_');
  const isWebInvalid = webSecret.length > 0 && !webSecret.startsWith('whsec_');

  if (!isOpen) return null;

  const inputClass = "w-full px-4 py-2.5 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all";

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-[3px] z-[9998]" onClick={onClose} />
      <div className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[580px] md:max-h-[85vh] bg-[var(--color-background-primary)] rounded-2xl shadow-2xl z-[9999] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-tertiary)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">Configurar Stripe</h3>
              <p className="text-xs text-[var(--color-text-tertiary)]">Pasarela de cobro en línea internacional</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          
          <HelperDropdown title="¿Dónde encuentro mis llaves de Stripe?">
            <p>1. Inicia sesión en tu cuenta de <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-0.5">Stripe Dashboard <ExternalLink className="w-3 h-3" /></a>.</p>
            <p>2. Ve a la esquina superior derecha y activa el modo de pruebas si quieres hacer un test preliminar, o déjalo desactivado para recibir cobros reales.</p>
            <p>3. Dirígete a la sección <strong>Developers</strong> (Desarrolladores) &rarr; <strong>API Keys</strong> (Llaves de API).</p>
            <p>4. Copia la <strong>Publishable Key</strong> (Llave pública) y la <strong>Secret Key</strong> (Llave secreta) y pégalas en los campos correspondientes a continuación.</p>
          </HelperDropdown>

          {/* Llave Pública */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
              Llave Pública / Publicable (Publishable Key)
            </label>
            <input
              type="text"
              required
              value={pubKey}
              onChange={(e) => setPubKey(e.target.value)}
              className={`${inputClass} ${isPubInvalid ? 'border-amber-500/50 focus:border-amber-500' : ''}`}
              placeholder="Ej: pk_live_51..."
              style={{ fontSize: '16px' }}
            />
            {isPubInvalid ? (
              <span className="text-[10px] text-amber-500 mt-1 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> La llave pública de Stripe usualmente empieza con 'pk_'.
              </span>
            ) : (
              <span className="text-[10px] text-[var(--color-text-tertiary)] mt-1 block">
                Comienza con 'pk_' y se usa de cara al cliente en el navegador.
              </span>
            )}
          </div>

          {/* Llave Secreta */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
              Llave Secreta (Secret Key)
            </label>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                required
                value={secKey}
                onChange={(e) => setSecKey(e.target.value)}
                className={`${inputClass} pr-10 ${isSecInvalid ? 'border-amber-500/50 focus:border-amber-500' : ''}`}
                placeholder="Ej: sk_live_51..."
                style={{ fontSize: '16px' }}
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer bg-transparent border-0 outline-none"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {isSecInvalid ? (
              <span className="text-[10px] text-amber-500 mt-1 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> La llave secreta de Stripe usualmente empieza con 'sk_'.
              </span>
            ) : (
              <span className="text-[10px] text-[var(--color-text-tertiary)] mt-1 block">
                Comienza con 'sk_'. Mantén esta llave resguardada y nunca la reveles a terceros.
              </span>
            )}
          </div>

          {/* Webhook Secret */}
          <div className="pt-4 border-t border-white/5 space-y-4">
            <div>
              <h4 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider">Webhooks (Recomendado para Sincronización)</h4>
              <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 leading-relaxed">
                El webhook le avisa a tu tienda cuando un pago ha sido procesado de forma externa en Stripe, actualizando el pedido en tiempo real.
              </p>
            </div>

            <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-[var(--color-text-tertiary)] block font-semibold uppercase tracking-wider mb-0.5">Pega esta URL en Stripe:</span>
                <code className="text-indigo-400 font-mono select-all truncate block">{webhookUrl}</code>
              </div>
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1 transition-colors shrink-0 text-white font-medium cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                Secreto del Webhook (Webhook Secret)
              </label>
              <div className="relative">
                <input
                  type={showWebhookSecret ? "text" : "password"}
                  value={webSecret}
                  onChange={(e) => setWebSecret(e.target.value)}
                  className={`${inputClass} pr-10 ${isWebInvalid ? 'border-amber-500/50 focus:border-amber-500' : ''}`}
                  placeholder="Ej: whsec_..."
                  style={{ fontSize: '16px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer bg-transparent border-0 outline-none"
                >
                  {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {isWebInvalid ? (
                <span className="text-[10px] text-amber-500 mt-1 flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> El secreto de webhook usualmente empieza con 'whsec_'.
                </span>
              ) : (
                <span className="text-[10px] text-[var(--color-text-tertiary)] mt-1 block">
                  Comienza con 'whsec_'. Opcional pero recomendado para certificar el origen del pago.
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border-tertiary)] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
            >
              Aplicar Cambios
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ██ MODAL: CONFIGURAR OPENPAY
// ═══════════════════════════════════════════════════════════════════
function OpenpayConfigModal({
  isOpen,
  onClose,
  initialMerchantId,
  initialPublicKey,
  initialPrivateKey,
  initialSandboxMode,
  onApply,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialMerchantId: string;
  initialPublicKey: string;
  initialPrivateKey: string;
  initialSandboxMode: boolean;
  onApply: (merchant: string, pub: string, priv: string, sandbox: boolean) => void;
}) {
  const [merchantId, setMerchantId] = useState(initialMerchantId);
  const [pubKey, setPubKey] = useState(initialPublicKey);
  const [privKey, setPrivKey] = useState(initialPrivateKey);
  const [sandbox, setSandbox] = useState(initialSandboxMode);

  const [showSecret, setShowSecret] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onApply(merchantId.trim(), pubKey.trim(), privKey.trim(), sandbox);
    toast.success('Credenciales aplicadas', { 
      message: 'Recuerda guardar los cambios generales para aplicar a producción.' 
    });
    onClose();
  };

  // Validaciones en caliente
  const isMerchantInvalid = merchantId.length > 0 && !merchantId.startsWith('m');
  const isPubInvalid = pubKey.length > 0 && !pubKey.startsWith('pk_');
  const isPrivInvalid = privKey.length > 0 && !privKey.startsWith('sk_');

  if (!isOpen) return null;

  const inputClass = "w-full px-4 py-2.5 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all";

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-[3px] z-[9998]" onClick={onClose} />
      <div className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[580px] md:max-h-[85vh] bg-[var(--color-background-primary)] rounded-2xl shadow-2xl z-[9999] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-tertiary)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">Configurar OpenPay</h3>
              <p className="text-xs text-[var(--color-text-tertiary)]">Pasarela de cobro de BBVA para LATAM</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          
          <HelperDropdown title="¿Dónde encuentro mis credenciales de OpenPay?">
            <p>1. Inicia sesión en tu panel de control de <a href="https://dashboard.openpay.mx" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline inline-flex items-center gap-0.5">OpenPay <ExternalLink className="w-3 h-3" /></a>.</p>
            <p>2. En la barra superior, asegúrate de estar en el entorno correcto (Sandbox para simulación de transacciones de pruebas, o Producción para cobros reales).</p>
            <p>3. En el menú de navegación izquierdo, ve a la sección <strong>Configuraciones</strong> &rarr; <strong>Credenciales API</strong>.</p>
            <p>4. Copia tu <strong>ID de Comercio (Merchant ID)</strong>, <strong>Llave Pública (Public Key)</strong> y <strong>Llave Privada (Private Key)</strong>.</p>
          </HelperDropdown>

          {/* Sandbox Mode Toggle */}
          <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl">
            <div className="flex-1 pr-4">
              <h4 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider">Entorno de Operaciones</h4>
              <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 leading-relaxed">
                {sandbox 
                  ? 'Las transacciones simularán pagos reales sin realizar cargos. Ideal para verificar el sistema.' 
                  : 'Cobros reales a tarjetas de crédito/débito y transferencias bancarias.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSandbox(!sandbox)}
              className={`relative w-12 h-6.5 rounded-full transition-colors duration-200 cursor-pointer shrink-0 ${
                sandbox ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5.5 h-5.5 bg-white rounded-full shadow transition-transform duration-200 ${
                sandbox ? 'translate-x-0' : 'translate-x-5.5'
              }`} />
            </button>
          </div>

          {/* ID de Comercio */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
              ID de Comercio (Merchant ID)
            </label>
            <input
              type="text"
              required
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              className={`${inputClass} ${isMerchantInvalid ? 'border-amber-500/50 focus:border-amber-500' : ''}`}
              placeholder="Ej: mqhxxxxxxxxxxxxxxxxx"
              style={{ fontSize: '16px' }}
            />
            {isMerchantInvalid ? (
              <span className="text-[10px] text-amber-500 mt-1 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> El ID de comercio usualmente empieza con 'm'.
              </span>
            ) : (
              <span className="text-[10px] text-[var(--color-text-tertiary)] mt-1 block">
                Identificador provisto por OpenPay.
              </span>
            )}
          </div>

          {/* Llave Pública */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
              Llave Pública (Public Key)
            </label>
            <input
              type="text"
              required
              value={pubKey}
              onChange={(e) => setPubKey(e.target.value)}
              className={`${inputClass} ${isPubInvalid ? 'border-amber-500/50 focus:border-amber-500' : ''}`}
              placeholder="Ej: pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              style={{ fontSize: '16px' }}
            />
            {isPubInvalid ? (
              <span className="text-[10px] text-amber-500 mt-1 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> La llave pública de OpenPay usualmente empieza con 'pk_'.
              </span>
            ) : (
              <span className="text-[10px] text-[var(--color-text-tertiary)] mt-1 block">
                Comienza con 'pk_'.
              </span>
            )}
          </div>

          {/* Llave Privada */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
              Llave Privada (Private Key)
            </label>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                required
                value={privKey}
                onChange={(e) => setPrivKey(e.target.value)}
                className={`${inputClass} pr-10 ${isPrivInvalid ? 'border-amber-500/50 focus:border-amber-500' : ''}`}
                placeholder="Ej: sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                style={{ fontSize: '16px' }}
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer bg-transparent border-0 outline-none"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {isPrivInvalid ? (
              <span className="text-[10px] text-amber-500 mt-1 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> La llave privada de OpenPay usualmente empieza con 'sk_'.
              </span>
            ) : (
              <span className="text-[10px] text-[var(--color-text-tertiary)] mt-1 block">
                Comienza con 'sk_'. No compartas esta clave.
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border-tertiary)] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
            >
              Aplicar Cambios
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ██ COMPONENTE PRINCIPAL: TAB DE CONFIGURACIÓN DE PAGOS
// ═══════════════════════════════════════════════════════════════════
export function PagosTab({
  state,
  actions,
  tenant
}: {
  state: any;
  actions: any;
  tenant: any;
}) {
  const {
    openpayMerchantId,
    openpayPublicKey,
    openpayPrivateKey,
    openpaySandboxMode,
    stripePublishableKey,
    stripeSecretKey,
    stripeWebhookSecret,
    preferredGateway,
    openAccordions
  } = state;

  const {
    setOpenpayMerchantId,
    setOpenpayPublicKey,
    setOpenpayPrivateKey,
    setOpenpaySandboxMode,
    setStripePublishableKey,
    setStripeSecretKey,
    setStripeWebhookSecret,
    setPreferredGateway,
    onToggleAccordion
  } = actions;

  // Controladores de los modales de configuración
  const [isStripeOpen, setIsStripeOpen] = useState(false);
  const [isOpenpayOpen, setIsOpenpayOpen] = useState(false);

  const hasStripeEnabled = tenant.subscription_level >= 3;

  // Estados de configuración reales (detectados por presencia de llaves)
  const isStripeConfigured = !!(stripePublishableKey && stripeSecretKey);
  const isOpenpayConfigured = !!(openpayMerchantId && openpayPublicKey && openpayPrivateKey);

  return (
    <div className="space-y-6">
      <Accordion
        id="editor-Pagos"
        title="Configuración de Cobros y Métodos de Pago"
        icon={CreditCard}
        isOpen={openAccordions.Pagos ?? true}
        onToggle={(open) => onToggleAccordion('Pagos', open)}
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Canales de Venta y Pasarelas</h3>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Administra los medios de pago que verán tus clientes al procesar su carrito.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* WhatsApp Checkout */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    WhatsApp (Offline)
                  </span>
                  <span className="text-xs text-[var(--color-text-tertiary)] font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-500" /> Siempre activo
                  </span>
                </div>
                <h4 className="text-base font-bold text-[var(--color-text-primary)] mb-1">Pedido por Chat</h4>
                <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
                  Los clientes envían su pedido detallado directo a tu chat. Coordinas el pago por transferencia o efectivo de forma manual, ideal para ventas de entrega local.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-[var(--color-text-tertiary)]">
                Pedidos consolidados automáticamente en el panel.
              </div>
            </div>

            {/* Pasarela Preferida / Gateway Directo */}
            <div className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
              hasStripeEnabled 
                ? 'bg-white/5 border-white/10' 
                : 'bg-white/5 dark:bg-black/10 border-white/5 opacity-80'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    hasStripeEnabled 
                      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                      : 'bg-white/10 text-[var(--color-text-tertiary)]'
                  }`}>
                    Tarjetas de Crédito / Débito
                  </span>
                  {hasStripeEnabled ? (
                    <span className="text-xs text-[var(--color-text-tertiary)] font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-indigo-500" /> Habilitado en tu plan
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Plan Básico
                    </span>
                  )}
                </div>
                <h4 className="text-base font-bold text-[var(--color-text-primary)] mb-1">Pasarelas en Línea</h4>
                <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
                  Permite cobros electrónicos automáticos. Soporta pasarelas de tarjetas internacionales y SPEI directo en el navegador de tu cliente.
                </p>
              </div>
              {!hasStripeEnabled ? (
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-amber-600 dark:text-amber-400">Disponible a partir del Plan Pro</span>
                  <a href="/admin" className="text-[10px] font-bold text-indigo-500 hover:underline uppercase tracking-wider shrink-0">Actualizar →</a>
                </div>
              ) : (
                <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-[var(--color-text-tertiary)]">
                  Procesamiento y depósitos automatizados con protección de fraude.
                </div>
              )}
            </div>
          </div>

          {/* Pasarelas de Conexión */}
          {hasStripeEnabled && (
            <div className="pt-6 border-t border-white/10 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Conexión de Pasarelas</h3>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  Conecta y administra tus credenciales de pago privadas de forma 100% segura.
                </p>
              </div>

              {/* Selector de Pasarela Activa */}
              <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl">
                <div>
                  <h4 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider">Pasarela en uso (Activa)</h4>
                  <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 leading-relaxed">
                    Selecciona qué pasarela de cobro por tarjeta se desplegará a tus clientes al pagar.
                  </p>
                </div>
                <div className="flex bg-[var(--color-background-secondary)] p-1 rounded-xl border border-[var(--color-border-secondary)] shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreferredGateway('openpay')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      preferredGateway === 'openpay'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    OpenPay
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferredGateway('stripe')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      preferredGateway === 'stripe'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    Stripe
                  </button>
                </div>
              </div>

              {/* Tarjetas de Pasarela */}
              <div className="grid grid-cols-1 gap-4">
                
                {/* Fila Stripe */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[var(--color-text-primary)]">Stripe</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`w-2 h-2 rounded-full ${isStripeConfigured ? 'bg-indigo-500' : 'bg-gray-400'}`} />
                        <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                          {isStripeConfigured ? 'Conectado (Producción)' : 'Sin configurar'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsStripeOpen(true)}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                      isStripeConfigured
                        ? 'bg-white/10 hover:bg-white/20 border border-white/15 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/10'
                    }`}
                  >
                    {isStripeConfigured ? 'Editar credenciales' : 'Conectar pasarela'}
                  </button>
                </div>

                {/* Fila OpenPay */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600/10 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[var(--color-text-primary)]">OpenPay</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`w-2 h-2 rounded-full ${isOpenpayConfigured ? (openpaySandboxMode ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-gray-400'}`} />
                        <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                          {isOpenpayConfigured 
                            ? (openpaySandboxMode ? 'Conectado (Pruebas - Sandbox)' : 'Conectado (Producción)') 
                            : 'Sin configurar'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpenpayOpen(true)}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                      isOpenpayConfigured
                        ? 'bg-white/10 hover:bg-white/20 border border-white/15 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/10'
                    }`}
                  >
                    {isOpenpayConfigured ? 'Editar credenciales' : 'Conectar pasarela'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Accordion>

      {/* Modales de Configuración */}
      <AnimatePresence>
        {isStripeOpen && (
          <StripeConfigModal
            isOpen={isStripeOpen}
            onClose={() => setIsStripeOpen(false)}
            initialPublishableKey={stripePublishableKey}
            initialSecretKey={stripeSecretKey}
            initialWebhookSecret={stripeWebhookSecret}
            onApply={(pub, sec, web) => {
              setStripePublishableKey(pub);
              setStripeSecretKey(sec);
              setStripeWebhookSecret(web);
            }}
          />
        )}

        {isOpenpayOpen && (
          <OpenpayConfigModal
            isOpen={isOpenpayOpen}
            onClose={() => setIsOpenpayOpen(false)}
            initialMerchantId={openpayMerchantId}
            initialPublicKey={openpayPublicKey}
            initialPrivateKey={openpayPrivateKey}
            initialSandboxMode={openpaySandboxMode}
            onApply={(merchant, pub, priv, sandbox) => {
              setOpenpayMerchantId(merchant);
              setOpenpayPublicKey(pub);
              setOpenpayPrivateKey(priv);
              setOpenpaySandboxMode(sandbox);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
