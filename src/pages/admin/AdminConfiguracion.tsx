import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { type DropResult } from '@hello-pangea/dnd';
import {
  Palette,
  LayoutTemplate,
  FileText,
  Save,
  Loader2,
  ExternalLink,
  Monitor,
  Smartphone,
  Eye,
  MapPin,
  Clock
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { useTheming } from '../../hooks/useTheming';
import { supabase } from '../../lib/supabaseClient';
import { toast } from '../../store/toastStore';
import { logger } from '../../lib/logger';
import { TenantConfigSchema, TenantConfigBaseSchema } from '../../lib/schemas';
import { getSubdomainUrl } from '../../lib/domain';

// --- Subcomponentes Extraídos ---
import { TemaTab } from './components/config/TemaTab';
import { GeneralTab } from './components/config/GeneralTab';
import { ContenidoTab } from './components/config/ContenidoTab';
import { CoberturaTab } from './components/config/CoberturaTab';
import { HorariosTab } from './components/config/HorariosTab';

import { FONT_OPTIONS } from '../../lib/constants.ts';

function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

export default function AdminConfiguracion() {
  const { tenant, loading, updateTenantConfig } = useTenant();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const activeTab = (tabParam === 'general' || tabParam === 'contenido' || tabParam === 'tema' || tabParam === 'cobertura' || tabParam === 'horarios')
    ? tabParam
    : 'tema';

  const setActiveTab = (tab: 'tema' | 'general' | 'contenido' | 'cobertura' | 'horarios') => {
    setSearchParams({ tab });
  };

  // Control de apertura de acordeones para atajos de edición
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    Hero: true,
    Nosotros: true,
    Cobertura: false,
  });

  const handleToggleAccordion = useCallback((key: string, isOpen: boolean) => {
    setOpenAccordions(prev => ({
      ...prev,
      [key]: isOpen
    }));
  }, []);

  const handleEditSection = useCallback((sectionKey: string) => {
    if (sectionKey === 'Catalogo') {
      navigate('/admin/catalogo');
      return;
    }

    const tabMap: Record<string, 'tema' | 'general' | 'contenido'> = {
      Hero: 'contenido',
      Servicios: 'contenido',
      Beneficios: 'contenido',
      Testimonios: 'contenido',
      Flores: 'contenido',
      Galeria: 'contenido',
      Nosotros: 'general',
      Cobertura: 'general',
    };

    const targetTab = tabMap[sectionKey];
    if (!targetTab) return;

    setActiveTab(targetTab);

    if (sectionKey === 'Hero' || sectionKey === 'Nosotros' || sectionKey === 'Cobertura') {
      setOpenAccordions(prev => ({
        ...prev,
        [sectionKey]: true
      }));
    }

    // Desplazamiento suave y efecto destello (glow)
    setTimeout(() => {
      const element = document.getElementById(`editor-${sectionKey}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-4', 'ring-emerald-500/30', 'border-emerald-500');
        setTimeout(() => {
          element.classList.remove('ring-4', 'ring-emerald-500/30', 'border-emerald-500');
        }, 2000);
      }
    }, 150);
  }, [navigate]);

  // Tema
  const [colorPrimario, setColorPrimario]     = useState(tenant.color_primario);
  const [colorSecundario, setColorSecundario] = useState(tenant.color_secundario);
  const [colorAcento, setColorAcento]         = useState(tenant.color_acento);
  const [fontFamily, setFontFamily]           = useState(tenant.font_family || 'Inter');
  const [logoPreview, setLogoPreview]         = useState<string | null>(tenant.logo_url);
  const [logoError, setLogoError]             = useState<string | null>(null);
  const [sections, setSections]               = useState<string[]>(tenant.orden_secciones);

  // Información General
  const [textoNosotros, setTextoNosotros] = useState(tenant.texto_nosotros || '');
  const [anioFundacion, setAnioFundacion] = useState<number | string>(tenant.anio_fundacion || '');
  const [firma, setFirma] = useState(tenant.firma || '');
  const [mapaUrl, setMapaUrl] = useState(tenant.mapa_url || '');
  const [direccion, setDireccion] = useState(tenant.direccion || '');
  const [colonias, setColonias] = useState(tenant.colonias?.join(', ') || '');
  const [metaTitle, setMetaTitle] = useState(tenant.meta_title || '');
  const [zonasEnvio, setZonasEnvio] = useState(tenant.zonas_envio || []);

  // Ubicación Principal
  const [ciudad, setCiudad]                   = useState(tenant.ciudad || 'Monterrey');
  const [estado, setEstado]                   = useState(tenant.estado || 'Nuevo León');
  const [areaMetropolitana, setAreaMetropolitana] = useState(tenant.area_metropolitana || 'área metropolitana');

  // Redes Sociales y Contacto
  const [whatsapp, setWhatsapp]               = useState(tenant.whatsapp || '0000000000');
  const [instagram, setInstagram]             = useState(tenant.redes_sociales?.instagram || '');
  const [facebook, setFacebook]               = useState(tenant.redes_sociales?.facebook || '');
  const [customDomain, setCustomDomain]       = useState(tenant.custom_domain || '');

  // Horarios de Atención
  const [horarioRegular, setHorarioRegular]   = useState(tenant.horarios?.regular || 'Lunes a Domingo · 9:00 AM – 6:00 PM');
  const [horarioEspecial, setHorarioEspecial] = useState(tenant.horarios?.especial || '');

  // Pasarelas de Pago (OpenPay / Stripe)
  const [preferredGateway, setPreferredGateway]     = useState<'stripe' | 'openpay'>(tenant.preferred_gateway || 'openpay');
  const [openpayMerchantId, setOpenpayMerchantId]   = useState(tenant.openpay_merchant_id || '');
  const [openpayPublicKey, setOpenpayPublicKey]     = useState(tenant.openpay_public_key || '');
  const [openpayPrivateKey, setOpenpayPrivateKey]   = useState(tenant.openpay_private_key || '');
  const [openpaySandboxMode, setOpenpaySandboxMode] = useState(tenant.openpay_sandbox_mode ?? true);

  // Evento/Promoción
  const [eventoActivo, setEventoActivo] = useState(tenant.evento?.activo || false);
  const [eventoTitulo, setEventoTitulo] = useState(tenant.evento?.titulo || '');
  const [eventoProducto, setEventoProducto] = useState(tenant.evento?.producto || '');
  const [eventoFechaFin, setEventoFechaFin] = useState(tenant.evento?.fecha_fin || '');

  // Catálogo Config
  const [mostrarDescripcionEnTarjeta, setMostrarDescripcionEnTarjeta] = useState(tenant.catalogo?.mostrar_descripcion_en_tarjeta ?? false);

  // Contenido Dinámico
  const [seccionesData, setSeccionesData] = useState(tenant.secciones || {});
  const [serviciosList, setServiciosList] = useState(tenant.servicios || []);
  const [beneficiosList, setBeneficiosList] = useState(tenant.beneficios || []);
  const [testimoniosList, setTestimoniosList] = useState(tenant.testimonios || []);
  const [floresList, setFloresList] = useState(tenant.flores || []);
  const [galeriaList, setGaleriaList] = useState(tenant.galeria || []);

  const [saving, setSaving] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  // --- Dirty State ---
  const hasUnsavedChanges = useMemo(() => {
    return (
      colorPrimario !== tenant.color_primario ||
      colorSecundario !== tenant.color_secundario ||
      colorAcento !== tenant.color_acento ||
      fontFamily !== (tenant.font_family || 'Inter') ||
      logoPreview !== tenant.logo_url ||
      JSON.stringify(sections) !== JSON.stringify(tenant.orden_secciones) ||
      textoNosotros !== (tenant.texto_nosotros || '') ||
      anioFundacion !== (tenant.anio_fundacion || '') ||
      firma !== (tenant.firma || '') ||
      mapaUrl !== (tenant.mapa_url || '') ||
      direccion !== (tenant.direccion || '') ||
      colonias !== (tenant.colonias?.join(', ') || '') ||
      metaTitle !== (tenant.meta_title || '') ||
      JSON.stringify(zonasEnvio) !== JSON.stringify(tenant.zonas_envio || []) ||
      eventoActivo !== (tenant.evento?.activo || false) ||
      eventoTitulo !== (tenant.evento?.titulo || '') ||
      eventoProducto !== (tenant.evento?.producto || '') ||
      eventoFechaFin !== (tenant.evento?.fecha_fin || '') ||
      JSON.stringify(serviciosList) !== JSON.stringify(tenant.servicios || []) ||
      JSON.stringify(beneficiosList) !== JSON.stringify(tenant.beneficios || []) ||
      JSON.stringify(testimoniosList) !== JSON.stringify(tenant.testimonios || []) ||
      JSON.stringify(floresList) !== JSON.stringify(tenant.flores || []) ||
      JSON.stringify(galeriaList) !== JSON.stringify(tenant.galeria || []) ||
      JSON.stringify(seccionesData) !== JSON.stringify(tenant.secciones || {}) ||
      ciudad !== (tenant.ciudad || 'Monterrey') ||
      estado !== (tenant.estado || 'Nuevo León') ||
      areaMetropolitana !== (tenant.area_metropolitana || 'área metropolitana') ||
      whatsapp !== (tenant.whatsapp || '0000000000') ||
      instagram !== (tenant.redes_sociales?.instagram || '') ||
      facebook !== (tenant.redes_sociales?.facebook || '') ||
      customDomain !== (tenant.custom_domain || '') ||
      horarioRegular !== (tenant.horarios?.regular || 'Lunes a Domingo · 9:00 AM – 6:00 PM') ||
      horarioEspecial !== (tenant.horarios?.especial || '') ||
      preferredGateway !== (tenant.preferred_gateway || 'openpay') ||
      openpayMerchantId !== (tenant.openpay_merchant_id || '') ||
      openpayPublicKey !== (tenant.openpay_public_key || '') ||
      openpayPrivateKey !== (tenant.openpay_private_key || '') ||
      openpaySandboxMode !== (tenant.openpay_sandbox_mode ?? true) ||
      mostrarDescripcionEnTarjeta !== (tenant.catalogo?.mostrar_descripcion_en_tarjeta ?? false)
    );
  }, [
    colorPrimario, colorSecundario, colorAcento, fontFamily, logoPreview, sections,
    textoNosotros, anioFundacion, firma, mapaUrl, direccion, colonias, metaTitle,
    serviciosList, beneficiosList, testimoniosList, floresList, galeriaList, seccionesData,
    tenant, zonasEnvio,
    ciudad, estado, areaMetropolitana, whatsapp, instagram, facebook, customDomain,
    horarioRegular, horarioEspecial,
    eventoActivo, eventoTitulo, eventoProducto, eventoFechaFin,
    preferredGateway, openpayMerchantId, openpayPublicKey, openpayPrivateKey, openpaySandboxMode,
    mostrarDescripcionEnTarjeta
  ]);

  const handleDiscard = useCallback(() => {
    setColorPrimario(tenant.color_primario);
    setColorSecundario(tenant.color_secundario);
    setColorAcento(tenant.color_acento);
    setFontFamily(tenant.font_family || 'Inter');
    setSections(tenant.orden_secciones);
    setLogoPreview(tenant.logo_url);
    setTextoNosotros(tenant.texto_nosotros || '');
    setAnioFundacion(tenant.anio_fundacion || '');
    setFirma(tenant.firma || '');
    setMapaUrl(tenant.mapa_url || '');
    setDireccion(tenant.direccion || '');
    setColonias(tenant.colonias?.join(', ') || '');
    setMetaTitle(tenant.meta_title || '');
    setZonasEnvio(tenant.zonas_envio || []);
    setEventoActivo(tenant.evento?.activo || false);
    setEventoTitulo(tenant.evento?.titulo || '');
    setEventoProducto(tenant.evento?.producto || '');
    setEventoFechaFin(tenant.evento?.fecha_fin || '');
    setMostrarDescripcionEnTarjeta(tenant.catalogo?.mostrar_descripcion_en_tarjeta ?? false);
    setServiciosList(tenant.servicios || []);
    setBeneficiosList(tenant.beneficios || []);
    setTestimoniosList(tenant.testimonios || []);
    setFloresList(tenant.flores || []);
    setGaleriaList(tenant.galeria || []);
    setSeccionesData(tenant.secciones || {});
    setCiudad(tenant.ciudad || 'Monterrey');
    setEstado(tenant.estado || 'Nuevo León');
    setAreaMetropolitana(tenant.area_metropolitana || 'área metropolitana');
    setWhatsapp(tenant.whatsapp || '0000000000');
    setInstagram(tenant.redes_sociales?.instagram || '');
    setFacebook(tenant.redes_sociales?.facebook || '');
    setCustomDomain(tenant.custom_domain || '');
    setHorarioRegular(tenant.horarios?.regular || 'Lunes a Domingo · 9:00 AM – 6:00 PM');
    setHorarioEspecial(tenant.horarios?.especial || '');
    setPreferredGateway(tenant.preferred_gateway || 'openpay');
    setOpenpayMerchantId(tenant.openpay_merchant_id || '');
    setOpenpayPublicKey(tenant.openpay_public_key || '');
    setOpenpayPrivateKey(tenant.openpay_private_key || '');
    setOpenpaySandboxMode(tenant.openpay_sandbox_mode ?? true);
  }, [tenant]);

  // BeforeUnload guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Google Fonts dynamic injection
  useEffect(() => {
    const fontsToLoad = FONT_OPTIONS.map(f => f.value).filter(f => !['Inter', 'Arial', 'system-ui'].includes(f));
    const fontFamilies = fontsToLoad.map(f => f.replace(/ /g, '+')).join('&family=');
    
    const id = 'admin-dynamic-fonts';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${fontFamilies}&display=swap`;
      document.head.appendChild(link);
    }
  }, []);

  // Sync state once when tenant resolves and loading completes
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!loading && tenant && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      setColorPrimario(tenant.color_primario);
      setColorSecundario(tenant.color_secundario);
      setColorAcento(tenant.color_acento);
      setFontFamily(tenant.font_family || 'Inter');
      setSections(tenant.orden_secciones);
      setLogoPreview(tenant.logo_url);
      setTextoNosotros(tenant.texto_nosotros || '');
      setAnioFundacion(tenant.anio_fundacion || '');
      setFirma(tenant.firma || '');
      setMapaUrl(tenant.mapa_url || '');
      setDireccion(tenant.direccion || '');
      setColonias(tenant.colonias?.join(', ') || '');
      setMetaTitle(tenant.meta_title || '');
      setZonasEnvio(tenant.zonas_envio || []);
      setEventoActivo(tenant.evento?.activo || false);
      setEventoTitulo(tenant.evento?.titulo || '');
      setEventoProducto(tenant.evento?.producto || '');
      setEventoFechaFin(tenant.evento?.fecha_fin || '');
      setMostrarDescripcionEnTarjeta(tenant.catalogo?.mostrar_descripcion_en_tarjeta ?? false);
      setServiciosList(tenant.servicios || []);
      setBeneficiosList(tenant.beneficios || []);
      setTestimoniosList(tenant.testimonios || []);
      setFloresList(tenant.flores || []);
      setGaleriaList(tenant.galeria || []);
      setSeccionesData(tenant.secciones || {});
      setCiudad(tenant.ciudad || 'Monterrey');
      setEstado(tenant.estado || 'Nuevo León');
      setAreaMetropolitana(tenant.area_metropolitana || 'área metropolitana');
      setWhatsapp(tenant.whatsapp || '0000000000');
      setInstagram(tenant.redes_sociales?.instagram || '');
      setFacebook(tenant.redes_sociales?.facebook || '');
      setCustomDomain(tenant.custom_domain || '');
      setHorarioRegular(tenant.horarios?.regular || 'Lunes a Domingo · 9:00 AM – 6:00 PM');
      setHorarioEspecial(tenant.horarios?.especial || '');
      setPreferredGateway(tenant.preferred_gateway || 'openpay');
      setOpenpayMerchantId(tenant.openpay_merchant_id || '');
      setOpenpayPublicKey(tenant.openpay_public_key || '');
      setOpenpayPrivateKey(tenant.openpay_private_key || '');
      setOpenpaySandboxMode(tenant.openpay_sandbox_mode ?? true);
    }
  }, [loading, tenant]);

  const previewUrl = getSubdomainUrl(tenant.slug, '/?preview=true');
  const isSameHost = useMemo(() => {
    try {
      return new URL(previewUrl).hostname === window.location.hostname;
    } catch (e) {
      return false;
    }
  }, [previewUrl]);

  // Update root CSS vars live
  useTheming({
    color_primario: colorPrimario,
    color_secundario: colorSecundario,
    color_acento: colorAcento,
    font_family: fontFamily
  }, true);

  // Send real-time preview updates to iframe(s)
  useEffect(() => {
    const iframes = document.querySelectorAll('iframe.preview-iframe') as NodeListOf<HTMLIFrameElement>;
    if (iframes.length > 0) {
      const payload = {
        color_primario: colorPrimario,
        color_secundario: colorSecundario,
        color_acento: colorAcento,
        font_family: fontFamily,
        logo_url: logoPreview,
        orden_secciones: sections,
        texto_nosotros: textoNosotros,
        anio_fundacion: anioFundacion,
        firma: firma,
        mapa_url: mapaUrl,
        colonias: colonias.split(',').map(c => c.trim()).filter(Boolean),
        meta_title: metaTitle,
        evento: {
          activo: eventoActivo,
          titulo: eventoTitulo,
          producto: eventoProducto,
          fecha_fin: eventoFechaFin,
        },
        servicios: serviciosList,
        beneficios: beneficiosList,
        testimonios: testimoniosList,
        flores: floresList,
        galeria: galeriaList,
        secciones: seccionesData,
        whatsapp: whatsapp,
        ciudad: ciudad,
        estado: estado,
        area_metropolitana: areaMetropolitana,
        horarios: {
          regular: horarioRegular,
          especial: horarioEspecial
        },
        redes_sociales: {
          instagram: instagram,
          facebook: facebook
        },
        preferred_gateway: preferredGateway,
        openpay_merchant_id: openpayMerchantId,
        openpay_public_key: openpayPublicKey,
        openpay_private_key: openpayPrivateKey,
        openpay_sandbox_mode: openpaySandboxMode
      };
      
      iframes.forEach(iframe => {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage(
            { type: 'UPDATE_PREVIEW', payload },
            window.location.origin
          );
        }
      });
    }
  }, [
    colorPrimario, colorSecundario, colorAcento, fontFamily, logoPreview, sections,
    textoNosotros, anioFundacion, firma, mapaUrl, colonias, metaTitle,
    eventoActivo, eventoTitulo, eventoProducto, eventoFechaFin,
    serviciosList, beneficiosList, testimoniosList, floresList, galeriaList, seccionesData,
    whatsapp, ciudad, estado, areaMetropolitana, horarioRegular, horarioEspecial, instagram, facebook,
    preferredGateway, openpayMerchantId, openpayPublicKey, openpayPrivateKey, openpaySandboxMode
  ]);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    const reordered = reorder(sections, result.source.index, result.destination.index);
    setSections(reordered);
  }, [sections]);

  const handleLogoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setLogoError(null);
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setLogoError('La imagen del logo no puede superar los 2 MB.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setLogoPreview(previewUrl);

    try {
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `${tenant.id}/logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        logger.error('[Logo] Upload error:', uploadError as Error);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      setLogoPreview(publicUrl);
    } catch (err) {
      logger.error('[Logo] Error:', err as Error);
    }
  }, [tenant.id]);

  const handleSave = useCallback(async () => {
    if (!hasUnsavedChanges) return;
    
    setSaving(true);

    const payloadToValidate = {
      id: tenant.id,
      slug: tenant.slug,
      nombre: tenant.nombre,
      color_primario:   colorPrimario,
      color_secundario: colorSecundario,
      color_acento:     colorAcento,
      font_family:      fontFamily,
      texto_nosotros:   textoNosotros,
      anio_fundacion:   anioFundacion === '' ? undefined : Number(anioFundacion),
      firma:            firma,
      mapa_url:         mapaUrl,
      direccion:        direccion,
      meta_title:       metaTitle,
      zonas_envio:      zonasEnvio,
      whatsapp:         whatsapp,
      custom_domain:    customDomain || null,
      ciudad:           ciudad,
      estado:           estado,
      area_metropolitana: areaMetropolitana,
      horarios: {
        regular:        horarioRegular,
        especial:       horarioEspecial || null
      },
      redes_sociales: {
        instagram:      instagram || '',
        facebook:       facebook || ''
      },
      preferred_gateway: preferredGateway,
      openpay_merchant_id: openpayMerchantId || null,
      openpay_public_key: openpayPublicKey || null,
      openpay_private_key: openpayPrivateKey || null,
      openpay_sandbox_mode: openpaySandboxMode
    };

    const schemaToUse = activeTab === 'horarios' ? TenantConfigSchema : TenantConfigBaseSchema;
    const validation = schemaToUse.safeParse(payloadToValidate);
    if (!validation.success) {
      toast.error('Error de validación', {
        message: validation.error.issues[0].message
      });
      setSaving(false);
      return;
    }

    const validatedData = validation.data;

    try {
      await updateTenantConfig({
        color_primario:   validatedData.color_primario,
        color_secundario: validatedData.color_secundario,
        color_acento:     validatedData.color_acento,
        logo_url:         logoPreview,
        orden_secciones:  sections,
        font_family:      validatedData.font_family,
        texto_nosotros:   validatedData.texto_nosotros,
        anio_fundacion:   validatedData.anio_fundacion,
        firma:            validatedData.firma,
        mapa_url:         validatedData.mapa_url,
        direccion:        validatedData.direccion,
        colonias:         colonias.split(',').map(c => c.trim()).filter(Boolean),
        meta_title:       validatedData.meta_title,
        zonas_envio:      validatedData.zonas_envio || [],
        servicios:        serviciosList,
        beneficios:       beneficiosList,
        testimonios:      testimoniosList,
        flores:           floresList,
        galeria:          galeriaList,
        secciones:        seccionesData,
        evento: {
          activo: eventoActivo,
          titulo: eventoTitulo,
          producto: eventoProducto,
          // datetime-local produce "YYYY-MM-DDTHH:mm" sin timezone.
          // Convertir a ISO 8601 completo para almacenamiento consistente.
          fecha_fin: eventoFechaFin
            ? new Date(eventoFechaFin).toISOString()
            : '',
        },
        whatsapp:         validatedData.whatsapp,
        custom_domain:    validatedData.custom_domain,
        ciudad:           validatedData.ciudad,
        estado:           validatedData.estado,
        area_metropolitana: validatedData.area_metropolitana,
        horarios:         validatedData.horarios,
        redes_sociales:   validatedData.redes_sociales,
        preferred_gateway: validatedData.preferred_gateway,
        openpay_merchant_id: validatedData.openpay_merchant_id,
        openpay_public_key: validatedData.openpay_public_key,
        openpay_private_key: validatedData.openpay_private_key,
        openpay_sandbox_mode: validatedData.openpay_sandbox_mode,
        catalogo: {
          mostrar_descripcion_en_tarjeta: mostrarDescripcionEnTarjeta
        }
      });

      toast.success('Configuración guardada', {
        message: 'Tus cambios se han guardado exitosamente.',
        action: { label: 'Ver tienda', href: getSubdomainUrl(tenant.slug, '/?preview=true') }
      });
    } catch (err) {
      logger.error('[AdminConfiguracion] Error al guardar:', err as Error);
      toast.error('Error al guardar', {
        message: 'Hubo un problema al guardar tu configuración. Intenta de nuevo.'
      });
    } finally {
      setSaving(false);
    }
  }, [
    activeTab,
    colorPrimario, colorSecundario, colorAcento, logoPreview, sections, fontFamily,
    textoNosotros, anioFundacion, firma, mapaUrl, direccion, colonias, metaTitle,
    serviciosList, beneficiosList, testimoniosList, floresList, galeriaList, seccionesData,
    updateTenantConfig, hasUnsavedChanges,
    ciudad, estado, areaMetropolitana, whatsapp, instagram, facebook, customDomain,
    horarioRegular, horarioEspecial, zonasEnvio,
    eventoActivo, eventoTitulo, eventoProducto, eventoFechaFin,
    preferredGateway, openpayMerchantId, openpayPublicKey, openpayPrivateKey, openpaySandboxMode,
    mostrarDescripcionEnTarjeta
  ]);

  const getListLength = (key: string) => {
    switch (key) {
      case 'Servicios': return serviciosList.length;
      case 'Beneficios': return beneficiosList.length;
      case 'Testimonios': return testimoniosList.length;
      case 'Flores': return floresList.length;
      case 'Galeria': return galeriaList.length;
      default: return -1;
    }
  };

  if (loading || !tenant || !tenant.slug) {
    return (
      <div className="flex-1 min-h-screen bg-[var(--color-background-secondary)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Encabezado ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Store Builder</h1>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Personaliza la apariencia y el contenido de tu tienda
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={getSubdomainUrl(tenant.slug, '/?preview=true')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold backdrop-blur-md bg-white/20 dark:bg-black/20 border border-white/30 dark:border-white/10 text-[var(--color-text-primary)] hover:bg-white/30 dark:hover:bg-white/10 transition-colors shadow-sm"
          >
            Vista previa <ExternalLink className="w-4 h-4" />
          </a>
          {/* Botón flotante/visible en móvil para la vista previa */}
          <button
            onClick={() => setShowMobilePreview(true)}
            className="xl:hidden inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold backdrop-blur-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors shadow-sm"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
            className={`
              inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
              transition-all duration-300 shadow-sm backdrop-blur-md border
              ${saving
                ? 'bg-white/10 dark:bg-black/10 border-white/20 dark:border-white/10 text-[var(--color-text-tertiary)] cursor-wait'
                : !hasUnsavedChanges
                  ? 'bg-white/10 dark:bg-black/10 border-white/20 dark:border-white/10 text-[var(--color-text-tertiary)] opacity-70 cursor-not-allowed'
                  : 'border-transparent active:scale-[0.97]'
              }
            `}
            style={hasUnsavedChanges && !saving ? { backgroundColor: 'var(--color-primario)', color: 'var(--color-primario-texto)' } : {}}
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
            ) : (
              <><Save className="w-4 h-4" /> Guardar cambios</>
            )}
          </button>
        </div>
      </div>

      {/* ── Dirty State Banner ── */}
      {hasUnsavedChanges && (
        <div className="sticky top-4 z-40 backdrop-blur-xl bg-amber-50/80 dark:bg-amber-900/30 border border-amber-200/50 dark:border-amber-700/50 rounded-xl px-4 py-3 shadow-sm flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-medium">Tienes cambios sin guardar. Asegúrate de guardarlos para publicarlos en tu tienda.</span>
          </div>
          <button
            onClick={handleDiscard}
            className="px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-200 hover:bg-amber-500/20 rounded-lg transition-colors"
          >
            Descartar cambios
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[450px_1fr] 2xl:grid-cols-[500px_1fr] gap-8 items-start">
        <div className="min-w-0 w-full max-w-xl mx-auto xl:mx-0">
          {/* ── Tabs Horizontales ── */}
        <div className="flex backdrop-blur-xl bg-white/20 dark:bg-black/20 border border-white/30 dark:border-white/10 rounded-2xl p-1.5 mb-6 shadow-sm overflow-x-auto relative z-10">
          {[
            { id: 'tema', label: 'Diseño', icon: Palette },
            { id: 'contenido', label: 'Estructura', icon: LayoutTemplate },
            { id: 'general', label: 'Identidad y SEO', icon: FileText },
            { id: 'cobertura', label: 'Cobertura', icon: MapPin },
            { id: 'horarios', label: 'Horarios y Pagos', icon: Clock },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'shadow-sm border border-white/10'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-white/10'
              }`}
              style={activeTab === tab.id ? { backgroundColor: 'var(--color-primario)', color: 'var(--color-primario-texto)' } : {}}
            >
              <tab.icon className="w-4 h-4" style={activeTab === tab.id ? { color: 'var(--color-primario-texto)' } : { color: 'var(--color-text-tertiary)' }} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Contenido ── */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            
            {/* TAB: TEMA */}
            {activeTab === 'tema' && (
            <TemaTab
              state={{ colorPrimario, colorSecundario, colorAcento, fontFamily, logoPreview, logoError, sections }}
              actions={{ setColorPrimario, setColorSecundario, setColorAcento, setFontFamily, handleLogoChange, handleDragEnd }}
              tenant={tenant}
              listLengths={{
                Servicios: serviciosList.length,
                Beneficios: beneficiosList.length,
                Testimonios: testimoniosList.length,
                Flores: floresList.length,
                Galeria: galeriaList.length,
              }}
              onEditSection={handleEditSection}
            />
          )}

          {/* TAB: ESTRUCTURA */}
          {activeTab === 'contenido' && (
            <ContenidoTab
              state={{ serviciosList, beneficiosList, testimoniosList, floresList, galeriaList, seccionesData, openAccordions }}
              actions={{ setServiciosList, setBeneficiosList, setTestimoniosList, setFloresList, setGaleriaList, setSeccionesData, onToggleAccordion: handleToggleAccordion }}
              tenant={tenant}
            />
          )}

          {/* TAB: IDENTIDAD Y SEO */}
          {activeTab === 'general' && (
            <GeneralTab
              state={{ textoNosotros, anioFundacion, firma, metaTitle, customDomain, whatsapp, instagram, facebook, eventoActivo, eventoTitulo, eventoProducto, eventoFechaFin, openAccordions, mostrarDescripcionEnTarjeta }}
              actions={{ setTextoNosotros, setAnioFundacion, setFirma, setMetaTitle, setCustomDomain, setWhatsapp, setInstagram, setFacebook, setEventoActivo, setEventoTitulo, setEventoProducto, setEventoFechaFin, onToggleAccordion: handleToggleAccordion, setMostrarDescripcionEnTarjeta }}
              tenant={tenant}
            />
          )}

          {/* TAB: COBERTURA Y ENVÍOS */}
          {activeTab === 'cobertura' && (
            <CoberturaTab
              state={{ ciudad, estado, areaMetropolitana, mapaUrl, direccion, colonias, zonasEnvio, openAccordions }}
              actions={{ setCiudad, setEstado, setAreaMetropolitana, setMapaUrl, setDireccion, setColonias, setZonasEnvio, onToggleAccordion: handleToggleAccordion }}
              tenant={tenant}
            />
          )}

          {/* TAB: HORARIOS Y PAGOS */}
          {activeTab === 'horarios' && (
            <HorariosTab
              state={{ horarioRegular, horarioEspecial, openpayMerchantId, openpayPublicKey, openpayPrivateKey, openpaySandboxMode, preferredGateway, openAccordions }}
              actions={{ setHorarioRegular, setHorarioEspecial, setOpenpayMerchantId, setOpenpayPublicKey, setOpenpayPrivateKey, setOpenpaySandboxMode, setPreferredGateway, onToggleAccordion: handleToggleAccordion }}
              tenant={tenant}
            />
          )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Lado Derecho: Preview Pegajoso ── */}
      <div className="hidden xl:flex flex-col sticky top-4 h-[calc(100vh-2rem)] backdrop-blur-xl bg-white/20 dark:bg-black/20 border border-white/30 dark:border-white/10 rounded-3xl overflow-hidden shadow-xl">
        <div className="bg-white/10 dark:bg-black/20 px-4 py-3 border-b border-white/20 dark:border-white/10 flex items-center justify-between backdrop-blur-md">
          <span className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider flex items-center gap-2">
            <Eye className="w-4 h-4 text-[var(--color-text-primary)]" /> Vista Previa
          </span>
          {isSameHost && (
            <div className="flex items-center gap-1 bg-white/10 dark:bg-black/20 border border-white/20 dark:border-white/10 p-0.5 rounded-lg">
              <button onClick={() => setPreviewDevice('mobile')} className={`p-1.5 rounded-md transition-colors ${previewDevice === 'mobile' ? 'bg-white/20 dark:bg-white/10 text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'}`}>
                <Smartphone className="w-4 h-4" />
              </button>
              <button onClick={() => setPreviewDevice('desktop')} className={`p-1.5 rounded-md transition-colors ${previewDevice === 'desktop' ? 'bg-white/20 dark:bg-white/10 text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'}`}>
                <Monitor className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 bg-transparent flex justify-center overflow-hidden relative">
          {isSameHost ? (
            <iframe
              src={previewUrl}
              className={`preview-iframe border-0 bg-white shadow-xl transition-all duration-300 relative z-10 ${previewDevice === 'mobile' ? 'w-[375px] h-[calc(100%-2rem)] mt-4 rounded-[2.5rem] border-[8px] border-black/80 shadow-[0_0_0_1px_rgba(255,255,255,0.2)]' : 'w-full h-full'}`}
              title="Preview"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none animate-fade-in bg-white/5 dark:bg-black/5 rounded-3xl m-4 border border-white/10 dark:border-white/5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 dark:bg-emerald-400/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 shadow-sm">
                <ExternalLink className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-[var(--color-text-primary)] mb-2">
                Vista previa en pestaña nueva
              </h4>
              <p className="text-xs text-[var(--color-text-tertiary)] max-w-[280px] leading-relaxed mb-6">
                La vista previa se abre en una pestaña independiente para garantizar que veas exactamente lo que ve tu cliente, evitando bloqueos de seguridad de tu navegador.
              </p>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-600/15"
              >
                <i className="ti ti-external-link text-base" /> Ver mi tienda
              </a>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* ── Modal Vista Previa Móvil ── */}
    <AnimatePresence>
      {showMobilePreview && (
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-[9999] bg-[var(--color-background-primary)] flex flex-col xl:hidden"
        >
          {/* Header del Modal */}
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-background-secondary)] border-b border-[var(--color-border-tertiary)] shrink-0">
            <span className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-500" /> Vista Previa en Vivo
            </span>
            <button
              onClick={() => setShowMobilePreview(false)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            >
              Cerrar
            </button>
          </div>
          
          {/* Iframe / Placeholder */}
          <div className="flex-1 w-full h-full bg-[var(--color-background-tertiary)] overflow-hidden flex items-center justify-center">
            {isSameHost ? (
              <iframe
                src={previewUrl}
                className="preview-iframe w-full h-full border-0"
                title="Mobile Preview"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center select-none animate-fade-in bg-[var(--color-background-secondary)] rounded-3xl m-4 border border-[var(--color-border-secondary)]">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 dark:bg-emerald-400/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
                  <ExternalLink className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-[var(--color-text-primary)] mb-2">
                  Vista previa en pestaña nueva
                </h4>
                <p className="text-xs text-[var(--color-text-tertiary)] max-w-[240px] leading-relaxed mb-6">
                  Tu navegador bloquea el visor embebido por seguridad de dominio cruzado. Abre tu tienda en una nueva pestaña.
                </p>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-600/15"
                >
                  <i className="ti ti-external-link text-base" /> Ver mi tienda
                </a>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
  );
}
