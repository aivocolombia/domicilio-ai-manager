import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeSubscriber {
  id: string;
  table: string;
  callback: (payload: any) => void;
  filter?: string;
}

interface SharedRealtimeManager {
  subscribe: (subscriber: RealtimeSubscriber) => void;
  unsubscribe: (subscriberId: string) => void;
  isConnected: boolean;
  connectionStatus: string;
}

// Manager global para controlar todas las suscripciones
class RealtimeManager {
  private channel: RealtimeChannel | null = null;
  private subscribers: Map<string, RealtimeSubscriber> = new Map();
  private isConnected: boolean = false;
  private connectionStatus: string = 'DISCONNECTED';
  private sedeId: string | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor() {
    console.log('🔄 [SHARED_REALTIME] Inicializando manager centralizado...');
  }

  private async createChannel(sedeId: string) {
    if (this.channel) {
      console.log('🔄 [SHARED_REALTIME] Cerrando canal existente...');
      await this.channel.unsubscribe();
      this.channel = null;
    }

    console.log(`🔄 [SHARED_REALTIME] Creando nuevo canal para sede: ${sedeId}`);

    // Crear UN SOLO canal para todas las suscripciones
    this.channel = supabase.channel(`shared_realtime_${sedeId}`, {
      config: {
        presence: { key: sedeId },
        broadcast: { self: false } // Cambiado a false para evitar duplicados locales
      }
    });

    // Configurar listeners de estado del canal
    this.channel
      .on('system', {}, (payload) => {
        console.log('🔍 [SHARED_REALTIME] System event:', payload);
        if (payload.extension === 'postgres_changes') {
          this.connectionStatus = payload.status;
          this.isConnected = payload.status === 'ok';
        }
      })
      // CRÍTICO: Agregar filtro por sede en el nivel de suscripción
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ordenes',
        filter: `sede_id=eq.${sedeId}` // ⚠️ FILTRO CRÍTICO
      }, (payload) => {
        console.log(`🔄 [SHARED_REALTIME] Change received for sede ${sedeId}:`, payload);
        this.handleRealtimeChange(payload);
      })
      // También escuchar cambios en ordenes_platos y ordenes_bebidas
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ordenes_platos'
      }, (payload) => {
        console.log('🔄 [SHARED_REALTIME] ordenes_platos change:', payload);
        this.handleRealtimeChange(payload);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ordenes_bebidas'
      }, (payload) => {
        console.log('🔄 [SHARED_REALTIME] ordenes_bebidas change:', payload);
        this.handleRealtimeChange(payload);
      });

    // Suscribirse al canal
    const subscriptionResult = await this.channel.subscribe((status) => {
      console.log(`📡 [SHARED_REALTIME] Canal status: ${status}`);
      this.connectionStatus = status;

      if (status === 'SUBSCRIBED') {
        console.log('✅ [SHARED_REALTIME] Canal suscrito exitosamente');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ [SHARED_REALTIME] Error en canal');
        this.isConnected = false;
        this.scheduleReconnect();
      } else if (status === 'TIMED_OUT') {
        console.error('⏰ [SHARED_REALTIME] Timeout en canal');
        this.isConnected = false;
        this.scheduleReconnect();
      } else if (status === 'CLOSED') {
        console.log('🔒 [SHARED_REALTIME] Canal cerrado');
        this.isConnected = false;
      }
    });

    return subscriptionResult;
  }

  private handleRealtimeChange(payload: any) {
    const tableName = payload.table;
    console.log(`🔄 [SHARED_REALTIME] Procesando cambio en tabla: ${tableName}`);

    // Notificar a todos los suscriptores interesados en esta tabla
    for (const [subscriberId, subscriber] of this.subscribers) {
      if (subscriber.table === tableName) {
        try {
          console.log(`📢 [SHARED_REALTIME] Notificando a suscriptor: ${subscriberId}`);
          subscriber.callback(payload);
        } catch (error) {
          console.error(`❌ [SHARED_REALTIME] Error notificando a ${subscriberId}:`, error);
        }
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ [SHARED_REALTIME] Máximo de intentos de reconexión alcanzado');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`🔄 [SHARED_REALTIME] Programando reconexión en ${delay}ms (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = setTimeout(async () => {
      if (this.sedeId) {
        await this.createChannel(this.sedeId);
      }
    }, delay);
  }

  async initialize(sedeId: string) {
    console.log(`🚀 [SHARED_REALTIME] Inicializando para sede: ${sedeId}`);
    this.sedeId = sedeId;
    await this.createChannel(sedeId);
  }

  subscribe(subscriber: RealtimeSubscriber) {
    console.log(`➕ [SHARED_REALTIME] Agregando suscriptor: ${subscriber.id} (tabla: ${subscriber.table})`);
    this.subscribers.set(subscriber.id, subscriber);
  }

  unsubscribe(subscriberId: string) {
    console.log(`➖ [SHARED_REALTIME] Eliminando suscriptor: ${subscriberId}`);
    this.subscribers.delete(subscriberId);
  }

  async cleanup() {
    console.log('🧹 [SHARED_REALTIME] Limpiando recursos...');

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }

    this.subscribers.clear();
    this.isConnected = false;
    this.connectionStatus = 'DISCONNECTED';
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      connectionStatus: this.connectionStatus,
      subscribersCount: this.subscribers.size,
      sedeId: this.sedeId
    };
  }
}

// Instancia global del manager
const realtimeManager = new RealtimeManager();

// Hook para usar el Realtime compartido
export const useSharedRealtime = (sedeId?: string): SharedRealtimeManager => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('DISCONNECTED');
  const initializeRef = useRef(false);

  // Inicializar el manager cuando se monta el primer componente
  useEffect(() => {
    if (sedeId && !initializeRef.current) {
      console.log(`🔄 [SHARED_REALTIME] Hook inicializando manager para sede: ${sedeId}`);
      initializeRef.current = true;
      realtimeManager.initialize(sedeId);
    }

    // Polling del estado del manager
    const statusInterval = setInterval(() => {
      const status = realtimeManager.getStatus();
      setIsConnected(status.isConnected);
      setConnectionStatus(status.connectionStatus);
    }, 1000);

    return () => {
      clearInterval(statusInterval);
    };
  }, [sedeId]);

  const subscribe = useCallback((subscriber: RealtimeSubscriber) => {
    realtimeManager.subscribe(subscriber);
  }, []);

  const unsubscribe = useCallback((subscriberId: string) => {
    realtimeManager.unsubscribe(subscriberId);
  }, []);

  return {
    subscribe,
    unsubscribe,
    isConnected,
    connectionStatus
  };
};

// Hook para limpiar el manager cuando se desmonta la app
export const useSharedRealtimeCleanup = () => {
  useEffect(() => {
    return () => {
      console.log('🧹 [SHARED_REALTIME] Limpiando manager en cleanup...');
      realtimeManager.cleanup();
    };
  }, []);
};