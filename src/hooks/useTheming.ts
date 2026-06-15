import { useEffect } from 'react';

/**
 * Calcula la luminancia relativa de un color HEX (WCAG 2.0).
 */
export function getLuminance(hex: string): number {
  let rgb = hex.replace('#', '');
  if (rgb.length === 3) rgb = rgb.split('').map(c => c + c).join('');
  
  const r = parseInt(rgb.substring(0, 2), 16) / 255;
  const g = parseInt(rgb.substring(2, 4), 16) / 255;
  const b = parseInt(rgb.substring(4, 6), 16) / 255;
  
  const [R, G, B] = [r, g, b].map(c => {
    if (c <= 0.03928) return c / 12.92;
    return Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Calcula la ratio de contraste entre dos colores (luminancias).
 */
export function getContrastRatio(lum1: number, lum2: number): number {
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

export interface ThemeData {
  color_primario?: string;
  color_secundario?: string;
  color_acento?: string;
  font_family?: string;
}

/**
 * Hook para inyectar variables CSS de Theming y cargar fuentes dinámicamente.
 */
export function useTheming(themeData: ThemeData, isLivePreview = false) {
  useEffect(() => {
    if (!themeData?.color_primario) return;
    const root = document.documentElement;

    // 1. Inyectar Colores
    let colorPrimario = themeData.color_primario;
    let colorSecundario = themeData.color_secundario || '#3A6B34';
    let colorAcento = themeData.color_acento || '#C49A3C';

    const params = new URLSearchParams(window.location.search);
    if (params.get('preview') === 'true') {
      const pColor = params.get('color_primario');
      if (pColor) colorPrimario = pColor;
      const sColor = params.get('color_secundario');
      if (sColor) colorSecundario = sColor;
      const aColor = params.get('color_acento');
      if (aColor) colorAcento = aColor;
    }

    root.style.setProperty('--color-primario', colorPrimario);
    root.style.setProperty('--color-secundario', colorSecundario);
    root.style.setProperty('--color-acento', colorAcento);
    
    // Variaciones para Tailwind y efectos glassmorphism
    root.style.setProperty('--color-primario-rgb', hexToRgbValues(colorPrimario));
    root.style.setProperty('--color-primario-alpha-10', `rgba(${hexToRgbValues(colorPrimario)}, 0.1)`);
    root.style.setProperty('--color-primario-alpha-20', `rgba(${hexToRgbValues(colorPrimario)}, 0.2)`);
    
    // Cálculo de Contraste WCAG para el texto sobre el color primario
    const lum = getLuminance(colorPrimario);
    const lumWhite = 1; 
    const contrastRatio = getContrastRatio(lum, lumWhite);
    const textColor = contrastRatio < 4.5 ? '#1A1A1A' : '#FFFFFF';
    root.style.setProperty('--color-primario-texto', textColor);

    // 2. Cargar y Aplicar Tipografía
    if (themeData.font_family) {
      const fontId = 'dynamic-google-font';
      let linkElement = document.getElementById(fontId) as HTMLLinkElement;
      
      if (!linkElement) {
        linkElement = document.createElement('link');
        linkElement.id = fontId;
        linkElement.rel = 'stylesheet';
        document.head.appendChild(linkElement);
      }
      
      // Construir URL de Google Fonts (reemplaza espacios por +)
      const fontName = themeData.font_family.replace(/\s+/g, '+');
      const fontUrl = `https://fonts.googleapis.com/css2?family=${fontName}:wght@300;400;500;600;700&display=swap`;
      
      if (linkElement.href !== fontUrl) {
        linkElement.href = fontUrl;
      }

      root.style.setProperty('--font-body', `'${themeData.font_family}', system-ui, sans-serif`);
      root.style.setProperty('--font-display', `'${themeData.font_family}', Georgia, serif`);
    }
  }, [
    themeData?.color_primario,
    themeData?.color_secundario,
    themeData?.color_acento,
    themeData?.font_family,
    isLivePreview
  ]);
}

/**
 * Helper para convertir HEX a valores RGB separados por coma (para usar en rgba)
 */
function hexToRgbValues(hex: string): string {
  let rgb = hex.replace('#', '');
  if (rgb.length === 3) rgb = rgb.split('').map(c => c + c).join('');
  const r = parseInt(rgb.substring(0, 2), 16);
  const g = parseInt(rgb.substring(2, 4), 16);
  const b = parseInt(rgb.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
