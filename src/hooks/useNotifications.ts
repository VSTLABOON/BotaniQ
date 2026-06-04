import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';
import {
  fetchAdminNotifications,
  markNotificationAsRead,
  markAllAsRead,
  type Notification
} from '../services/notificacionesService';

// Pre-instanciar el sonido de notificación una sola vez en el ámbito de módulo
const notificationAudio = typeof Audio !== 'undefined' ? new Audio('/notification.mp3') : null;
if (notificationAudio) {
  notificationAudio.volume = 0.5;
}

export function useNotifications(tenantId?: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<any[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;

    // 1. Obtener las últimas 30 notificaciones
    const fetchNotifications = async () => {
      try {
        const data = await fetchAdminNotifications(tenantId);
        if (active) {
          setNotifications(data);
          setUnreadCount(data.filter((n) => !n.leida).length);
        }
      } catch (err) {
        logger.error('Error fetching initial notifications:', err as Error);
      }
    };
    fetchNotifications();

    // 2. Suscribirse a INSERTS en la tabla notificaciones
    const channel = supabase
      .channel('admin-notificaciones')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `tienda_id=eq.${tenantId}`,
        },
        (payload) => {
          const newNoti = payload.new as Notification;
          logger.info('🔔 [Realtime] Nueva notificación:', newNoti);
          
          if (active) {
            setUnreadCount((prev) => prev + 1);
            setNotifications((prev) => [newNoti, ...prev].slice(0, 30));

            // Mostrar un Toast temporal (se oculta tras 6s)
            const toastId = Date.now();
            setToasts((prev) => [...prev, { id: toastId, ...newNoti }]);

            // Reproducir sonido de campanilla ligero
            try {
              if (notificationAudio) {
                notificationAudio.currentTime = 0;
                notificationAudio.play().catch(() => {});
              }
            } catch (e) {}

            setTimeout(() => {
              if (active) {
                setToasts((prev) => prev.filter((t) => t.id !== toastId));
              }
            }, 6000);
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  const handleMarkAllRead = useCallback(async () => {
    if (!tenantId) return;
    try {
      await markAllAsRead(tenantId);
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
    } catch (err) {
      logger.error('Error marking all notifications as read:', err as Error);
    }
  }, [tenantId]);

  const handleMarkAsRead = useCallback(async (id: string) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      logger.error(`Error marking notification ${id} as read:`, err as Error);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    toasts,
    handleMarkAllRead,
    handleMarkAsRead,
  };
}
