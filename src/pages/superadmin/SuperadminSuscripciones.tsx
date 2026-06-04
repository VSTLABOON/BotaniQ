import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { logger } from '../../lib/logger';
import { useAuth } from '../../context/AuthContext';
import { 
  CreditCard, Search, Filter, ShieldAlert,
  CheckCircle, Clock, XCircle, ArrowRight, X, AlertCircle, PlaySquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTenant } from '../../context/TenantContext';
import { toast } from '../../store/toastStore';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { CARD } from '../admin/components/config/SharedUI';
import { updateSubscription } from '../../services/superadminService';

type PlanSaaS = 'basico' | 'pro' | 'enterprise';
type EstadoSuscripcion = 'activo' | 'vencido' | 'prueba' | 'cancelado';

interface TenantInfo {
  id: string;
  nombre: string;
  slug: string;
  created_at: string;
  dueño?: { email: string, nombre: string };
  suscripcion?: Suscripcion;
}

interface Suscripcion {
  id: string;
  plan: PlanSaaS;
  estado: EstadoSuscripcion;
  fecha_inicio: string;
  fecha_renovacion: string;
  monto_mensual: number;
}

const PLAN_COLORS = {
  basico: 'bg-[var(--color-background-tertiary)] text-[var(--color-text-primary)]',
  pro: 'bg-indigo-100 text-indigo-800',
  enterprise: 'bg-amber-100 text-amber-800'
};

const ESTADO_COLORS = {
  activo: 'bg-emerald-100 text-emerald-800',
  vencido: 'bg-red-100 text-red-800',
  prueba: 'bg-blue-100 text-blue-800',
  cancelado: 'bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)]'
};

export default function SuperadminSuscripciones() {
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<PlanSaaS | 'todos'>('todos');
  const [estadoFilter, setEstadoFilter] = useState<EstadoSuscripcion | 'todos'>('todos');
  
  const [selectedTenant, setSelectedTenant] = useState<TenantInfo | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch tiendas
      const { data: tiendasData, error: tiendasErr } = await supabase
        .from('tiendas')
        .select('id, nombre, slug, created_at');
      
      if (tiendasErr) throw tiendasErr;

      // Fetch perfiles (dueños)
      const { data: dueñosData, error: dueñosErr } = await supabase
        .from('perfiles')
        .select('tienda_id, email, nombre_completo')
        .eq('rol', 'dueño');

      if (dueñosErr) throw dueñosErr;

      // Fetch suscripciones
      const { data: subsData, error: subsErr } = await supabase
        .from('suscripciones')
        .select('id, tenant_id, plan, estado, fecha_inicio, fecha_renovacion, monto_mensual');
        
      if (subsErr) {
        logger.warn('Error fetching suscripciones (puede que la tabla aún no tenga RLS o no haya datos)', subsErr as any);
      }

      if (!isMounted.current) return;

      const merged: TenantInfo[] = (tiendasData || []).map(t => {
        const dueño = dueñosData?.find(d => d.tienda_id === t.id);
        const sub = subsData?.find(s => s.tenant_id === t.id) || {
          plan: 'basico', estado: 'prueba', fecha_inicio: t.created_at, fecha_renovacion: new Date(Date.now() + 14*24*60*60*1000).toISOString(), monto_mensual: 0
        };
        return {
          ...t,
          dueño: dueño ? { email: dueño.email || 'Sin email', nombre: dueño.nombre_completo } : undefined,
          suscripcion: sub as Suscripcion
        };
      });

      setTenants(merged);
    } catch (err) {
      if (isMounted.current) {
        logger.error('Error cargando datos de SaaS', err as Error);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Metricas
  const stats = useMemo(() => {
    const activas = tenants.filter(t => t.suscripcion?.estado === 'activo');
    const mrr = activas.reduce((acc, t) => acc + (t.suscripcion?.monto_mensual || 0), 0);
    const enPrueba = tenants.filter(t => t.suscripcion?.estado === 'prueba');
    const proxRenovacion = tenants.filter(t => {
      if (!t.suscripcion?.fecha_renovacion) return false;
      const diff = new Date(t.suscripcion.fecha_renovacion).getTime() - Date.now();
      return diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000;
    });
    return { activas, mrr, enPrueba, proxRenovacion };
  }, [tenants]);

  const { activas, mrr, enPrueba, proxRenovacion } = stats;

  const filtered = useMemo(() => {
    return tenants.filter(t => {
      const matchSearch = t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.dueño?.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchPlan = planFilter === 'todos' || t.suscripcion?.plan === planFilter;
      const matchEstado = estadoFilter === 'todos' || t.suscripcion?.estado === estadoFilter;
      return matchSearch && matchPlan && matchEstado;
    });
  }, [tenants, searchTerm, planFilter, estadoFilter]);

  const updateSub = useCallback(async (tenantId: string, updates: any) => {
    try {
      await updateSubscription(tenantId, updates);
      await fetchData(); // Reload
      if (selectedTenant && selectedTenant.id === tenantId) {
        setSelectedTenant(prev => prev ? { ...prev, suscripcion: { ...prev.suscripcion!, ...updates } } : null);
      }
    } catch (err) {
      logger.error('Error updating suscripcion', err as Error);
      toast.error('Error actualizando suscripción. Verifica si existe el registro en la DB.');
    }
  }, [fetchData, selectedTenant]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-background-primary)] flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-indigo-500" />
            Suscripciones SaaS
          </h1>
          <p className="text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)] mt-1">
            Gestión de facturación, MRR y planes de los tenants.
          </p>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`${CARD} p-5`}>
          <span className="text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)] text-sm font-medium">Tiendas Activas</span>
          <div className="text-3xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-background-primary)] mt-2">{activas.length}</div>
        </div>
        <div className={`${CARD} p-5`}>
          <span className="text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)] text-sm font-medium">MRR (Mensual)</span>
          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">${mrr.toLocaleString()}</div>
        </div>
        <div className={`${CARD} p-5`}>
          <span className="text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)] text-sm font-medium">En Prueba (Trials)</span>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{enPrueba.length}</div>
        </div>
        <div className={`${CARD} p-5 border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10`}>
          <span className="text-amber-600 dark:text-amber-500 text-sm font-medium flex items-center gap-1">
            <AlertCircle className="w-4 h-4" /> Renovaciones (7d)
          </span>
          <div className="text-3xl font-bold text-amber-700 dark:text-amber-400 mt-2">{proxRenovacion.length}</div>
        </div>
      </div>

      {/* Controles */}
      <div className={`${CARD} p-4 flex flex-col sm:flex-row gap-4 !rounded-xl`}>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
          <input 
            type="text" 
            placeholder="Buscar por tienda o email..."
            className="w-full pl-9 pr-4 py-2 bg-[var(--color-background-secondary)] dark:bg-[var(--color-text-primary)] border border-[var(--color-border-secondary)] dark:border-gray-700 rounded-lg text-sm text-[var(--color-text-primary)] dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="py-2 px-3 bg-[var(--color-background-secondary)] dark:bg-[var(--color-text-primary)] border border-[var(--color-border-secondary)] dark:border-gray-700 rounded-lg text-sm text-[var(--color-text-primary)] dark:text-gray-100"
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value as any)}
        >
          <option value="todos">Todos los Planes</option>
          <option value="basico">BotaniQ Esencia</option>
          <option value="pro">BotaniQ Alquimia</option>
          <option value="enterprise">BotaniQ Edén</option>
        </select>
        <select 
          className="py-2 px-3 bg-[var(--color-background-secondary)] dark:bg-[var(--color-text-primary)] border border-[var(--color-border-secondary)] dark:border-gray-700 rounded-lg text-sm text-[var(--color-text-primary)] dark:text-gray-100"
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value as any)}
        >
          <option value="todos">Todos los Estados</option>
          <option value="activo">Activos</option>
          <option value="prueba">En Prueba</option>
          <option value="vencido">Vencidos</option>
          <option value="cancelado">Cancelados</option>
        </select>
      </div>
 
      {/* Tabla */}
      <div className={`${CARD} !p-0 overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-tertiary)]">
            <thead className="bg-black/5 dark:bg-white/5 border-b border-[var(--color-border-tertiary)] dark:border-gray-700/50 text-xs uppercase font-semibold text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)]">
              <tr>
                <th className="px-6 py-4">Tienda</th>
                <th className="px-6 py-4">Dueño</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Renovación</th>
                <th className="px-6 py-4">MRR</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-[var(--color-text-tertiary)]">Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-[var(--color-text-tertiary)]">No hay tiendas que coincidan.</td></tr>
              ) : filtered.map(tenant => (
                <tr key={tenant.id} className="hover:bg-[var(--color-background-secondary)]/50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-[var(--color-text-primary)] dark:text-[var(--color-background-primary)]">{tenant.nombre}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)] font-mono">{tenant.slug}</p>
                  </td>
                  <td className="px-6 py-4">{tenant.dueño?.email || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${PLAN_COLORS[tenant.suscripcion?.plan || 'basico']}`}>
                      {tenant.suscripcion?.plan === 'basico' ? 'BotaniQ Esencia' : tenant.suscripcion?.plan === 'pro' ? 'BotaniQ Alquimia' : 'BotaniQ Edén'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${ESTADO_COLORS[tenant.suscripcion?.estado || 'prueba']}`}>
                      {tenant.suscripcion?.estado === 'prueba' ? 'Prueba' : tenant.suscripcion?.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {tenant.suscripcion?.fecha_renovacion ? new Date(tenant.suscripcion.fecha_renovacion).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 font-semibold text-[var(--color-text-primary)] dark:text-gray-100">
                    ${tenant.suscripcion?.monto_mensual || 0}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setSelectedTenant(tenant)}
                      className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors inline-flex"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SlideOver Panel (Detalles) */}
      <AnimatePresence>
        {selectedTenant && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90]"
              onClick={() => setSelectedTenant(null)}
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-[var(--color-background-primary)]/90 dark:bg-[#0a0a0c]/90 backdrop-blur-2xl border-l border-[var(--color-border-secondary)] dark:border-gray-800 shadow-2xl z-[100] flex flex-col"
            >
              <div className="p-6 border-b border-[var(--color-border-tertiary)] dark:border-gray-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-background-primary)]">Detalle de Suscripción</h2>
                  <p className="text-sm text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)]">{selectedTenant.nombre}</p>
                </div>
                <button onClick={() => setSelectedTenant(null)} className="p-2 hover:bg-[var(--color-background-tertiary)] dark:hover:bg-[var(--color-text-primary)] rounded-full text-[var(--color-text-tertiary)]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-6">
                
                {/* Info */}
                <div className="bg-[var(--color-background-secondary)] dark:bg-[var(--color-text-primary)] rounded-xl p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--color-text-tertiary)]">Dueño</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)] dark:text-[var(--color-background-primary)]">{selectedTenant.dueño?.nombre || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--color-text-tertiary)]">Email</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)] dark:text-[var(--color-background-primary)]">{selectedTenant.dueño?.email || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--color-text-tertiary)]">Creada el</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)] dark:text-[var(--color-background-primary)]">{new Date(selectedTenant.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Acciones de Plan */}
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)] dark:text-[var(--color-background-primary)] mb-3 uppercase tracking-wider">Gestión de Plan</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Cambiar Plan</label>
                      <select 
                        className="w-full bg-[var(--color-background-primary)] dark:bg-[var(--color-text-primary)] border border-[var(--color-border-secondary)] dark:border-gray-700 rounded-lg py-2 px-3 text-sm text-[var(--color-text-primary)] dark:text-[var(--color-background-primary)]"
                        value={selectedTenant.suscripcion?.plan || 'basico'}
                        onChange={(e) => updateSub(selectedTenant.id, { plan: e.target.value as PlanSaaS })}
                      >
                        <option value="basico">BotaniQ Esencia</option>
                        <option value="pro">BotaniQ Alquimia</option>
                        <option value="enterprise">BotaniQ Edén</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Estado</label>
                      <select 
                        className="w-full bg-[var(--color-background-primary)] dark:bg-[var(--color-text-primary)] border border-[var(--color-border-secondary)] dark:border-gray-700 rounded-lg py-2 px-3 text-sm text-[var(--color-text-primary)] dark:text-[var(--color-background-primary)]"
                        value={selectedTenant.suscripcion?.estado || 'prueba'}
                        onChange={(e) => updateSub(selectedTenant.id, { estado: e.target.value as EstadoSuscripcion })}
                      >
                        <option value="activo">Activo</option>
                        <option value="prueba">En Prueba</option>
                        <option value="vencido">Vencido</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </div>

                    <div className="pt-4 mt-4 border-t border-[var(--color-border-tertiary)] dark:border-gray-800">
                      <button 
                        onClick={() => setConfirmCancel(true)}
                        className="w-full py-2.5 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 font-bold rounded-lg text-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                      >
                        Cancelar Suscripción
                      </button>
                    </div>
                  </div>
                </div>

                {/* Impersonar */}
                <div className="pt-4 border-t border-[var(--color-border-tertiary)] dark:border-gray-800">
                  <a 
                    href={`/`}
                    target="_blank"
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-[var(--color-background-primary)] font-bold rounded-lg text-sm transition-colors"
                  >
                    <PlaySquare className="w-4 h-4" />
                    Abrir Storefront
                  </a>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-2 text-center">Para impersonar la tienda, debes iniciar sesión como admin usando un token.</p>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={confirmCancel}
        title="Cancelar Suscripción"
        description="¿Seguro que deseas cancelar esta suscripción? Esta acción cambiará el estado a cancelado y podría interrumpir el servicio para este tenant."
        onConfirm={() => {
          if (selectedTenant) {
            updateSub(selectedTenant.id, { estado: 'cancelado' });
          }
          setConfirmCancel(false);
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}
