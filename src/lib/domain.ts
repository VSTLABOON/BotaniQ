// ─── DOMAIN UTILITIES ───────────────────────────────────────────
// Utilidades centralizadas para resolución de dominios y entornos.
//
// Responsabilidades:
//   1. Detectar si el hostname es la plataforma SaaS (botaniq.com)
//      o la tienda de un comerciante (subdominio / custom domain).
//   2. Extraer el slug del subdominio cuando aplique.
//   3. Construir URLs de redirección respetando el entorno actual
//      (localhost, staging en Vercel/Railway, producción).
//
// REGLA: Toda lógica de detección de hostname/entorno vive aquí.
//        Otros módulos IMPORTAN desde este archivo — no duplican.
// ────────────────────────────────────────────────────────────────

/**
 * Retorna el dominio base de la plataforma SaaS.
 * Configurable vía variable de entorno para staging.
 */
export function getPlatformDomain(): string {
  // Si hay una variable de entorno explícita, la usamos
  if (import.meta.env.VITE_PLATFORM_DOMAIN) {
    return import.meta.env.VITE_PLATFORM_DOMAIN;
  }
  
  const hostname = window.location.hostname;
  
  // Si es localhost o una IP, no hay apex domain real
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)
  ) {
    return 'botaniq.com'; // fallback para local
  }
  
  // Si termina en vercel.app o railway.app, la plataforma base es el dominio de vercel/railway
  if (hostname.endsWith('.vercel.app')) {
    const parts = hostname.split('.');
    if (parts.length > 3) {
      return parts.slice(parts.length - 3).join('.');
    }
    return hostname;
  }
  if (hostname.endsWith('.railway.app')) {
    const parts = hostname.split('.');
    if (parts.length > 3) {
      return parts.slice(parts.length - 3).join('.');
    }
    return hostname;
  }

  // Para dominios normales, extraemos los últimos dos segmentos (o tres si es com.mx, co.uk, etc.)
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    const isThreePart = parts.length >= 3 && 
      ['com', 'org', 'net', 'edu', 'gob', 'co'].includes(parts[parts.length - 2]) &&
      parts[parts.length - 1].length === 2; // e.g. .com.mx
    
    const sliceCount = isThreePart ? 3 : 2;
    return parts.slice(parts.length - sliceCount).join('.');
  }
  
  return 'botaniq.com';
}

/**
 * Detecta si un hostname corresponde al dominio de la plataforma SaaS
 * (landing page, login principal, onboarding) o a un entorno de desarrollo.
 *
 * Retorna true para:
 *   • botaniq.com / www.botaniq.com (producción raíz)
 *   • localhost / 127.0.0.1 / IPs locales (desarrollo)
 *   • botaniq-staging.vercel.app (staging base, ≤3 segmentos)
 *
 * Retorna false para:
 *   • flores.botaniq.com (subdominio de cliente)
 *   • flores.botaniq-staging.vercel.app (subdominio de cliente en staging, 4+ segmentos)
 *   • floresdelcorazon.com (custom domain)
 */
export function isPlatformDomain(hostname: string): boolean {
  const platform = getPlatformDomain();

  // Dominio raíz o www
  if (hostname === platform || hostname === `www.${platform}`) {
    return true;
  }

  // Desarrollo local
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)
  ) {
    return true;
  }

  // Staging base en Vercel o Railway (sin subdominio de cliente)
  // ej: botaniq-staging.vercel.app → 3 partes → plataforma
  // ej: flores.botaniq-staging.vercel.app → 4 partes → tienda
  if (hostname.endsWith('.vercel.app') || hostname.endsWith('.railway.app')) {
    const parts = hostname.split('.');
    if (parts.length <= 3) {
      return true;
    }
  }

  return false;
}

/**
 * Extrae el subdominio de cliente del hostname actual.
 *
 * Ejemplos:
 *   flores.botaniq.com → "flores"
 *   www.botaniq.com    → null (www no es un tenant)
 *   botaniq.com        → null (dominio raíz)
 *   floresdelcorazon.com → null (custom domain, no subdominio)
 *
 * @returns El slug del subdominio o null si no aplica
 */
export function getSubdomainFromHostname(hostname: string): string | null {
  const platform = getPlatformDomain();

  if (hostname.endsWith(`.${platform}`)) {
    const subdomain = hostname.slice(0, -(platform.length + 1));
    // Ignorar 'www' — no es un tenant
    if (subdomain && subdomain !== 'www') {
      return subdomain;
    }
    return null;
  }

  // Staging en Vercel/Railway con subdominio de cliente
  // ej: flores.botaniq-staging.vercel.app → subdomain = "flores"
  if (hostname.endsWith('.vercel.app') || hostname.endsWith('.railway.app')) {
    const parts = hostname.split('.');
    if (parts.length > 3) {
      return parts[0];
    }
  }

  return null;
}

/**
 * Construye la URL completa para un subdominio de cliente,
 * respetando el entorno actual (local, staging o producción).
 *
 * En local: no cambia de host (evita romper cookies/sesión).
 * En staging: preserva la base del entorno y usa query params (ya que no hay wildcard dns).
 * En producción: usa el dominio de la plataforma.
 *
 * @param subdomain - El slug del comerciante (ej: "flores")
 * @param path - Ruta opcional (ej: "/admin")
 * @returns URL completa (ej: "https://flores.botaniq.com/admin")
 */
export function getSubdomainUrl(subdomain: string, path: string = ''): string {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : '';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Local: mantenerse en el mismo host
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)
  ) {
    const joinChar = cleanPath.includes('?') ? '&' : '?';
    return `${protocol}//${hostname}${port}${cleanPath}${joinChar}store=${subdomain}`;
  }

  // Staging en Vercel/Railway: como no soportan wildcards por defecto,
  // usamos query parameters (?store=slug) en el dominio base.
  if (hostname.endsWith('.vercel.app') || hostname.endsWith('.railway.app')) {
    const parts = hostname.split('.');
    const baseStaging = parts.length > 3
      ? parts.slice(parts.length - 3).join('.')
      : hostname;
    const joinChar = cleanPath.includes('?') ? '&' : '?';
    return `${protocol}//${baseStaging}${port}${cleanPath}${joinChar}store=${subdomain}`;
  }

  // Producción real
  const platform = getPlatformDomain();
  return `${protocol}//${subdomain}.${platform}${port}${cleanPath}`;
}
