import { useState, useEffect } from 'react';
import { useTenant } from '../context/TenantContext';
import { SubscriptionLevel } from '../types';
import { supabase } from '../lib/supabaseClient';

export function useSubscriptionStatus() {
  const { tenant } = useTenant();
  const [isTrialExpired, setIsTrialExpired] = useState(false);
  const [diasRestantes, setDiasRestantes] = useState(14);
  const [subscriptionEstado, setSubscriptionEstado] = useState('prueba');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant || !tenant.id) {
      setLoading(false);
      return;
    }

    let active = true;

    async function fetchStatus() {
      try {
        const { data, error } = await supabase.rpc('get_subscription_status', {
          p_tienda_id: tenant.id,
        });

        if (error) {
          console.error('Error al obtener estado de suscripción:', error.message);
          return;
        }

        if (active && data) {
          setIsTrialExpired(data.is_trial_expired === true);
          setDiasRestantes(data.dias_restantes ?? 0);
          setSubscriptionEstado(data.estado || 'sin_suscripcion');
        }
      } catch (err) {
        console.error('Error cargando estado de suscripción:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchStatus();

    return () => {
      active = false;
    };
  }, [tenant?.id]);

  const isBlocked =
    tenant?.subscription_level === SubscriptionLevel.BLOCKED || isTrialExpired;

  return {
    isBlocked,
    isTrialExpired,
    diasRestantes,
    subscriptionEstado,
    loading,
    subscriptionLevel: tenant?.subscription_level ?? SubscriptionLevel.BASICO,
    hasActiveSubscription: tenant?.has_active_subscription ?? false,
  };
}
