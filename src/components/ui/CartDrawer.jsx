import { useState, useEffect, useMemo } from 'react';
import { useCartStore } from '../../store/cartStore.ts';
import { useTenant } from '../../context/TenantContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { initiateStripeCheckout, initiateOpenpayCheckout } from '../../services/checkoutService.ts';
import { createGuestOrder } from '../../services/orderService.ts';
import { ShoppingCart, MessageCircle, Copy, Check, CreditCard, Landmark, DollarSign, Download, Upload, AlertCircle, ArrowLeft } from 'lucide-react';
import { UI_COLORS } from '../../lib/constants.ts';
import { toast } from '../../store/toastStore.ts';
import { logger } from '../../lib/logger';
import { PedidoEnvioSchema } from '../../lib/schemas.ts';
import { loadStripe } from '@stripe/stripe-js';
import { supabase } from '../../lib/supabaseClient';

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
  
  const [cartMode, setCartMode] = useState('cart'); // 'cart' | 'custom'
  const [checkoutStep, setCheckoutStep] = useState(1); // 1 | 2
  const [customBudget, setCustomBudget] = useState('');
  const [customOccasion, setCustomOccasion] = useState('Amor');
  const [selectedFlowers, setSelectedFlowers] = useState([]);
  const [customDetails, setCustomDetails] = useState('');
  const [referenceImage, setReferenceImage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '', telefono: '', fecha: '', direccion: '',
    destinatario: '', notas: '', mensaje: '', zonaEnvio: '', postalCode: '',
    deliveryType: 'domicilio'
  });

  const [cpLoading, setCpLoading] = useState(false);
  const [coloniasList, setColoniasList] = useState([]);
  const [selectedColonia, setSelectedColonia] = useState('');
  const [cpError, setCpError] = useState(null);
  const [cpInfo, setCpInfo] = useState({ municipio: '', estado: '' });

  // Normalizador de texto para coincidencia de tarifas
  const normalizeText = (text) => 
    text ? text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim() : "";

  // Función para emparejar la colonia seleccionada con las zonas de la tienda
  const matchZonaEnvio = (colonia, municipio = '', estado = '') => {
    const zones = tenant.zonas_envio || [];
    if (zones.length === 0) return;

    const normColonia = normalizeText(colonia);
    const normMunicipio = normalizeText(municipio);
    
    let matchedZone = zones.find(z => {
      const normZoneName = normalizeText(z.nombre);
      if (!normZoneName || normZoneName.length < 3) return false;
      
      return normColonia.includes(normZoneName) || 
             normZoneName.includes(normColonia) ||
             (normMunicipio && normMunicipio.includes(normZoneName));
    });

    if (matchedZone) {
      setFormData(prev => ({
        ...prev,
        zonaEnvio: matchedZone.nombre
      }));
      toast.success(`Zona de envío "${matchedZone.nombre}" detectada automáticamente ($${matchedZone.costo} MXN)`);
    } else {
      setFormData(prev => ({
        ...prev,
        zonaEnvio: ''
      }));
    }
  };

  // Manejar el cambio de colonia seleccionada
  const handleColoniaChange = (e) => {
    const colonia = e.target.value;
    setSelectedColonia(colonia);
    
    const municipio = cpInfo.municipio;
    const estado = cpInfo.estado;
    
    setFormData(prev => ({
      ...prev,
      direccion: `${colonia}, ${municipio}, ${estado}`
    }));

    if (validationErrors.direccion) {
      setValidationErrors(p => { const copy = { ...p }; delete copy.direccion; return copy; });
    }

    matchZonaEnvio(colonia, municipio, estado);
  };

  useEffect(() => {
    const cp = formData.postalCode;
    if (!/^\d{5}$/.test(cp)) {
      setColoniasList([]);
      setSelectedColonia('');
      setCpInfo({ municipio: '', estado: '' });
      setCpError(null);
      return;
    }

    let active = true;
    const fetchPostalCode = async () => {
      setCpLoading(true);
      setCpError(null);
      try {
        const token = import.meta.env.VITE_COPOMEX_TOKEN || 'pruebas';
        const res = await fetch(`https://api.copomex.com/query/info_cp/${cp}?token=${token}`);
        if (!res.ok) throw new Error("Error en la conexión con la API de códigos postales");
        const data = await res.json();
        
        if (!active) return;

        if (data && data[0] && data[0].error === true) {
          setCpError(data[0].error_message || "Código Postal no encontrado");
          setColoniasList([]);
          setSelectedColonia('');
          return;
        }

        if (Array.isArray(data) && data.length > 0) {
          const first = data[0].response;
          const estado = first.estado || '';
          const municipio = first.municipio || '';
          const ciudad = first.ciudad || municipio || '';

          const colonias = data.map(item => item.response.asentamiento).filter(Boolean);
          
          setCpInfo({ municipio: ciudad, estado });
          setColoniasList(colonias);
          
          if (colonias.length > 0) {
            setSelectedColonia(colonias[0]);
            setFormData(prev => ({
              ...prev,
              direccion: `${colonias[0]}, ${ciudad}, ${estado}`
            }));
            
            if (validationErrors.direccion) {
              setValidationErrors(p => { const copy = { ...p }; delete copy.direccion; return copy; });
            }
            
            matchZonaEnvio(colonias[0], ciudad, estado);
          }
        } else {
          setCpError("Código Postal no encontrado");
        }
      } catch (err) {
        if (active) {
          logger.error("Error al consultar Copomex CP:", err);
          setCpError("Error al consultar el Código Postal. Intente ingresarlo manualmente.");
        }
      } finally {
        if (active) setCpLoading(false);
      }
    };

    fetchPostalCode();
    return () => { active = false; };
  }, [formData.postalCode]);

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
  
  const isPickup = formData.deliveryType === 'pickup';
  const shippingCost = isPickup ? 0 : (selectedZone ? selectedZone.costo : (hasZones ? 0 : (tenant.envio_costo || 0)));

  const sumOfSelectedFlowers = useMemo(() => {
    const list = tenant.flores || [];
    return selectedFlowers.reduce((sum, flowerName) => {
      const flower = list.find(f => (f.nombre || f.name) === flowerName);
      const price = flower?.precio_promedio ? parseFloat(flower.precio_promedio) : 0;
      return sum + price;
    }, 0);
  }, [selectedFlowers, tenant.flores]);

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
    if (tenant.subscription_level >= 3 && isPreferredOpenpay) {
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

  const handleCartModeChange = (mode) => {
    setCartMode(mode);
    setValidationErrors({});
  };

  const handleDeliveryTypeChange = (type) => {
    setFormData(prev => ({
      ...prev,
      deliveryType: type,
      ...(type === 'pickup' ? {
        direccion: 'Recoger en tienda',
        zonaEnvio: '',
        postalCode: ''
      } : {
        direccion: '',
        zonaEnvio: '',
        postalCode: ''
      })
    }));
    setValidationErrors(prev => {
      const copy = { ...prev };
      delete copy.direccion;
      delete copy.zonaEnvio;
      delete copy.postalCode;
      return copy;
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Solo se permiten imágenes en formato JPG, PNG, WEBP o GIF.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no debe pesar más de 5MB");
      return;
    }

    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${tenant.id}/pedidos-personalizados/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('referencias-clientes')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('referencias-clientes')
        .getPublicUrl(fileName);

      setReferenceImage(publicUrl);
      toast.success("¡Imagen de referencia cargada correctamente!");
    } catch (err) {
      logger.error("Error al cargar imagen de referencia:", err);
      toast.error("Error al cargar imagen. Puedes enviarla directamente en el mensaje de WhatsApp.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setReferenceImage('');
  };

  // Valida que el número de WhatsApp sea real (no el fallback)
  const isWhatsAppConfigured = tenant.whatsapp && tenant.whatsapp !== '0000000000' && /^\d{10,15}$/.test(tenant.whatsapp.replace(/\D/g, ''));

  const handleWhatsApp = async (e) => {
    e.preventDefault();
    if (cartMode === 'cart' && !items.length) {
      return toast.error("Tu carrito está vacío.");
    }
    if (cartMode === 'custom' && (!customBudget || parseFloat(customBudget) <= 0)) {
      return toast.error("Por favor ingresa un presupuesto válido.");
    }
    if (!isWhatsAppConfigured) {
      return toast.error('Esta tienda aún no ha configurado su WhatsApp. Intenta más tarde.');
    }
    const { nombre, fecha, direccion, destinatario, telefono, notas, mensaje } = formData;

    const errors = {};
    if (!nombre.trim()) {
      errors.nombre = 'El nombre del comprador es obligatorio.';
    }

    if (formData.deliveryType === 'domicilio' && hasZones && !formData.zonaEnvio) {
      errors.zonaEnvio = 'Debes seleccionar una zona de envío.';
    }

    const shippingData = {
      deliveryType: formData.deliveryType,
      recipientName: destinatario || undefined,
      recipientPhone: telefono || undefined,
      deliveryAddress: formData.deliveryType === 'pickup' ? 'Recoger en tienda' : direccion,
      deliveryDate: fecha,
      customMessage: mensaje,
      zonaEnvio: formData.deliveryType === 'pickup' ? undefined : (formData.zonaEnvio || undefined),
      postalCode: formData.deliveryType === 'pickup' ? undefined : (formData.postalCode || undefined),
      ...(cartMode === 'custom' ? {
        customOccasion,
        selectedFlowers,
        referenceImage: referenceImage || undefined,
        customBudget: parseFloat(customBudget)
      } : {})
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
        if (path === 'postalCode') fieldName = 'postalCode';
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
    let orderId = null;
    try {
      const subtotal = cartMode === 'custom' ? parseFloat(customBudget) : getSubtotal();
      const customItems = [
        {
          productId: null,
          variantId: null,
          name: "Arreglo Personalizado (Diseño a Medida)",
          quantity: 1,
          unitPrice: parseFloat(customBudget),
        }
      ];
      const orderItems = cartMode === 'custom' ? customItems : items;

      const result = await createGuestOrder(
        {
          items: orderItems,
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
      logger.warn('[CartDrawer] No se pudo registrar pedido en BD:', err.message);
    }

    // ── 2. Construir mensaje de WhatsApp ─────────────────────────
    const subtotal = cartMode === 'custom' ? parseFloat(customBudget) : getSubtotal();
    const [y,m,d] = validatedShipping.deliveryDate.split('-');
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    
    let lines = [];
    if (cartMode === 'custom') {
      lines = [
        '¡Hola! Quiero solicitar un Diseño a Medida:',
        '',
        `-- Detalles del Arreglo --`,
        `Presupuesto: $${customBudget} MXN`,
        `Ocasión: ${customOccasion}`,
        selectedFlowers.length > 0 ? `Flores de preferencia: ${selectedFlowers.join(', ')}` : 'Flores de preferencia: Sin preferencia (a elección del florista)',
        customDetails.trim() ? `Notas de estilo: ${customDetails}` : '',
        referenceImage ? `Foto de referencia: ${referenceImage}` : '',
        ''
      ].filter(l => l !== '');
    } else {
      lines = ['Hola! Quiero hacer un pedido:','','-- Arreglos --'];
      items.forEach((it,i) => lines.push(`${i+1}. ${it.name} — ${it.variantName} x${it.quantity} ($${it.unitPrice*it.quantity})`));
    }

    lines.push(
      '',
      `Subtotal: $${subtotal} MXN`,
      formData.deliveryType === 'pickup' ? 'Tipo de entrega: Recoger en tienda' : `Zona de envío: ${formData.zonaEnvio || 'N/A'} ($${shippingCost} MXN)`,
      `Total: $${subtotal + shippingCost} MXN`,
      '',
      `Fecha de entrega/recogida: ${Number(d)} de ${meses[Number(m)-1]} de ${y}`,
      formData.deliveryType === 'pickup' ? '' : `Dirección: ${validatedShipping.deliveryAddress}${validatedShipping.postalCode ? ` (C.P. ${validatedShipping.postalCode})` : ''}`,
      `Quién pide: ${nombre}`
    );
    
    if (validatedShipping.recipientName && formData.deliveryType === 'domicilio') {
      lines.push(`Para: ${validatedShipping.recipientName}`);
    }
    if (validatedShipping.recipientPhone && formData.deliveryType === 'domicilio') {
      lines.push(`Teléfono de quien recibe: ${validatedShipping.recipientPhone}`);
    }
    if (notas && cartMode === 'cart') {
      lines.push(`Notas adicionales: ${notas}`);
    }
    if (validatedShipping.customMessage) {
      lines.push(`Tarjeta: "${validatedShipping.customMessage}"`);
    }
    if (orderId) {
      lines.push('', `ID de pedido: ${orderId.slice(0, 8).toUpperCase()}`);
    }
    lines.push('','¡Gracias!');

    // ── 3. Abrir WhatsApp y limpiar carrito ──────────────────────
    const cleanNumber = tenant.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
    if (orderId) {
      if (cartMode === 'cart') {
        clearCart();
      } else {
        // Limpiar el formulario de diseño a medida
        setCustomBudget('');
        setCustomOccasion('Amor');
        setSelectedFlowers([]);
        setCustomDetails('');
        setReferenceImage('');
      }
      setCheckoutStep(1);
      closeCart();
      toast.success('¡Pedido registrado! Confirma por WhatsApp.');
    }
  };

  const handleCheckout = async () => {
    if (cartMode === 'custom') return; // Bloqueado en UI, pero de seguridad
    if (!items.length) return;

    const { nombre, fecha, direccion, destinatario, telefono, notas, mensaje } = formData;

    const errors = {};
    if (!nombre.trim()) {
      errors.nombre = 'El nombre del comprador es obligatorio.';
    }

    if (formData.deliveryType === 'domicilio' && hasZones && !formData.zonaEnvio) {
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
      deliveryType: formData.deliveryType,
      recipientName: destinatario || undefined,
      recipientPhone: telefono || undefined,
      deliveryAddress: formData.deliveryType === 'pickup' ? 'Recoger en tienda' : direccion,
      deliveryDate: fecha,
      customMessage: mensaje,
      zonaEnvio: formData.deliveryType === 'pickup' ? undefined : (formData.zonaEnvio || undefined),
      postalCode: formData.deliveryType === 'pickup' ? undefined : (formData.postalCode || undefined),
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
        if (path === 'postalCode') fieldName = 'postalCode';
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

        window.OpenPay.setId(tenant.openpay_merchant_id);
        window.OpenPay.setApiKey(tenant.openpay_public_key);
        window.OpenPay.setSandboxMode(tenant.openpay_sandbox_mode ?? true);

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
  const hasSubscriptionForCheckout = tenant.subscription_level >= 3; // Nivel 3 = ALQUIMIA
  const isPreferredStripe = tenant.preferred_gateway === 'stripe';
  const isPreferredOpenpay = tenant.preferred_gateway === 'openpay' || !tenant.preferred_gateway;

  const isStripeConfigured = !!tenant.stripe_publishable_key;
  const isOpenpayConfigured = !!(tenant.openpay_public_key && tenant.openpay_merchant_id);

  const isGatewayConfigured = isPreferredStripe ? isStripeConfigured : isOpenpayConfigured;

  const enableCheckout = hasSubscriptionForCheckout && isGatewayConfigured;
  const enableWhatsApp = true; // WhatsApp is always available
  const isCheckoutMode = enableCheckout;
  const FabIcon = ShoppingCart;
  const fabAriaLabel = "Ver mi pedido / Carrito de compras";

  return (
    <>
      {/* FAB */}
      <button onClick={openCart} aria-label={fabAriaLabel}
        aria-expanded={isOpen} aria-controls="cart-drawer"
        className={`fixed bottom-24 lg:bottom-6 left-6 lg:left-8 z-[8900] w-[60px] h-[60px] rounded-full bg-verde text-[var(--color-background-primary)] shadow-lg-custom flex items-center justify-center transition-transform duration-300 hover:scale-110 ${itemCount > 0 ? 'animate-bounce' : ''}`}>
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
              {/* PASO 1: SELECCIÓN / DISEÑO A MEDIDA */}
              {checkoutStep === 1 && (
                <div className="flex flex-col gap-5 animate-fade-up">
                  {/* Selector de Pestañas */}
                  <div className="flex border-b border-white/10 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCartModeChange('cart')}
                      className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                        cartMode === 'cart'
                          ? 'border-verde text-verde'
                          : 'border-transparent text-[var(--color-background-primary)]/40 hover:text-[var(--color-background-primary)]/70'
                      }`}
                    >
                      Mi Carrito
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCartModeChange('custom')}
                      className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                        cartMode === 'custom'
                          ? 'border-verde text-verde'
                          : 'border-transparent text-[var(--color-background-primary)]/40 hover:text-[var(--color-background-primary)]/70'
                      }`}
                    >
                      Diseño a Medida
                    </button>
                  </div>

                  {/* Flujo: Mi Carrito estándar */}
                  {cartMode === 'cart' && (
                    <>
                      <div className="flex flex-col gap-3">
                        {items.length === 0 ? (
                          <p className="text-texto-muted text-sm text-center py-6">Tu carrito está vacío</p>
                        ) : items.map((item) => (
                          <div key={item.cartItemId} className="flex items-center gap-3 bg-[var(--color-background-primary)]/5 p-3 rounded-xl border border-white/5 animate-fade-up">
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

                      <button
                        type="button"
                        disabled={items.length === 0}
                        onClick={() => setCheckoutStep(2)}
                        className="w-full flex items-center justify-center gap-2 bg-verde hover:bg-verde-light disabled:bg-[var(--color-background-primary)]/10 disabled:text-[var(--color-background-primary)]/30 text-[var(--color-background-primary)] rounded-xl py-3.5 font-bold text-[0.85rem] tracking-[0.04em] transition-all duration-300 ease-spring hover:scale-[1.02] disabled:hover:scale-100 mt-2 cursor-pointer"
                      >
                        Continuar con el Envío
                      </button>
                    </>
                  )}

                  {/* Flujo: Diseño a Medida personalizado */}
                  {cartMode === 'custom' && (
                    <div className="flex flex-col gap-4 animate-fade-up">
                      {/* Disclaimer Protector */}
                      <div className="bg-verde/5 border border-verde/15 rounded-xl p-3.5 text-xs text-[var(--color-background-primary)]/80 leading-relaxed font-body">
                        <p className="font-semibold text-verde-light mb-1 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Alineación de Expectativas
                        </p>
                        {tenant.secciones?.flores?.disclaimer_medida || 'Para garantizar la calidad y volumen de tu arreglo, ten en cuenta que el presupuesto ingresado determina la cantidad y variedad de tallos. Flores premium (como peonías, orquídeas o proteas) tienen costos promedio más elevados. Tu composición se adaptará artísticamente para optimizar tu presupuesto.'}
                      </div>

                      {/* Presupuesto */}
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="cd-presupuesto" className={LABEL}>Tu Presupuesto (MXN) *</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[var(--color-background-primary)]/40 font-semibold">$</span>
                          <input
                            type="number"
                            id="cd-presupuesto"
                            value={customBudget}
                            onChange={(e) => setCustomBudget(e.target.value)}
                            required
                            placeholder="Monto mínimo recomendado $500"
                            className={`${INPUT} pl-8`}
                            min="1"
                          />
                        </div>
                      </div>

                      {/* Ocasión */}
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="cd-ocasion" className={LABEL}>Ocasión *</label>
                        <select
                          id="cd-ocasion"
                          value={customOccasion}
                          onChange={(e) => setCustomOccasion(e.target.value)}
                          className={INPUT}
                        >
                          <option value="Amor">Amor / Romance</option>
                          <option value="Aniversario">Aniversario</option>
                          <option value="Cumpleaños">Cumpleaños</option>
                          <option value="Condolencias">Condolencias</option>
                          <option value="Felicitación">Felicitación</option>
                          <option value="Otro">Otro / General</option>
                        </select>
                      </div>

                      {/* Catálogo de Flores con precio promedio */}
                      <div className="flex flex-col gap-2 bg-white/5 border border-white/10 rounded-xl p-4">
                        <span className={LABEL}>Flores preferidas (Opcional)</span>
                        <div className="grid grid-cols-2 gap-2 mt-1 max-h-[160px] overflow-y-auto pr-1">
                          {(tenant.flores || []).filter(f => f.stock !== 'Agotado').map((f, i) => {
                            const name = f.nombre || f.name;
                            const price = f.precio_promedio ? parseFloat(f.precio_promedio) : 0;
                            const isChecked = selectedFlowers.includes(name);
                            return (
                              <label key={i} className="flex items-center gap-2 cursor-pointer text-xs text-[var(--color-background-primary)]/80 hover:text-white transition-colors py-1">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedFlowers([...selectedFlowers, name]);
                                    } else {
                                      setSelectedFlowers(selectedFlowers.filter(nameItem => nameItem !== name));
                                    }
                                  }}
                                  className="rounded border-white/20 bg-negro text-verde focus:ring-verde focus:ring-offset-negro w-3.5 h-3.5"
                                />
                                <span className="truncate flex-1">{name}</span>
                                {price > 0 && <span className="text-[10px] text-verde-light font-semibold shrink-0 font-mono">${price} c/u</span>}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Advertencia Presupuesto vs Flores */}
                      {customBudget && sumOfSelectedFlowers > parseFloat(customBudget) && (
                        <div className="flex gap-2 items-start bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl p-3.5 text-xs animate-fade-up">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold mb-0.5">Presupuesto Ajustado</p>
                            <p className="text-[11px] leading-relaxed opacity-90">
                              Tu presupuesto de ${customBudget} MXN podría ser bajo para incluir la variedad de flores seleccionadas (costo mínimo promedio aproximado: ${sumOfSelectedFlowers} MXN). Se dará prioridad a las flores elegidas que se ajusten al monto.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Fotos de referencia */}
                      <div className="flex flex-col gap-2 bg-white/5 border border-white/10 rounded-xl p-4">
                        <span className={LABEL}>Fotos de referencia (Opcional)</span>
                        
                        {!referenceImage ? (
                          <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-xl py-6 px-4 cursor-pointer hover:border-verde/40 transition-colors bg-negro/20">
                            {uploadingImage ? (
                              <div className="flex flex-col items-center gap-2 text-xs text-[var(--color-background-primary)]/50">
                                <svg className="animate-spin h-5 w-5 text-verde" viewBox="0 0 24 24" fill="none">
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeLinecap="round"/>
                                </svg>
                                <span>Subiendo archivo...</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-2 text-xs text-[var(--color-background-primary)]/50">
                                <Upload className="w-5 h-5 text-verde" />
                                <span className="font-semibold text-verde-light">Selecciona o arrastra una imagen</span>
                                <span className="text-[10px] opacity-60">PNG, JPG hasta 5MB</span>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              disabled={uploadingImage}
                              className="hidden"
                            />
                          </label>
                        ) : (
                          <div className="relative rounded-xl overflow-hidden aspect-video border border-white/10 bg-black/40">
                            <img src={referenceImage} alt="Referencia" className="w-full h-full object-contain" />
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              className="absolute top-2 right-2 p-1.5 bg-black/75 hover:bg-rosa/80 text-white rounded-lg transition-colors cursor-pointer"
                              aria-label="Eliminar imagen"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Detalles / Notas de estilo */}
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="cd-customDetails" className={LABEL}>Detalles del Diseño / Notas de Estilo</label>
                        <textarea
                          id="cd-customDetails"
                          value={customDetails}
                          onChange={(e) => setCustomDetails(e.target.value)}
                          rows="2.5"
                          placeholder="Ej: Prefiero tonos pastel, evitar follaje abundante, agregar listón rosa..."
                          className={`${INPUT} resize-none`}
                        />
                      </div>

                      <button
                        type="button"
                        disabled={!customBudget || parseFloat(customBudget) <= 0}
                        onClick={() => setCheckoutStep(2)}
                        className="w-full flex items-center justify-center gap-2 bg-verde hover:bg-verde-light disabled:bg-[var(--color-background-primary)]/10 disabled:text-[var(--color-background-primary)]/30 text-[var(--color-background-primary)] rounded-xl py-3.5 font-bold text-[0.85rem] tracking-[0.04em] transition-all duration-300 ease-spring hover:scale-[1.02] disabled:hover:scale-100 mt-2 cursor-pointer"
                      >
                        Continuar con el Envío
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* PASO 2: DATOS DE ENVÍO / PAGO */}
              {checkoutStep === 2 && (
                <div className="flex flex-col gap-5 animate-fade-up">
                  {/* Botón de Regresar */}
                  <button
                    type="button"
                    onClick={() => setCheckoutStep(1)}
                    className="flex items-center gap-1.5 text-[var(--color-background-primary)]/60 hover:text-[var(--color-background-primary)] text-xs font-bold transition-all self-start cursor-pointer hover:text-white"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Regresar al Paso 1
                  </button>

                  <form id="carrito-form" onSubmit={handleWhatsApp} className="flex flex-col gap-5" noValidate>
                    {/* Selector de Tipo de Entrega */}
                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL}>Tipo de entrega *</label>
                      <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
                        <button
                          type="button"
                          onClick={() => handleDeliveryTypeChange('domicilio')}
                          className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            formData.deliveryType === 'domicilio'
                              ? 'bg-verde text-black font-semibold'
                              : 'bg-transparent text-[var(--color-background-primary)]/60 hover:text-white'
                          }`}
                        >
                          Envío a domicilio
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeliveryTypeChange('pickup')}
                          className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            formData.deliveryType === 'pickup'
                              ? 'bg-verde text-black font-semibold'
                              : 'bg-transparent text-[var(--color-background-primary)]/60 hover:text-white'
                          }`}
                        >
                          Recoger en tienda
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="cd-nombre" className={LABEL}>Tu nombre *</label>
                        <input type="text" id="cd-nombre" name="nombre" value={formData.nombre} onChange={handleChange} required placeholder="María González" className={INPUT} />
                        {validationErrors.nombre && <p className="text-[11px] text-rosa mt-0.5 animate-fade-up">{validationErrors.nombre}</p>}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="cd-fecha" className={LABEL}>
                          {formData.deliveryType === 'pickup' ? 'Fecha de recogida *' : 'Fecha entrega *'}
                        </label>
                        <input type="date" id="cd-fecha" name="fecha" value={formData.fecha} min={minDate} onChange={handleChange} required className={`${INPUT} [color-scheme:dark]`} />
                        {validationErrors.fecha && <p className="text-[11px] text-rosa mt-0.5 animate-fade-up">{validationErrors.fecha}</p>}
                      </div>
                    </div>

                    {formData.deliveryType === 'domicilio' && (
                      <>
                        <div className={coloniasList.length > 0 ? "grid grid-cols-2 gap-4" : "w-full"}>
                          <div className="flex flex-col gap-1.5 relative">
                            <label htmlFor="cd-postalCode" className={LABEL}>Código Postal *</label>
                            <div className="relative">
                              <input 
                                type="text" 
                                id="cd-postalCode" 
                                name="postalCode" 
                                value={formData.postalCode || ''} 
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '').substring(0, 5);
                                  setFormData(p => ({ ...p, postalCode: val }));
                                  if (validationErrors.postalCode) {
                                    setValidationErrors(p => { const copy = {...p}; delete copy.postalCode; return copy; });
                                  }
                                }} 
                                maxLength={5} 
                                placeholder="CP (ej. 01000)" 
                                className={INPUT} 
                              />
                              {cpLoading && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  <svg className="animate-spin h-4 w-4 text-verde" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeLinecap="round"/>
                                  </svg>
                                </div>
                              )}
                            </div>
                            {validationErrors.postalCode && <p className="text-[11px] text-rosa mt-0.5 animate-fade-up">{validationErrors.postalCode}</p>}
                            {cpError && <p className="text-[11px] text-amber-500 mt-0.5 animate-fade-up">{cpError}</p>}
                          </div>

                          {coloniasList.length > 0 && (
                            <div className="flex flex-col gap-1.5 animate-fade-up">
                              <label htmlFor="cd-coloniaSelect" className={LABEL}>Colonia / Asentamiento</label>
                              <select
                                id="cd-coloniaSelect"
                                value={selectedColonia}
                                onChange={handleColoniaChange}
                                className={INPUT}
                              >
                                {coloniasList.map((col, idx) => (
                                  <option key={idx} value={col} className="bg-negro text-white">
                                    {col}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
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
                            <label htmlFor="cd-destinatario" className={LABEL}>¿Para quién? <span className="text-[var(--color-background-primary)]/30 lowercase normal-case">(opcional)</span></label>
                            <input type="text" id="cd-destinatario" name="destinatario" value={formData.destinatario} onChange={handleChange} placeholder="Nombre de quien recibe" className={INPUT} />
                            {validationErrors.destinatario && <p className="text-[11px] text-rosa mt-0.5 animate-fade-up">{validationErrors.destinatario}</p>}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label htmlFor="cd-telefono" className={LABEL}>Teléfono <span className="text-[var(--color-background-primary)]/30 lowercase normal-case">(opcional)</span></label>
                            <input type="tel" id="cd-telefono" name="telefono" value={formData.telefono} onChange={handleChange} placeholder="81 1234 5678" className={INPUT} />
                            {validationErrors.telefono && <p className="text-[11px] text-rosa mt-0.5 animate-fade-up">{validationErrors.telefono}</p>}
                          </div>
                        </div>
                      </>
                    )}

                    {cartMode === 'cart' && (
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="cd-notes" className={LABEL}>Preferencias <span className="text-[var(--color-background-primary)]/30 lowercase normal-case">(opcional)</span></label>
                        <input type="text" id="cd-notes" name="notas" value={formData.notas} onChange={handleChange} placeholder="Ej: Rosas rojas..." className={INPUT} />
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-end">
                        <label htmlFor="cd-mensaje" className={LABEL}>Mensaje tarjeta <span className="text-[var(--color-background-primary)]/30 lowercase normal-case">(opcional)</span></label>
                        <span className={`text-xs ${formData.mensaje.length > 130 ? 'text-rosa' : 'text-[var(--color-background-primary)]/30'}`}>{formData.mensaje.length}/160</span>
                      </div>
                      <textarea id="cd-mensaje" name="mensaje" value={formData.mensaje} onChange={handleChange} rows="2" placeholder="Con todo mi amor…" maxLength="160" className={`${INPUT} resize-none`} />
                      {validationErrors.mensaje && <p className="text-[11px] text-rosa mt-0.5 animate-fade-up">{validationErrors.mensaje}</p>}
                    </div>

                    {/* Si cobros en línea están habilitados, pasarela preferida es OpenPay y NO es pedido personalizado */}
                    {cartMode === 'cart' && enableCheckout && isPreferredOpenpay && (
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
                </div>
              )}
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
              
              {formData.deliveryType === 'domicilio' && (
                <>
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
                </>
              )}
              {formData.deliveryType === 'pickup' && (
                <div className="flex justify-between items-center text-[var(--color-background-primary)]">
                  <span className="text-xs text-[var(--color-background-primary)]/40">Envío (Recoger en tienda)</span>
                  <span className="text-sm text-verde-light font-semibold">Gratis</span>
                </div>
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

            {/* Renderización Condicional de Botones según cartMode */}
            {checkoutStep === 2 && (
              <>
                {cartMode === 'cart' && enableCheckout ? (
                  <button type="button" disabled={!items.length || checkoutLoading} onClick={handleCheckout}
                    className="w-full flex items-center justify-center gap-2.5 bg-verde hover:bg-verde-light disabled:bg-[var(--color-background-primary)]/10 disabled:text-[var(--color-background-primary)]/30 text-[var(--color-background-primary)] rounded-xl py-3.5 font-bold text-[0.85rem] tracking-[0.04em] transition-all duration-300 ease-spring hover:scale-[1.02] disabled:hover:scale-100 cursor-pointer">
                    {checkoutLoading ? (<><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeLinecap="round"/></svg>Procesando...</>)
                    : (<><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Pagar ahora</>)}
                  </button>
                ) : cartMode === 'cart' && hasSubscriptionForCheckout ? (
                  <div className="w-full text-center py-3.5 px-4 rounded-xl border border-white/10 bg-white/5 text-[var(--color-background-primary)]/60 text-xs font-semibold">
                    Pago con tarjeta no disponible en esta tienda.
                  </div>
                ) : null}

                {cartMode === 'cart' && enableCheckout && enableWhatsApp && (
                  <div className="flex items-center gap-3 my-1"><div className="flex-1 h-[1px] bg-[var(--color-background-primary)]/10"/><span className="text-[0.7rem] text-[var(--color-background-primary)]/30 uppercase tracking-[0.15em]">o</span><div className="flex-1 h-[1px] bg-[var(--color-background-primary)]/10"/></div>
                )}

                {enableWhatsApp && (
                  <button type="submit" form="carrito-form"
                    className={`w-full flex items-center justify-center gap-2 text-[var(--color-background-primary)] rounded-xl py-3.5 font-bold transition-all duration-200 cursor-pointer ${cartMode === 'cart' && enableCheckout ? `bg-transparent border border-[${UI_COLORS.WHATSAPP}]/40 text-[${UI_COLORS.WHATSAPP}] hover:bg-[${UI_COLORS.WHATSAPP}]/10 text-[0.8rem]` : `bg-[${UI_COLORS.WHATSAPP}] hover:bg-[${UI_COLORS.WHATSAPP_HOVER}] text-[0.85rem]`} disabled:bg-[var(--color-background-primary)]/10 disabled:text-[var(--color-background-primary)]/30 disabled:border-white/10`}>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                    Pedido por WhatsApp
                  </button>
                )}

                <p className="text-[0.6rem] text-center text-[var(--color-background-primary)]/30 flex items-center justify-center gap-1.5 mt-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  {cartMode === 'custom' ? 'Los pedidos personalizados se coordinan y confirman vía WhatsApp.'
                    : enableCheckout && enableWhatsApp ? 'Elige el método que prefieras. Ambos son seguros.'
                    : enableWhatsApp ? 'Sin apps, sin registro. Confirman en minutos.'
                    : 'Pago seguro procesado por nuestro servidor.'}
                </p>
              </>
            )}

            {checkoutStep === 1 && (
              <p className="text-[0.6rem] text-center text-[var(--color-background-primary)]/30 flex items-center justify-center gap-1.5 mt-1">
                Completa tus preferencias para continuar con los datos de entrega.
              </p>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
