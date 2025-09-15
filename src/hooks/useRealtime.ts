import { useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel, REALTIME_LISTEN_TYPES, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimePayload<T = any> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table: string;
  commit_timestamp: string;
  new?: T;
  old?: T;
}

export interface UseRealtimeOptions {
  table: string;
  event?: RealtimeEvent;
  schema?: string;
  onPayload: (payload: RealtimePayload) => void;
  onError?: (error: Error) => void;
  onSubscribed?: () => void;
  enabled?: boolean;
}

/**
 * Hook para suscribirse a cambios en tiempo real de una tabla específica
 */
export const useRealtime = ({
  table,
  event = '*',
  schema = 'public',
  onPayload,
  onError,
  onSubscribed,
  enabled = true
}: UseRealtimeOptions) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef(false);

  const handlePayload = useCallback((payload: RealtimePayload) => {
    console.log(`🔔 [${table}] Realtime event:`, payload.eventType, payload);
    try {
      onPayload(payload);
    } catch (error) {
      console.error(`❌ [${table}] Error handling realtime payload:`, error);
      onError?.(error as Error);
    }
  }, [table, onPayload, onError]);

  const subscribe = useCallback(() => {
    if (!enabled || isSubscribedRef.current) return;

    console.log(`📡 [${table}] Subscribing to realtime changes...`);
    
    const channelName = `${table}_changes_${Date.now()}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        REALTIME_LISTEN_TYPES.POSTGRES_CHANGES,
        {
          event,
          schema,
          table
        },
        handlePayload
      )
      .subscribe((status, err) => {
        console.log(`📡 [${table}] Subscription status:`, status);
        
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          console.log(`✅ [${table}] Successfully subscribed to realtime`);
          isSubscribedRef.current = true;
          onSubscribed?.();
        } else if (status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR) {
          console.error(`❌ [${table}] Realtime subscription error:`, err);
          isSubscribedRef.current = false;
          onError?.(new Error(`Realtime subscription failed: ${err?.message || 'Unknown error'}`));
        } else if (status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT) {
          console.warn(`⏰ [${table}] Realtime subscription timed out`);
          isSubscribedRef.current = false;
          onError?.(new Error('Realtime subscription timed out'));
        } else if (status === REALTIME_SUBSCRIBE_STATES.CLOSED) {
          console.log(`📪 [${table}] Realtime subscription closed`);
          isSubscribedRef.current = false;
        }
      });

    channelRef.current = channel;
  }, [enabled, table, event, schema, handlePayload, onError, onSubscribed]);

  const unsubscribe = useCallback(() => {
    if (channelRef.current && isSubscribedRef.current) {
      console.log(`📡 [${table}] Unsubscribing from realtime...`);
      channelRef.current.unsubscribe();
      channelRef.current = null;
      isSubscribedRef.current = false;
    }
  }, [table]);

  useEffect(() => {
    subscribe();
    
    return () => {
      unsubscribe();
    };
  }, [subscribe, unsubscribe]);

  return {
    isSubscribed: isSubscribedRef.current,
    subscribe,
    unsubscribe
  };
};

/**
 * Hook para suscribirse a múltiples tablas
 */
export const useMultiTableRealtime = (subscriptions: Omit<UseRealtimeOptions, 'onPayload'>[] & { onPayload: (payload: RealtimePayload, table: string) => void }) => {
  const channels = subscriptions.map((sub, index) => 
    useRealtime({
      ...sub,
      onPayload: (payload) => sub.onPayload(payload, sub.table)
    })
  );

  return {
    subscriptions: channels,
    unsubscribeAll: () => channels.forEach(channel => channel.unsubscribe())
  };
};

/**
 * Hook específico para órdenes con eventos comunes
 */
export const useOrdersRealtime = (
  onNewOrder?: (order: any) => void,
  onOrderUpdate?: (order: any, oldOrder: any) => void,
  onOrderDelete?: (order: any) => void,
  enabled = true
) => {
  return useRealtime({
    table: 'ordenes',
    enabled,
    onPayload: (payload) => {
      switch (payload.eventType) {
        case 'INSERT':
          onNewOrder?.(payload.new);
          break;
        case 'UPDATE':
          onOrderUpdate?.(payload.new, payload.old);
          break;
        case 'DELETE':
          onOrderDelete?.(payload.old);
          break;
      }
    },
    onError: (error) => {
      console.error('❌ Orders realtime error:', error);
    }
  });
};

/**
 * Hook específico para repartidores
 */
export const useDeliveryRealtime = (
  onDeliveryPersonUpdate?: (person: any) => void,
  enabled = true
) => {
  return useRealtime({
    table: 'repartidores',
    enabled,
    onPayload: (payload) => {
      if (payload.eventType === 'UPDATE') {
        onDeliveryPersonUpdate?.(payload.new);
      }
    },
    onError: (error) => {
      console.error('❌ Delivery realtime error:', error);
    }
  });
};