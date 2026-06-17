// ─── TENANT CONTEXT ─────────────────────────────────────────────
// Motor de temas dinámicos Multi-tenant SaaS.
//
// Responsabilidades:
//   1. Resolver la identidad del tenant (slug, subdominio o custom_domain)
//   2. Consultar Supabase para obtener la configuración del tenant
//   3. Inyectar variables CSS dinámicas en :root
//   4. Proveer TenantConfig a toda la aplicación
//   5. Exponer updateTenantConfig() para mutaciones optimistas
//      desde el panel de administración (Store Builder)
//
// FIX DT-02: Resolución de tenant por hostname
//   • localhost / 127.0.0.1  → usa VITE_STORE_SLUG (desarrollo)
//   • *.botaniq.com     → extrae slug del subdominio
//   • cualquier otro hostname → busca por custom_domain en BD
// ────────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabaseClient';
import type { TenantConfig } from '../types';
import { SubscriptionLevel } from '../types';
import { useTheming } from '../hooks/useTheming';
import { FALLBACK_TENANT_DEFAULTS } from '../lib/constants.ts';
import { logger } from '../lib/logger';
import { useAuth } from './AuthContext';
import { isPlatformDomain, getSubdomainFromHostname, getPlatformDomain } from '../lib/domain';

// ── Orden de secciones por defecto ──────────────────────────────
// Refleja el orden "canónico" de la landing pública. Cada entrada
// debe coincidir con una clave del SECTIONS_MAP en StorefrontPage.
const DEFAULT_ORDEN_SECCIONES: string[] = [
  'Hero',
  'Catalogo',
  'Servicios',
  'Testimonios',
  'Beneficios',
  'Flores',
  'Cobertura',
  'Nosotros',
  'Galeria',
  'InstagramFeed',
];

// ── Dominio base de la plataforma SaaS ──────────────────────────
// Ahora se lee desde domain.ts → getPlatformDomain()
// Configurable vía VITE_PLATFORM_DOMAIN (default: 'botaniq.com')

// ── Resolución de identidad del tenant ──────────────────────────
// Determina cómo buscar la tienda en Supabase según el hostname.
//
// Retorna un discriminated union:
//   { mode: 'slug',   value: string } — buscar por columna `slug`
//   { mode: 'domain', value: string } — buscar por columna `custom_domain`
//
// Prioridad:
//   1. localhost/127.0.0.1 → VITE_STORE_SLUG (modo desarrollo)
//   2. *.botaniq.com  → subdominio como slug
//   3. Cualquier otro host → custom_domain
// ────────────────────────────────────────────────────────────────

type TenantIdentifier =
  | { mode: 'slug';   value: string }
  | { mode: 'domain'; value: string };

function resolveTenantIdentifier(): TenantIdentifier {
  const hostname = window.location.hostname;

  // ── 0. Query param override (Soporte para testing sin wildcards) ────
  const searchParams = new URLSearchParams(window.location.search);
  const querySlug = searchParams.get('store') || searchParams.get('tenant');
  if (querySlug) {
    logger.info(`🔍 [TenantResolver] Slug detectado por query param → "${querySlug}"`);
    return { mode: 'slug', value: querySlug };
  }

  // ── 1. Desarrollo local ──────────────────────────────────────
  const isLocalIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  if (hostname === 'localhost' || hostname === '127.0.0.1' || isLocalIP) {
    const devSlug = import.meta.env.VITE_STORE_SLUG || 'flores-del-corazon';
    logger.info(`🔧 [TenantResolver] Modo desarrollo → slug: "${devSlug}"`);
    return { mode: 'slug', value: devSlug };
  }

  // ── 2. Subdominio de la plataforma (slug.botaniq.com) ───
  const subdomain = getSubdomainFromHostname(hostname);
  if (subdomain) {
    logger.info(`🌐 [TenantResolver] Subdominio detectado → slug: "${subdomain}"`);
    return { mode: 'slug', value: subdomain };
  }

  // ── 2b. Dominio raíz de la plataforma (botaniq.com, www.botaniq.com) ──
  const platformDomain = getPlatformDomain();
  if (hostname === platformDomain || hostname === `www.${platformDomain}`) {
    // En producción, el dominio raíz es la landing SaaS → no tiene tenant
    // pero para compatibilidad, retornamos un slug de fallback
    const fallbackSlug = import.meta.env.VITE_STORE_SLUG || 'demo';
    return { mode: 'slug', value: fallbackSlug };
  }

  // ── 3. Custom domain (ej. www.mifloreria.com) ────────────────
  // Normalizar: quitar 'www.' para la búsqueda en BD
  const cleanDomain = hostname.startsWith('www.')
    ? hostname.slice(4)
    : hostname;
  logger.info(`🔗 [TenantResolver] Custom domain detectado → "${cleanDomain}"`);
  return { mode: 'domain', value: cleanDomain };
}

// ── Datos de fallback genéricos ──────────────────────────────────
const FALLBACK_TENANT: TenantConfig = {
  id: 'local-fallback',
  slug: import.meta.env.VITE_STORE_SLUG || FALLBACK_TENANT_DEFAULTS.SLUG,
  nombre: FALLBACK_TENANT_DEFAULTS.NAME,
  logo_url: null,
  color_primario: FALLBACK_TENANT_DEFAULTS.COLORS.PRIMARY,
  color_secundario: FALLBACK_TENANT_DEFAULTS.COLORS.SECONDARY,
  color_acento: FALLBACK_TENANT_DEFAULTS.COLORS.ACCENT,
  ciudad: 'Monterrey',
  estado: 'Nuevo León',
  area_metropolitana: 'área metropolitana',
  mapa_url: '',
  direccion: '',
  whatsapp: '0000000000',
  wa_base: 'https://wa.me/0000000000',
  horarios: {
    regular: 'Lunes a Domingo · 8:00 AM – 8:00 PM',
  },
  redes_sociales: {},
  nav_links: ['Catálogo', 'Servicios', 'Cobertura', 'Nosotros'],
  campana: null,
  anio_fundacion: 2020,
  texto_nosotros: 'Bienvenido a nuestra florería.',
  firma: 'El equipo',
  envio_costo: 50,
  colonias: [],
  // ── SaaS defaults ─────────────────────────────────────────────
  subscription_level: SubscriptionLevel.ESENCIA,
  custom_domain: null,
  currency: 'MXN',
  created_at: null,
  has_active_subscription: false,
  meta_title: null,
  openpay_merchant_id: null,
  openpay_public_key: null,
  openpay_private_key: null,
  openpay_sandbox_mode: true,
  preferred_gateway: 'openpay',
  // ── Secciones dinámicas ───────────────────────────────────────
  servicios: [],
  beneficios: [],
  flores: [],
  galeria: [],
  testimonios: [],
  seo: {
    titulo: '',
    descripcion: '',
    og_image: '',
  },
  evento: {
    activo: false,
    titulo: '',
    producto: '',
    fecha_fin: '',
  },
  catalogo: {
    mostrar_descripcion_en_tarjeta: false,
  },
  orden_secciones: DEFAULT_ORDEN_SECCIONES,
  secciones: {
    hero: {
      titulo: 'Flores que',
      titulo_italic: 'enamoran',
      subtitulo: 'Llegamos a todo el área metropolitana en menos de 3 horas.',
      trust_bar_1: 'Entrega en 3 horas',
    },
    servicios: {
      etiqueta: 'Ocasiones especiales',
      titulo: 'Flores para',
      titulo_italic: 'cada momento',
    },
    beneficios: {
      etiqueta: 'Por qué elegirnos',
      titulo: 'Lo que nos hace',
      titulo_italic: 'diferentes',
      imagen: 'img/minecraft.jpeg',
      metrica_valor: '+2,000',
      metrica_texto: 'Entregas',
    },
    flores: {
      etiqueta: 'Nuestra selección',
      titulo: 'La variedad',
      titulo_italic: 'que mereces',
      cita: '"Cada flor tiene un lenguaje que las palabras no alcanzan..."',
    },
    galeria: {
      etiqueta: 'Entregas reales',
      titulo: 'Así llegan',
      titulo_italic: 'nuestros arreglos',
      subtitulo: 'Fotos de clientes satisfechos — sin filtros, sin edición',
    },
    testimonios: {
      etiqueta: 'Testimonios',
      titulo: 'Flores que',
      titulo_italic: 'dejan huella',
    },
  },
};

// ── Context ──────────────────────────────────────────────────────

// Estado explícito de resolución del tenant:
//   'loading'   → resolución en curso
//   'platform'  → hostname es el dominio SaaS (mostrar landing)
//   'ready'     → tenant encontrado en BD (mostrar storefront)
//   'not_found' → subdominio/dominio no tiene tienda en BD
export type TenantStatus = 'loading' | 'platform' | 'ready' | 'not_found';

interface TenantContextValue {
  tenant: TenantConfig;
  loading: boolean;
  error: string | null;
  /** Estado de resolución del tenant para RootRouter */
  status: TenantStatus;

  /**
   * Actualiza la configuración del tenant de forma **optimista**.
   *
   * Flujo de datos:
   *   1. Se clona el estado actual como `previousState` (caché de rollback).
   *   2. Se aplica el merge `{ ...tenant, ...updates }` al state de React
   *      de forma inmediata — la UI refleja los cambios al instante.
   *   3. Se dispara un UPDATE asíncrono a Supabase (tabla `tiendas`).
   *   4. Si Supabase responde con error (red, RLS, etc.), el catch
   *      revierte `setTenant(previousState)` y re-lanza el error
   *      para que la UI pueda mostrar un toast de fallo.
   *
   * @param updates - Partial de TenantConfig con los campos a mutar.
   * @throws Error si la persistencia en Supabase falla.
   */
  updateTenantConfig: (updates: Partial<TenantConfig>) => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

function mapRowToTenant(row: Record<string, unknown>): TenantConfig {
  const configUi = (row.config_ui as Record<string, any>) || {};

  return {
    id:                 row.id as string,
    slug:               row.slug as string,
    nombre:             (row.nombre as string) ?? FALLBACK_TENANT.nombre,
    logo_url:           (row.logo_url as string) ?? null,
    color_primario:     (row.color_primario as string) ?? FALLBACK_TENANT.color_primario,
    color_secundario:   (row.color_secundario as string) ?? FALLBACK_TENANT.color_secundario,
    color_acento:       (row.color_acento as string) ?? FALLBACK_TENANT.color_acento,
    ciudad:             (row.ciudad as string) ?? FALLBACK_TENANT.ciudad,
    estado:             (row.estado as string) ?? FALLBACK_TENANT.estado,
    area_metropolitana: (row.area_metropolitana as string) ?? FALLBACK_TENANT.area_metropolitana,
    mapa_url:           (row.mapa_url as string) ?? FALLBACK_TENANT.mapa_url,
    direccion:          (row.direccion as string) ?? FALLBACK_TENANT.direccion,
    whatsapp:           (row.whatsapp as string) ?? FALLBACK_TENANT.whatsapp,
    wa_base:            (row.wa_base as string) ?? FALLBACK_TENANT.wa_base,
    horarios:           (row.horarios as TenantConfig['horarios']) ?? FALLBACK_TENANT.horarios,
    redes_sociales:     (row.redes_sociales as TenantConfig['redes_sociales']) ?? FALLBACK_TENANT.redes_sociales,
    nav_links:          (row.nav_links as string[]) ?? FALLBACK_TENANT.nav_links,
    campana:            (row.campana as TenantConfig['campana']) ?? FALLBACK_TENANT.campana,
    anio_fundacion:     (row.anio_fundacion as number) ?? FALLBACK_TENANT.anio_fundacion,
    texto_nosotros:     (row.texto_nosotros as string) ?? FALLBACK_TENANT.texto_nosotros,
    firma:              (row.firma as string) ?? FALLBACK_TENANT.firma,
    envio_costo:        (row.envio_costo as number) ?? FALLBACK_TENANT.envio_costo,
    colonias:           (row.colonias as string[]) ?? FALLBACK_TENANT.colonias,

    // ── SaaS fields ─────────────────────────────────────────────
    subscription_level: (row.subscription_level as number) ?? FALLBACK_TENANT.subscription_level,
    custom_domain:      (row.custom_domain as string) ?? FALLBACK_TENANT.custom_domain,
    currency:           (row.currency as string) ?? FALLBACK_TENANT.currency,
    created_at:         (row.created_at as string) ?? FALLBACK_TENANT.created_at,
    has_active_subscription: (row.has_active_subscription as boolean) ?? FALLBACK_TENANT.has_active_subscription,
    meta_title:         (row.meta_title as string) ?? null,
    openpay_merchant_id:  (row.openpay_merchant_id as string) ?? null,
    openpay_public_key:   (row.openpay_public_key as string) ?? null,
    openpay_private_key:  (row.openpay_private_key as string) ?? null,
    openpay_sandbox_mode:  (row.openpay_sandbox_mode as boolean) ?? true,
    preferred_gateway:     (row.preferred_gateway as 'stripe' | 'openpay') ?? 'openpay',

    // Arrays extraídos del JSONB config_ui
    servicios:          configUi.servicios || [],
    beneficios:         configUi.beneficios || [],
    flores:             configUi.flores || [],
    galeria:            configUi.galeria || [],
    testimonios:        configUi.testimonios || [],
    seo:                configUi.seo || { titulo: '', descripcion: '', og_image: '' },
    evento:             configUi.evento || { activo: false, titulo: '', producto: '', fecha_fin: '' },
    orden_secciones:    configUi.orden_secciones || DEFAULT_ORDEN_SECCIONES,
    font_family:        configUi.font_family,
    secciones:          configUi.secciones || FALLBACK_TENANT.secciones,
    catalogo:           configUi.catalogo || { mostrar_descripcion_en_tarjeta: false },
  };
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantConfig>(FALLBACK_TENANT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<TenantStatus>('loading');
  const { profile } = useAuth();

  // ── FIX DT-02: Resolución dinámica del tenant ─────────────────
  // En lugar de leer siempre de VITE_STORE_SLUG, detectamos el
  // entorno (localhost, subdominio, custom domain) y construimos
  // la query de Supabase dinámicamente.
  useEffect(() => {
    let cancelled = false;

    async function fetchTenant() {
      // Inicia el fetch. Si es una re-evaluación por cambio de perfil,
      // debemos volver a marcar el estado como cargando para evitar que
      // los consumidores lean datos obsoletos del fallback.
      if (!cancelled) {
        setLoading(true);
        setStatus('loading');
      }

      const hostname = window.location.hostname;

      // ── Detección de dominio de la plataforma ──────────────────
      // Si el hostname es el dominio raíz del SaaS (botaniq.com,
      // localhost, staging base), no hay tenant que resolver.
      // EXCEPCIÓN: si el usuario está logueado como dueño/empleado
      // en un entorno de override, resolvemos su tienda igualmente
      // para que /admin funcione.
      const isOverrideEnvironment =
        import.meta.env.DEV ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.vercel.app') ||
        hostname.endsWith('.railway.app') ||
        /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);

      const platformDetected = isPlatformDomain(hostname);
      const isAdminPath = window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/superadmin');
      
      const hasProfileOverride = 
        (isOverrideEnvironment || isAdminPath) && 
        profile?.tienda_id && 
        (profile.rol === 'dueño' || profile.rol === 'empleado' || profile.rol === 'superadmin');

      // Si es dominio de plataforma Y no hay override de perfil,
      // marcamos status como 'platform' y terminamos.
      if (platformDetected && !hasProfileOverride) {
        if (!cancelled) {
          setStatus('platform');
          setLoading(false);
        }
        return;
      }

      try {
        // Construir query dinámica según el modo de resolución
        let query = supabase.from('tiendas').select('id, slug, nombre, logo_url, color_primario, color_secundario, color_acento, ciudad, estado, area_metropolitana, mapa_url, direccion, whatsapp, wa_base, horarios, redes_sociales, nav_links, campana, anio_fundacion, texto_nosotros, firma, envio_costo, colonias, subscription_level, custom_domain, currency, created_at, meta_title, config_ui, openpay_merchant_id, openpay_public_key, openpay_sandbox_mode, preferred_gateway');

        if (hasProfileOverride) {
          logger.info(`🔧 [TenantContext] Entorno override detectado. Forzando tienda_id: "${profile.tienda_id}"`);
          query = query.eq('id', profile.tienda_id);
        } else {
          const identifier = resolveTenantIdentifier();
          if (identifier.mode === 'slug') {
            query = query.eq('slug', identifier.value);
          } else {
            // mode === 'domain' — buscar por custom_domain
            query = query.eq('custom_domain', identifier.value);
          }
        }

        const { data, error: fetchError } = await query.maybeSingle();

        if (cancelled) return;

        if (fetchError) throw fetchError;

        if (data) {
          const { data: subData } = await supabase
            .from('suscripciones')
            .select('estado')
            .eq('tenant_id', data.id)
            .eq('estado', 'activo')
            .maybeSingle();

          const hasActiveSubscription = !!subData;

          setTenant(mapRowToTenant({
            ...data,
            has_active_subscription: hasActiveSubscription
          }));
          setStatus('ready');
        } else {
          // Subdominio o custom domain no encontrado en BD
          logger.warn('⚠️ [TenantContext] Tenant no encontrado. Status: not_found');
          setStatus('not_found');
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error 
            ? err.message 
            : (err && typeof err === 'object' && 'message' in err)
              ? String((err as any).message)
              : JSON.stringify(err);
          logger.warn(
            `⚠️ [TenantContext] Usando fallback. ` +
            (hasProfileOverride
              ? `Modo: ID forzado, Valor: "${profile?.tienda_id}". ` 
              : `Modo: dinámico, Razón: ${message}`)
          );
          setError(message);
          setStatus('not_found');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTenant();
    return () => { cancelled = true; };
  }, [profile?.tienda_id, profile?.rol]);

  // ── Listener para vista previa en tiempo real (Store Builder Iframe) ──
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'UPDATE_PREVIEW' && event.data?.payload) {
        setTenant(prev => prev ? { ...prev, ...event.data.payload } : null);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ── Listener de Supabase Realtime (Sincronización Multi-dispositivo) ──
  useEffect(() => {
    if (!tenant?.id || tenant.id === 'local-fallback') return;

    const channel = supabase
      .channel(`tenant-changes-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tiendas',
          filter: `id=eq.${tenant.id}`,
        },
        async (payload) => {
          logger.info('🔄 [TenantContext] Actualización recibida vía Realtime.');
          const { data: subData } = await supabase
            .from('suscripciones')
            .select('estado')
            .eq('tenant_id', tenant.id)
            .eq('estado', 'activo')
            .maybeSingle();
          const hasActive = !!subData;
          setTenant(mapRowToTenant({
            ...(payload.new as Record<string, unknown>),
            has_active_subscription: hasActive
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id]);

  // ── Inyección de variables CSS en :root (Vía useTheming) ───────
  useTheming(tenant);

  useEffect(() => {
    const cleanEmojis = (text: string) => {
      return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
    };

    // 1. Actualizar el título de la página
    if (status === 'platform') {
      document.title = 'BotaniQ — Crea tu tienda de flores online';
    } else if (status === 'ready' && tenant) {
      const fallbackTitle = `${tenant.nombre} — ${tenant.ciudad}`;
      const titleToUse = tenant.meta_title ? tenant.meta_title : fallbackTitle;
      document.title = cleanEmojis(titleToUse);
    } else {
      document.title = 'BotaniQ — Crea tu tienda de flores online';
    }

    // 2. Actualizar el Favicon y el Apple Touch Icon de forma dinámica
    let faviconUrl = '/logo.webp';
    if (status === 'ready' && tenant?.logo_url) {
      faviconUrl = tenant.logo_url;
    }

    // Actualizar <link rel="icon">
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
    if (faviconUrl.endsWith('.webp')) {
      link.type = 'image/webp';
    } else if (faviconUrl.endsWith('.png')) {
      link.type = 'image/png';
    } else if (faviconUrl.endsWith('.ico')) {
      link.type = 'image/x-icon';
    } else {
      link.type = 'image/jpeg';
    }

    // Actualizar <link rel="apple-touch-icon"> (Para accesos directos de PWA en móviles)
    let appleLink: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']");
    if (!appleLink) {
      appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      document.head.appendChild(appleLink);
    }
    appleLink.href = faviconUrl;
  }, [status, tenant]);

  /**
   * Mutación optimista con rollback automático.
   *
   * Arquitectura del flujo:
   * ┌────────────┐    ┌─────────────────┐    ┌──────────────┐
   * │ UI (Admin) │───▶│ setTenant(merge) │───▶│  Supabase    │
   * │  dispatch  │    │  (optimista)     │    │  UPDATE      │
   * └────────────┘    └────────┬────────┘    └──────┬───────┘
   *                           │                      │
   *                   OK ◄────┘               Error ─┤
   *                                                  ▼
   *                                    setTenant(previousState)
   *                                    throw Error → UI muestra toast
   *
   * Los campos que se persisten en Supabase se dividen en dos capas:
   *   • Columnas directas: color_primario, color_secundario, etc.
   *   • JSONB config_ui: orden_secciones, secciones, etc.
   */
  const tenantId = tenant?.id;
  const tenantRef = useRef(tenant);

  // Mantener el ref actualizado con el último estado de React
  useEffect(() => {
    tenantRef.current = tenant;
  }, [tenant]);

  /**
   * Mutación optimista con rollback automático.
   */
  const updateTenantConfig = useCallback(
    async (updates: Partial<TenantConfig>): Promise<void> => {
      if (!tenantId) return;

      const currentTenant = tenantRef.current;
      if (!currentTenant) return;

      // 1️⃣ Clonar el estado actual como caché de rollback
      const previousState = { ...currentTenant };

      // 2️⃣ Aplicar merge optimista — la UI refleja el cambio inmediatamente
      const merged = { ...currentTenant, ...updates };
      
      // Actualizar el ref de forma síncrona para soportar actualizaciones rápidas consecutivas
      tenantRef.current = merged;
      setTenant(merged);

      // 3️⃣ Construir el payload para Supabase
      //    Separamos columnas directas de los campos que viven en config_ui (JSONB)
      const directColumns: Record<string, unknown> = {};
      const configUiFields = [
        'servicios', 'beneficios', 'flores', 'galeria',
        'testimonios', 'seo', 'evento', 'orden_secciones', 'secciones', 'catalogo',
      ];

      // Campos que son columnas directas en la tabla `tiendas`
      const directFieldNames = [
        'nombre', 'logo_url', 'color_primario', 'color_secundario',
        'color_acento', 'ciudad', 'estado', 'area_metropolitana',
        'mapa_url', 'direccion', 'whatsapp', 'wa_base', 'horarios', 'redes_sociales',
        'nav_links', 'campana', 'anio_fundacion', 'texto_nosotros',
        'firma', 'envio_costo', 'colonias',
        'meta_title',
        'openpay_merchant_id', 'openpay_public_key', 'openpay_private_key', 'openpay_sandbox_mode', 'preferred_gateway',
        // SaaS columns (read-only from admin, but included for completeness)
        'custom_domain', 'currency',
      ];

      for (const key of Object.keys(updates)) {
        if (directFieldNames.includes(key)) {
          directColumns[key] = (updates as Record<string, unknown>)[key];
        }
      }

      // Reconstruir config_ui completo con los cambios aplicados
      const newConfigUi: Record<string, unknown> = {};
      for (const field of configUiFields) {
        newConfigUi[field] = (merged as Record<string, unknown>)[field];
      }

      try {
        // 4️⃣ Persistir en Supabase (UPDATE a la tabla `tiendas`)
        const payload: Record<string, unknown> = {
          ...directColumns,
          config_ui: newConfigUi,
        };

        const { error: updateError } = await supabase
          .from('tiendas')
          .update(payload)
          .eq('id', tenantId);

        if (updateError) throw updateError;

        logger.info('✅ [TenantContext] Configuración guardada en Supabase.');
      } catch (err) {
        // 5️⃣ ROLLBACK — revertir al estado anterior en ref y en estado
        tenantRef.current = previousState;
        setTenant(previousState);
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`❌ [TenantContext] Rollback ejecutado. Error: ${message}`);
        throw new Error(`Error al guardar configuración: ${message}`);
      }
    },
    [tenantId],
  );

  const contextValue = useMemo(() => ({
    tenant, loading, error, status, updateTenantConfig
  }), [tenant, loading, error, status, updateTenantConfig]);

  return (
    <TenantContext.Provider value={contextValue}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant() debe usarse dentro de un <TenantProvider>.');
  }
  return ctx;
}
