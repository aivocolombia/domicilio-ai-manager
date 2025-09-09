import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { logDebug, logError, logWarn } from '@/utils/logger';

interface UseRealtimeOrdersProps {
  sedeId?: string;
  onOrderUpdated?: () => void;
  onNewOrder?: (order: any) => void;
  onOrderStatusChanged?: (orderId: number, newStatus: string) => void;
}

export const useRealtimeOrders = ({
  sedeId,
  onOrderUpdated,
  onNewOrder,
  onOrderStatusChanged
}: UseRealtimeOrdersProps) => {
  const channelsRef = useRef<any[]>([]);
  const isConnectedRef = useRef(false);
  
  const handleOrderChange = useCallback((payload: any) => {
    const orderId = payload.new?.id || payload.old?.id;
    
    if (payload.eventType === 'INSERT') {
      logDebug('Realtime', 'Nueva orden creada', { orderId });
      onNewOrder?.(payload.new);
    } else if (payload.eventType === 'UPDATE') {
      const statusChanged = payload.old?.status !== payload.new?.status;
      if (statusChanged) {
        logDebug('Realtime', 'Status de orden cambió', { 
          orderId, 
          from: payload.old?.status, 
          to: payload.new?.status 
        });
        onOrderStatusChanged?.(payload.new.id, payload.new.status);
      }
      
      // Solo loguear cambios importantes en debug
      const changedFields = [];
      if (payload.old?.repartidor_id !== payload.new?.repartidor_id) {
        changedFields.push('repartidor');
      }
      if (payload.old?.hora_entrega !== payload.new?.hora_entrega) {
        changedFields.push('hora_entrega');
      }
      
      if (changedFields.length > 0) {
        logDebug('Realtime', 'Campos actualizados', { orderId, fields: changedFields });
      }
    } else if (payload.eventType === 'DELETE') {
      logDebug('Realtime', 'Orden eliminada', { orderId });
    }
    
    // Notificar actualización general (esto puede disparar recargas)
    onOrderUpdated?.();
  }, [onOrderUpdated, onNewOrder, onOrderStatusChanged]);

  useEffect(() => {
    if (!sedeId) {
      logWarn('Realtime', 'No hay sede_id, no configurando realtime');
      return;
    }

    logDebug('Realtime', 'Configurando suscripción realtime', { sedeId });
    isConnectedRef.current = false;

    // Verificar que Supabase esté configurado correctamente
    if (!supabase) {
      logError('Realtime', 'Supabase no está inicializado');
      return;
    }

    // Suscripción a cambios en órdenes de la sede
    const ordersChannel = supabase
      .channel(`orders_${sedeId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'ordenes',
          filter: `sede_id=eq.${sedeId}`
        },
        handleOrderChange
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logDebug('Realtime', 'Realtime conectado exitosamente', { sedeId, channel: `orders_${sedeId}` });
          isConnectedRef.current = true;
        } else if (status === 'CHANNEL_ERROR') {
          logError('Realtime', 'Error en conexión realtime', { 
            sedeId, 
            possibleCauses: ['Realtime no habilitado', 'RLS bloqueando suscripción', 'API keys incorrectas'] 
          });
          isConnectedRef.current = false;
        } else if (status === 'CLOSED') {
          logDebug('Realtime', 'Conexión realtime cerrada', { sedeId });
          isConnectedRef.current = false;
        }
      });

    // Suscripción a cambios en items de órdenes (platos)
    const orderPlatosChannel = supabase
      .channel(`order_platos_${sedeId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'ordenes_platos'
        },
        (payload) => {
          logDebug('Realtime', 'Items de orden actualizados', { table: 'ordenes_platos' });
          onOrderUpdated?.();
        }
      )
      .subscribe();

    // Suscripción a cambios en items de órdenes (bebidas)
    const orderBebidasChannel = supabase
      .channel(`order_bebidas_${sedeId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'ordenes_bebidas'
        },
        (payload) => {
          logDebug('Realtime', 'Bebidas de orden actualizadas', { table: 'ordenes_bebidas' });
          onOrderUpdated?.();
        }
      )
      .subscribe();

    // Almacenar referencias de canales para limpieza
    channelsRef.current = [ordersChannel, orderPlatosChannel, orderBebidasChannel];

    return () => {
      logDebug('Realtime', 'Cerrando suscripciones realtime', { sedeId, channelCount: channelsRef.current.length });
      
      // Intentar cerrar cada canal, pero continuar con la limpieza incluso si falla
      let closedSuccessfully = 0;
      let closedWithErrors = 0;
      
      channelsRef.current.forEach((channel, index) => {
        if (channel) {
          try {
            supabase.removeChannel(channel);
            closedSuccessfully++;
          } catch (error) {
            closedWithErrors++;
            logError('Realtime', `Error cerrando canal ${index + 1}`, error);
          }
        }
      });
      
      // CRÍTICO: Limpiar array independientemente de errores para prevenir memory leaks
      channelsRef.current = [];
      isConnectedRef.current = false;
      
      logDebug('Realtime', 'Limpieza de canales completada', { 
        closedSuccessfully, 
        closedWithErrors,
        sedeId 
      });
    };
  }, [sedeId, handleOrderChange, onOrderUpdated]);

  return {
    // Función para forzar reconexión si es necesario
    reconnect: useCallback(() => {
      console.log('🔄 Forzando reconexión realtime...');
      // El useEffect se ejecutará nuevamente debido a las dependencias
    }, []),
    
    // Función para verificar estado de conexión
    isConnected: useCallback(() => {
      return isConnectedRef.current;
    }, []),
    
    // Función para obtener estado de los canales
    getChannelsStatus: useCallback(() => {
      return {
        totalChannels: channelsRef.current.length,
        isConnected: isConnectedRef.current,
        sedeId
      };
    }, [sedeId])
  };
};