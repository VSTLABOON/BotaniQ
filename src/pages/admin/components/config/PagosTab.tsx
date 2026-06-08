import React from 'react';
import { CreditCard, Check, AlertCircle } from 'lucide-react';
import { Accordion } from './SharedUI';
import { motion, AnimatePresence } from 'framer-motion';

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

  const [showSecret, setShowSecret] = React.useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = React.useState(false);

  const inputClass = "w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all";

  // Determinar si los pagos en línea con Stripe están activos según el nivel del plan de suscripción
  const hasStripeEnabled = tenant.subscription_level >= 2;

  return (
    <div className="space-y-6">
      {/* ── Métodos de Pago ── */}
      <Accordion
        id="editor-Pagos"
        title="Métodos de Pago Integrados"
        icon={CreditCard}
        isOpen={openAccordions.Pagos ?? true}
        onToggle={(open) => onToggleAccordion('Pagos', open)}
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Canales de Venta y Cobro</h3>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Así es como tus clientes eligen y pagan sus arreglos florales en el checkout.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WhatsApp Checkout */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Efectivo / Transfer
                  </span>
                  <span className="text-xs text-[var(--color-text-tertiary)] font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-500" /> Siempre activo
                  </span>
                </div>
                <h4 className="text-base font-bold text-[var(--color-text-primary)] mb-1">Pedido por WhatsApp</h4>
                <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
                  Los clientes arman su carrito y envían el pedido con todos sus datos directo a tu chat. Coordinas el pago en efectivo o por transferencia bancaria de forma directa.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-[var(--color-text-tertiary)]">
                Pedidos registrados al instante en tu pestaña de <strong>Pedidos</strong>.
              </div>
            </div>

            {/* Stripe Online Checkout */}
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
                    Tarjetas de Crédito
                  </span>
                  {hasStripeEnabled ? (
                    <span className="text-xs text-[var(--color-text-tertiary)] font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-indigo-500" /> Canal Activo
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Plan Básico
                    </span>
                  )}
                </div>
                <h4 className="text-base font-bold text-[var(--color-text-primary)] mb-1">Stripe Checkout</h4>
                <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
                  Pasarela segura hosted para recibir pagos con tarjeta Visa, Mastercard o AMEX. El dinero se deposita directamente en la cuenta bancaria de tu negocio.
                </p>
              </div>
              {!hasStripeEnabled ? (
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-amber-600 dark:text-amber-400">Disponible a partir del Plan Pro</span>
                  <a href="/admin" className="text-[10px] font-bold text-indigo-500 hover:underline uppercase tracking-wider shrink-0">Actualizar →</a>
                </div>
              ) : (
                <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-[var(--color-text-tertiary)]">
                  Procesamiento y depósitos automatizados con Price Hardening.
                </div>
              )}
            </div>
          </div>

          {/* Configuración de Pasarela de Pagos (Cobros en Línea) */}
          <div className="pt-6 border-t border-white/10">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
              Pasarelas de Pago (Cobros en Línea)
            </h3>
            <p className="text-xs text-[var(--color-text-tertiary)] mb-4">
              Configura tus credenciales para recibir pagos directos con tarjetas y otros medios locales.
            </p>

            {/* Selector de Pasarelas (Radio Cards) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {/* Opción OpenPay */}
              <button
                type="button"
                onClick={() => setPreferredGateway('openpay')}
                className={`relative p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  preferredGateway === 'openpay'
                    ? 'bg-emerald-500/10 border-emerald-500 shadow-md ring-1 ring-emerald-500/20'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold text-[var(--color-text-primary)]">OpenPay</span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Recomendado (México)
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
                  Pasarela de BBVA en LATAM. Soporta cobros con tarjetas 3D Secure, transferencias SPEI directas y pagos en tiendas Paynet/OXXO.
                </p>
                {preferredGateway === 'openpay' && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </button>

              {/* Opción Stripe */}
              <button
                type="button"
                onClick={() => setPreferredGateway('stripe')}
                className={`relative p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  preferredGateway === 'stripe'
                    ? 'bg-indigo-500/10 border-indigo-500 shadow-md ring-1 ring-indigo-500/20'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold text-[var(--color-text-primary)]">Stripe</span>
                  <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] bg-white/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Global
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
                  Pasarela internacional confiable. Acepta cobros con tarjetas globales y depósitos automatizados a tu cuenta bancaria.
                </p>
                {preferredGateway === 'stripe' && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </button>
            </div>

            {/* Formulario Dinámico según Pasarela */}
            <AnimatePresence mode="wait">
              {preferredGateway === 'openpay' ? (
                <motion.div
                  key="openpay-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 p-5 rounded-2xl bg-white/5 border border-white/10"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider">Credenciales de OpenPay</span>
                    </div>
                    
                    {/* Sandbox Mode Toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--color-text-tertiary)] font-medium">
                        {openpaySandboxMode ? 'Modo Pruebas (Sandbox)' : 'Modo Producción'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenpaySandboxMode(!openpaySandboxMode)}
                        className={`relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer ${
                          openpaySandboxMode ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                          openpaySandboxMode ? 'translate-x-0' : 'translate-x-4'
                        }`} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label htmlFor="openpayMerchantId" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        ID de Comercio (Merchant ID)
                      </label>
                      <input
                        id="openpayMerchantId"
                        type="text"
                        value={openpayMerchantId}
                        onChange={(e) => setOpenpayMerchantId(e.target.value.trim())}
                        className={inputClass}
                        placeholder="Ej: mxxxxxxxxxxxxxxxxxxx"
                        style={{ fontSize: '16px' }}
                      />
                      <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                        Tu identificador único de comercio de OpenPay.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="openpayPublicKey" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        Llave Pública (Public Key)
                      </label>
                      <input
                        id="openpayPublicKey"
                        type="password"
                        value={openpayPublicKey}
                        onChange={(e) => setOpenpayPublicKey(e.target.value.trim())}
                        className={inputClass}
                        placeholder="Ej: pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        style={{ fontSize: '16px' }}
                      />
                      <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                        Comienza con <code className="bg-white/10 px-1 rounded">pk_</code>.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="openpayPrivateKey" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        Llave Privada (Private Key)
                      </label>
                      <input
                        id="openpayPrivateKey"
                        type="password"
                        value={openpayPrivateKey}
                        onChange={(e) => setOpenpayPrivateKey(e.target.value.trim())}
                        className={inputClass}
                        placeholder="Ej: sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        style={{ fontSize: '16px' }}
                      />
                      <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                        Comienza con <code className="bg-white/10 px-1 rounded">sk_</code>. Nunca compartas esta llave.
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="stripe-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 p-5 rounded-2xl bg-white/5 border border-white/10"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                      <span className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider">Credenciales de Stripe</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label htmlFor="stripePublishableKey" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        Llave Pública / Publicable (Publishable Key)
                      </label>
                      <input
                        id="stripePublishableKey"
                        type="text"
                        value={stripePublishableKey}
                        onChange={(e) => setStripePublishableKey(e.target.value.trim())}
                        className={inputClass}
                        placeholder="Ej: pk_live_..."
                        style={{ fontSize: '16px' }}
                      />
                      <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                        Comienza con <code className="bg-white/10 px-1 rounded">pk_</code>.
                      </p>
                    </div>

                    <div className="relative">
                      <label htmlFor="stripeSecretKey" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        Llave Secreta (Secret Key)
                      </label>
                      <div className="relative">
                        <input
                           id="stripeSecretKey"
                           type={showSecret ? "text" : "password"}
                           value={stripeSecretKey}
                           onChange={(e) => setStripeSecretKey(e.target.value.trim())}
                           className={`${inputClass} pr-10`}
                           placeholder="Ej: sk_live_..."
                           style={{ fontSize: '16px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecret(!showSecret)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer bg-transparent border-0 outline-none"
                        >
                          <span className={showSecret ? "ti ti-eye-off" : "ti ti-eye"} />
                        </button>
                      </div>
                      <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                        Comienza con <code className="bg-white/10 px-1 rounded">sk_</code>. Nunca compartas esta llave.
                      </p>
                    </div>

                    <div className="relative">
                      <label htmlFor="stripeWebhookSecret" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        Secreto de Webhook (Webhook Secret)
                      </label>
                      <div className="relative">
                        <input
                           id="stripeWebhookSecret"
                           type={showWebhookSecret ? "text" : "password"}
                           value={stripeWebhookSecret}
                           onChange={(e) => setStripeWebhookSecret(e.target.value.trim())}
                           className={`${inputClass} pr-10`}
                           placeholder="Ej: whsec_..."
                           style={{ fontSize: '16px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer bg-transparent border-0 outline-none"
                        >
                          <span className={showWebhookSecret ? "ti ti-eye-off" : "ti ti-eye"} />
                        </button>
                      </div>
                      <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                        Comienza con <code className="bg-white/10 px-1 rounded">whsec_</code>. Opcional.
                      </p>
                    </div>

                    <div className="md:col-span-2 flex items-start gap-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-600 dark:text-indigo-400">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <p className="leading-relaxed">
                        Encuentra tus llaves en el Dashboard de Stripe &rarr; Developers &rarr; API Keys. Para el secreto de webhook, crea un endpoint en Stripe apuntando a: <code className="bg-white/15 dark:bg-black/20 px-1 py-0.5 rounded select-all">https://vivero.botaniq.com.mx/functions/v1/stripe-webhook</code>
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Accordion>
    </div>
  );
}
