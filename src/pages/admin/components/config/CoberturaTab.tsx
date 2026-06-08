import React from 'react';
import { MapPin, Truck, Plus, Trash2, Building, Globe } from 'lucide-react';
import { Accordion } from './SharedUI';
import { cleanGoogleMapsUrl } from '../../../../utils/formatters';

export function CoberturaTab({
  state,
  actions,
  tenant
}: {
  state: any;
  actions: any;
  tenant: any;
}) {
  const {
    ciudad,
    estado,
    areaMetropolitana,
    mapaUrl,
    direccion,
    colonias,
    zonasEnvio = [],
    openAccordions
  } = state;

  const {
    setCiudad,
    setEstado,
    setAreaMetropolitana,
    setMapaUrl,
    setDireccion,
    setColonias,
    setZonasEnvio,
    onToggleAccordion
  } = actions;

  const handleAddZona = () => {
    setZonasEnvio([...zonasEnvio, { nombre: 'Nueva Zona', costo: 50 }]);
  };

  const handleUpdateZona = (index: number, field: 'nombre' | 'costo', value: any) => {
    const updated = [...zonasEnvio];
    updated[index] = { ...updated[index], [field]: value };
    setZonasEnvio(updated);
  };

  const handleRemoveZona = (index: number) => {
    const updated = [...zonasEnvio];
    updated.splice(index, 1);
    setZonasEnvio(updated);
  };

  const inputClass = "w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all";

  return (
    <div className="space-y-6">
      {/* ── Ubicación Principal ── */}
      <Accordion
        id="editor-Ubicacion"
        title="Ubicación Principal"
        icon={Building}
        isOpen={openAccordions.Ubicacion ?? true}
        onToggle={(open) => onToggleAccordion('Ubicacion', open)}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ciudad" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Ciudad
              </label>
              <input
                id="ciudad"
                type="text"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                className={inputClass}
                placeholder="Ej: Monterrey"
                style={{ fontSize: '16px' }}
              />
            </div>
            <div>
              <label htmlFor="estado" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Estado
              </label>
              <input
                id="estado"
                type="text"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className={inputClass}
                placeholder="Ej: Nuevo León"
                style={{ fontSize: '16px' }}
              />
            </div>
          </div>
          <div>
            <label htmlFor="areaMetropolitana" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Área Metropolitana (Región de entrega general)
            </label>
            <input
              id="areaMetropolitana"
              type="text"
              value={areaMetropolitana}
              onChange={(e) => setAreaMetropolitana(e.target.value)}
              className={inputClass}
              placeholder="Ej: área metropolitana"
              style={{ fontSize: '16px' }}
            />
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Ej: "área metropolitana", "Zona Conurbada". Se muestra en los banners de entrega y hero.
            </p>
          </div>
        </div>
      </Accordion>

      {/* ── Dirección y Mapa ── */}
      <Accordion
        id="editor-Cobertura"
        title="Dirección y Mapa"
        icon={MapPin}
        isOpen={openAccordions.Cobertura}
        onToggle={(open) => onToggleAccordion('Cobertura', open)}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="direccion" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Dirección Física de la Tienda
            </label>
            <input
              id="direccion"
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className={inputClass}
              placeholder="Ej: Av. Constitución 456, Col. Centro, Monterrey"
              style={{ fontSize: '16px' }}
            />
          </div>
          <div>
            <label htmlFor="mapaUrl" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Enlace del Mapa (Google Maps URL)
            </label>
            <input
              id="mapaUrl"
              type="text"
              value={mapaUrl}
              onChange={(e) => setMapaUrl(cleanGoogleMapsUrl(e.target.value))}
              className={inputClass}
              placeholder="https://maps.app.goo.gl/..."
              style={{ fontSize: '16px' }}
            />
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Soporta enlaces cortos compartidos desde celular (`maps.app.goo.gl`), regionales y códigos iframe directos.
            </p>
          </div>
          <div>
            <label htmlFor="colonias" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Colonias de entrega (separadas por coma)
            </label>
            <textarea
              id="colonias"
              value={colonias}
              onChange={(e) => setColonias(e.target.value)}
              className={`${inputClass} min-h-[80px] leading-relaxed`}
              placeholder="Centro, San Pedro, Cumbres..."
              style={{ fontSize: '16px' }}
            />
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Escribe las colonias a las que ofreces entrega, separadas por comas.
            </p>
          </div>
        </div>
      </Accordion>

      {/* ── Costos por Zona ── */}
      <Accordion
        id="editor-ZonasEnvio"
        title="Costos por Zona de Envío"
        icon={Truck}
        isOpen={openAccordions.ZonasEnvio}
        onToggle={(open) => onToggleAccordion('ZonasEnvio', open)}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Costos de Envío por Zona</h3>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Configura tarifas personalizadas según la zona de entrega (MXN).</p>
            </div>
            <button
              type="button"
              onClick={handleAddZona}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar Zona
            </button>
          </div>

          {zonasEnvio.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-white/20 dark:border-white/10 rounded-xl bg-white/5">
              <Truck className="w-8 h-8 text-[var(--color-text-tertiary)] mx-auto mb-2 opacity-50" />
              <p className="text-xs text-[var(--color-text-secondary)] font-medium">No tienes zonas de envío configuradas</p>
              <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">Se utilizará el costo de envío general por defecto (${tenant.envio_costo || 0} MXN).</p>
            </div>
          ) : (
            <div className="space-y-3">
              {zonasEnvio.map((zona: any, index: number) => (
                <div key={index} className="flex items-end gap-3 p-3 bg-white/5 border border-white/10 rounded-xl animate-fade-up">
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1 font-medium">Nombre de la Zona</label>
                    <input
                      type="text"
                      value={zona.nombre}
                      onChange={(e) => handleUpdateZona(index, 'nombre', e.target.value)}
                      className="w-full px-3 py-1.5 bg-white/10 dark:bg-black/40 border border-white/20 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                      placeholder="Ej: Zona Norte, Cholula..."
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1 font-medium">Costo (MXN)</label>
                    <input
                      type="number"
                      min="0"
                      value={zona.costo}
                      onChange={(e) => handleUpdateZona(index, 'costo', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 bg-white/10 dark:bg-black/40 border border-white/20 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveZona(index)}
                    className="p-2.5 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors self-end"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Accordion>
    </div>
  );
}
