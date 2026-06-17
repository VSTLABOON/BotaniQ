// ─── SUPERADMIN DASHBOARD ────────────────────────────────────────
// Panel de control global del SaaS. Muestra todas las tiendas
// (tenants), métricas de ingresos, y permite gestionar los niveles
// de suscripción de cada tenant.
//
// RBAC: Solo visible para rol 'superadmin'.
//
// Datos:
//   • Tabla tiendas: id, nombre, slug, subscription_level, currency,
//     stripe_customer_id, created_at
//   • Agregados: conteo de pedidos y revenue por tienda
//
// Seguridad: Usa Service Role implícitamente (el superadmin tiene
// acceso vía RLS a todas las tiendas).
// ────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import { logger } from '../../lib/logger';
import { updateStoreSubscriptionLevel } from '../../services/superadminService';
import {
  Store,
  TrendingUp,
  Users,
  CreditCard,
  ChevronUp,
  ChevronDown,
  Search,
  ArrowUpRight,
  Zap,
  Crown,
  Rocket,
  Globe,
  Check,
  X,
} from 'lucide-react';

import { CARD as BASE_CARD } from '../admin/components/config/SharedUI';

const CARD = `${BASE_CARD} p-5`;

// ── Configuración de niveles ─────────────────────────────────────
const LEVEL_CONFIG: Record<number, { label: string; icon: any; color: string; bg: string; border: string }> = {
  0: { label: 'Bloqueado', icon: X,      color: 'text-red-400',                        bg: 'bg-red-500/10',    border: 'border-red-500/20' },
  1: { label: 'Esencia',   icon: Store,  color: 'text-[var(--color-text-tertiary)]',   bg: 'bg-gray-500/10',   border: 'border-gray-500/20' },
  2: { label: 'Aura',      icon: Zap,    color: 'text-purple-400',                     bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  3: { label: 'Alquimia',  icon: Crown,  color: 'text-amber-400',                      bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
  4: { label: 'Edén',      icon: Rocket, color: 'text-violet-400',                     bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
};

// ── Tipos ────────────────────────────────────────────────────────
interface TenantRow {
  id: string;
  nombre: string;
  slug: string;
  subscription_level: number;
  currency: string;
  stripe_customer_id: string | null;
  created_at: string;
}

// ── Componente de Nivel (Badge) ──────────────────────────────────
function LevelBadge({ level }: { level: number }) {
  const conf = LEVEL_CONFIG[level] || LEVEL_CONFIG[1];
  const Icon = conf.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${conf.bg} ${conf.color} border ${conf.border}`}>
      <Icon className="w-3 h-3" strokeWidth={2.5} />
      Nivel {level} · {conf.label}
    </span>
  );
}

// ── Modal de cambio de nivel ─────────────────────────────────────
function LevelChangeModal({
  tenant,
  onClose,
  onConfirm,
}: {
  tenant: TenantRow;
  onClose: () => void;
  onConfirm: (tenantId: string, newLevel: number) => void;
}) {
  const [selectedLevel, setSelectedLevel] = useState(tenant.subscription_level);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (selectedLevel === tenant.subscription_level) return onClose();
    setSaving(true);
    await onConfirm(tenant.id, selectedLevel);
    setSaving(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]" onClick={onClose} />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#16162a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div>
              <h3 className="text-base font-bold text-[var(--color-background-primary)]">Cambiar Suscripción</h3>
              <p className="text-xs text-[var(--color-background-primary)]/40 mt-0.5">{tenant.nombre}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-background-primary)]/30 hover:text-[var(--color-background-primary)] hover:bg-[var(--color-background-primary)]/5">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Opciones */}
          <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
            {[1, 2, 3, 4].map((level) => {
              const conf = LEVEL_CONFIG[level];
              const Icon = conf.icon;
              const isSelected = selectedLevel === level;
              const isCurrent = tenant.subscription_level === level;
              return (
                <button
                  key={level}
                  onClick={() => setSelectedLevel(level)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
                    isSelected
                      ? `${conf.bg} ${conf.border} ring-1 ring-current/20`
                      : 'bg-[var(--color-background-primary)]/[0.02] border-white/5 hover:bg-[var(--color-background-primary)]/5'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg ${conf.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${conf.color}`} strokeWidth={2} />
                  </div>
                  <div className="flex-1 text-left">
                    <span className={`text-sm font-semibold ${isSelected ? 'text-[var(--color-background-primary)]' : 'text-[var(--color-background-primary)]/60'}`}>
                      Nivel {level} — {conf.label}
                    </span>
                    <p className="text-xs text-[var(--color-background-primary)]/30 mt-0.5">
                      {level === 1 && 'Esencia (WhatsApp, límites en catálogo)'}
                      {level === 2 && 'Aura (Instagram Feed, catálogo ilimitado, 1 empleado)'}
                      {level === 3 && 'Alquimia (Cobro en línea Stripe/OpenPay, equipo ilimitado)'}
                      {level === 4 && 'Edén (Logística, Repartidores)'}
                    </p>
                  </div>
                  {isCurrent && (
                    <span className="text-[0.6rem] font-bold text-[var(--color-background-primary)]/20 uppercase tracking-wider">Actual</span>
                  )}
                  {isSelected && <Check className={`w-5 h-5 ${conf.color}`} strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-black/20">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[var(--color-background-primary)]/40 hover:text-[var(--color-background-primary)] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || selectedLevel === tenant.subscription_level}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-[var(--color-background-primary)]/5 disabled:text-[var(--color-background-primary)]/20 text-[var(--color-background-primary)] text-sm font-semibold rounded-lg transition-all"
            >
              {saving ? 'Guardando...' : 'Confirmar Cambio'}
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ██ COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export default function SuperadminDashboard() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTenant, setEditingTenant] = useState<TenantRow | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // ── Fetch de todos los tenants con patrón active ─────────────────
  useEffect(() => {
    let active = true;

    async function fetchTenants() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('tiendas')
          .select('id, nombre, slug, subscription_level, currency, stripe_customer_id, created_at')
          .order('created_at', { ascending: false });

        if (!active) return;
        if (error) throw error;
        setTenants(data ?? []);
      } catch (err) {
        if (active) {
          logger.error('Error fetching tenants:', err as Error);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchTenants();

    return () => {
      active = false;
    };
  }, [refreshTrigger]);

  // ── Cambiar nivel de suscripción ────────────────────────────────
  const handleLevelChange = useCallback(async (tenantId: string, newLevel: number) => {
    // Optimista
    setTenants((prev) =>
      prev.map((t) => (t.id === tenantId ? { ...t, subscription_level: newLevel } : t))
    );

    try {
      await updateStoreSubscriptionLevel(tenantId, newLevel);
    } catch (error) {
      logger.error('Error updating subscription level:', error as Error);
      setRefreshTrigger((prev) => prev + 1); // Revertir con refetch
    }
  }, []);

  // ── Filtro de búsqueda ──────────────────────────────────────────
  const filtered = useMemo(() => {
    return tenants.filter((t) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return t.nombre.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q);
    });
  }, [tenants, searchQuery]);

  // ── KPIs globales ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalTenants = tenants.length;
    const byLevel = [1, 2, 3, 4].map((l) => tenants.filter((t) => t.subscription_level === l).length);
    return { totalTenants, byLevel };
  }, [tenants]);

  const { totalTenants, byLevel } = stats;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* ── Encabezado ── */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-background-primary)] mb-1">Panel Global</h1>
        <p className="text-sm text-[var(--color-background-primary)]/40">
          Gestión centralizada de todos los tenants del SaaS ·{' '}
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* ═══ KPIs ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Tiendas */}
        <div className={`${CARD} flex items-start gap-4`}>
          <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <Store className="w-5 h-5 text-violet-400" strokeWidth={1.8} />
          </div>
          <div>
            <span className="text-xs text-[var(--color-background-primary)]/40 font-medium">Tiendas Activas</span>
            <span className="text-2xl font-bold text-[var(--color-background-primary)] block leading-tight mt-0.5">{totalTenants}</span>
          </div>
        </div>

        {/* Nivel 1 */}
        <div className={`${CARD} flex items-start gap-4`}>
          <div className="w-11 h-11 rounded-xl bg-gray-500/10 flex items-center justify-center">
            <Store className="w-5 h-5 text-[var(--color-text-tertiary)]" strokeWidth={1.8} />
          </div>
          <div>
            <span className="text-xs text-[var(--color-background-primary)]/40 font-medium">Nivel 1 (Esencia)</span>
            <span className="text-2xl font-bold text-[var(--color-background-primary)] block leading-tight mt-0.5">{byLevel[0]}</span>
          </div>
        </div>

        {/* Nivel 2 */}
        <div className={`${CARD} flex items-start gap-4`}>
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-purple-400" strokeWidth={1.8} />
          </div>
          <div>
            <span className="text-xs text-[var(--color-background-primary)]/40 font-medium">Nivel 2 (Aura)</span>
            <span className="text-2xl font-bold text-[var(--color-background-primary)] block leading-tight mt-0.5">{byLevel[1]}</span>
          </div>
        </div>

        {/* Nivel 3 */}
        <div className={`${CARD} flex items-start gap-4`}>
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Crown className="w-5 h-5 text-amber-400" strokeWidth={1.8} />
          </div>
          <div>
            <span className="text-xs text-[var(--color-background-primary)]/40 font-medium">Nivel 3 (Alquimia)</span>
            <span className="text-2xl font-bold text-[var(--color-background-primary)] block leading-tight mt-0.5">{byLevel[2]}</span>
          </div>
        </div>

        {/* Nivel 4 */}
        <div className={`${CARD} flex items-start gap-4`}>
          <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <Rocket className="w-5 h-5 text-violet-400" strokeWidth={1.8} />
          </div>
          <div>
            <span className="text-xs text-[var(--color-background-primary)]/40 font-medium">Nivel 4 (Edén)</span>
            <span className="text-2xl font-bold text-[var(--color-background-primary)] block leading-tight mt-0.5">{byLevel[3]}</span>
          </div>
        </div>
      </div>

      {/* ═══ BUSCADOR ═══ */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-background-primary)]/20" />
        <input
          type="text"
          placeholder="Buscar tienda por nombre o slug…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-10 pl-10 pr-4 bg-[var(--color-background-primary)]/[0.03] border border-white/5 rounded-xl text-sm text-[var(--color-background-primary)] placeholder:text-[var(--color-background-primary)]/20 focus:outline-none focus:ring-1 focus:ring-violet-500/30 focus:border-violet-500/30 transition-all"
        />
      </div>

      {/* ═══ TABLA DE TENANTS ═══ */}
      <div className={`${BASE_CARD} overflow-hidden`}>
        {/* Header */}
        <div className="hidden md:grid grid-cols-[1fr_140px_140px_160px_100px] gap-4 px-6 py-3 bg-[var(--color-background-primary)]/[0.02] border-b border-white/5 text-[0.7rem] font-semibold text-[var(--color-background-primary)]/30 uppercase tracking-wider">
          <span>Tienda</span>
          <span>Nivel</span>
          <span>Moneda</span>
          <span>Fecha Registro</span>
          <span className="text-center">Acción</span>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mb-4" />
            <p className="text-sm text-[var(--color-background-primary)]/30">Cargando tenants...</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {filtered.map((tenant) => (
              <div
                key={tenant.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_140px_140px_160px_100px] gap-4 px-6 py-4 items-center hover:bg-[var(--color-background-primary)]/[0.02] transition-colors"
              >
                {/* Nombre + Slug */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-background-primary)] truncate">{tenant.nombre}</p>
                  <p className="text-xs text-[var(--color-background-primary)]/30 truncate flex items-center gap-1 mt-0.5">
                    <Globe className="w-3 h-3 shrink-0" />
                    /{tenant.slug}
                  </p>
                </div>

                {/* Nivel */}
                <div>
                  <LevelBadge level={tenant.subscription_level} />
                </div>

                {/* Moneda */}
                <div>
                  <span className="text-sm text-[var(--color-background-primary)]/50 font-mono uppercase">{tenant.currency || 'MXN'}</span>
                </div>

                {/* Fecha */}
                <div className="text-sm text-[var(--color-background-primary)]/40">
                  {new Date(tenant.created_at).toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>

                {/* Acción */}
                <div className="flex justify-center">
                  <button
                    onClick={() => setEditingTenant(tenant)}
                    className="text-xs font-semibold text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 px-3 py-1.5 rounded-lg transition-all"
                  >
                    Editar ↗
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <Store className="w-12 h-12 text-[var(--color-background-primary)]/10 mx-auto mb-3" />
            <p className="text-sm text-[var(--color-background-primary)]/30">No se encontraron tiendas</p>
          </div>
        )}
      </div>

      {/* ═══ MODAL DE EDICIÓN ═══ */}
      <AnimatePresence>
        {editingTenant && (
          <LevelChangeModal
            tenant={editingTenant}
            onClose={() => setEditingTenant(null)}
            onConfirm={handleLevelChange}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
