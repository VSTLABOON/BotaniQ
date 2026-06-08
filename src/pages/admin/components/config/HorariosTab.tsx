import React from 'react';
import { Clock } from 'lucide-react';
import { Accordion } from './SharedUI';

export function HorariosTab({
  state,
  actions,
  tenant
}: {
  state: any;
  actions: any;
  tenant: any;
}) {
  const {
    horarioRegular,
    horarioEspecial,
    openAccordions
  } = state;

  const {
    setHorarioRegular,
    setHorarioEspecial,
    onToggleAccordion
  } = actions;

  const inputClass = "w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all";

  return (
    <div className="space-y-6">
      {/* ── Horarios de Atención ── */}
      <Accordion
        id="editor-Horarios"
        title="Horarios de Atención"
        icon={Clock}
        isOpen={openAccordions.Horarios ?? true}
        onToggle={(open) => onToggleAccordion('Horarios', open)}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="horarioRegular" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Horario Comercial Regular
            </label>
            <input
              id="horarioRegular"
              type="text"
              value={horarioRegular}
              onChange={(e) => setHorarioRegular(e.target.value)}
              className={inputClass}
              placeholder="Ej: Lunes a Domingo · 8:00 AM – 8:00 PM"
              style={{ fontSize: '16px' }}
            />
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Se muestra públicamente en el pie de página (footer) de tu catálogo digital.
            </p>
          </div>
          <div>
            <label htmlFor="horarioEspecial" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Notas u Horario Especial (Opcional)
            </label>
            <input
              id="horarioEspecial"
              type="text"
              value={horarioEspecial}
              onChange={(e) => setHorarioEspecial(e.target.value)}
              className={inputClass}
              placeholder="Ej: Días festivos cerrado de 1:00 PM a 3:00 PM"
              style={{ fontSize: '16px' }}
            />
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Mensaje secundario de horarios para días festivos o avisos breves.
            </p>
          </div>
        </div>
      </Accordion>
    </div>
  );
}
