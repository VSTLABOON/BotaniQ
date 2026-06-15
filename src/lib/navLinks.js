const SECCION_LABELS = {
  hero: null, // el hero no aparece en navegación
  catalogo: 'Catálogo',
  servicios: 'Servicios',
  beneficios: 'Nosotros',
  variedades: 'Flores',
  galeria: 'Galería',
  testimonios: 'Testimonios',
  cobertura: 'Cobertura',
  instagram: null, // el feed de instagram no aparece en navegación
  evento_especial: null, // el banner no aparece en navegación
};

export function getNavLinksFromSecciones(ordenSecciones = [], staticNavLinks = []) {
  const normalizedSecciones = (ordenSecciones || []).map(k => k.toLowerCase());

  if (normalizedSecciones.length === 0) {
    return (staticNavLinks || []).map(label => {
      const cleanAnchor = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return {
        label,
        href: `#${cleanAnchor}`,
      };
    });
  }

  return normalizedSecciones
    .filter(key => {
      const lookupKey = key === 'flores' ? 'variedades' : key;
      return SECCION_LABELS[lookupKey] !== undefined && SECCION_LABELS[lookupKey] !== null;
    })
    .map(key => {
      const lookupKey = key === 'flores' ? 'variedades' : key;
      return {
        label: SECCION_LABELS[lookupKey],
        href: `#${key}`,
      };
    });
}
