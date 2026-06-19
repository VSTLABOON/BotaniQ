import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SectionListEditor } from '../SectionListEditor';
import { Accordion } from './SharedUI';
import { LayoutTemplate, Upload, Loader2, Film, X, Link2, ChevronDown, Flower2, Gem, Gift } from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';
import { fetchAdminProducts } from '../../../../services/productService';

const MAX_VIDEO_SIZE_MB = 30;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

export function ContenidoTab({ 
  state, 
  actions,
  tenant
}: { 
  state: any, 
  actions: any,
  tenant: any
}) {
  const { 
    serviciosList, 
    beneficiosList, 
    testimoniosList, 
    floresList, 
    galeriaList, 
    seccionesData, 
    openAccordions,
    eventoActivo,
    eventoTitulo,
    eventoProducto,
    eventoFechaFin
  } = state;

  const { 
    setServiciosList, 
    setBeneficiosList, 
    setTestimoniosList, 
    setFloresList, 
    setGaleriaList, 
    setSeccionesData, 
    onToggleAccordion,
    setEventoActivo,
    setEventoTitulo,
    setEventoProducto,
    setEventoFechaFin
  } = actions;

  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadProducts() {
      if (!tenant?.id) return;
      setLoadingProducts(true);
      try {
        const data = await fetchAdminProducts(tenant.id);
        if (active) {
          setProducts(data.filter(p => p.isAvailable));
        }
      } catch (err) {
        console.error('Error fetching active products for banner select:', err);
      } finally {
        if (active) {
          setLoadingProducts(false);
        }
      }
    }
    loadProducts();
    return () => { active = false; };
  }, [tenant?.id]);

  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const heroData = seccionesData?.hero || {};
  const beneficiosData = seccionesData?.beneficios || {};
  const floresData = seccionesData?.flores || {};

  const handleHeroChange = (field: string, value: string) => {
    setSeccionesData({
      ...seccionesData,
      hero: {
        ...heroData,
        [field]: value
      }
    });
  };

  const handleBeneficiosChange = (field: string, value: string) => {
    setSeccionesData({
      ...seccionesData,
      beneficios: {
        ...beneficiosData,
        [field]: value
      }
    });
  };

  const handleFloresChange = (field: string, value: string) => {
    setSeccionesData({
      ...seccionesData,
      flores: {
        ...floresData,
        [field]: value
      }
    });
  };

  const serviciosData = seccionesData?.servicios || {};
  const testimoniosData = seccionesData?.testimonios || {};
  const galeriaData = seccionesData?.galeria || {};

  const handleServiciosChange = (field: string, value: string) => {
    setSeccionesData({
      ...seccionesData,
      servicios: {
        ...serviciosData,
        [field]: value
      }
    });
  };

  const handleTestimoniosChange = (field: string, value: string) => {
    setSeccionesData({
      ...seccionesData,
      testimonios: {
        ...testimoniosData,
        [field]: value
      }
    });
  };

  const handleGaleriaChange = (field: string, value: string) => {
    setSeccionesData({
      ...seccionesData,
      galeria: {
        ...galeriaData,
        [field]: value
      }
    });
  };

  const handleBeneficiosImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${tenant.id}/beneficios-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('logos').upload(fileName, file, { cacheControl: '3600', upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(fileName);
      handleBeneficiosChange('imagen', publicUrl);
    } catch (err) {
      console.error('Error uploading beneficios image', err);
    } finally {
      setUploading(false);
    }
  };

  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${tenant.id}/hero-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('logos').upload(fileName, file, { cacheControl: '3600', upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(fileName);
      handleHeroChange('imagen_fondo', publicUrl);
    } catch (err) {
      console.error('Error uploading hero image', err);
    } finally {
      setUploading(false);
    }
  };

  // ── Video Upload Handler ────────────────────────────────────────
  const handleVideoUpload = useCallback(async (file: File) => {
    setVideoError(null);

    // Validar tipo
    if (!file.type.startsWith('video/')) {
      setVideoError('El archivo debe ser un video (MP4, MOV, WebM).');
      return;
    }

    // Validar tamaño
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      setVideoError(`El video es demasiado grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo: ${MAX_VIDEO_SIZE_MB} MB.`);
      return;
    }

    setUploadingVideo(true);
    setVideoProgress(10);

    try {
      const ext = file.name.split('.').pop() || 'mp4';
      const fileName = `${tenant.id}/hero-video-${Date.now()}.${ext}`;

      // Simular progreso (Supabase JS no emite progress nativo)
      const progressInterval = setInterval(() => {
        setVideoProgress(prev => Math.min(prev + 8, 85));
      }, 300);

      const { error } = await supabase.storage
        .from('logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });

      clearInterval(progressInterval);

      if (error) throw error;

      setVideoProgress(95);
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(fileName);
      handleHeroChange('video_url', publicUrl);
      setVideoProgress(100);

      // Reset progress after a moment
      setTimeout(() => setVideoProgress(0), 1200);
    } catch (err: any) {
      console.error('Error uploading video:', err);
      setVideoError(err.message || 'Error al subir el video. Intenta de nuevo.');
      setVideoProgress(0);
    } finally {
      setUploadingVideo(false);
    }
  }, [tenant.id, heroData]);

  // ── Drag and Drop Handlers ──────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleVideoUpload(file);
  }, [handleVideoUpload]);

  const handleVideoFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleVideoUpload(file);
    // Reset input so same file can be re-selected
    if (videoInputRef.current) videoInputRef.current.value = '';
  }, [handleVideoUpload]);

  return (
    <div className="space-y-6">
      <Accordion 
        id="seccion-Hero"
        title="Sección Principal (Hero)" 
        icon={LayoutTemplate} 
        isOpen={openAccordions.Hero}
        onToggle={(open) => onToggleAccordion('Hero', open)}
      >
        <div className="space-y-5">
          {/* ── Selector de Estilo de Hero ──────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Estilo de Hero</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  key: 'classic',
                  label: 'Clásico',
                  desc: 'Pétalos animados, fondo oscuro con imagen',
                  accent: 'border-pink-500/40 bg-pink-500/5',
                  activeAccent: 'border-pink-500 bg-pink-500/15 ring-2 ring-pink-500/20',
                  Icon: Flower2,
                },
                {
                  key: 'cinematic',
                  label: 'Cinemático',
                  desc: 'Fondo claro, video en loop, tipografía editorial',
                  accent: 'border-sky-500/40 bg-sky-500/5',
                  activeAccent: 'border-sky-500 bg-sky-500/15 ring-2 ring-sky-500/20',
                  Icon: Film,
                },
                {
                  key: 'glassmorphic',
                  label: 'Cristal Oscuro',
                  desc: 'Estilo luxury, efecto de vidrio, video con parallax',
                  accent: 'border-violet-500/40 bg-violet-500/5',
                  activeAccent: 'border-violet-500 bg-violet-500/15 ring-2 ring-violet-500/20',
                  Icon: Gem,
                },
              ].map((style) => {
                const isActive = (heroData.hero_style || 'classic') === style.key;
                return (
                  <button
                    key={style.key}
                    type="button"
                    onClick={() => handleHeroChange('hero_style', style.key)}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                      isActive ? style.activeAccent : `${style.accent} hover:opacity-80`
                    }`}
                  >
                    <div className="mb-2 text-[var(--color-text-primary)]">
                      <style.Icon className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-[var(--color-text-primary)]">{style.label}</h4>
                    <p className="text-[0.7rem] text-[var(--color-text-tertiary)] mt-0.5 leading-snug">{style.desc}</p>
                    {isActive && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Video de Fondo (solo para cinematic/glassmorphic) ── */}
          {(heroData.hero_style === 'cinematic' || heroData.hero_style === 'glassmorphic') && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Video de Fondo</label>

              {/* Preview del video actual */}
              {heroData.video_url && !uploadingVideo && (
                <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/30">
                  <video
                    src={heroData.video_url}
                    muted
                    playsInline
                    className="w-full h-32 object-cover"
                    onMouseOver={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                    onMouseOut={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                  <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-white/70" />
                    <span className="text-[0.65rem] text-white/70 font-medium">Pasa el cursor para previsualizar</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleHeroChange('video_url', '')}
                    className="absolute top-2 right-2 p-1 rounded-lg bg-black/50 text-white/70 hover:text-white hover:bg-red-500/80 transition-colors"
                    title="Eliminar video"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Zona de Drag & Drop */}
              {!heroData.video_url && !uploadingVideo && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => videoInputRef.current?.click()}
                  className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
                    dragOver
                      ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
                      : 'border-white/15 dark:border-white/10 hover:border-white/30 bg-white/5 dark:bg-black/20'
                  }`}
                >
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    onChange={handleVideoFileSelect}
                    className="hidden"
                  />
                  <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center transition-colors ${
                    dragOver ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-[var(--color-text-tertiary)]'
                  }`}>
                    <Film className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {dragOver ? '¡Suelta el video aquí!' : 'Arrastra tu video aquí'}
                  </p>
                  <p className="text-[0.7rem] text-[var(--color-text-tertiary)] mt-1">
                    o <span className="text-emerald-500 font-medium">haz clic para seleccionar</span>
                  </p>
                  <p className="text-[0.65rem] text-[var(--color-text-tertiary)] mt-2">
                    MP4, MOV o WebM · máximo {MAX_VIDEO_SIZE_MB} MB
                  </p>
                </div>
              )}

              {/* Progress Bar */}
              {uploadingVideo && (
                <div className="rounded-xl border border-white/10 bg-white/5 dark:bg-black/20 p-6 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Subiendo video...</p>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${videoProgress}%` }}
                    />
                  </div>
                  <p className="text-[0.7rem] text-[var(--color-text-tertiary)] mt-2">{videoProgress}%</p>
                </div>
              )}

              {/* Error */}
              {videoError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 rounded-xl text-sm text-red-700 dark:text-red-400">
                  <X className="w-4 h-4 shrink-0" />
                  <span>{videoError}</span>
                </div>
              )}

              {/* URL alternativa (colapsable) */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="flex items-center gap-1.5 text-[0.75rem] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
                >
                  <Link2 className="w-3 h-3" />
                  <span>¿Ya tienes un enlace? Pega la URL directamente</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showUrlInput ? 'rotate-180' : ''}`} />
                </button>
                 {showUrlInput && (
                  <div className="space-y-1.5 mt-2 animate-fade-up">
                    <input
                      type="url"
                      value={heroData.video_url || ''}
                      onChange={(e) => handleHeroChange('video_url', e.target.value)}
                      className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      placeholder="https://ejemplo.com/mi-video.mp4"
                    />
                    {(heroData.video_url || '').toLowerCase().match(/(youtube\.com|youtu\.be|vimeo\.com)/) && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        ⚠️ Los videos de fondo del Hero deben ser enlaces directos a archivos (ej. .mp4, .webm). Enlaces de YouTube o Vimeo no se reproducirán.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Título principal</label>
              <input
                type="text"
                value={heroData.titulo || ''}
                onChange={(e) => handleHeroChange('titulo', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. Flores que"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Palabra destacada (cursiva)</label>
              <input
                type="text"
                value={heroData.titulo_italic || ''}
                onChange={(e) => handleHeroChange('titulo_italic', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. enamoran"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Subtítulo</label>
            <input
              type="text"
              value={heroData.subtitulo || ''}
              onChange={(e) => handleHeroChange('subtitulo', e.target.value)}
              className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
              placeholder="Ej. Llegamos a toda la ciudad en menos de 3 horas."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Texto de Confianza (Trust Bar)</label>
            <input
              type="text"
              value={heroData.trust_bar_1 || ''}
              onChange={(e) => handleHeroChange('trust_bar_1', e.target.value)}
              className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
              placeholder="Ej. Entrega en 3 horas"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Imagen de Fondo</label>
            <div className="flex items-center gap-4">
              {heroData.imagen_fondo && (
                <img src={heroData.imagen_fondo} alt="Hero bg" className="w-20 h-20 object-cover rounded-lg border border-white/10" />
              )}
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleHeroImageUpload}
                  disabled={uploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait"
                />
                <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-lg text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-background-tertiary)] transition-colors">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Subiendo...' : 'Subir imagen'}
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => handleHeroChange('imagen_fondo', '')}
                className="text-xs text-red-500 hover:text-red-400"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      </Accordion>

      <div id="seccion-Servicios" className="transition-all duration-300 rounded-3xl border border-transparent space-y-4">
        <div className="bg-white/30 dark:bg-black/30 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Configuración General de Servicios</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Etiqueta de sección</label>
              <input
                type="text"
                value={serviciosData.etiqueta || ''}
                onChange={(e) => handleServiciosChange('etiqueta', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. Ocasiones especiales"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Título</label>
              <input
                type="text"
                value={serviciosData.titulo || ''}
                onChange={(e) => handleServiciosChange('titulo', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. Flores para"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Título destacado (cursiva)</label>
              <input
                type="text"
                value={serviciosData.titulo_italic || ''}
                onChange={(e) => handleServiciosChange('titulo_italic', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. cada momento"
              />
            </div>
          </div>
        </div>
        <SectionListEditor
          title="Servicios / Ocasiones"
          description="Listado de eventos y ocasiones que cubren (Bodas, Cumpleaños, etc.)"
          items={serviciosList}
          onChange={setServiciosList}
          fields={[
            { key: 'titulo', label: 'Título', type: 'text' },
            { key: 'descripcion', label: 'Descripción', type: 'textarea' },
            { key: 'icono', label: 'Ícono', type: 'icon' },
            { key: 'imagen_url', label: 'Imagen', type: 'image' },
            { key: 'catalog', label: 'Carrusel de Arreglos (Catálogo)', type: 'catalog' },
          ]}
        />
      </div>

      <div id="seccion-Beneficios" className="transition-all duration-300 rounded-3xl border border-transparent space-y-4">
        <div className="bg-white/30 dark:bg-black/30 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Configuración General de Beneficios</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Etiqueta de sección</label>
              <input
                type="text"
                value={beneficiosData.etiqueta || ''}
                onChange={(e) => handleBeneficiosChange('etiqueta', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. Por qué elegirnos"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Título</label>
              <input
                type="text"
                value={beneficiosData.titulo || ''}
                onChange={(e) => handleBeneficiosChange('titulo', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. Lo que nos hace"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Título destacado (cursiva)</label>
              <input
                type="text"
                value={beneficiosData.titulo_italic || ''}
                onChange={(e) => handleBeneficiosChange('titulo_italic', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. diferentes"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Valor de métrica</label>
              <input
                type="text"
                value={beneficiosData.metrica_valor || ''}
                onChange={(e) => handleBeneficiosChange('metrica_valor', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. +2,000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Texto de métrica</label>
              <input
                type="text"
                value={beneficiosData.metrica_texto || ''}
                onChange={(e) => handleBeneficiosChange('metrica_texto', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. Entregas"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Imagen Principal</label>
            <div className="flex items-center gap-4">
              {beneficiosData.imagen && (
                <img src={beneficiosData.imagen} alt="Beneficios bg" className="w-20 h-20 object-cover rounded-lg border border-white/10" />
              )}
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBeneficiosImageUpload}
                  disabled={uploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait"
                />
                <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-lg text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-background-tertiary)] transition-colors">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Subiendo...' : 'Subir imagen'}
                </div>
              </div>
              {beneficiosData.imagen && (
                <button 
                  type="button" 
                  onClick={() => handleBeneficiosChange('imagen', '')}
                  className="text-xs text-red-500 hover:text-red-400"
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>
        <SectionListEditor
          title="Beneficios"
          description="Promesas de valor (Entrega express, Flores frescas, etc.)"
          items={beneficiosList}
          onChange={setBeneficiosList}
          fields={[
            { key: 'titulo', label: 'Título', type: 'text' },
            { key: 'descripcion', label: 'Descripción', type: 'textarea' },
            { key: 'icono', label: 'Ícono', type: 'icon' },
          ]}
        />
      </div>

      <div id="seccion-Testimonios" className="transition-all duration-300 rounded-3xl border border-transparent space-y-4">
        <div className="bg-white/30 dark:bg-black/30 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Configuración General de Testimonios</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Etiqueta de sección</label>
              <input
                type="text"
                value={testimoniosData.etiqueta || ''}
                onChange={(e) => handleTestimoniosChange('etiqueta', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. Testimonios"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Título</label>
              <input
                type="text"
                value={testimoniosData.titulo || ''}
                onChange={(e) => handleTestimoniosChange('titulo', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. Flores que"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Título destacado (cursiva)</label>
              <input
                type="text"
                value={testimoniosData.titulo_italic || ''}
                onChange={(e) => handleTestimoniosChange('titulo_italic', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. dejan huella"
              />
            </div>
          </div>
        </div>
        <SectionListEditor
          title="Testimonios"
          description="Reseñas y comentarios de tus clientes."
          items={testimoniosList}
          onChange={setTestimoniosList}
          fields={[
            { key: 'nombre', label: 'Nombre del Cliente', type: 'text' },
            { key: 'texto', label: 'Testimonio', type: 'textarea' },
            { key: 'rating', label: 'Calificación (1-5)', type: 'number' },
            { key: 'inicial', label: 'Iniciales', type: 'text' },
            { key: 'ubicacion', label: 'Ubicación / Ciudad', type: 'text' },
          ]}
        />
      </div>

      <div id="seccion-Flores" className="transition-all duration-300 rounded-3xl border border-transparent space-y-4">
        <div className="bg-white/30 dark:bg-black/30 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Configuración General de Flores</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Etiqueta de sección</label>
              <input
                type="text"
                value={floresData.etiqueta || ''}
                onChange={(e) => handleFloresChange('etiqueta', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. Nuestra selección"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Título</label>
              <input
                type="text"
                value={floresData.titulo || ''}
                onChange={(e) => handleFloresChange('titulo', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. La variedad"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Título destacado (cursiva)</label>
              <input
                type="text"
                value={floresData.titulo_italic || ''}
                onChange={(e) => handleFloresChange('titulo_italic', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. que mereces"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Cita literaria al pie</label>
              <input
                type="text"
                value={floresData.cita || ''}
                onChange={(e) => handleFloresChange('cita', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder='Ej. "Cada flor tiene un lenguaje..."'
              />
            </div>
          </div>
        </div>
        <SectionListEditor
          title="Catálogo Rápido (Variedad de Flores)"
          description="Destaca tus tipos de flores más populares (Rosas, Girasoles, Peonías)."
          items={floresList}
          onChange={setFloresList}
          fields={[
            { key: 'nombre', label: 'Nombre de flor', type: 'text' },
            { key: 'color_hex', label: 'Color Prominente', type: 'color' },
            { key: 'imagen_url', label: 'Imagen', type: 'image' },
          ]}
        />
      </div>

      <div id="seccion-Galeria" className="transition-all duration-300 rounded-3xl border border-transparent space-y-4">
        <div className="bg-white/30 dark:bg-black/30 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Configuración General de Galería</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Etiqueta de sección</label>
              <input
                type="text"
                value={galeriaData.etiqueta || ''}
                onChange={(e) => handleGaleriaChange('etiqueta', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. Entregas reales"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Título</label>
              <input
                type="text"
                value={galeriaData.titulo || ''}
                onChange={(e) => handleGaleriaChange('titulo', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. Así llegan"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Título destacado (cursiva)</label>
              <input
                type="text"
                value={galeriaData.titulo_italic || ''}
                onChange={(e) => handleGaleriaChange('titulo_italic', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. nuestros arreglos"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Subtítulo</label>
              <input
                type="text"
                value={galeriaData.subtitulo || ''}
                onChange={(e) => handleGaleriaChange('subtitulo', e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Ej. Fotos de clientes satisfechos — sin filtros, sin edición"
              />
            </div>
          </div>
        </div>
        <SectionListEditor
          title="Galería"
          description="Fotos de los mejores arreglos que has entregado."
          items={galeriaList}
          onChange={setGaleriaList}
          fields={[
            { key: 'alt_text', label: 'Descripción (Texto Alt)', type: 'text' },
            { key: 'imagen_url', label: 'Imagen', type: 'image' },
            { key: 'autor', label: 'Autor / Cliente', type: 'text' },
          ]}
        />
      </div>

      {/* ── Evento / Promoción ── */}
      <div id="seccion-EventoPromocional" className="transition-all duration-300 rounded-3xl border border-transparent">
        <Accordion 
          title="Evento / Promoción (Banner Superior)" 
          icon={Gift}
          isOpen={openAccordions.EventoPromocional}
          onToggle={(open) => onToggleAccordion('EventoPromocional', open)}
        >
          <div className="flex items-center justify-between mb-4 bg-emerald-500/10 dark:bg-emerald-500/15 backdrop-blur-sm p-4 rounded-xl border border-emerald-500/20 dark:border-emerald-500/15">
            <div>
              <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-400 font-sans">Activar Banner Promocional</h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1 font-sans">Muestra un mensaje especial en la parte superior de tu tienda.</p>
            </div>
            <label htmlFor="eventoActivo" className="relative inline-flex items-center cursor-pointer select-none">
              <input id="eventoActivo" type="checkbox" className="sr-only peer" checked={eventoActivo} onChange={e => setEventoActivo(e.target.checked)} />
              <div className="w-11 h-6 bg-[var(--color-background-tertiary)] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[var(--color-background-primary)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--color-background-primary)] after:border-[var(--color-border-secondary)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
          
          <div className={`space-y-4 transition-all duration-300 ${!eventoActivo ? 'opacity-50 pointer-events-none filter grayscale' : ''}`}>
            <div>
              <label htmlFor="eventoTitulo" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1 font-sans">Título del anuncio</label>
              <input
                id="eventoTitulo"
                type="text"
                value={eventoTitulo || ''}
                onChange={(e) => setEventoTitulo(e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                style={{ fontSize: '16px' }}
                placeholder="Ej. ¡Día de las Madres!"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="eventoProducto" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1 font-sans">Producto Vinculado</label>
                {loadingProducts ? (
                  <div className="text-xs text-[var(--color-text-tertiary)] py-2.5 flex items-center gap-1.5 font-sans">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cargando productos...</span>
                  </div>
                ) : (
                  <select
                    id="eventoProducto"
                    value={eventoProducto || ''}
                    onChange={(e) => setEventoProducto(e.target.value)}
                    className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    style={{ fontSize: '16px' }}
                  >
                    <option value="">-- Ninguno (Sin vínculo) --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.slug || p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label htmlFor="eventoFechaFin" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1 font-sans">Fecha y hora límite</label>
                <input
                  id="eventoFechaFin"
                  type="datetime-local"
                  value={eventoFechaFin || ''}
                  onChange={(e) => setEventoFechaFin(e.target.value)}
                  className="w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>
          </div>
        </Accordion>
      </div>
    </div>
  );
}
