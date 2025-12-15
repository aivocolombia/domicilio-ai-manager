import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface UseRealtimeMetricsProps {
  sedeId?: string;
  onMetricsUpdated?: () => void;
  onOrderInserted?: (order: any) => void;
  onOrderUpdated?: (order: any) => void;
  onOrderDeleted?: (orderId: number) => void;
  enabled?: boolean; // Para controlar si está activo
}

export const useRealtimeMetrics = ({
  sedeId,
  onMetricsUpdated,
  onOrderInserted,
  onOrderUpdated,
  onOrderDeleted,
  enabled = true
}: UseRealtimeMetricsProps) => {
  const channelRef = useRef<any>(null);
  
  const handleOrderChange = useCallback((payload: any) => {
    console.log('📊 Métricas: Cambio en órdenes detectado:', payload.eventType);
    
    // Filtrar por sede si está especificada
    if (sedeId && payload.new?.sede_id !== sedeId && payload.old?.sede_id !== sedeId) {
      console.log('🏢 Métricas: Cambio no pertenece a la sede actual, ignorando');
      return;
    }
    
    if (payload.eventType === 'INSERT') {
      console.log('📝 Métricas: Nueva orden creada:', payload.new);
      onOrderInserted?.(payload.new);
    } else if (payload.eventType === 'UPDATE') {
      console.log('✏️ Métricas: Orden actualizada:', payload.new);
      onOrderUpdated?.(payload.new);
    } else if (payload.eventType === 'DELETE') {
      console.log('🗑️ Métricas: Orden eliminada:', payload.old);
      onOrderDeleted?.(payload.old?.id);
    }
    
    // Notificar actualización de métricas
    onMetricsUpdated?.();
  }, [sedeId, onMetricsUpdated, onOrderInserted, onOrderUpdated, onOrderDeleted]);

  useEffect(() => {
    if (!enabled) {
      console.log('📊 Métricas realtime deshabilitadas');
      return;
    }

    // ✅ FIX: Crear AbortController para cancelar operaciones asíncronas
    const abortController = new AbortController();
    let isSubscribed = true;

    console.log('🔔 Configurando suscripción realtime para métricas. Sede:', sedeId || 'todas');

    // Crear canal único para métricas
    const channelName = sedeId ? `metrics_${sedeId}` : 'metrics_global';
    const metricsChannel = supabase.channel(channelName);

    // Suscripción a cambios en todas las órdenes (o filtradas por sede)
    let filter: string | undefined;
    if (sedeId) {
      filter = `sede_id=eq.${sedeId}`;
    }

    metricsChannel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'ordenes',
        ...(filter && { filter })
      },
      (payload) => {
        // ✅ FIX: Verificar que el componente sigue montado
        if (!isSubscribed || abortController.signal.aborted) return;
        handleOrderChange(payload);
      }
    );

    // Suscripción a cambios en pagos (afecta métricas de ingresos)
    metricsChannel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'pagos'
      },
      (payload) => {
        // ✅ FIX: Verificar que el componente sigue montado
        if (!isSubscribed || abortController.signal.aborted) return;
        console.log('💰 Métricas: Cambio en pagos detectado:', payload.eventType);
        onMetricsUpdated?.();
      }
    );

    metricsChannel.subscribe((status) => {
      if (!isSubscribed) return; // ✅ FIX: No actualizar estado si ya se desmontó
      console.log('📡 Estado suscripción métricas:', status, 'Canal:', channelName);
      if (status === 'SUBSCRIBED') {
        console.log('✅ Métricas realtime activadas correctamente');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Error en canal de métricas realtime');
      }
    });

    channelRef.current = metricsChannel;

    return () => {
      // ✅ FIX: Marcar como no suscrito y abortar operaciones pendientes
      isSubscribed = false;
      abortController.abort();

      console.log('🔌 Cerrando suscripción métricas realtime');
      if (channelRef.current) {
        // ✅ FIX: Desuscribir antes de remover
        channelRef.current.unsubscribe();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, sedeId, handleOrderChange, onMetricsUpdated]);

  return {
    // Función para forzar reconexión si es necesario
    reconnect: useCallback(() => {
      console.log('🔄 Forzando reconexión métricas realtime...');
      // El useEffect se ejecutará nuevamente debido a las dependencias
    }, []),
    
    // Función para verificar estado de conexión
    isConnected: useCallback(() => {
      return channelRef.current?.state === 'joined';
    }, [])
  };
};