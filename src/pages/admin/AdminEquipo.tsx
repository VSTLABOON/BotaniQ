// ─── ADMIN EQUIPO — GESTIÓN DE STAFF ────────────────────────────
// Permite al dueño ver, añadir y gestionar miembros de su equipo.
//
// SAAS_FLAG OVERVIEW:
//   NIVEL 1: Bloqueado — muestra upgrade CTA.
//   NIVEL 2: Hasta 5 miembros (dueño + empleados).
//   NIVEL 3: Ilimitado + rol 'repartidor' desbloqueado.
//
// Dependencias:
//   teamService.ts — Funciones async simuladas (Edge Function en prod)
//   TenantContext   — tenant.id para filtrar por tienda
// ────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, Users, Shield, Truck, Lock,
  X, Loader2, Save, Crown, ArrowUpCircle,
  UserX, Mail, Key,
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import {
  fetchTeamMembers,
  createTeamMember,
  deactivateTeamMember,
  type TeamMember,
  type CreateMemberPayload,
} from '../../services/teamService';
import type { UserRole } from '../../types';
import { logger } from '../../lib/logger';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

import { CARD } from './components/config/SharedUI';

// ── Configuración visual de roles ────────────────────────────────
const ROLE_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  dueño:      { label: 'Dueño',      dot: 'bg-amber-500',   bg: 'bg-amber-50 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-400' },
  admin:      { label: 'Admin',      dot: 'bg-violet-500',  bg: 'bg-violet-50 dark:bg-violet-900/30',  text: 'text-violet-700 dark:text-violet-400' },
  empleado:   { label: 'Empleado',   dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  repartidor: { label: 'Repartidor', dot: 'bg-blue-500',    bg: 'bg-blue-50 dark:bg-blue-900/30',    text: 'text-blue-700 dark:text-blue-400' },
};

// ── Roles disponibles en el selector ─────────────────────────────
const ASSIGNABLE_ROLES: { value: UserRole; label: string; icon: typeof Users }[] = [
  { value: 'empleado',   label: 'Empleado',   icon: Users },
  { value: 'repartidor', label: 'Repartidor', icon: Truck },
];

// ── Avatar por iniciales ─────────────────────────────────────────
function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['bg-emerald-600', 'bg-blue-600', 'bg-violet-600', 'bg-pink-600', 'bg-amber-600'];
  const color = colors[name.length % colors.length];
  return (
    <div
      className={`${color} text-[var(--color-background-primary)] font-semibold rounded-full flex items-center justify-center shrink-0 select-none`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >{initials}</div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ██ MODAL: AÑADIR MIEMBRO
// ═══════════════════════════════════════════════════════════════════

function AddMemberModal({
  onClose, onCreated, tiendaId,
}: {
  onClose: () => void;
  onCreated: (member: TeamMember) => void;
  tiendaId: string;
}) {
  const { tenant } = useTenant();
  const level = tenant?.subscription_level ?? 1;
  const [nombre, setNombre]   = useState('');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol]         = useState<UserRole>('empleado');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  /**
   * Crear miembro del equipo a través del servicio simulado.
   *
   * Flujo de datos:
   *   1. Construye CreateMemberPayload con los campos del formulario.
   *   2. Llama a createTeamMember() del teamService.
   *      - En PRODUCCIÓN esto invoca una Edge Function que usa
   *        supabase.auth.admin.createUser() (server-side).
   *      - NUNCA usa supabase.auth.signUp() en el cliente para
   *        no desloguear al dueño que tiene sesión activa.
   *   3. Si éxito → invoca onCreated() para agregar al estado local.
   *   4. Si falla → muestra el error en el formulario.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload: CreateMemberPayload = {
        nombre, email, tempPassword: password, rol,
      };
      const newMember = await createTeamMember(tiendaId, payload);
      onCreated(newMember);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[3px] z-[9998]" onClick={onClose} />
      <div className="fixed inset-0 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[680px] md:max-h-[85vh] bg-[var(--color-background-primary)] md:bg-[var(--color-background-primary)]/90 md:backdrop-blur-2xl md:rounded-2xl shadow-2xl z-[9999] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-tertiary)] shrink-0">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            Añadir Miembro
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 rounded-xl text-sm text-red-700 dark:text-red-400">
              <X className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Nombre completo</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} required
              className="w-full h-10 px-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
              style={{ fontSize: '16px' }} />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              <Mail className="w-3.5 h-3.5" /> Email
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full h-10 px-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
              style={{ fontSize: '16px' }} />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              <Key className="w-3.5 h-3.5" /> Contraseña temporal
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              className="w-full h-10 px-4 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
              style={{ fontSize: '16px' }} />
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">El miembro podrá cambiarla al iniciar sesión.</p>
          </div>

          {/* ── Selector de Rol ── */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Rol asignado</label>
            <div className="space-y-2">
              {ASSIGNABLE_ROLES.map(option => {
                const Icon = option.icon;
                const isLocked = option.value === 'repartidor' && level < 4;

                return (
                  <button
                    key={option.value} type="button"
                    disabled={isLocked}
                    onClick={() => !isLocked && setRol(option.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm border transition-all duration-200
                      ${isLocked
                        ? 'border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] text-[var(--color-text-tertiary)] cursor-not-allowed'
                        : rol === option.value
                          ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 font-semibold'
                          : 'border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] hover:border-[var(--color-border-secondary)]'
                      }`}
                  >
                    <Icon className={`w-4 h-4 ${isLocked ? 'text-[var(--color-border-primary)]' : rol === option.value ? 'text-emerald-600' : 'text-[var(--color-text-tertiary)]'}`} />
                    <span className="flex-1 text-left">{option.label}</span>
                    {isLocked ? (
                      <span className="inline-flex items-center gap-1 text-[0.6rem] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                        <Lock className="w-3 h-3" /> NIVEL 4
                      </span>
                    ) : rol === option.value ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] shrink-0 pb-safe md:pb-4">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] transition-colors">
            Cancelar
          </button>
          <button onClick={(e) => { e.preventDefault(); const form = (e.target as HTMLElement).closest('.flex')?.previousElementSibling as HTMLFormElement; form?.requestSubmit(); }}
            disabled={saving}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-[var(--color-text-primary)] text-[var(--color-background-primary)] hover:bg-[var(--color-text-primary)] transition-all active:scale-[0.97] shadow-lg shadow-black/5">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando…</> : <><Save className="w-4 h-4" /> Crear miembro</>}
          </button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ██ MODAL: UPGRADE CTA (Para Nivel 1 bloqueado)
// ═══════════════════════════════════════════════════════════════════

function UpgradeModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[3px] z-[9998]" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(440px,calc(100vw-2rem))] bg-[var(--color-background-primary)]/90 backdrop-blur-2xl rounded-2xl shadow-2xl z-[9999] p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
          <Crown className="w-8 h-8 text-amber-500" />
        </div>
        <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Desbloquea la Gestión de Equipo</h3>
        <p className="text-sm text-[var(--color-text-tertiary)] leading-relaxed mb-6">
          Haz upgrade al <span className="font-semibold text-amber-700 dark:text-amber-400">Nivel 2</span> para añadir empleados a tu tienda y gestionar roles y permisos de tu equipo.
        </p>
        <div className="space-y-3">
          <button className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-[var(--color-background-primary)] hover:from-amber-600 hover:to-orange-600 transition-all active:scale-[0.97] shadow-sm flex items-center justify-center gap-2">
            <ArrowUpCircle className="w-4 h-4" /> Actualizar a Nivel 2
          </button>
          <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-medium text-[var(--color-text-tertiary)] hover:bg-[var(--color-background-secondary)] transition-colors">
            Quizás después
          </button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ██ COMPONENTE PRINCIPAL — ADMIN EQUIPO
// ═══════════════════════════════════════════════════════════════════

export default function AdminEquipo() {
  const { tenant } = useTenant();

  const [members, setMembers]       = useState<TeamMember[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showAddModal, setShowAddModal]     = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, member: TeamMember | null}>({ isOpen: false, member: null });

  const maxEmployees = tenant.subscription_level === 2 ? 1 : Infinity;
  const activeEmployees = members.filter(m => m.rol !== 'dueño' && m.is_active).length;
  const reachedLimit = activeEmployees >= maxEmployees;

  // Fetch inicial del equipo
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchTeamMembers(tenant.id)
      .then(data => {
        if (active) {
          setMembers(data);
        }
      })
      .catch(err => {
        if (active) {
          logger.error('[AdminEquipo] Error fetching team:', err as Error);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [tenant.id]);

  /**
   * Manejador para abrir el modal de "Añadir Miembro".
   */
  const handleAddClick = useCallback(() => {
    if (reachedLimit) return;
    setShowAddModal(true);
  }, [reachedLimit]);

  const handleMemberCreated = useCallback((member: TeamMember) => {
    setMembers(prev => [...prev, member]);
  }, []);

  /** Desactivar miembro con confirmación */
  const handleDeactivate = useCallback(async () => {
    if (!confirmDialog.member) return;
    try {
      await deactivateTeamMember(confirmDialog.member.id);
      setMembers(prev => prev.map(m => m.id === confirmDialog.member?.id ? { ...m, is_active: false } : m));
    } catch (err) {
      logger.error('[AdminEquipo] Error deactivating:', err as Error);
    } finally {
      setConfirmDialog({ isOpen: false, member: null });
    }
  }, [confirmDialog.member]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Encabezado ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Equipo</h1>
          <p className="text-sm text-[var(--color-text-tertiary)]">Gestiona los miembros y roles de tu tienda</p>
        </div>
        <button 
          onClick={handleAddClick}
          disabled={reachedLimit}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] shadow-sm select-none ${
            reachedLimit 
              ? 'bg-[var(--color-background-secondary)] text-[var(--color-text-tertiary)] border border-[var(--color-border-secondary)] cursor-not-allowed opacity-50' 
              : 'bg-[var(--color-text-primary)] text-[var(--color-background-primary)] hover:opacity-90'
          }`}
        >
          <UserPlus className="w-4 h-4" strokeWidth={2.5} /> Añadir miembro
        </button>
      </div>

      {/* ── Contador ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-background-secondary)] p-4 rounded-xl border border-[var(--color-border-tertiary)]">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 bg-[var(--color-background-primary)] text-[var(--color-text-secondary)] px-3 py-1 rounded-full text-xs font-semibold border border-[var(--color-border-tertiary)]">
            <Users className="w-3.5 h-3.5" />
            {tenant.subscription_level === 2 
              ? `${activeEmployees} de 1 integrantes` 
              : `${members.filter(m => m.is_active).length} activos`}
          </span>
        </div>
        {tenant.subscription_level === 2 && (
          <span className="text-xs text-[var(--color-text-tertiary)] font-medium">
            Tu plan Aura incluye 1 integrante adicional. Actualiza a Alquimia para un equipo ilimitado.
          </span>
        )}
      </div>

      {/* ═══ TABLA DEL EQUIPO ═══ */}
      <div className={`${CARD} overflow-hidden`}>
        {/* Header */}
        <div className="hidden md:grid grid-cols-[1fr_200px_120px_100px_60px] gap-4 px-5 py-3 bg-[var(--color-background-secondary)] border-b border-[var(--color-border-tertiary)] text-[0.7rem] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
          <span>Miembro</span>
          <span>Email</span>
          <span>Rol</span>
          <span className="text-center">Estado</span>
          <span></span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-3 text-[var(--color-text-tertiary)]">
            <Loader2 className="w-5 h-5 animate-spin" /> Cargando equipo…
          </div>
        )}

        {/* Rows */}
        {!loading && (
          <div className="divide-y divide-[var(--color-border-tertiary)]">
            {members.map(member => {
              const roleConf = ROLE_CONFIG[member.rol] || ROLE_CONFIG.empleado;
              return (
                <div key={member.id}
                  className={`grid grid-cols-1 md:grid-cols-[1fr_200px_120px_100px_60px] gap-4 px-5 py-4 items-center hover:bg-[var(--color-background-secondary)] transition-colors group ${!member.is_active ? 'opacity-50' : ''}`}>
                  {/* Avatar + Name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={member.nombre} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{member.nombre}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)] md:hidden truncate">{member.email}</p>
                    </div>
                  </div>
                  {/* Email */}
                  <span className="hidden md:block text-sm text-[var(--color-text-tertiary)] truncate">{member.email}</span>
                  {/* Role badge */}
                  <div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${roleConf.bg} ${roleConf.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${roleConf.dot}`} />
                      {roleConf.label}
                    </span>
                  </div>
                  {/* Status */}
                  <div className="text-center">
                    <span className={`text-xs font-medium ${member.is_active ? 'text-emerald-600' : 'text-[var(--color-text-tertiary)]'}`}>
                      {member.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  {/* Actions */}
                  <div className="flex justify-end">
                    {member.rol !== 'dueño' && (
                      <button
                        onClick={() => setConfirmDialog({ isOpen: true, member })}
                        disabled={!member.is_active}
                        className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors"
                        title="Desactivar acceso"
                      >
                        <Lock className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty */}
        {!loading && members.length === 0 && (
          <div className="text-center py-20 px-4">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <Users className="w-10 h-10 text-emerald-500" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Sin colaboradores</h3>
            <p className="text-sm text-[var(--color-text-tertiary)] max-w-md mx-auto leading-relaxed">
              Aún no tienes colaboradores registrados. Agrega a tu equipo para que puedan gestionar pedidos y el catálogo.
            </p>
          </div>
        )}
      </div>

      {/* ═══ MODALES ═══ */}
      {showAddModal && (
        <AddMemberModal
          tiendaId={tenant.id}
          onClose={() => setShowAddModal(false)}
          onCreated={handleMemberCreated}
        />
      )}
      {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} />}
      
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Desactivar usuario"
        description={`¿Estás seguro de que deseas desactivar el acceso a ${confirmDialog.member?.nombre}? No podrá iniciar sesión en tu tienda.`}
        confirmLabel="Sí, desactivar acceso"
        onConfirm={handleDeactivate}
        onCancel={() => setConfirmDialog({ isOpen: false, member: null })}
      />
    </div>
  );
}
