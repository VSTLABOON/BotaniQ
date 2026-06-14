import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Truck,
  Plus,
  Trash2,
  Phone,
  Activity,
  X,
  Bike,
  Car,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { toast } from '../../store/toastStore';
import { CARD } from './components/config/SharedUI';
import { fetchRepartidores, createRepartidor, updateRepartidorEstatus, deleteRepartidor } from '../../services/repartidorService';
import { logger } from '../../lib/logger';

interface Repartidor {
  id: string;
  nombre: string;
  telefono: string;
  vehiculo: 'moto' | 'auto' | 'bici';
  estatus: 'disponible' | 'en_entrega' | 'inactivo';
  pedidosActivos: number;
}

const REPARTIDORES_MODULE_ENABLED = false;

export default function AdminRepartidores() {
  if (!REPARTIDORES_MODULE_ENABLED) {
    return <Navigate to="/admin" replace />;
  }

  const { tenant } = useTenant();
  const tenantColor = tenant.color_primario || '#1a7f5a';

  const [drivers, setDrivers] = useState<Repartidor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [newNombre, setNewNombre] = useState('');
  const [newTelefono, setNewTelefono] = useState('');
  const [newVehiculo, setNewVehiculo] = useState<'moto' | 'auto' | 'bici'>('moto');
  const [newEstatus, setNewEstatus] = useState<'disponible' | 'en_entrega' | 'inactivo'>('disponible');

  const fetchDrivers = useCallback(async () => {
    if (!tenant.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRepartidores(tenant.id);

      const mapped = (data || []).map((d: any, idx: number) => {
        const extraStr = localStorage.getItem(`driver_extra_${d.id}`);
        const extra = extraStr ? JSON.parse(extraStr) : null;
        
        const phone = extra?.telefono || d.perfiles?.telefono || '';
        const vehiculo = extra?.vehiculo || ['moto', 'auto', 'bici'][idx % 3];
        const estatus = d.activo ? (extra?.estatus || 'disponible') : 'inactivo';
        
        return {
          id: d.id,
          nombre: d.nombre,
          telefono: phone,
          vehiculo: vehiculo as 'moto' | 'auto' | 'bici',
          estatus: estatus as 'disponible' | 'en_entrega' | 'inactivo',
          pedidosActivos: 0
        };
      });

      setDrivers(mapped);
    } catch (err) {
      logger.error('Error fetching drivers:', err as Error);
      setError('No se pudo cargar el equipo de repartidores. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [tenant.id]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNombre.trim() || !newTelefono.trim()) {
      toast.error('Campos incompletos', {
        message: 'Por favor rellena el nombre y telefono del repartidor.',
      });
      return;
    }

    setSaving(true);
    try {
      const isActivo = newEstatus !== 'inactivo';
      const data = await createRepartidor(tenant.id, newNombre, isActivo);

      if (data) {
        localStorage.setItem(`driver_extra_${data.id}`, JSON.stringify({
          telefono: newTelefono.trim(),
          vehiculo: newVehiculo,
          estatus: newEstatus
        }));

        const newDriver: Repartidor = {
          id: data.id,
          nombre: data.nombre,
          telefono: newTelefono.trim(),
          vehiculo: newVehiculo,
          estatus: newEstatus,
          pedidosActivos: 0
        };

        setDrivers(prev => [...prev, newDriver]);
        setShowAddModal(false);
        
        // Reset Form
        setNewNombre('');
        setNewTelefono('');
        setNewVehiculo('moto');
        setNewEstatus('disponible');

        toast.success('Repartidor agregado', {
          message: `${newDriver.nombre} se ha unido al equipo de reparto.`,
        });
      }
    } catch (err) {
      logger.error('Error adding driver:', err as Error);
      toast.error('Error al agregar repartidor', {
        message: 'Hubo un problema al intentar guardar el repartidor en la base de datos.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDriver = async (id: string, name: string) => {
    try {
      await deleteRepartidor(id);

      localStorage.removeItem(`driver_extra_${id}`);
      setDrivers(prev => prev.filter(d => d.id !== id));
      toast.success('Repartidor removido', {
        message: `${name} fue dado de baja del sistema.`,
      });
    } catch (err) {
      logger.error('Error deleting driver:', err as Error);
      toast.error('Error al remover repartidor', {
        message: 'No se pudo eliminar al repartidor. Intente de nuevo.'
      });
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: Repartidor['estatus']) => {
    const statusMap: Record<Repartidor['estatus'], Repartidor['estatus']> = {
      'disponible': 'en_entrega',
      'en_entrega': 'inactivo',
      'inactivo': 'disponible'
    };
    
    const nextStatus = statusMap[currentStatus];
    const nextActivo = nextStatus !== 'inactivo';

    try {
      await updateRepartidorEstatus(id, nextActivo);

      // Update local storage representation
      const extraStr = localStorage.getItem(`driver_extra_${id}`);
      if (extraStr) {
        const extra = JSON.parse(extraStr);
        extra.estatus = nextStatus;
        localStorage.setItem(`driver_extra_${id}`, JSON.stringify(extra));
      } else {
        localStorage.setItem(`driver_extra_${id}`, JSON.stringify({
          estatus: nextStatus
        }));
      }

      setDrivers(prev => prev.map(d => {
        if (d.id === id) {
          return { ...d, estatus: nextStatus };
        }
        return d;
      }));
    } catch (err) {
      logger.error('Error updating driver status:', err as Error);
      toast.error('Error al cambiar estado', {
        message: 'No se pudo actualizar el estado del repartidor.'
      });
    }
  };

  if (error) {
    return (
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center py-32 gap-4 text-center font-sans">
        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 flex items-center justify-center text-red-500">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Error al cargar repartidores</h3>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1 max-w-md mx-auto">
            {error}
          </p>
        </div>
        <button
          onClick={fetchDrivers}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm active:scale-95 cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center py-32 gap-3 text-[var(--color-text-tertiary)]">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Cargando repartidores...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Equipo de Repartidores</h1>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Gestiona los mensajeros, su disponibilidad y vehiculos asignados en tiempo real.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          style={{ backgroundColor: tenantColor, color: '#fff' }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-97 transition-all shadow-sm focus:outline-none"
        >
          <Plus className="w-4 h-4" /> Agregar Repartidor
        </button>
      </div>

      {/* Grid de Repartidores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {drivers.map((driver) => {
          const VehicleIcon = driver.vehiculo === 'moto' ? Bike : driver.vehiculo === 'auto' ? Car : Truck;
          const statusColors = {
            disponible: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
            en_entrega: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
            inactivo: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
          };
          const statusLabels = {
            disponible: 'Disponible',
            en_entrega: 'En Entrega',
            inactivo: 'Inactivo'
          };

          return (
            <div key={driver.id} className={`${CARD} p-5 space-y-4 relative group`}>
              {/* Boton Eliminar */}
              <button
                type="button"
                onClick={() => handleDeleteDriver(driver.id, driver.nombre)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-red-50 hover:text-white transition-all duration-200"
                title="Dar de baja"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div
                  style={{ backgroundColor: `${tenantColor}12`, color: tenantColor }}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                >
                  <VehicleIcon size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)] leading-tight">{driver.nombre}</h3>
                  <span className="text-[10px] text-[var(--color-text-tertiary)] uppercase font-semibold tracking-wider">
                    {driver.vehiculo === 'moto' ? 'Motocicleta' : driver.vehiculo === 'auto' ? 'Automovil' : 'Bicicleta'}
                  </span>
                </div>
              </div>

              {/* Stats / Datos de contacto */}
              <div className="space-y-2 text-xs text-[var(--color-text-secondary)]">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                  <span>{driver.telefono}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                  <span>pedidos asignados: <strong className="text-[var(--color-text-primary)]">{driver.pedidosActivos}</strong></span>
                </div>
              </div>

              {/* Boton de Cambiar Estatus */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border-tertiary)]">
                <span className={`text-[10px] font-bold border px-2 py-1 rounded-full ${statusColors[driver.estatus]}`}>
                  {statusLabels[driver.estatus]}
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleStatus(driver.id, driver.estatus)}
                  className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] flex items-center gap-1 font-semibold"
                >
                  Cambiar Estado
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Agregar Repartidor */}
      {showAddModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-[var(--color-background-primary)] border border-[var(--color-border-secondary)] rounded-2xl shadow-xl overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-tertiary)]">
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">Nuevo Repartidor</h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDriver} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)}
                  className="w-full px-3 py-2 border border-white/30 dark:border-white/10 rounded-lg text-sm bg-white/50 dark:bg-black/50 text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Ej. Juan Perez"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Telefono</label>
                <input
                  type="tel"
                  required
                  value={newTelefono}
                  onChange={(e) => setNewTelefono(e.target.value)}
                  className="w-full px-3 py-2 border border-white/30 dark:border-white/10 rounded-lg text-sm bg-white/50 dark:bg-black/50 text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Ej. +52 81 9999 9999"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Vehiculo</label>
                  <select
                    value={newVehiculo}
                    onChange={(e) => setNewVehiculo(e.target.value as any)}
                    className="w-full px-3 py-2 border border-white/30 dark:border-white/10 rounded-lg text-sm bg-white/50 dark:bg-black/50 text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="moto">Motocicleta</option>
                    <option value="auto">Automovil</option>
                    <option value="bici">Bicicleta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Estado Inicial</label>
                  <select
                    value={newEstatus}
                    onChange={(e) => setNewEstatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-white/30 dark:border-white/10 rounded-lg text-sm bg-white/50 dark:bg-black/50 text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="disponible">Disponible</option>
                    <option value="en_entrega">En entrega</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--color-background-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-border-tertiary)] active:scale-97 transition-all focus:outline-none"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ backgroundColor: tenantColor }}
                  className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg text-white hover:opacity-90 active:scale-97 transition-all shadow-sm focus:outline-none flex items-center justify-center gap-1.5"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Guardar Repartidor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
