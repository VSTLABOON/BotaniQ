/**
 * Utilidades de formato y limpieza de entradas para BotaniQ
 */

/**
 * Transforma enlaces cortos de compartir (Google/Apple Maps) o direcciones en texto
 * en una URL de incrustación segura para <iframe> con COSTO CERO.
 */
export const cleanGoogleMapsUrl = (input: string): string => {
  if (!input) return '';
  const trimmed = input.trim();

  // 1. Si el usuario pegó el código iframe completo de Google Maps (<iframe src="...">)
  const srcMatch = trimmed.match(/src=["']([^"']+)["']/);
  if (srcMatch && srcMatch[1]) {
    return srcMatch[1];
  }

  // 2. Si pegó una URL que ya viene en formato de incrustación pública
  if (trimmed.includes('maps.google.com') && trimmed.includes('output=embed')) {
    return trimmed;
  }

  // 3. Enlaces de compartir (Google/Apple) o direcciones de texto plano
  const encodedQuery = encodeURIComponent(trimmed);

  // Endpoint público y gratuito de Google Maps para búsquedas incrustadas
  // iwloc=B fuerza a mostrar el pin de ubicación de forma clara.
  return `https://maps.google.com/maps?q=${encodedQuery}&t=&z=16&ie=UTF8&iwloc=B&output=embed`;
};

/**
 * Normaliza y extrae el nombre de usuario de Instagram a partir de un enlace o arroba.
 */
export const cleanInstagramUsername = (input: string): string => {
  if (!input) return '';
  let cleaned = input.trim();

  // Eliminar diagonales al final
  cleaned = cleaned.replace(/\/+$/, '');

  // Si es un enlace de Instagram
  if (cleaned.includes('instagram.com')) {
    try {
      const url = new URL(cleaned.startsWith('http') ? cleaned : `https://${cleaned}`);
      const pathSegments = url.pathname.split('/').filter(Boolean);
      if (pathSegments.length > 0) {
        cleaned = pathSegments[pathSegments.length - 1];
      }
    } catch (e) {
      const match = cleaned.match(/instagram\.com\/([^/?#]+)/i);
      if (match && match[1]) {
        cleaned = match[1];
      }
    }
  }

  // Quitar el arroba si existe
  cleaned = cleaned.replace(/^@/, '');

  return cleaned;
};

/**
 * Normaliza un enlace de Facebook, convirtiendo nombres de usuario sueltos en URLs completas.
 */
export const cleanFacebookUrl = (input: string): string => {
  if (!input) return '';
  let cleaned = input.trim();

  // Si es un nombre de usuario suelto
  if (cleaned && !cleaned.includes('facebook.com') && !cleaned.startsWith('http') && !cleaned.startsWith('www.')) {
    cleaned = cleaned.replace(/^@/, '');
    cleaned = `https://facebook.com/${cleaned}`;
  } else if (cleaned && cleaned.includes('facebook.com') && !cleaned.startsWith('http')) {
    cleaned = `https://${cleaned}`;
  }

  return cleaned;
};

/**
 * Limpia y normaliza un número de WhatsApp, previniendo duplicación de código de país 52
 * y formateando números locales de 10 dígitos.
 */
export const cleanWhatsappNumber = (input: string): string => {
  if (!input) return '';
  let cleaned = input.replace(/\D/g, '');

  // Si comienza con 5252 duplicado por múltiples formateos, limpiar el extra
  while (cleaned.startsWith('5252') && cleaned.length > 12) {
    cleaned = cleaned.substring(2);
  }

  // Si es un número local mexicano de exactamente 10 dígitos, anteponer 52
  if (cleaned.length === 10) {
    cleaned = '52' + cleaned;
  }

  return cleaned;
};
