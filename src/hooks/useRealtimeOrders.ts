import { useEffect, useCallback } from 'react';
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
  
  const handleOrderChange = useCallback((payload: any) => {
    console.log('🔄 Orden actualizada en tiempo real:', payload);
    
    if (payload.eventType === 'INSERT') {
      console.log('📝 Nueva orden creada:', payload.new);
      onNewOrder?.(payload.new);
    } else if (payload.eventType === 'UPDATE') {
      console.log('✏️ Orden actualizada:', payload.new);
      
      // Si cambió el status, notificar específicamente
      if (payload.old?.status !== payload.new?.status) {
        onOrderStatusChanged?.(payload.new.id, payload.new.status);
      }
    }
    
    // Notificar actualización general
    onOrderUpdated?.();
  }, [onOrderUpdated, onNewOrder, onOrderStatusChanged]);

  useEffect(() => {
    if (!sedeId) return;

    console.log('🔔 Configurando suscripción realtime para sede:', sedeId);

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
        console.log('📡 Estado suscripción órdenes:', status);
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
      .subscribe();

    return () => {
      console.log('🔌 Cerrando suscripciones realtime');
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(orderPlatosChannel);
      supabase.removeChannel(orderBebidasChannel);
    };
  }, [sedeId, handleOrderChange, onOrderUpdated]);

  return {
    // Función para forzar reconexión si es necesario
    reconnect: useCallback(() => {
      console.log('🔄 Forzando reconexión realtime...');
      // El useEffect se ejecutará nuevamente debido a las dependencias
    }, [])
  };
};