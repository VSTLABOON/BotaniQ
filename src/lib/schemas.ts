import { z } from 'zod';

// ── Helpers ────────────────────────────────────────────────────────

const safeString = z.string().trim();
const safeStringMinMax = (min: number, max: number, minMsg?: string, maxMsg?: string) => 
  z.string().trim().min(min, minMsg).max(max, maxMsg);
const safeStringMin = (min: number, minMsg?: string) => 
  z.string().trim().min(min, minMsg);

const mxPhoneRegex = /^[0-9]{10}$/;

// ── Google Maps Allowlist Validation ─────────────────────────────
const isValidGoogleMapsUrl = (url: string): boolean => {
  if (!url) return true; // Permite vacío si no es obligatorio
  const lower = url.toLowerCase().trim();
  const regex = /^(https?:\/\/)?(www\.)?(google\.[a-z]{2,3}(\.[a-z]{2})?\/maps|maps\.google\.[a-z]{2,3}(\.[a-z]{2})?|goo\.gl\/maps|maps\.app\.goo\.gl)/;
  return regex.test(lower);
};

// ── Schemas de Dominio ───────────────────────────────────────────

export const TenantConfigBaseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
  nombre: safeStringMinMax(1, 100, "El nombre de la tienda es requerido", "El nombre no puede exceder 100 caracteres"),
  color_primario: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Formato de color primario inválido"),
  color_secundario: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Formato de color secundario inválido"),
  color_acento: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Formato de color acento inválido"),
  font_family: z.string().optional().default('Inter'),
  texto_nosotros: z.string().max(1000, "El texto de Nosotros no puede exceder los 1000 caracteres").optional().or(z.literal('')),
  anio_fundacion: z.preprocess((val) => val === '' || val === null || val === undefined ? undefined : Number(val), z.number().int().min(1800).max(new Date().getFullYear()).optional()),
  firma: z.string().max(100, "La firma no puede exceder 100 caracteres").optional().or(z.literal('')),
  mapa_url: z.string().url("URL de mapa inválida").refine(isValidGoogleMapsUrl, {
    message: "El enlace del mapa debe ser una dirección válida de Google Maps (https://maps.google.com, https://www.google.com/maps, etc.)"
  }).optional().or(z.literal('')),
  direccion: z.string().max(200, "La dirección no puede exceder 200 caracteres").optional().or(z.literal('')),
  meta_title: z.string().max(60, "El título de pestaña no puede exceder los 60 caracteres").optional().or(z.literal('')),
  whatsapp: z.string().regex(/^[0-9]{10,15}$/, "El WhatsApp debe tener entre 10 y 15 dígitos").optional().or(z.literal('')),
  custom_domain: z.string().max(100, "El dominio no puede exceder 100 caracteres").nullable().optional().or(z.literal('')),
  ciudad: z.string().max(100, "La ciudad no puede exceder 100 caracteres").optional().or(z.literal('')),
  estado: z.string().max(100, "El estado no puede exceder 100 caracteres").optional().or(z.literal('')),
  area_metropolitana: z.string().max(150, "El área metropolitana no puede exceder 150 caracteres").optional().or(z.literal('')),
  horarios: z.object({
    regular: z.string().trim().min(1, "El horario regular es obligatorio"),
    especial: z.string().trim().optional().nullable()
  }).optional(),
  redes_sociales: z.object({
    instagram: z.string().trim().optional().or(z.literal('')),
    facebook: z.string().trim().optional().or(z.literal(''))
  }).optional(),
  zonas_envio: z.array(
    z.object({
      nombre: z.string().trim().min(1, "El nombre de la zona es obligatorio"),
      costo: z.number().nonnegative("El costo de la zona debe ser mayor o igual a 0")
    })
  ).optional(),
  openpay_merchant_id: z.string().max(100, "El ID de comercio no puede exceder 100 caracteres").nullable().optional().or(z.literal('')),
  openpay_public_key: z.string().max(200, "La llave pública no puede exceder 200 caracteres").nullable().optional().or(z.literal('')),
  openpay_private_key: z.string().max(200, "La llave privada no puede exceder 200 caracteres").nullable().optional().or(z.literal('')),
  openpay_sandbox_mode: z.boolean().optional().default(true),
  stripe_publishable_key: z.string().max(200, "La llave publicable no puede exceder 200 caracteres").nullable().optional().or(z.literal('')),
  stripe_secret_key: z.string().max(200, "La llave secreta no puede exceder 200 caracteres").nullable().optional().or(z.literal('')),
  stripe_webhook_secret: z.string().max(200, "El secreto de webhook no puede exceder 200 caracteres").nullable().optional().or(z.literal('')),
  preferred_gateway: z.enum(['stripe', 'openpay']).optional().default('openpay'),
});

export const TenantConfigSchema = TenantConfigBaseSchema.superRefine((data, ctx) => {
  if (data.preferred_gateway === 'openpay') {
    if (!data.openpay_merchant_id || data.openpay_merchant_id.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El ID de Comercio de OpenPay es requerido",
        path: ["openpay_merchant_id"]
      });
    }
    if (!data.openpay_public_key || data.openpay_public_key.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La Llave Pública de OpenPay es requerida",
        path: ["openpay_public_key"]
      });
    }
    if (!data.openpay_private_key || data.openpay_private_key.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La Llave Privada de OpenPay es requerida",
        path: ["openpay_private_key"]
      });
    }
  }

  if (data.preferred_gateway === 'stripe') {
    if (!data.stripe_publishable_key || data.stripe_publishable_key.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La Llave Pública de Stripe es requerida (debe iniciar con 'pk_')",
        path: ["stripe_publishable_key"]
      });
    } else if (!data.stripe_publishable_key.trim().startsWith('pk_')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La Llave Publicable debe comenzar con 'pk_'",
        path: ["stripe_publishable_key"]
      });
    }

    if (!data.stripe_secret_key || data.stripe_secret_key.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La Llave Secreta de Stripe es requerida (debe iniciar con 'sk_')",
        path: ["stripe_secret_key"]
      });
    } else if (!data.stripe_secret_key.trim().startsWith('sk_')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La Llave Secreta debe comenzar con 'sk_'",
        path: ["stripe_secret_key"]
      });
    }

    if (data.stripe_webhook_secret && data.stripe_webhook_secret.trim() !== '') {
      if (!data.stripe_webhook_secret.trim().startsWith('whsec_')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El Secreto de Webhook debe comenzar con 'whsec_'",
          path: ["stripe_webhook_secret"]
        });
      }
    }
  }
});

export const ProductoItemSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().positive(),
});

export const PedidoEnvioSchema = z.object({
  recipientName: z.string().trim().min(2, "El nombre del destinatario debe tener al menos 2 caracteres").max(100),
  recipientPhone: z.string().trim().refine((val) => {
    const clean = val.replace(/\D/g, '');
    return clean.length === 10 || (clean.length === 12 && clean.startsWith('52'));
  }, {
    message: "El teléfono debe ser un número de 10 dígitos (ej. 8112345678) o 12 con prefijo 52"
  }),
  deliveryAddress: z.string().trim().min(10, "Proporciona una dirección de entrega completa (mínimo 10 caracteres)").max(300),
  deliveryDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (debe ser YYYY-MM-DD)").refine((val) => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    return val >= todayStr;
  }, {
    message: "La fecha de entrega no puede ser en el pasado"
  }),
  customMessage: z.string().trim().max(160, "El mensaje de la tarjeta no puede exceder 160 caracteres").optional().or(z.literal('')),
  zonaEnvio: z.string().trim().optional(),
});

export const PedidoCheckoutSchema = z.object({
  tenant_id: z.string().uuid(),
  items: z.array(ProductoItemSchema).min(1, "El carrito no puede estar vacío"),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
});

// Inferred Types
export type TenantConfigType = z.infer<typeof TenantConfigSchema>;
export type PedidoEnvioType = z.infer<typeof PedidoEnvioSchema>;
export type PedidoCheckoutType = z.infer<typeof PedidoCheckoutSchema>;

