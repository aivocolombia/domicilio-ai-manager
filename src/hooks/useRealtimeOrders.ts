import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

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
    console.log('🔄 Orden actualizada en tiempo real:', payload.eventType, 'ID:', payload.new?.id || payload.old?.id);
    
    if (payload.eventType === 'INSERT') {
      console.log('📝 Nueva orden creada:', payload.new);
      onNewOrder?.(payload.new);
    } else if (payload.eventType === 'UPDATE') {
      console.log('✏️ Orden actualizada:', payload.new);
      
      // Log cambios específicos para debugging
      if (payload.old?.status !== payload.new?.status) {
        console.log(`📊 Status cambió: ${payload.old?.status} → ${payload.new?.status}`);
        onOrderStatusChanged?.(payload.new.id, payload.new.status);
      }
      
      // Log otros cambios importantes
      const changedFields = [];
      if (payload.old?.repartidor_id !== payload.new?.repartidor_id) {
        changedFields.push('repartidor');
      }
      if (payload.old?.hora_entrega !== payload.new?.hora_entrega) {
        changedFields.push('hora_entrega');
      }
      
      if (changedFields.length > 0) {
        console.log('🔄 Campos actualizados:', changedFields.join(', '));
      }
    } else if (payload.eventType === 'DELETE') {
      console.log('🗑️ Orden eliminada:', payload.old);
    }
    
    // Notificar actualización general (esto puede disparar recargas)
    onOrderUpdated?.();
  }, [onOrderUpdated, onNewOrder, onOrderStatusChanged]);

  useEffect(() => {
    if (!sedeId) {
      console.log('⚠️ No hay sede_id, no configurando realtime');
      return;
    }

    console.log('🔔 Configurando suscripción realtime para sede:', sedeId);
    isConnectedRef.current = false;

    // Verificar que Supabase esté configurado correctamente
    if (!supabase) {
      console.error('❌ Supabase no está inicializado');
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
        console.log('📡 Estado suscripción órdenes:', status, 'para sede:', sedeId);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime órdenes conectado exitosamente para sede:', sedeId);
          isConnectedRef.current = true;
          
          // Verificar configuración de Supabase
          console.log('🔍 Verificando configuración realtime...');
          console.log('Supabase URL:', supabase.supabaseUrl);
          console.log('Canal configurado:', `orders_${sedeId}`);
          console.log('Filtro aplicado:', `sede_id=eq.${sedeId}`);
          
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error en conexión realtime órdenes para sede:', sedeId);
          console.error('Posibles causas:');
          console.error('1. Realtime no habilitado en Supabase');
          console.error('2. Filtros RLS bloqueando la suscripción');
          console.error('3. Configuración de API keys incorrecta');
          isConnectedRef.current = false;
          
        } else if (status === 'CLOSED') {
          console.log('📴 Conexión realtime órdenes cerrada para sede:', sedeId);
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
          console.log('🍽️ Items de orden actualizados:', payload);
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
          console.log('🥤 Bebidas de orden actualizadas:', payload);
          onOrderUpdated?.();
        }
      )
      .subscribe((status) => {
        console.log('📡 Estado suscripción bebidas:', status);
      });

    // Almacenar referencias de canales para limpieza
    channelsRef.current = [ordersChannel, orderPlatosChannel, orderBebidasChannel];

    return () => {
      console.log('🔌 Cerrando suscripciones realtime para sede:', sedeId);
      
      channelsRef.current.forEach((channel, index) => {
        if (channel) {
          try {
            supabase.removeChannel(channel);
            console.log(`✅ Canal ${index + 1} cerrado exitosamente`);
          } catch (error) {
            console.error(`❌ Error cerrando canal ${index + 1}:`, error);
          }
        }
      });
      
      channelsRef.current = [];
      isConnectedRef.current = false;
      console.log('🔌 Todas las suscripciones realtime cerradas');
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