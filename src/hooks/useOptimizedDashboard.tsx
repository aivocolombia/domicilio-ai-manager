import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSmartQuery, useThrottle, usePersistentMemo } from '@/hooks/usePerformance';
import { sedeService } from '@/services/sedeService';
import { multiPaymentService } from '@/services/multiPaymentService';
import { supabase } from '@/lib/supabase';
import { logDebug, logError, logWarn } from '@/utils/logger';

interface DashboardOrder {
  id: number;
  id_display: string;
  orden_id: number;
  cliente_nombre: string;
  cliente_telefono: string;
  direccion: string;
  sede: string;
  estado: string;
  total: number;
  pago_tipo: string;
  pago_estado: string;
  creado_fecha: string;
  creado_hora: string;
  entrega_hora: string;
  repartidor: string;
  payment_id: string;
  payment_id_2?: string; // Segundo pago
  payment_display: string; // Formato para mostrar: "efectivo" o "efectivo +1"
  has_multiple_payments: boolean;
  minuta_id?: string;
}

interface DashboardStats {
  total: number;
  recibidos: number;
  cocina: number;
  camino: number;
  entregados: number;
  cancelados: number;
}

interface DashboardFilters {
  fechaInicio?: string;
  fechaFin?: string;
  estado?: string;
  searchTerm?: string;
}

interface RealtimeStatus {
  isConnected: () => boolean;
  getChannelsStatus: () => {
    totalChannels: number;
    isConnected: boolean;
    sedeId?: string;
  };
  reconnect: () => void;
}

interface UseOptimizedDashboardResult {
  orders: DashboardOrder[];
  stats: DashboardStats;
  loading: boolean;
  error: string | null;
  loadDashboardOrders: (filters?: DashboardFilters) => Promise<void>;
  refreshData: () => Promise<void>;
  deleteOrder: (orderId: number) => Promise<void>;
  realtimeStatus: RealtimeStatus | null;
}

const CACHE_TTL = 2 * 60 * 1000; // 2 minutos para datos del dashboard

export const useOptimizedDashboard = (sedeId?: string): UseOptimizedDashboardResult => {
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    recibidos: 0,
    cocina: 0,
    camino: 0,
    entregados: 0,
    cancelados: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus | null>(null);

  // Refs para evitar múltiples llamadas simultáneas
  const loadingRef = useRef(false);
  const lastFiltersRef = useRef<string>('');
  
  // Subscription para realtime
  const subscriptionRef = useRef<any>(null);

  // Query optimizada con caché inteligente
  const fetchDashboardData = useCallback(async (filters: DashboardFilters = {}) => {
    if (!sedeId) {
      throw new Error('SedeId requerido');
    }

    logDebug('OptimizedDashboard', `📊 Fetching dashboard data for sede ${sedeId}`, filters);

    // Construir query base
    let query = supabase
      .from('ordenes')
      .select(`
        id,
        status,
        payment_id,
        payment_id_2,
        created_at,
        observaciones,
        precio_envio,
        address,
        clientes!cliente_id(nombre, telefono),
        pagos!payment_id(type, total_pago),
        pagos_secondary:pagos!payment_id_2(type, total_pago),
        repartidores!left(nombre),
        minutas!left(daily_id),
        sedes!inner(name)
      `)
      .eq('sede_id', sedeId);

    // Aplicar filtros
    if (filters.estado && filters.estado !== 'todos') {
      query = query.eq('status', filters.estado);
    }

    if (filters.fechaInicio && filters.fechaFin) {
      query = query
        .gte('created_at', filters.fechaInicio)
        .lte('created_at', filters.fechaFin);
    }

    // Limitar resultados y ordenar
    query = query.order('created_at', { ascending: false }).limit(500);

    const { data: ordersData, error: ordersError } = await query;

    if (ordersError) {
      throw new Error(`Error fetching orders: ${ordersError.message}`);
    }

    // Transformar datos
    const transformedOrders: DashboardOrder[] = (ordersData || []).map(order => {
      const payment1 = order.pagos;
      const payment2 = order.pagos_secondary;

      // Calcular información de pagos
      const hasMultiplePayments = !!(payment1 && payment2);
      const totalPaid = (payment1?.total_pago || 0) + (payment2?.total_pago || 0);

      // Determinar método principal (el de mayor monto)
      let primaryPaymentType = payment1?.type || 'Sin especificar';
      if (hasMultiplePayments && (payment2?.total_pago || 0) > (payment1?.total_pago || 0)) {
        primaryPaymentType = payment2?.type || primaryPaymentType;
      }

      // Formato de visualización
      const paymentDisplay = hasMultiplePayments
        ? `${primaryPaymentType} +1`
        : primaryPaymentType;

      return {
        id: order.id,
        id_display: `ORD-${order.id.toString().padStart(4, '0')}`,
        orden_id: order.id,
        cliente_nombre: order.clientes?.nombre || 'Sin nombre',
        cliente_telefono: order.clientes?.telefono || 'Sin teléfono',
        direccion: order.address || 'Sin dirección',
        sede: order.sedes?.name || 'Sin sede',
        estado: order.status || 'Desconocido',
        total: totalPaid,
        pago_tipo: primaryPaymentType,
        pago_estado: totalPaid > 0 ? 'Pagado' : 'Pendiente',
        creado_fecha: new Date(order.created_at).toLocaleDateString('es-CO'),
        creado_hora: new Date(order.created_at).toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        entrega_hora: 'N/A',
        repartidor: order.repartidores?.nombre || 'Sin asignar',
        payment_id: order.payment_id?.toString() || '',
        payment_id_2: order.payment_id_2?.toString(),
        payment_display: paymentDisplay,
        has_multiple_payments: hasMultiplePayments,
        minuta_id: order.minutas?.[0]?.daily_id?.toString()
      };
    });

    // Aplicar filtro de búsqueda en memoria (más eficiente)
    let filteredOrders = transformedOrders;
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filteredOrders = transformedOrders.filter(order => 
        order.cliente_nombre.toLowerCase().includes(searchLower) ||
        order.cliente_telefono.includes(filters.searchTerm!) ||
        order.id_display.toLowerCase().includes(searchLower) ||
        order.direccion.toLowerCase().includes(searchLower)
      );
    }

    // Calcular estadísticas
    const stats: DashboardStats = {
      total: filteredOrders.length,
      recibidos: filteredOrders.filter(o => o.estado === 'Recibidos').length,
      cocina: filteredOrders.filter(o => o.estado === 'Cocina').length,
      camino: filteredOrders.filter(o => o.estado === 'Camino').length,
      entregados: filteredOrders.filter(o => o.estado === 'Entregados').length,
      cancelados: filteredOrders.filter(o => o.estado === 'Cancelado').length
    };

    logDebug('OptimizedDashboard', `✅ Dashboard data loaded: ${filteredOrders.length} orders`);

    return { orders: filteredOrders, stats };
  }, [sedeId]);

  // Smart query con caché y reintentos
  const { 
    data: dashboardData, 
    loading: queryLoading, 
    error: queryError,
    refetch,
    invalidate 
  } = useSmartQuery(
    { sedeId, type: 'dashboard' },
    () => fetchDashboardData(),
    { 
      ttl: CACHE_TTL,
      retryAttempts: 2,
      retryDelay: 1000 
    }
  );

  // Throttled load function para evitar llamadas excesivas
  const throttledLoadOrders = useThrottle(
    useCallback(async (filters: DashboardFilters = {}) => {
      const filtersKey = JSON.stringify(filters);
      
      // Evitar cargas duplicadas
      if (loadingRef.current || lastFiltersRef.current === filtersKey) {
        return;
      }

      loadingRef.current = true;
      lastFiltersRef.current = filtersKey;
      
      try {
        setError(null);
        const result = await fetchDashboardData(filters);
        
        if (result) {
          setOrders(result.orders);
          setStats(result.stats);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        logError('OptimizedDashboard', 'Error loading dashboard', err);
        setError(errorMessage);
      } finally {
        loadingRef.current = false;
      }
    }, [fetchDashboardData]),
    300 // 300ms de throttle
  );

  // Configurar datos cuando lleguen del smart query
  useEffect(() => {
    if (dashboardData) {
      setOrders(dashboardData.orders);
      setStats(dashboardData.stats);
    }
  }, [dashboardData]);

  useEffect(() => {
    setLoading(queryLoading);
  }, [queryLoading]);

  useEffect(() => {
    setError(queryError?.message || null);
  }, [queryError]);

  // Setup realtime subscription
  useEffect(() => {
    if (!sedeId) return;

    logDebug('OptimizedDashboard', `🔄 Setting up realtime for sede ${sedeId}`);

    const setupRealtime = () => {
      // Limpiar subscription anterior
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }

      const subscription = supabase
        .channel(`ordenes_sede_${sedeId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ordenes',
            filter: `sede_id=eq.${sedeId}`
          },
          (payload) => {
            logDebug('OptimizedDashboard', '🔄 Realtime update received', payload);
            
            // Invalidar caché y refrescar datos
            invalidate();
            refetch(true);
          }
        )
        .subscribe();

      subscriptionRef.current = subscription;

      const realtimeStatus: RealtimeStatus = {
        isConnected: () => subscription.state === 'SUBSCRIBED',
        getChannelsStatus: () => ({
          totalChannels: 1,
          isConnected: subscription.state === 'SUBSCRIBED',
          sedeId
        }),
        reconnect: () => {
          setupRealtime();
        }
      };

      setRealtimeStatus(realtimeStatus);
    };

    setupRealtime();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [sedeId, invalidate, refetch]);

  // Función optimizada para eliminar orden
  const deleteOrder = useCallback(async (orderId: number) => {
    try {
      logDebug('OptimizedDashboard', `🗑️ Deleting order ${orderId}`);
      
      const { error } = await supabase
        .from('ordenes')
        .delete()
        .eq('id', orderId);

      if (error) {
        throw error;
      }

      // Actualizar estado local inmediatamente (optimistic update)
      setOrders(prev => prev.filter(order => order.orden_id !== orderId));
      
      // Recalcular estadísticas
      setStats(prev => ({
        ...prev,
        total: prev.total - 1
      }));

      // Invalidar caché
      invalidate();

      logDebug('OptimizedDashboard', `✅ Order ${orderId} deleted`);
    } catch (error) {
      logError('OptimizedDashboard', `Error deleting order ${orderId}`, error);
      throw error;
    }
  }, [invalidate]);

  const refreshData = useCallback(async () => {
    invalidate();
    await refetch(true);
  }, [invalidate, refetch]);

  const loadDashboardOrders = useCallback(async (filters?: DashboardFilters) => {
    await throttledLoadOrders(filters || {});
  }, [throttledLoadOrders]);

  return {
    orders,
    stats,
    loading,
    error,
    loadDashboardOrders,
    refreshData,
    deleteOrder,
    realtimeStatus
  };
};