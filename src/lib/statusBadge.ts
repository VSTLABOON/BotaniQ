/**
 * Helper to obtain css classes for order status badges using system design CSS variables.
 */
export function getStatusBadgeClasses(estado: string): string {
  const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold';
  const map: Record<string, string> = {
    pagado: `${base} bg-[var(--color-success-subtle)] text-[var(--color-success)]`,
    entregado: `${base} bg-[var(--color-success-subtle)] text-[var(--color-success)]`,
    pendiente_pago: `${base} bg-[var(--color-warning-subtle)] text-[var(--color-warning)]`,
    preparando: `${base} bg-[var(--color-warning-subtle)] text-[var(--color-warning)]`,
    cancelado: `${base} bg-[var(--color-error-subtle)] text-[var(--color-error)]`,
    en_camino: `${base} bg-[var(--color-info-subtle)] text-[var(--color-info)]`,
    en_ruta: `${base} bg-[var(--color-info-subtle)] text-[var(--color-info)]`,
    pendiente: `${base} bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border-secondary)]`,
  };
  return map[estado] ?? `${base} bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]`;
}
