// ─── INTERFACES CENTRALES DEL DOMINIO ───────────────────────────
// Contratos de datos compartidos entre Store, Servicios y UI.
// Fuente de verdad única para el modelado de negocio e-commerce.
// ────────────────────────────────────────────────────────────────

// ── Producto y Variantes ─────────────────────────────────────────

export interface Product {
  id: string;
  tienda_id: string;
  name: string;
  slug?: string;
  description: string;
  basePrice: number;
  images: string[];
  variants: ProductVariant[];
  isAvailable: boolean;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;            // "Estándar", "Premium"
  price: number | null;    // Precio propio absoluto de la variante (null si no está capturado)
  stock: number;
  sku: string;
  image?: string;
}

// ── Carrito ──────────────────────────────────────────────────────

export interface CartItem {
  cartItemId: string;      // UUID interno de la línea de pedido
  productId: string;
  variantId: string;       // Identifica la versión exacta
  name: string;
  variantName: string;
  unitPrice: number;       // Precio unitario absoluto (precio de la variante o del producto base)
  quantity: number;
  image: string;
}

// ── Checkout ─────────────────────────────────────────────────────

export interface CheckoutState {
  items: CartItem[];
  subtotal: number;
  shippingData: ShippingData | null;
  shippingCost: number;
  total: number;           // subtotal + shippingCost
}

export interface ShippingData {
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  deliveryDate: string;    // ISO 8601
  customMessage: string;   // Dedicatoria en tarjeta impresa
  zonaEnvio?: string;
}

// ── Tenant (Configuración Multi-tenant) ──────────────────────────

export interface TenantConfig {
  id: string;
  slug: string;
  nombre: string;
  logo_url: string | null;
  color_primario: string;
  color_secundario: string;
  color_acento: string;
  ciudad: string;
  estado: string;
  area_metropolitana: string;
  mapa_url: string;
  direccion?: string;
  whatsapp: string;
  wa_base: string;
  horarios: {
    regular: string;
    especial?: string;
  };
  redes_sociales: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
  };
  nav_links: string[];
  campana: {
    activa: boolean;
    titulo: string;
    fecha_objetivo: string;
  } | null;
  anio_fundacion: number;
  texto_nosotros: string;
  firma: string;
  envio_costo: number;
  colonias: string[];
  zonas_envio?: { nombre: string; costo: number }[];

  // ── SaaS — Suscripción y Dominio ───────────────────────────────
  // Campos sincronizados con las columnas de la tabla `tiendas`.
  // subscription_level se deriva de subscription_status (Stripe webhook).
  subscription_level: number;    // 1 = Base, 2 = E-commerce, 3 = Logística
  custom_domain: string | null;  // ej. "www.mifloreria.com" (UNIQUE en BD)
  currency: string;              // ISO 4217: 'MXN', 'USD', 'EUR', etc.
  created_at?: string | null;
  has_active_subscription?: boolean;
  meta_title?: string | null;

  // ── OpenPay y Preferred Gateway ────────────────────────────────
  openpay_merchant_id?: string | null;
  openpay_public_key?: string | null;
  openpay_private_key?: string | null;
  openpay_sandbox_mode?: boolean;
  preferred_gateway?: 'stripe' | 'openpay';

  // Secciones Dinámicas desde config_ui
  servicios: any[];
  beneficios: any[];
  flores: any[];
  galeria: any[];
  testimonios: any[];
  seo: {
    titulo: string;
    descripcion: string;
    og_image: string;
  };
  evento: {
    activo: boolean;
    titulo: string;
    producto: string;
    fecha_fin: string;
  };

  // ── Page Builder — Orden dinámico de secciones ─────────────────
  // SAAS_FLAG: NIVEL 1 - El array completo se ofrece en todos los planes,
  // pero ciertas secciones (Testimonios, Galeria) se deshabilitan en plan básico.
  orden_secciones: string[];
  font_family?: string;

  secciones: {
    hero: {
      titulo: string;
      titulo_italic: string;
      subtitulo: string;
      trust_bar_1: string;
    };
    servicios: {
      etiqueta: string;
      titulo: string;
      titulo_italic: string;
    };
    beneficios: {
      etiqueta: string;
      titulo: string;
      titulo_italic: string;
      imagen: string;
      metrica_valor: string;
      metrica_texto: string;
    };
    flores: {
      etiqueta: string;
      titulo: string;
      titulo_italic: string;
      cita: string;
    };
    galeria: {
      etiqueta: string;
      titulo: string;
      titulo_italic: string;
      subtitulo: string;
    };
    testimonios: {
      etiqueta: string;
      titulo: string;
      titulo_italic: string;
    };
  };
}

// ── Auth & RBAC ──────────────────────────────────────────────────

export type UserRole = 'superadmin' | 'admin' | 'dueño' | 'empleado' | 'repartidor' | 'cliente';

export interface UserProfile {
  id: string;              // user.id de auth.users
  tienda_id: string | null;
  rol: UserRole;
  nombre: string | null;
  email: string | null;
  telefono?: string | null;
  direccion?: string | null;
}

export enum SubscriptionLevel {
  BLOCKED  = 0,
  BASICO   = 1,
  PRO      = 2,
  PREMIUM  = 3
}

