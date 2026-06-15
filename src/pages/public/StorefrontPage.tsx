// ─── STOREFRONT PAGE — MOTOR DE RENDERIZADO DINÁMICO ────────────
// Page Builder que reemplaza el renderizado estático de App.jsx.
//
// Arquitectura:
//   1. Define un SECTIONS_MAP: diccionario clave→componente React.
//   2. Consume `orden_secciones` del TenantContext (config_ui JSONB).
//   3. Itera con .map() para renderizar secciones en el orden que
//      dicta la base de datos, no el código fuente.
//
// Esto permite que cada tenant personalice el orden de su landing
// desde el Store Builder (AdminConfiguracion.tsx) sin tocar código.
//
// SAAS_FLAG OVERVIEW:
//   NIVEL 1: Secciones básicas (Hero, Catalogo, Servicios, etc.)
//   NIVEL 2: Secciones premium (Testimonios, Galeria, InstagramFeed)
// ────────────────────────────────────────────────────────────────

import type { ComponentType } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTenant } from '../../context/TenantContext';

// ── Importación de secciones ─────────────────────────────────────
import { lazy, Suspense } from 'react';

// Eager imports para elementos "above the fold" (Mejora LCP)
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import HeroRouter from '../../components/sections/HeroRouter';
import CheckoutReturnHandler from '../../components/ui/CheckoutReturnHandler';
import GlobalFeatures from '../../components/ui/GlobalFeatures';

// Lazy imports para todo lo que está "below the fold" (Code Splitting)
const Catalogo = lazy(() => import('../../components/sections/Catalogo'));
const Servicios = lazy(() => import('../../components/sections/Servicios'));
const Testimonios = lazy(() => import('../../components/sections/Testimonios'));
const Beneficios = lazy(() => import('../../components/sections/Beneficios'));
const Flores = lazy(() => import('../../components/sections/Flores'));
const Cobertura = lazy(() => import('../../components/sections/Cobertura'));
const Nosotros = lazy(() => import('../../components/sections/Nosotros'));
const Galeria = lazy(() => import('../../components/sections/Galeria'));
const InstagramFeed = lazy(() => import('../../components/sections/InstagramFeed'));
import { logger } from '../../lib/logger';

// ═══════════════════════════════════════════════════════════════════
// ██ SECTIONS_MAP — Diccionario de componentes renderizables
// ═══════════════════════════════════════════════════════════════════
//
// Cada clave DEBE coincidir exactamente con los strings almacenados
// en el array `orden_secciones` del config_ui (Supabase JSONB).
//
// Para agregar una nueva sección al Page Builder:
//   1. Crear el componente en /components/sections/
//   2. Importarlo arriba
//   3. Añadir la entrada aquí
//   4. Agregar el nombre al array default en TenantContext
//   5. Registrar metadatos en SECTION_META de AdminConfiguracion.tsx
// ═══════════════════════════════════════════════════════════════════

const SECTIONS_MAP: Record<string, ComponentType<any>> = {
  Hero: HeroRouter,
  Catalogo,
  Servicios,
  Testimonios,
  Beneficios,
  Flores,
  Cobertura,
  Nosotros,
  Galeria,
  InstagramFeed,
};

// ═══════════════════════════════════════════════════════════════════
// ██ STOREFRONT PAGE — Componente principal de la landing pública
// ═══════════════════════════════════════════════════════════════════

/**
 * Renderiza la landing pública de forma dinámica basándose en el
 * array `orden_secciones` del TenantContext.
 *
 * Flujo de datos:
 *   1. TenantProvider (en main.jsx) hidrata el tenant desde Supabase.
 *   2. Este componente lee `tenant.orden_secciones` (array de strings).
 *   3. Para cada string, busca el componente correspondiente en SECTIONS_MAP.
 *   4. Si el componente existe, lo renderiza con una key única.
 *   5. Si no existe (typo en la DB), lo ignora silenciosamente con un warn.
 *
 * Header, Footer, CartDrawer y GlobalFeatures están FUERA del ciclo
 * dinámico porque son elementos estructurales fijos de toda landing.
 */
export default function StorefrontPage() {
  const { tenant, status } = useTenant();

  const ogImage = tenant.seo?.og_image || tenant.logo_url || '';

  return (
    <>
      <Helmet>
        <title>{tenant.seo?.titulo || `${tenant.nombre} ✦ ${tenant.ciudad}`}</title>
        <meta name="description" content={tenant.seo?.descripcion || tenant.texto_nosotros} />
        <meta property="og:title" content={tenant.seo?.titulo || tenant.nombre} />
        <meta property="og:description" content={tenant.seo?.descripcion || tenant.texto_nosotros} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:type" content="website" />
      </Helmet>

      <GlobalFeatures />
      <Header />

      <main className="min-h-screen">
        {tenant.orden_secciones.map((sectionKey) => {
          const SectionComponent = SECTIONS_MAP[sectionKey];

          if (!SectionComponent) {
            // Clave no encontrada en el diccionario — posible typo en config_ui
            logger.warn(
              `⚠️ [StorefrontPage] Sección "${sectionKey}" no existe en SECTIONS_MAP. Ignorando.`
            );
            return null;
          }

          // SAAS_FLAG: Habilitar o deshabilitar secciones premium reactivamente.
          // Si el tenant está cargando o es Nivel 1 (Básico), ocultamos el Instagram Feed.
          if (sectionKey === 'InstagramFeed' && (status === 'loading' || tenant.subscription_level < 2)) {
            return null;
          }

          // Props especiales para componentes que los necesitan
          const extraProps: Record<string, unknown> = {};
          if (sectionKey === 'InstagramFeed') {
            extraProps.slug = tenant.slug;
          }

          // Si es el Hero, renderiza directo (LCP), si no, usa Suspense
          if (sectionKey === 'Hero') {
            return <SectionComponent key={sectionKey} {...extraProps} />;
          }

          return (
            <Suspense key={sectionKey} fallback={<div className="min-h-[400px] bg-[var(--color-background-primary)] animate-pulse" />}>
              <SectionComponent {...extraProps} />
            </Suspense>
          );
        })}
      </main>

      <Footer />
      <CheckoutReturnHandler />
    </>
  );
}
