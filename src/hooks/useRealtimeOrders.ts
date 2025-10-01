import { useEffect, useCallback, useRef, useState } from 'react';
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
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 5;
  const isMountedRef = useRef(true);
  
  // Usar refs para callbacks para evitar recrear suscripciones
  const callbacksRef = useRef({
    onOrderUpdated,
    onNewOrder,
    onOrderStatusChanged
  });
  
  // Actualizar refs cuando cambian los callbacks
  useEffect(() => {
    callbacksRef.current = {
      onOrderUpdated,
      onNewOrder,
      onOrderStatusChanged
    };
  }, [onOrderUpdated, onNewOrder, onOrderStatusChanged]);
  
  // Función para testear conectividad básica de Supabase
  const testSupabaseConnection = useCallback(async () => {
    try {
      console.log('🧪 [TEST] Probando conectividad básica de Supabase...');
      const { data, error } = await supabase
        .from('ordenes')
        .select('id')
        .limit(1);

      if (error) {
        console.error('❌ [TEST] Error en consulta básica:', error);
        return false;
      }

      console.log('✅ [TEST] Supabase conectado correctamente, datos obtenidos:', !!data);
      return true;
    } catch (error) {
      console.error('❌ [TEST] Error en test de conectividad:', error);
      return false;
    }
  }, []);

  const handleOrderChange = useCallback((payload: any) => {
    const orderId = payload.new?.id || payload.old?.id;
    
    if (payload.eventType === 'INSERT') {
      logDebug('Realtime', 'Nueva orden creada', { orderId });
      callbacksRef.current.onNewOrder?.(payload.new);
    } else if (payload.eventType === 'UPDATE') {
      const statusChanged = payload.old?.status !== payload.new?.status;
      if (statusChanged) {
        logDebug('Realtime', 'Status de orden cambió', { 
          orderId, 
          from: payload.old?.status, 
          to: payload.new?.status 
        });
        callbacksRef.current.onOrderStatusChanged?.(payload.new.id, payload.new.status);
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
    callbacksRef.current.onOrderUpdated?.();
  }, []); // Sin dependencias porque usa refs

  // Función para iniciar heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(async () => {
      if (!isMountedRef.current) {
        console.log('🚫 [HEARTBEAT] Componente desmontado, deteniendo heartbeat');
        return;
      }

      if (isConnectedRef.current) {
        try {
          // Test básico de conectividad cada 30 segundos
          const isStillConnected = await testSupabaseConnection();
          if (!isStillConnected) {
            console.warn('🔄 [HEARTBEAT] Conectividad perdida, forzando reconexión...');
            setConnectionStatus('disconnected');
            setReconnectTrigger(prev => prev + 1);
          } else {
            console.log('💓 [HEARTBEAT] Conexión saludable');
          }
        } catch (error) {
          console.error('❌ [HEARTBEAT] Error en heartbeat:', error);
          setConnectionStatus('error');
          setReconnectTrigger(prev => prev + 1);
        }
      }
    }, 30000); // Heartbeat cada 30 segundos
  }, [testSupabaseConnection]);

  // Función para detener heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Función para reconexión automática con backoff exponencial
  const scheduleReconnect = useCallback(() => {
    // No reconectar si el componente está siendo desmontado
    if (!isMountedRef.current || !sedeId) {
      console.log('🚫 [RECONNECT] Componente desmontado, no programando reconexión');
      return;
    }

    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error('❌ [RECONNECT] Máximo número de intentos alcanzado');
      setConnectionStatus('error');
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Backoff exponencial: 2^attempts * 1000ms, máximo 30 segundos
    const delay = Math.min(Math.pow(2, reconnectAttempts) * 1000, 30000);
    console.log(`🔄 [RECONNECT] Programando reconexión en ${delay}ms (intento ${reconnectAttempts + 1}/${maxReconnectAttempts})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      // Verificar nuevamente antes de reconectar
      if (isMountedRef.current && sedeId) {
        setReconnectAttempts(prev => prev + 1);
        setReconnectTrigger(prev => prev + 1);
      }
    }, delay);
  }, [reconnectAttempts, maxReconnectAttempts, sedeId]);

  useEffect(() => {
    isMountedRef.current = true; // Marcar como montado

    if (!sedeId) {
      logWarn('Realtime', 'No hay sede_id, no configurando realtime');
      return;
    }

    // Test de conectividad antes de intentar Realtime
    testSupabaseConnection().then(isConnected => {
      if (!isConnected) {
        console.error('❌ [REALTIME] Test de conectividad falló, no iniciando Realtime');
        setConnectionStatus('error');
        return;
      }
      console.log('✅ [REALTIME] Test de conectividad exitoso, iniciando Realtime...');
    });

    logDebug('Realtime', 'Configurando suscripción realtime', { sedeId });
    isConnectedRef.current = false;
    setConnectionStatus('connecting');

    // Verificar que Supabase esté configurado correctamente
    if (!supabase) {
      logError('Realtime', 'Supabase no está inicializado');
      setConnectionStatus('error');
      return;
    }

    // Debug: Log de configuración más agresivo
    console.log('🔍 [ORDERS] Realtime Debug:', {
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      sedeId,
      hasSupabase: !!supabase,
      channel: `orders_${sedeId}`,
      timestamp: new Date().toISOString()
    });

    // Suscripción a cambios en órdenes con filtro directo por sede
    console.log('🔄 [ORDERS] Creando canal de suscripción:', `orders_${sedeId}`);
    console.log('🔍 [ORDERS] Debug - Sede ID para filtro:', sedeId, typeof sedeId);

    // Log antes de crear el canal
    console.log('🚀 [ORDERS] Iniciando suscripción a tabla ordenes...');

    // Test 1: Verificar que supabase.realtime esté disponible
    console.log('🔍 [ORDERS] Verificando Supabase realtime:', {
      hasRealtime: !!supabase.realtime,
      realtimeConfig: supabase.realtime?.accessToken ? 'HAS_TOKEN' : 'NO_TOKEN',
      isConnected: supabase.realtime?.isConnected?.(),
      settings: supabase.realtime?.channels?.length || 0
    });

    // Test 2: Intentar suscripción más simple primero
    console.log('🧪 [ORDERS] Testing simple subscription to ordenes table...');

    // Configuración optimizada del canal con parámetros de conexión mejorados
    const channelConfig = {
      config: {
        presence: {
          key: `user_${sedeId}`,
        },
        broadcast: {
          self: false,
        },
        timeout: 60000, // 60 segundos timeout más generoso
        heartbeat_interval: 30000, // Heartbeat cada 30 segundos
      }
    };

    const ordersChannel = supabase
      .channel(`orders_${sedeId}`, channelConfig)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordenes'
          // Sin filtro para testing inicial
        },
        (payload) => {
          console.log('📨 [ORDERS] Realtime payload recibido (SIN FILTRO - testing):', {
            event: payload.eventType,
            orderId: payload.new?.id || payload.old?.id,
            sedeId: payload.new?.sede_id || payload.old?.sede_id,
            timestamp: new Date().toISOString()
          });

          // Filtrar manualmente por sede (temporalmente)
          const order = payload.new || payload.old;
          if (order && order.sede_id === sedeId) {
            console.log('✅ [ORDERS] Orden pertenece a la sede, procesando...', { orderId: order.id, sedeId });
            handleOrderChange(payload);
          } else {
            console.log('🚫 [ORDERS] Orden filtrada (no pertenece a la sede)', {
              orderSedeId: order?.sede_id,
              expectedSedeId: sedeId
            });
          }
        }
      )
      .subscribe((status, err) => {
        console.log('🔍 [ORDERS] Realtime Status Changed:', {
          status,
          sedeId,
          channel: `orders_${sedeId}`,
          error: err,
          timestamp: new Date().toISOString()
        });

        if (status === 'SUBSCRIBED') {
          console.log('✅ [ORDERS] Realtime conectado exitosamente para sede:', sedeId);
          logDebug('Realtime', '[ORDERS] Realtime conectado exitosamente', {
            sedeId,
            channel: `orders_${sedeId}`,
            filter: `sede_id=eq.${sedeId}`
          });
          isConnectedRef.current = true;
          setConnectionStatus('connected');
          setReconnectAttempts(0); // Reset intentos de reconexión
          startHeartbeat(); // Iniciar heartbeat
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [ORDERS] Error en conexión realtime:', { status, error: err, sedeId });
          logError('Realtime', '[ORDERS] Error en conexión realtime', {
            sedeId,
            status,
            error: err,
            filter: `sede_id=eq.${sedeId}`,
            possibleCauses: [
              'Realtime no habilitado en Supabase',
              'RLS bloqueando suscripción para tabla ordenes',
              'API keys incorrectas',
              'Filtro de sede inválido',
              'Sede ID formato incorrecto',
              'Tabla ordenes no tiene permisos de SELECT'
            ]
          });
          isConnectedRef.current = false;
          setConnectionStatus('error');
          stopHeartbeat();
          scheduleReconnect(); // Programar reconexión automática
        } else if (status === 'CLOSED') {
          console.warn('⚠️ Conexión realtime cerrada para sede:', sedeId);
          logDebug('Realtime', 'Conexión realtime cerrada', { sedeId });
          isConnectedRef.current = false;
          setConnectionStatus('disconnected');
          stopHeartbeat();
          // No reconectar automáticamente en CLOSED - usar manual o heartbeat
        } else if (status === 'TIMED_OUT') {
          console.error('⏰ Conexión realtime timeout para sede:', sedeId);
          isConnectedRef.current = false;
          setConnectionStatus('error');
          stopHeartbeat();
          // Solo reconectar en timeout si no está siendo desmontado
          if (isMountedRef.current) {
            scheduleReconnect();
          }
        } else {
          console.warn('🔄 Estado realtime desconocido:', { status, sedeId });
          setConnectionStatus('connecting');
        }
      });

    // Suscripción a cambios en items de órdenes (platos)
    const orderPlatosChannel = supabase
      .channel(`order_platos_${sedeId}`, channelConfig)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordenes_platos'
        },
        (payload) => {
          logDebug('Realtime', 'Items de orden actualizados', { table: 'ordenes_platos' });
          callbacksRef.current.onOrderUpdated?.();
        }
      )
      .subscribe();

    // Suscripción a cambios en items de órdenes (bebidas)
    const orderBebidasChannel = supabase
      .channel(`order_bebidas_${sedeId}`, channelConfig)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordenes_bebidas'
        },
        (payload) => {
          logDebug('Realtime', 'Bebidas de orden actualizadas', { table: 'ordenes_bebidas' });
          callbacksRef.current.onOrderUpdated?.();
        }
      )
      .subscribe();

    // Almacenar referencias de canales para limpieza
    channelsRef.current = [ordersChannel, orderPlatosChannel, orderBebidasChannel];

    return () => {
      // Marcar como desmontado INMEDIATAMENTE para prevenir reconexiones
      isMountedRef.current = false;

      logDebug('Realtime', 'Cerrando suscripciones realtime', { sedeId, channelCount: channelsRef.current.length });

      // Detener heartbeat y timers
      stopHeartbeat();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

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
      setConnectionStatus('disconnected');
      
      logDebug('Realtime', 'Limpieza de canales completada', { 
        closedSuccessfully, 
        closedWithErrors,
        sedeId 
      });
    };
  }, [sedeId, reconnectTrigger]); // Solo sedeId y reconnectTrigger como dependencias para evitar loops

  return {
    // Función para forzar reconexión si es necesario
    reconnect: useCallback(() => {
      console.log('🔄 Forzando reconexión realtime...');
      setConnectionStatus('connecting');
      setReconnectAttempts(0); // Reset intentos
      setReconnectTrigger(prev => prev + 1);
    }, []),

    // Función para verificar estado de conexión
    isConnected: useCallback(() => {
      return isConnectedRef.current;
    }, []),

    // Estado de conexión actual
    connectionStatus,

    // Intentos de reconexión actuales
    reconnectAttempts,

    // Función para obtener estado de los canales
    getChannelsStatus: useCallback(() => {
      return {
        totalChannels: channelsRef.current.length,
        isConnected: isConnectedRef.current,
        connectionStatus,
        reconnectAttempts,
        maxReconnectAttempts,
        sedeId
      };
    }, [sedeId, connectionStatus, reconnectAttempts]),

    // Función para testear conectividad
    testConnection: testSupabaseConnection
  };
};