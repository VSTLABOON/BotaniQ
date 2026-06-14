import { useState, useEffect, useMemo } from 'react';
import { useCartStore } from '../../store/cartStore.ts';
import { useTenant } from '../../context/TenantContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { initiateStripeCheckout, initiateOpenpayCheckout } from '../../services/checkoutService.ts';
import { createGuestOrder } from '../../services/orderService.ts';
import { ShoppingCart, MessageCircle, Copy, Check, CreditCard, Landmark, DollarSign, Download } from 'lucide-react';
import { UI_COLORS } from '../../lib/constants.ts';
import { toast } from '../../store/toastStore.ts';
import { logger } from '../../lib/logger';
import { PedidoEnvioSchema } from '../../lib/schemas.ts';
import { loadStripe } from '@stripe/stripe-js';

export default function CartDrawer() {
  const items = useCartStore((s) => s.items);
  const isOpen = useCartStore((s) => s.isOpen);
  const openCart = useCartStore((s) => s.openCart);
  const closeCart = useCartStore((s) => s.closeCart);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getItemCount = useCartStore((s) => s.getItemCount);
  const { tenant } = useTenant();
  const { profile } = useAuth();

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '', telefono: '', fecha: '', direccion: '',
    destinatario: '', notas: '', mensaje: '', zonaEnvio: ''
  });

  // OpenPay payment states
  const [openpayLoaded, setOpenpayLoaded] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card'); // 'card' | 'spei' | 'store'
  const [email, setEmail] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpMonth, setCardExpMonth] = useState('');
  const [cardExpYear, setCardExpYear] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [openpayInstructions, setOpenpayInstructions] = useState(null);
  const [copied, setCopied] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const zones = tenant.zonas_envio || [];
  const hasZones = zones.length > 0;
  const selectedZone = hasZones ? zones.find(z => z.nombre === formData.zonaEnvio) : null;
  const shippingCost = selectedZone ? selectedZone.costo : (hasZones ? 0 : (tenant.envio_costo || 0));

  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        nombre: prev.nombre || profile.nombre || '',
        telefono: prev.telefono || profile.telefono || '',
        direccion: prev.direccion || profile.direccion || '',
      }));
    }
  }, [profile]);

  useEffect(() => {
    if (profile && profile.email) {
      setEmail(profile.email);
    }
  }, [profile]);

  useEffect(() => {
    const isPreferredOpenpay = tenant.preferred_gateway === 'openpay' || !tenant.preferred_gateway;
    if (tenant.subscription_level >= 2 && isPreferredOpenpay) {
      if (window.OpenPay) {
        setOpenpayLoaded(true);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://openpay.s3.amazonaws.com/openpay.v1.min.js';
      script.async = true;
      script.onload = () => {
        const dataScript = document.createElement('script');
        dataScript.src = 'https://openpay.s3.amazonaws.com/openpay-data.v1.min.js';
        dataScript.async = true;
        dataScript.onload = () => {
          setOpenpayLoaded(true);
        };
        dataScript.onerror = () => logger.error("Error al cargar OpenPay Antifraud JS");
        document.body.appendChild(dataScript);
      };
      script.onerror = () => logger.error("Error al cargar OpenPay SDK JS");
      document.body.appendChild(script);
    }
  }, [tenant.subscription_level, tenant.preferred_gateway]);

  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  useEffect(() => {
    if (!formData.fecha) setFormData(p => ({ ...p, fecha: minDate }));
  }, [minDate, formData.fecha]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'mensaje' && value.length > 160) return;
    setFormData(p => ({ ...p, [name]: value }));
    if (validationErrors[name]) {
      setValidationErrors(p => {
        const copy = { ...p };
        delete copy[name];
        return copy;
      });
    }
  };

  // Valida que el número de WhatsApp sea real (no el fallback)
  const isWhatsAppConfigured = tenant.whatsapp && tenant.whatsapp !== '0000000000' && /^\d{10,15}$/.test(tenant.whatsapp.replace(/\D/g, ''));

  const handleWhatsApp = async (e) => {
    e.preventDefault();
    if (!items.length) return toast.error("Tu carrito está vacío.");
    if (!isWhatsAppConfigured) {
      return toast.error('Esta tienda aún no ha configurado su WhatsApp. Intenta más tarde.');
    }
    const { nombre, fecha, direccion, destinatario, telefono, notas, mensaje } = formData;

    const errors = {};
    if (!nombre.trim()) {
      errors.nombre = 'El nombre del comprador es obligatorio.';
    }

    if (hasZones && !formData.zonaEnvio) {
      errors.zonaEnvio = 'Debes seleccionar una zona de envío.';
    }

    const shippingData = {
      recipientName: destinatario,
      recipientPhone: telefono,
      deliveryAddress: direccion,
      deliveryDate: fecha,
      customMessage: mensaje,
      zonaEnvio: formData.zonaEnvio || undefined,
    };

    const validation = PedidoEnvioSchema.safeParse(shippingData);
    if (!validation.success) {
      validation.error.issues.forEach(issue => {
        const path = issue.path[0];
        let fieldName = path;
        if (path === 'recipientName') fieldName = 'destinatario';
        if (path === 'recipientPhone') fieldName = 'telefono';
        if (path === 'deliveryAddress') fieldName = 'direccion';
        if (path === 'deliveryDate') fieldName = 'fecha';
        if (path === 'customMessage') fieldName = 'mensaje';
        errors[fieldName] = issue.message;
      });
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    const validatedShipping = validation.data;

    // ── 1. Registrar pedido en Supabase (estado: pendiente) ──────
    // Esto garantiza que el dueño vea el pedido en su dashboard
    // incluso si el cliente no completa la conversación por WhatsApp.
    let orderId = null;
    try {
      const subtotal = getSubtotal();
      const result = await createGuestOrder(
        {
          items,
          subtotal,
          shippingData: null,
          shippingCost,
          total: subtotal + shippingCost,
        },
        validatedShipping,
        tenant.id
      );
      orderId = result.orderId;
      logger.info('[CartDrawer] Pedido WhatsApp registrado:', orderId);
    } catch (err) {
      // Si falla el registro, seguimos con WhatsApp igualmente
      // El dueño recibirá los datos vía mensaje de texto
      logger.warn('[CartDrawer] No se pudo registrar pedido en BD:', err.message);
    }

    // ── 2. Construir mensaje de WhatsApp ─────────────────────────
    const subtotal = getSubtotal();
    const [y,m,d] = validatedShipping.deliveryDate.split('-');
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const lines = ['Hola! Quiero hacer un pedido:','','-- Arreglos --'];
    items.forEach((it,i) => lines.push(`${i+1}. ${it.name} — ${it.variantName} x${it.quantity} ($${it.unitPrice*it.quantity})`));
    lines.push('',`Total: $${subtotal + shippingCost} MXN`,'',
      `Entrega: ${Number(d)} de ${meses[Number(m)-1]} de ${y}`,
      `Dirección: ${validatedShipping.deliveryAddress}`);
    
    if (formData.zonaEnvio) {
      lines.push(`Zona de envío: ${formData.zonaEnvio} ($${shippingCost} MXN)`);
    }
    
    lines.push(`Quién pide: ${nombre}`, `Para: ${validatedShipping.recipientName}`);
    if (notas) lines.push(`Notas: ${notas}`);
    if (validatedShipping.customMessage) lines.push(`Tarjeta: "${validatedShipping.customMessage}"`);
    if (orderId) lines.push('', `ID de pedido: ${orderId.slice(0, 8).toUpperCase()}`);
    lines.push('','¡Gracias!');

    // ── 3. Abrir WhatsApp y limpiar carrito ──────────────────────
    const cleanNumber = tenant.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
    if (orderId) {
      clearCart();
      toast.success('¡Pedido registrado! Confirma por WhatsApp.');
    }
  };

  const handleCheckout = async () => {
    if (!items.length) return;

    const { nombre, fecha, direccion, destinatario, telefono, notas, mensaje } = formData;

    const errors = {};
    if (!nombre.trim()) {
      errors.nombre = 'El nombre del comprador es obligatorio.';
    }

    if (hasZones && !formData.zonaEnvio) {
      errors.zonaEnvio = 'Debes seleccionar una zona de envío.';
    }

    const isPreferredOpenpay = tenant.preferred_gateway === 'openpay' || !tenant.preferred_gateway;

    if (isPreferredOpenpay) {
      if (!email.trim()) {
        errors.email = 'El correo electrónico es obligatorio para cobros en línea.';
      }
      if (paymentMethod === 'card') {
        if (!cardHolder.trim()) errors.cardHolder = 'El titular es requerido.';
        if (!cardNumber.trim()) errors.cardNumber = 'El número de tarjeta es requerido.';
        if (!cardExpMonth.trim()) errors.cardExpMonth = 'Mes requerido.';
        if (!cardExpYear.trim()) errors.cardExpYear = 'Año requerido.';
        if (!cardCvv.trim()) errors.cardCvv = 'CVV requerido.';
      }
    }

    const shippingData = {
      recipientName: destinatario,
      recipientPhone: telefono,
      deliveryAddress: direccion,
      deliveryDate: fecha,
      customMessage: mensaje,
      zonaEnvio: formData.zonaEnvio || undefined,
    };

    const validation = PedidoEnvioSchema.safeParse(shippingData);
    if (!validation.success) {
      validation.error.issues.forEach(issue => {
        const path = issue.path[0];
        let fieldName = path;
        if (path === 'recipientName') fieldName = 'destinatario';
        if (path === 'recipientPhone') fieldName = 'telefono';
        if (path === 'deliveryAddress') fieldName = 'direccion';
        if (path === 'deliveryDate') fieldName = 'fecha';
        if (path === 'customMessage') fieldName = 'mensaje';
        errors[fieldName] = issue.message;
      });
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    const validatedShipping = validation.data;

    setCheckoutLoading(true); setCheckoutError(null); setCheckoutResult(null); setOpenpayInstructions(null);
    try {
      let tokenId = null;
      let deviceSessionId = null;

      if (isPreferredOpenpay) {
        if (!window.OpenPay) {
          throw new Error("El SDK de OpenPay no se cargó correctamente. Por favor recarga.");
        }

        // Configurar credenciales del SDK de OpenPay en el cliente
        window.OpenPay.setId(tenant.openpay_merchant_id);
        window.OpenPay.setApiKey(tenant.openpay_public_key);
        window.OpenPay.setSandboxMode(tenant.openpay_sandbox_mode ?? true);

        // Generar device_data (antifraude)
        deviceSessionId = window.OpenPay.deviceData.setup();

        if (paymentMethod === 'card') {
          // Tokenizar tarjeta
          tokenId = await new Promise((resolve, reject) => {
            const expMonth2Digits = cardExpMonth.padStart(2, '0');
            const expYear2Digits = cardExpYear.slice(-2); // OpenPay espera 2 dígitos para el año

            window.OpenPay.token.create({
              "card_number": cardNumber.replace(/\s+/g, ''),
              "holder_name": cardHolder.trim(),
              "expiration_year": expYear2Digits,
              "expiration_month": expMonth2Digits,
              "cvv2": cardCvv.trim()
            }, 
            (response) => {
              resolve(response.data.id);
            }, 
            (error) => {
              console.error("Error OpenPay Tokenize:", error);
              reject(new Error(error.data.description || "Error al validar la tarjeta con OpenPay. Verifique sus datos."));
            });
          });
        }
      }

      // ── 1. Crear pedido en BD con datos de envío (estado: pendiente_pago) ──
      const subtotal = getSubtotal();
      const result = await createGuestOrder(
        {
          items,
          subtotal,
          shippingData: null,
          shippingCost,
          total: subtotal + shippingCost,
        },
        validatedShipping,
        tenant.id
      );

      logger.info('[CartDrawer] Pedido pre-pago creado:', result.orderId);

      // ── 2. Construir payload seguro: SOLO IDs y cantidades (Price Hardening) ──
      const checkoutItems = items.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId || null,
        quantity: item.quantity,
      }));

      const currentUrl = window.location.origin;
      const successUrl = `${currentUrl}?checkout=success&order=${result.orderId}`;
      const cancelUrl = `${currentUrl}?checkout=cancel&order=${result.orderId}`;

      // ── 3. Llamar a la Edge Function correspondientes ──
      if (isPreferredOpenpay) {
        const responseData = await initiateOpenpayCheckout({
          tenantId: tenant.id,
          items: checkoutItems,
          successUrl,
          cancelUrl,
          orderId: result.orderId,
          paymentMethodType: paymentMethod,
          deviceData: deviceSessionId,
          tokenId: tokenId,
          customer: {
            name: nombre,
            email: email.trim(),
            phone: telefono || '5500000000'
          }
        });

        if (paymentMethod === 'card') {
          // Redirigir para 3D Secure
          if (responseData.redirect_url) {
            window.location.href = responseData.redirect_url;
          } else {
            // Pago directo aprobado (si no requirió 3DS)
            clearCart();
            setCheckoutResult({ success: true, orderId: result.orderId });
            toast.success("¡Pago aprobado! Tu pedido ha sido confirmado.");
          }
        } else {
          // SPEI o Tienda (OXXO/Paynet)
          clearCart();
          setOpenpayInstructions({
            method: paymentMethod,
            clabe: responseData.clabe,
            bank: responseData.bank,
            reference: responseData.reference,
            barcode_url: responseData.barcode_url,
            pdf_url: responseData.pdf_url,
            amount: subtotal + shippingCost,
            orderId: result.orderId
          });
          toast.success("¡Instrucciones de pago generadas con éxito!");
        }
      } else {
        // Stripe Checkout
        const stripeUrl = await initiateStripeCheckout({
          tenantId: tenant.id,
          items: checkoutItems,
          successUrl,
          cancelUrl,
          orderId: result.orderId,
        });
        window.location.href = stripeUrl;
      }
    } catch (err) {
      const errorMsg = err.message || 'Error al procesar el pago';
      setCheckoutError(errorMsg);
      toast.error(errorMsg);
    } finally { setCheckoutLoading(false); }
  };

  const stripePromise = useMemo(() => {
    return tenant?.stripe_publishable_key ? loadStripe(tenant.stripe_publishable_key) : null;
  }, [tenant?.stripe_publishable_key]);

  const itemCount = getItemCount();
  const subtotal = getSubtotal();
  const INPUT = "w-full bg-negro border border-white/10 rounded-lg px-4 py-2.5 text-[var(--color-background-primary)] text-sm focus:outline-none focus:border-verde focus:ring-1 focus:ring-verde transition-all";
  const LABEL = "text-[0.75rem] font-semibold text-[var(--color-background-primary)]/60 uppercase tracking-wider";

  // Feature flags derived from subscription_level (DB source of truth)
  // Nivel 1: WhatsApp only | Nivel 2+: Stripe Checkout + WhatsApp
  const hasSubscriptionForCheckout = tenant.subscription_level >= 2; // Nivel 2 = PRO
  const isPreferredStripe = tenant.preferred_gateway === 'stripe';
  const isPreferredOpenpay = tenant.preferred_gateway === 'openpay' || !tenant.preferred_gateway;

  const isStripeConfigured = !!tenant.stripe_publishable_key;
  const isOpenpayConfigured = !!(tenant.openpay_public_key && tenant.openpay_merchant_id);

  const isGatewayConfigured = isPreferredStripe ? isStripeConfigured : isOpenpayConfigured;

  const enableCheckout = hasSubscriptionForCheckout && isGatewayConfigured;
  const enableWhatsApp = true; // WhatsApp is always available
  const isCheckoutMode = enableCheckout;
  const FabIcon = isCheckoutMode ? ShoppingCart : MessageCircle;
  const fabAriaLabel = isCheckoutMode ? "Ir al checkout" : "Contactar por WhatsApp";

  return (
    <>
      {/* FAB */}
      <button onClick={openCart} aria-label={fabAriaLabel}
        aria-expanded={isOpen} aria-controls="cart-drawer"
        className={`fixed bottom-6 right-6 z-[8900] w-[60px] h-[60px] rounded-full bg-verde text-[var(--color-background-primary)] shadow-lg-custom flex items-center justify-center transition-transform duration-300 hover:scale-110 ${itemCount > 0 ? 'animate-bounce' : ''}`}>
        <FabIcon className="w-6 h-6" strokeWidth={2} />
        {itemCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-rosa text-[var(--color-background-primary)] text-[0.7rem] font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-negro">
            <span aria-live="polite" aria-atomic="true">{itemCount}</span>
          </div>
        )}
      </button>

      {/* Backdrop */}
      <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[9990] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={closeCart} aria-hidden="true" />

      {/* Drawer */}
      <aside id="cart-drawer" role="region" aria-label="Carrito de compras"
        className={`fixed top-0 right-0 h-full w-full max-w-[420px] bg-negro/90 backdrop-blur-2xl border-l border-white/5 z-[9991] flex flex-col shadow-2xl transition-transform duration-500 ease-spring ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3 text-[var(--color-background-primary)]">
            <ShoppingCart className="w-5 h-5 shrink-0" />
            <span className="font-display text-xl font-bold">Tu Pedido</span>
            {itemCount > 0 && <span className="text-xs bg-verde/20 text-verde-light px-2 py-0.5 rounded-full font-semibold">{itemCount}</span>}
          </div>
          <button onClick={closeCart} aria-label="Cerrar" className="text-[var(--color-background-primary)]/50 hover:text-[var(--color-background-primary)] transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-6 flex flex-col gap-6">
          {openpayInstructions ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 animate-fade-up text-[var(--color-background-primary)] flex flex-col gap-4">
              <h4 className="text-emerald-400 font-bold text-sm uppercase tracking-wider flex items-center gap-1.5 justify-center">
                {openpayInstructions.method === 'spei' ? <Landmark className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                {openpayInstructions.method === 'spei' ? 'Pago SPEI Pendiente' : 'Ficha de Pago Pendiente'}
              </h4>
              <p className="text-[11px] text-[var(--color-background-primary)]/80 text-center leading-relaxed">
                {openpayInstructions.method === 'spei' 
                  ? 'Realiza la transferencia desde tu banca móvil para completar tu pedido. El inventario se liberará si no se liquida en 24 horas.' 
                  : 'Acude a cualquier establecimiento afiliado (Paynet, OXXO, etc.) a realizar tu pago en efectivo.'}
              </p>

              {openpayInstructions.method === 'spei' ? (
                <div className="space-y-3 bg-black/30 p-4 rounded-xl border border-white/5 font-mono text-[11px]">
                  <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
                    <span className="text-[var(--color-background-primary)]/40">Banco</span>
                    <span className="font-bold text-white">{openpayInstructions.bank}</span>
                  </div>
                  <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
                    <span className="text-[var(--color-background-primary)]/40">CLABE</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white select-all">{openpayInstructions.clabe}</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          navigator.clipboard.writeText(openpayInstructions.clabe);
                          toast.success("¡CLABE copiada!");
                        }}
                        className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
                    <span className="text-[var(--color-background-primary)]/40">Referencia</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white select-all">{openpayInstructions.reference}</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          navigator.clipboard.writeText(openpayInstructions.reference);
                          toast.success("¡Referencia copiada!");
                        }}
                        className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center font-sans mt-2 pt-1 border-t border-white/10 text-xs">
                    <span className="text-[var(--color-background-primary)]/50">Monto a Pagar</span>
                    <span className="font-bold text-emerald-400 font-display text-sm">${openpayInstructions.amount} MXN</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-black/30 p-4 rounded-xl border border-white/5 text-center flex flex-col items-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[10px] text-[var(--color-background-primary)]/40 uppercase tracking-widest">Referencia de Pago</span>
                    <span className="font-mono font-bold text-sm text-white tracking-widest select-all">{openpayInstructions.reference}</span>
                    <button 
                      type="button" 
                      onClick={() => {
                        navigator.clipboard.writeText(openpayInstructions.reference);
                        toast.success("¡Referencia copiada!");
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copiar Referencia
                    </button>
                  </div>

                  {openpayInstructions.barcode_url && (
                    <div className="bg-white p-2.5 rounded-lg inline-block my-2">
                      <img src={openpayInstructions.barcode_url} alt="Código de barras Paynet" className="max-w-[200px] h-auto mx-auto" />
                    </div>
                  )}

                  {openpayInstructions.pdf_url && (
                    <div className="pt-2">
                      <a 
                        href={openpayInstructions.pdf_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Descargar PDF
                      </a>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xs mt-2 pt-2 border-t border-white/10 w-full">
                    <span className="text-[var(--color-background-primary)]/50">Monto a Pagar</span>
                    <span className="font-bold text-emerald-400 font-display text-sm">${openpayInstructions.amount} MXN</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setOpenpayInstructions(null)}
                className="mt-4 w-full py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-[var(--color-background-primary)] font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Volver al carrito
              </button>
            </div>
          ) : (
            <>
              {/* Items con [−] qty [+] */}
              <div className="flex flex-col gap-3">
                {items.length === 0 ? (
                  <p className="text-texto-muted text-sm text-center py-6">Tu carrito está vacío</p>
                ) : items.map((item) => (
                  <div key={item.cartItemId} className="flex items-center gap-3 bg-[var(--color-background-primary)]/5 p-3 rounded-xl border border-white/5">
                    {item.image && <img src={item.image} alt={item.name} className="w-14 h-14 object-cover rounded-lg bg-crema-dark shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[var(--color-background-primary)] text-sm truncate">{item.name}</p>
                      <p className="text-rosa text-xs">{item.variantName}</p>
                      <p className="text-verde-light text-xs font-semibold mt-0.5">${item.unitPrice * item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                        className="w-7 h-7 rounded-lg bg-[var(--color-background-primary)]/10 text-[var(--color-background-primary)]/60 hover:text-[var(--color-background-primary)] hover:bg-[var(--color-background-primary)]/20 flex items-center justify-center text-sm font-bold transition-colors" aria-label="Reducir">−</button>
                      <span className="w-7 text-center text-[var(--color-background-primary)] text-sm font-semibold tabular-nums">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                        className="w-7 h-7 rounded-lg bg-[var(--color-background-primary)]/10 text-[var(--color-background-primary)]/60 hover:text-[var(--color-background-primary)] hover:bg-[var(--color-background-primary)]/20 flex items-center justify-center text-sm font-bold transition-colors" aria-label="Aumentar">+</button>
                    </div>
                    <button onClick={() => removeItem(item.cartItemId)} className="p-1.5 text-[var(--color-background-primary)]/30 hover:text-rosa hover:bg-rosa/10 rounded-lg transition-colors" aria-label="Quitar">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Form */}
              <form id="carrito-form" onSubmit={handleWhatsApp} className="flex flex-col gap-5 mt-2" noValidate>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="cd-nombre" className={LABEL}>Tu nombre *</label>
                    <input type="text" id="cd-nombre" name="nombre" value={formData.nombre} onChange={handleChange} required placeholder="María González" className={INPUT} />
                    {validationErrors.nombre && <p className="text-[11px] text-rosa mt-0.5 animate-fade-up">{validationErrors.nombre}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="cd-fecha" className={LABEL}>Fecha entrega *</label>
                    <input type="date" id="cd-fecha" name="fecha" value={formData.fecha} min={minDate} onChange={handleChange} required className={`${INPUT} [color-scheme:dark]`} />
                    {validationErrors.fecha && <p className="text-[11px] text-rosa mt-0.5 animate-fade-up">{validationErrors.fecha}</p>}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cd-direccion" className={LABEL}>Dirección de entrega *</label>
                  <input type="text" id="cd-direccion" name="direccion" value={formData.direccion} onChange={handleChange} required placeholder="Calle, número, colonia" className={INPUT} />
                  {validationErrors.direccion && <p className="text-[11px] text-rosa mt-0.5 animate-fade-up">{validationErrors.direccion}</p>}
                </div>
                {hasZones && (
                  <div className="flex flex-col gap-1.5 animate-fade-up">
                    <label htmlFor="cd-zonaEnvio" className={LABEL}>Zona de envío *</label>
                    <select
                      id="cd-zonaEnvio"
                      name="zonaEnvio"
                      value={formData.zonaEnvio}
                      onChange={handleChange}
                      required
                      className={INPUT}
                    >
                      <option value="" disabled className="text-white/40">-- Selecciona tu zona de envío --</option>
                      {zones.map((z, idx) => (
                        <option key={idx} value={z.nombre} className="bg-negro text-white">
                          {z.nombre} (${z.costo} MXN)
                        </option>
                      ))}
                    </select>
                    {validationErrors.zonaEnvio && <p className="text-[11px] text-rosa mt-0.5 animate-fade-up">{validationErrors.zonaEnvio}</p>}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="cd-destinatario" className={LABEL}>¿Para quién? *</label>
                    <input type="text" id="cd-destinatario" name="destinatario" value={formData.destinatario} onChange={handleChange} required placeholder="Nombre de quien recibe" className={INPUT} />
                    {validationErrors.destinatario && <p className="text-[11px] text-rosa mt-0.5 animate-fade-up">{validationErrors.destinatario}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="cd-telefono" className={LABEL}>Teléfono *</label>
                    <input type="tel" id="cd-telefono" name="telefono" value={formData.telefono} onChange={handleChange} placeholder="81 1234 5678" className={INPUT} />
                    {validationErrors.telefono && <p className="text-[11px] text-rosa mt-0.5 animate-fade-up">{validationErrors.telefono}</p>}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cd-notes" className={LABEL}>Preferencias <span className="text-[var(--color-background-primary)]/30 lowercase normal-case">(opcional)</span></label>
                  <input type="text" id="cd-notes" name="notas" value={formData.notas} onChange={handleChange} placeholder="Ej: Rosas rojas..." className={INPUT} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-end">
                    <label htmlFor="cd-mensaje" className={LABEL}>Mensaje tarjeta <span className="text-[var(--color-background-primary)]/30 lowercase normal-case">(opcional)</span></label>
                    <span className={`text-xs ${formData.mensaje.length > 130 ? 'text-rosa' : 'text-[var(--color-background-primary)]/30'}`}>{formData.mensaje.length}/160</span>
                  </div>
                  <textarea id="cd-mensaje" name="mensaje" value={formData.mensaje} onChange={handleChange} rows="2" placeholder="Con todo mi amor…" maxLength="160" className={`${INPUT} resize-none`} />
                  {validationErrors.mensaje && <p className="text-[11px] text-rosa mt-0.5 animate-fade-up">{validationErrors.mensaje}</p>}
                </div>

                {/* Si cobros en línea están habilitados y la pasarela preferida es OpenPay */}
                {enableCheckout && isPreferredOpenpay && (
                  <div className="border-t border-white/10 pt-4 flex flex-col gap-4 animate-fade-up">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="cd-email" className={LABEL}>Tu correo electrónico *</label>
                      <input
                        type="email"
                        id="cd-email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="correo@ejemplo.com"
                        className={INPUT}
                      />
                      {validationErrors.email && <p className="text-[11px] text-rosa mt-0.5 animate-fade-up">{validationErrors.email}</p>}
                      <p className="text-[10px] text-[var(--color-background-primary)]/40">
                        Necesario para enviar tus comprobantes y detalles de pago.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className={LABEL}>Método de Pago en Línea *</label>
                      <div className="grid grid-cols-3 gap-2">
                        {/* Tarjeta */}
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('card')}
                          className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border text-[10px] font-bold uppercase transition-all cursor-pointer ${
                            paymentMethod === 'card'
                              ? 'bg-verde text-black border-verde'
                              : 'bg-transparent text-[var(--color-background-primary)]/60 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <CreditCard className="w-4 h-4 mb-1" /> Tarjeta
                        </button>
                        {/* SPEI */}
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('spei')}
                          className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border text-[10px] font-bold uppercase transition-all cursor-pointer ${
                            paymentMethod === 'spei'
                              ? 'bg-verde text-black border-verde'
                              : 'bg-transparent text-[var(--color-background-primary)]/60 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <Landmark className="w-4 h-4 mb-1" /> SPEI
                        </button>
                        {/* Paynet / Cash */}
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('store')}
                          className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border text-[10px] font-bold uppercase transition-all cursor-pointer ${
                            paymentMethod === 'store'
                              ? 'bg-verde text-black border-verde'
                              : 'bg-transparent text-[var(--color-background-primary)]/60 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <DollarSign className="w-4 h-4 mb-1" /> Efectivo
                        </button>
                      </div>
                    </div>

                    {/* Formulario de Tarjeta */}
                    {paymentMethod === 'card' && (
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3 animate-fade-up">
                        <div className="flex flex-col gap-1">
                          <label htmlFor="cardHolder" className={LABEL}>Titular de la Tarjeta</label>
                          <input
                            type="text"
                            id="cardHolder"
                            value={cardHolder}
                            onChange={(e) => {
                              setCardHolder(e.target.value);
                              if (validationErrors.cardHolder) {
                                setValidationErrors(p => { const copy = {...p}; delete copy.cardHolder; return copy; });
                              }
                            }}
                            placeholder="Nombre impreso"
                            className={INPUT}
                          />
                          {validationErrors.cardHolder && <p className="text-[11px] text-rosa mt-0.5 animate-fade-up">{validationErrors.cardHolder}</p>}
                        </div>
                        <div className="flex flex-col gap-1">
                          <label htmlFor="cardNumber" className={LABEL}>Número de Tarjeta</label>
                          <input
                            type="text"
                            id="cardNumber"
                            value={cardNumber}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '').substring(0, 16);
                              const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
                              setCardNumber(formatted);
                              if (validationErrors.cardNumber) {
                                setValidationErrors(p => { const copy = {...p}; delete copy.cardNumber; return copy; });
                              }
                            }}
                            placeholder="0000 0000 0000 0000"
                            className={INPUT}
                          />
                          {validationErrors.cardNumber && <p className="text-[11px] text-rosa mt-0.5 animate-fade-up">{validationErrors.cardNumber}</p>}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col gap-1">
                            <label htmlFor="cardExpMonth" className={LABEL}>Mes (MM)</label>
                            <input
                              type="text"
                              id="cardExpMonth"
                              value={cardExpMonth}
                              onChange={(e) => {
                                setCardExpMonth(e.target.value.replace(/\D/g, '').substring(0, 2));
                                if (validationErrors.cardExpMonth) {
                                  setValidationErrors(p => { const copy = {...p}; delete copy.cardExpMonth; return copy; });
                                }
                              }}
                              placeholder="12"
                              className={INPUT}
                            />
                            {validationErrors.cardExpMonth && <p className="text-[10px] text-rosa mt-0.5 animate-fade-up">{validationErrors.cardExpMonth}</p>}
                          </div>
                          <div className="flex flex-col gap-1">
                            <label htmlFor="cardExpYear" className={LABEL}>Año (AA)</label>
                            <input
                              type="text"
                              id="cardExpYear"
                              value={cardExpYear}
                              onChange={(e) => {
                                setCardExpYear(e.target.value.replace(/\D/g, '').substring(0, 2));
                                if (validationErrors.cardExpYear) {
                                  setValidationErrors(p => { const copy = {...p}; delete copy.cardExpYear; return copy; });
                                }
                              }}
                              placeholder="28"
                              className={INPUT}
                            />
                            {validationErrors.cardExpYear && <p className="text-[10px] text-rosa mt-0.5 animate-fade-up">{validationErrors.cardExpYear}</p>}
                          </div>
                          <div className="flex flex-col gap-1">
                            <label htmlFor="cardCvv" className={LABEL}>CVV</label>
                            <input
                              type="password"
                              id="cardCvv"
                              value={cardCvv}
                              onChange={(e) => {
                                setCardCvv(e.target.value.replace(/\D/g, '').substring(0, 4));
                                if (validationErrors.cardCvv) {
                                  setValidationErrors(p => { const copy = {...p}; delete copy.cardCvv; return copy; });
                                }
                              }}
                              placeholder="123"
                              className={INPUT}
                            />
                            {validationErrors.cardCvv && <p className="text-[10px] text-rosa mt-0.5 animate-fade-up">{validationErrors.cardCvv}</p>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        {!openpayInstructions && (
          <div className="p-6 border-t border-white/5 bg-negro shrink-0 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5 mb-1">
            <div className="flex justify-between items-center text-[var(--color-background-primary)]">
              <span className="text-xs text-[var(--color-background-primary)]/40">Subtotal</span>
              <span className="text-sm text-[var(--color-background-primary)]/70">${subtotal}</span>
            </div>
            {hasZones ? (
              <div className="flex justify-between items-center text-[var(--color-background-primary)]">
                <span className="text-xs text-[var(--color-background-primary)]/40">
                  Envío {selectedZone ? `(${selectedZone.nombre})` : ''}
                </span>
                <span className="text-sm text-[var(--color-background-primary)]/70">
                  {selectedZone ? `$${selectedZone.costo}` : 'Selecciona una zona'}
                </span>
              </div>
            ) : (
              (tenant.envio_costo > 0) && (
                <div className="flex justify-between items-center text-[var(--color-background-primary)]">
                  <span className="text-xs text-[var(--color-background-primary)]/40">Envío</span>
                  <span className="text-sm text-[var(--color-background-primary)]/70">${tenant.envio_costo}</span>
                </div>
              )
            )}
            <div className="h-px bg-white/5 my-1" />
            <div className="flex justify-between items-center text-[var(--color-background-primary)]">
              <span className="text-sm font-semibold text-[var(--color-background-primary)]/60">Total</span>
              <span className="font-display text-2xl font-bold text-verde">${subtotal + shippingCost}</span>
            </div>
          </div>
          {checkoutResult?.success && (
            <div className="bg-verde/10 border border-verde/20 rounded-2xl p-4 text-center animate-fade-up mb-2">
              <p className="text-verde-light font-bold text-[1rem] mb-1">¡Pedido confirmado!</p>
              <p className="text-[var(--color-background-primary)]/60 text-[0.75rem] font-mono">{checkoutResult.orderId}</p>
            </div>
          )}
          {checkoutError && (
            <div className="bg-rosa/10 border border-rosa/20 rounded-2xl p-3 text-center animate-fade-up mb-2">
              <p className="text-rosa text-[0.8rem]">{checkoutError}</p>
            </div>
          )}

          {enableCheckout ? (
            <button type="button" disabled={!items.length || checkoutLoading} onClick={handleCheckout}
              className="w-full flex items-center justify-center gap-2.5 bg-verde hover:bg-verde-light disabled:bg-[var(--color-background-primary)]/10 disabled:text-[var(--color-background-primary)]/30 text-[var(--color-background-primary)] rounded-xl py-3.5 font-bold text-[0.85rem] tracking-[0.04em] transition-all duration-300 ease-spring hover:scale-[1.02] disabled:hover:scale-100">
              {checkoutLoading ? (<><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeLinecap="round"/></svg>Procesando...</>)
              : (<><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Pagar ahora</>)}
            </button>
          ) : (
            hasSubscriptionForCheckout && (
              <div className="w-full text-center py-3.5 px-4 rounded-xl border border-white/10 bg-white/5 text-[var(--color-background-primary)]/60 text-xs font-semibold">
                Pago con tarjeta no disponible en esta tienda.
              </div>
            )
          )}

          {enableCheckout && enableWhatsApp && (
            <div className="flex items-center gap-3 my-1"><div className="flex-1 h-[1px] bg-[var(--color-background-primary)]/10"/><span className="text-[0.7rem] text-[var(--color-background-primary)]/30 uppercase tracking-[0.15em]">o</span><div className="flex-1 h-[1px] bg-[var(--color-background-primary)]/10"/></div>
          )}

          {enableWhatsApp && (
            <button type="submit" form="carrito-form" disabled={!items.length}
              className={`w-full flex items-center justify-center gap-2 text-[var(--color-background-primary)] rounded-xl py-3.5 font-bold transition-all duration-200 ${enableCheckout ? `bg-transparent border border-[${UI_COLORS.WHATSAPP}]/40 text-[${UI_COLORS.WHATSAPP}] hover:bg-[${UI_COLORS.WHATSAPP}]/10 text-[0.8rem]` : `bg-[${UI_COLORS.WHATSAPP}] hover:bg-[${UI_COLORS.WHATSAPP_HOVER}] text-[0.85rem]`} disabled:bg-[var(--color-background-primary)]/10 disabled:text-[var(--color-background-primary)]/30 disabled:border-white/10`}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              Pedido por WhatsApp
            </button>
          )}

          <p className="text-[0.6rem] text-center text-[var(--color-background-primary)]/30 flex items-center justify-center gap-1.5 mt-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            {enableCheckout && enableWhatsApp ? 'Elige el método que prefieras. Ambos son seguros.'
              : enableWhatsApp ? 'Sin apps, sin registro. Confirman en minutos.'
              : 'Pago seguro procesado por nuestro servidor.'}
          </p>
          </div>
        )}
      </aside>
    </>
  );
}
