import React from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Palette, Type, Upload, GripVertical, Eye, EyeOff, Image, AlertCircle, Home, ShoppingBag, Gift, MessageSquare, Sparkles, Flower2, MapPin, Heart, Camera, Smartphone, Check, Edit, Edit2, AlertTriangle } from 'lucide-react';
import { Accordion, ColorPickerField } from './SharedUI';

import { FONT_OPTIONS } from '../../../../lib/constants.ts';

// ── Section Metadata ─────────────────────────────────────────────
const SECTION_META: Record<string, { label: string; icon: React.ReactNode; premium: boolean }> = {
  Hero:          { label: 'Hero / Banner principal',    icon: <Home className="w-5 h-5" />, premium: false },
  Catalogo:      { label: 'Catálogo de productos',      icon: <ShoppingBag className="w-5 h-5" />, premium: false },
  Servicios:     { label: 'Servicios / Ocasiones',      icon: <Gift className="w-5 h-5" />, premium: false },
  Testimonios:   { label: 'Testimonios de clientes',    icon: <MessageSquare className="w-5 h-5" />, premium: false },
  Beneficios:    { label: 'Beneficios / Por qué elegirnos', icon: <Sparkles className="w-5 h-5" />, premium: false },
  Flores:        { label: 'Variedades de flores',       icon: <Flower2 className="w-5 h-5" />, premium: false },
  Cobertura:     { label: 'Mapa de cobertura',          icon: <MapPin className="w-5 h-5" />, premium: false },
  Nosotros:      { label: 'Sobre nosotros',             icon: <Heart className="w-5 h-5" />, premium: false },
  Galeria:       { label: 'Galería de entregas',        icon: <Camera className="w-5 h-5" />, premium: false },
  InstagramFeed: { label: 'Feed de Instagram',          icon: <Smartphone className="w-5 h-5" />, premium: true  },
};

// ── Section Miniature Wireframes ─────────────────────────────────
// Small blueprint-style previews that use the tenant's brand colors
function SectionMiniature({ sectionKey, colorPrimario, colorAcento }: { sectionKey: string; colorPrimario: string; colorAcento: string }) {
  const w = '100%';
  const h = 48;

  switch (sectionKey) {
    // Hero: banner with title line + button
    case 'Hero':
      return (
        <svg width={w} height={h} viewBox="0 0 140 48" fill="none" className="block">
          <rect width="140" height="48" rx="6" fill={colorPrimario} opacity={0.08} />
          <rect x="10" y="12" width="55" height="5" rx="2" fill={colorPrimario} opacity={0.55} />
          <rect x="10" y="21" width="35" height="3" rx="1.5" fill={colorPrimario} opacity={0.25} />
          <rect x="10" y="32" width="28" height="8" rx="4" fill={colorPrimario} opacity={0.7} />
          <rect x="85" y="6" width="48" height="36" rx="4" fill={colorPrimario} opacity={0.12} />
          <circle cx="109" cy="24" r="8" fill={colorPrimario} opacity={0.18} />
        </svg>
      );

    // Catalogo: product grid
    case 'Catalogo':
      return (
        <svg width={w} height={h} viewBox="0 0 140 48" fill="none" className="block">
          <rect width="140" height="48" rx="6" fill={colorPrimario} opacity={0.05} />
          {[0, 1, 2, 3].map(i => (
            <g key={i}>
              <rect x={6 + i * 33} y="6" width="29" height="24" rx="3" fill={colorPrimario} opacity={0.15} />
              <rect x={10 + i * 33} y="33" width="20" height="3" rx="1.5" fill={colorPrimario} opacity={0.3} />
              <rect x={10 + i * 33} y="39" width="12" height="3" rx="1.5" fill={colorAcento} opacity={0.4} />
            </g>
          ))}
        </svg>
      );

    // Servicios: circles for service icons
    case 'Servicios':
      return (
        <svg width={w} height={h} viewBox="0 0 140 48" fill="none" className="block">
          <rect width="140" height="48" rx="6" fill={colorPrimario} opacity={0.05} />
          {[0, 1, 2, 3, 4].map(i => (
            <g key={i}>
              <circle cx={14 + i * 26} cy="18" r="9" fill={colorPrimario} opacity={0.2} />
              <rect x={6 + i * 26} y="32" width="16" height="3" rx="1.5" fill={colorPrimario} opacity={0.25} />
            </g>
          ))}
        </svg>
      );

    // Testimonios: quote cards
    case 'Testimonios':
      return (
        <svg width={w} height={h} viewBox="0 0 140 48" fill="none" className="block">
          <rect width="140" height="48" rx="6" fill={colorPrimario} opacity={0.05} />
          {[0, 1, 2].map(i => (
            <g key={i}>
              <rect x={6 + i * 45} y="6" width="41" height="36" rx="4" fill={colorPrimario} opacity={0.08} stroke={colorPrimario} strokeOpacity={0.15} strokeWidth="0.5" />
              <text x={12 + i * 45} y="16" fontSize="10" fill={colorPrimario} opacity={0.4} fontFamily="serif">"</text>
              <rect x={12 + i * 45} y="20" width="28" height="2.5" rx="1" fill={colorPrimario} opacity={0.2} />
              <rect x={12 + i * 45} y="25" width="20" height="2.5" rx="1" fill={colorPrimario} opacity={0.15} />
              <circle cx={15 + i * 45} cy="36" r="3" fill={colorAcento} opacity={0.3} />
              <rect x={21 + i * 45} y="34" width="18" height="2.5" rx="1" fill={colorPrimario} opacity={0.2} />
            </g>
          ))}
        </svg>
      );

    // Beneficios: list bullets
    case 'Beneficios':
      return (
        <svg width={w} height={h} viewBox="0 0 140 48" fill="none" className="block">
          <rect width="140" height="48" rx="6" fill={colorPrimario} opacity={0.05} />
          {[0, 1, 2].map(i => (
            <g key={i}>
              <circle cx="16" cy={12 + i * 14} r="4" fill={colorPrimario} opacity={0.3} />
              <rect x="26" y={10 + i * 14} width="45" height="3" rx="1.5" fill={colorPrimario} opacity={0.25} />
              <rect x="80" y={10 + i * 14} width="50" height="3" rx="1.5" fill={colorPrimario} opacity={0.12} />
            </g>
          ))}
        </svg>
      );

    // Flores: flower badges
    case 'Flores':
      return (
        <svg width={w} height={h} viewBox="0 0 140 48" fill="none" className="block">
          <rect width="140" height="48" rx="6" fill={colorPrimario} opacity={0.05} />
          {[0, 1, 2, 3, 4].map(i => (
            <g key={i}>
              <circle cx={14 + i * 26} cy="18" r="10" fill={colorPrimario} opacity={0.12} />
              <circle cx={14 + i * 26} cy="18" r="5" fill={colorAcento} opacity={0.35} />
              <rect x={6 + i * 26} y="33" width="16" height="3" rx="1.5" fill={colorPrimario} opacity={0.2} />
            </g>
          ))}
        </svg>
      );

    // Cobertura: radar-circle map
    case 'Cobertura':
      return (
        <svg width={w} height={h} viewBox="0 0 140 48" fill="none" className="block">
          <rect width="140" height="48" rx="6" fill={colorPrimario} opacity={0.05} />
          <circle cx="70" cy="24" r="18" fill={colorPrimario} opacity={0.06} stroke={colorPrimario} strokeOpacity={0.15} strokeWidth="0.5" />
          <circle cx="70" cy="24" r="12" fill={colorPrimario} opacity={0.08} stroke={colorPrimario} strokeOpacity={0.12} strokeWidth="0.5" />
          <circle cx="70" cy="24" r="6" fill={colorPrimario} opacity={0.15} />
          <circle cx="70" cy="24" r="2" fill={colorAcento} opacity={0.6} />
          <circle cx="60" cy="18" r="1.5" fill={colorPrimario} opacity={0.4} />
          <circle cx="82" cy="28" r="1.5" fill={colorPrimario} opacity={0.4} />
          <circle cx="75" cy="14" r="1.5" fill={colorPrimario} opacity={0.3} />
        </svg>
      );

    // Nosotros: split layout (photo + text)
    case 'Nosotros':
      return (
        <svg width={w} height={h} viewBox="0 0 140 48" fill="none" className="block">
          <rect width="140" height="48" rx="6" fill={colorPrimario} opacity={0.05} />
          <rect x="6" y="6" width="50" height="36" rx="4" fill={colorPrimario} opacity={0.12} />
          <circle cx="31" cy="20" r="8" fill={colorPrimario} opacity={0.18} />
          <rect x="66" y="10" width="60" height="4" rx="2" fill={colorPrimario} opacity={0.35} />
          <rect x="66" y="18" width="50" height="3" rx="1.5" fill={colorPrimario} opacity={0.18} />
          <rect x="66" y="24" width="55" height="3" rx="1.5" fill={colorPrimario} opacity={0.12} />
          <rect x="66" y="30" width="40" height="3" rx="1.5" fill={colorPrimario} opacity={0.12} />
          <rect x="66" y="38" width="24" height="6" rx="3" fill={colorAcento} opacity={0.35} />
        </svg>
      );

    // Galeria: photo mosaic
    case 'Galeria':
      return (
        <svg width={w} height={h} viewBox="0 0 140 48" fill="none" className="block">
          <rect width="140" height="48" rx="6" fill={colorPrimario} opacity={0.05} />
          <rect x="6" y="6" width="60" height="36" rx="4" fill={colorPrimario} opacity={0.15} />
          <rect x="70" y="6" width="28" height="16" rx="3" fill={colorAcento} opacity={0.18} />
          <rect x="102" y="6" width="32" height="16" rx="3" fill={colorPrimario} opacity={0.12} />
          <rect x="70" y="26" width="64" height="16" rx="3" fill={colorPrimario} opacity={0.1} />
        </svg>
      );

    // InstagramFeed: phone mockup with feed lines
    case 'InstagramFeed':
      return (
        <svg width={w} height={h} viewBox="0 0 140 48" fill="none" className="block">
          <rect width="140" height="48" rx="6" fill={colorPrimario} opacity={0.05} />
          <rect x="48" y="2" width="44" height="44" rx="8" fill={colorPrimario} opacity={0.08} stroke={colorPrimario} strokeOpacity={0.2} strokeWidth="0.7" />
          <rect x="52" y="6" width="36" height="4" rx="2" fill={colorPrimario} opacity={0.15} />
          <rect x="52" y="13" width="36" height="18" rx="2" fill={colorPrimario} opacity={0.12} />
          <circle cx="57" cy="36" r="2" fill={colorAcento} opacity={0.4} />
          <circle cx="64" cy="36" r="2" fill={colorPrimario} opacity={0.2} />
          <circle cx="71" cy="36" r="2" fill={colorPrimario} opacity={0.15} />
          <rect x="76" y="34" width="10" height="3" rx="1.5" fill={colorPrimario} opacity={0.15} />
        </svg>
      );

    default:
      return null;
  }
}

function getContrastRatio(hex1: string, hex2: string): number {
  const normalizeHex = (hex: string) => {
    let clean = (hex || '').replace('#', '');
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    if (clean.length !== 6) {
      return '000000'; // fallback
    }
    return clean;
  };

  const lum = (hex: string) => {
    const clean = normalizeHex(hex);
    const rgb = parseInt(clean, 16) || 0;
    const r = ((rgb >> 16) & 0xff) / 255;
    const g = ((rgb >> 8) & 0xff) / 255;
    const b = (rgb & 0xff) / 255;
    const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    return L;
  };
  const L1 = lum(hex1);
  const L2 = lum(hex2);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

// ── Main Component ───────────────────────────────────────────────
export function TemaTab({ 
  state, 
  actions, 
  tenant, 
  listLengths,
  onEditSection,
  onNavigateToContent
}: { 
  state: any, 
  actions: any, 
  tenant: any,
  listLengths: Record<string, number>,
  onEditSection: (sectionKey: string) => void,
  onNavigateToContent: (sectionKey: string) => void
}) {
  const { colorPrimario, colorSecundario, colorAcento, fontFamily, logoPreview, logoError, sections } = state;
  const { setColorPrimario, setColorSecundario, setColorAcento, setFontFamily, handleLogoChange, handleDragEnd } = actions;

  const visibleSections = (sections || []).filter((key: string) => {
    if (key === 'InstagramFeed' && tenant.subscription_level === 1) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <Accordion title="Logotipo" icon={Image} defaultOpen={true}>
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-xl bg-white/40 dark:bg-black/40 backdrop-blur-sm border-2 border-dashed border-white/40 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
            ) : (
              <Upload className="w-6 h-6 text-[var(--color-text-tertiary)]" />
            )}
          </div>
          <div className="flex-1">
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-white/60 dark:hover:bg-white/10 cursor-pointer transition-colors">
              <Upload className="w-4 h-4" strokeWidth={2} />
              Subir imagen
              <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            </label>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-2 leading-relaxed">PNG, JPG o SVG · Máximo 2MB</p>
            {logoError && (
              <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1 animate-fade-in">
                <AlertCircle className="w-3 h-3" /> {logoError}
              </p>
            )}
          </div>
        </div>
      </Accordion>

      <Accordion title="Paleta de Colores" icon={Palette}>
        <div className="space-y-4">
          <ColorPickerField label="Color Primario" value={colorPrimario} onChange={setColorPrimario} />
          
          <div>
            <ColorPickerField label="Color Secundario" value={colorSecundario} onChange={setColorSecundario} />
            {getContrastRatio(colorSecundario, '#ffffff') < 4.5 && getContrastRatio(colorSecundario, '#000000') < 4.5 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1 flex items-center gap-1.5 animate-fade-in pl-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                Este color puede dificultar la lectura del texto
              </p>
            )}
          </div>
          
          <div>
            <ColorPickerField label="Color Acento" value={colorAcento} onChange={setColorAcento} />
            {getContrastRatio(colorAcento, '#ffffff') < 4.5 && getContrastRatio(colorAcento, '#000000') < 4.5 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1 flex items-center gap-1.5 animate-fade-in pl-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                Este color puede dificultar la lectura del texto
              </p>
            )}
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <div className="flex-1 h-10 rounded-lg transition-colors duration-300" style={{ backgroundColor: colorPrimario }} title="Primario" />
          <div className="flex-1 h-10 rounded-lg transition-colors duration-300" style={{ backgroundColor: colorSecundario }} title="Secundario" />
          <div className="flex-1 h-10 rounded-lg transition-colors duration-300" style={{ backgroundColor: colorAcento }} title="Acento" />
        </div>
      </Accordion>

      <Accordion title="Tipografía" icon={Type}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
          {FONT_OPTIONS.map((font) => (
            <button
              key={font.value}
              onClick={() => setFontFamily(font.value)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all duration-200 border ${
                fontFamily === font.value
                  ? 'border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-400/15 text-emerald-800 dark:text-emerald-300 font-semibold shadow-sm'
                  : 'border-white/30 dark:border-white/10 bg-white/50 dark:bg-black/50 backdrop-blur-sm text-[var(--color-text-secondary)] hover:bg-white/60 dark:hover:bg-white/10 hover:border-[var(--color-border-primary)]'
              }`}
              style={{ fontFamily: font.value }}
            >
              <span>{font.name}</span>
              {fontFamily === font.value && <Check className="w-4 h-4 text-emerald-600" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      </Accordion>

      <Accordion title="Orden de Secciones" icon={GripVertical}>
        <p className="text-xs text-[var(--color-text-tertiary)] mb-5">Arrastra las tarjetas para reorganizar tu landing</p>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="sections-list">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`space-y-2 rounded-xl p-2 transition-colors duration-200 min-h-[200px] ${
                  snapshot.isDraggingOver ? 'bg-emerald-500/10 dark:bg-emerald-500/10' : 'bg-white/30 dark:bg-black/30 backdrop-blur-sm border border-white/20 dark:border-white/10'
                }`}
              >
                {visibleSections.map((sectionKey: string, index: number) => {
                  const meta = SECTION_META[sectionKey] || {
                    label: sectionKey, icon: <GripVertical className="w-5 h-5" />, premium: false,
                  };

                  const isLocked = meta.premium && tenant.subscription_level < 2;
                  const listCount = listLengths[sectionKey] ?? -1;

                  return (
                    <Draggable key={sectionKey} draggableId={sectionKey} index={index} isDragDisabled={isLocked}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          title={isLocked ? "Disponible en tu plan actual: actualiza para habilitar" : ""}
                          className={`rounded-xl border transition-all duration-200 select-none overflow-hidden ${
                            snapshot.isDragging
                              ? 'bg-white/90 dark:bg-black/90 backdrop-blur-sm shadow-xl scale-[1.02] z-50'
                              : isLocked
                                ? 'bg-white/40 dark:bg-black/40 border-[var(--color-border-tertiary)] opacity-60 cursor-not-allowed'
                                : 'bg-white/60 dark:bg-black/60 border-[var(--color-border-tertiary)] hover:border-[var(--color-border-secondary)] hover:shadow-sm'
                          }`}
                          style={snapshot.isDragging ? {
                            borderColor: colorPrimario,
                            boxShadow: `0 8px 30px -8px ${colorPrimario}40, 0 0 0 1px ${colorPrimario}30`,
                          } : {}}
                        >
                          {/* Miniatura visual */}
                          <div className="px-3 pt-3">
                            <SectionMiniature sectionKey={sectionKey} colorPrimario={colorPrimario} colorAcento={colorAcento} />
                          </div>

                          {/* Info row */}
                          <div className="flex items-center gap-3 px-4 py-2.5">
                            <div
                              {...provided.dragHandleProps}
                              className={isLocked ? '' : 'cursor-grab active:cursor-grabbing p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] select-none shrink-0'}
                            >
                              <GripVertical className={`w-4 h-4 shrink-0 ${isLocked ? 'text-[var(--color-border-primary)]' : ''}`} strokeWidth={2} />
                            </div>
                            <div className="text-[var(--color-text-tertiary)]" aria-hidden="true">{meta.icon}</div>
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              <span className="text-sm font-medium text-[var(--color-text-primary)] truncate block">{meta.label}</span>
                              {listCount === 0 && (
                                <span className="text-[0.6rem] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 dark:border-amber-500/15 px-1.5 py-0.5 rounded">
                                  Sin contenido
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {!isLocked && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onNavigateToContent(sectionKey);
                                    }}
                                    className="text-xs flex items-center gap-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors px-1 py-0.5 rounded-md"
                                    title="Editar contenido"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    Editar contenido
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEditSection(sectionKey);
                                    }}
                                    className="p-1 rounded-md text-[var(--color-text-tertiary)] hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                                    title="Editar configuración de la sección"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {isLocked ? <EyeOff className="w-4 h-4 text-[var(--color-border-primary)]" /> : <Eye className="w-4 h-4 text-emerald-500" />}
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        <div className="mt-4 pt-4 border-t border-[var(--color-border-tertiary)] flex items-center gap-4 text-[0.7rem] text-[var(--color-text-tertiary)]">
          <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3 text-emerald-500" /> Activa</span>
          <span className="inline-flex items-center gap-1"><EyeOff className="w-3 h-3 text-[var(--color-border-primary)]" /> Bloqueada</span>
        </div>
      </Accordion>
    </div>
  );
}
