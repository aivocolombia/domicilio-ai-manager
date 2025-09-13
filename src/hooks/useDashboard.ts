import { useState, useCallback, useEffect, useRef } from 'react';
import { dashboardService, DashboardOrder, DashboardFilters } from '@/services/dashboardService';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { logDebug, logError, logWarn } from '@/utils/logger';

// Simple debounce function
const debounce = <T extends (...args: any[]) => any>(func: T, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export interface DashboardStats {
  total: number;
  recibidos: number;
  cocina: number;
  camino: number;
  entregados: number;
  cancelados: number;
}

export const useDashboard = (sede_id?: string | number) => {
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
  const { toast } = useToast();
  const loadingRef = useRef(false);
  const sedeIdRef = useRef(sede_id);
  
  // Actualizar ref cuando sede_id cambie
  useEffect(() => {
    sedeIdRef.current = sede_id;
  }, [sede_id]);

  // Cargar órdenes del dashboard con protección contra cargas concurrentes
  const loadDashboardOrders = useCallback(async (filters: DashboardFilters = {}) => {
    // ATOMIC check-and-set para prevenir race conditions
    const wasLoading = loadingRef.current;
    loadingRef.current = true;
    
    if (wasLoading) {
      logDebug('Dashboard', 'Ya hay una carga en progreso, saltando...');
      loadingRef.current = wasLoading; // Restaurar estado original
      return;
    }

    try {
      setLoading(true);
      setError(null);
      logDebug('Dashboard', 'Cargando órdenes del dashboard', { sede_id, filters });

      // Usar la referencia actualizada de sede_id
      const currentSedeId = sedeIdRef.current;
      
      // Verificar que tenemos sede_id antes de proceder
      if (!currentSedeId) {
        logWarn('Dashboard', 'No hay sede_id, saltando carga de dashboard');
        return;
      }

      // Agregar sede_id a los filtros si existe
      const filtersWithSede = { ...filters, sede_id: currentSedeId };

      const [ordersData, statsData] = await Promise.all([
        dashboardService.getDashboardOrders(filtersWithSede),
        dashboardService.getDashboardStats(currentSedeId, filters)
      ]);

      setOrders(ordersData);
      setStats(statsData);

      logDebug('Dashboard', 'Dashboard cargado exitosamente', { 
        ordersCount: ordersData.length, 
        stats: statsData 
      });
      
      if (ordersData.length === 0) {
        logWarn('Dashboard', 'No se recibieron órdenes desde el servicio');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al cargar dashboard';
      logError('Dashboard', 'Error al cargar dashboard', err);
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [toast]); // Removemos sede_id de las dependencias para evitar re-creaciones

  // NO cargar datos iniciales automáticamente - dejar que el Dashboard maneje todos los filtros
  // MODIFICADO: Eliminado carga inicial automática para evitar conflictos con filtros del Dashboard
  useEffect(() => {
    logDebug('Dashboard', 'Hook inicializado, esperando filtros del Dashboard', { sede_id });
  }, [sede_id]); // Solo dependencia de sede_id

  // Filtrar órdenes por estado
  const filterOrdersByStatus = useCallback(async (status: string | null) => {
    const filters: DashboardFilters = {};
    if (status && status !== 'all') {
      filters.estado = status;
    }
    await loadDashboardOrders(filters);
  }, [loadDashboardOrders]);

  // Recargar datos
  const refreshData = useCallback(() => {
    loadDashboardOrders();
  }, [loadDashboardOrders]);

  // Eliminar orden (solo para admins)
  const deleteOrder = useCallback(async (orderId: number) => {
    try {
      await dashboardService.deleteOrder(orderId);
      
      // Actualizar el estado local removiendo la orden
      setOrders(prevOrders => prevOrders.filter(order => order.orden_id !== orderId));
      
      toast({
        title: "Orden eliminada",
        description: `Orden #${orderId} eliminada exitosamente`,
      });
      
      // Recargar datos para asegurar consistencia
      loadDashboardOrders();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Error eliminando orden:', error);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      throw error;
    }
  }, [toast, loadDashboardOrders]);

  // Función para recarga con filtros actuales (será pasada desde Dashboard)
  const refreshFunctionRef = useRef<(() => void) | null>(null);
  
  // Forzar recarga inmediata para cambios de estado críticos
  const forceReload = useCallback(() => {
    if (sedeIdRef.current) {
      console.log('🔄 Dashboard: Forzando recarga inmediata...');
      // Resetear el flag de loading para permitir recarga
      loadingRef.current = false;
      // Usar función de refresh del Dashboard si está disponible, sino usar loadDashboardOrders
      if (refreshFunctionRef.current) {
        console.log('🔄 Dashboard: Usando función de refresh con filtros actuales');
        refreshFunctionRef.current();
      } else {
        console.log('🔄 Dashboard: Usando loadDashboardOrders básico');
        loadDashboardOrders();
      }
    }
  }, [loadDashboardOrders]);

  // Configurar suscripción en tiempo real con debounce reducido
  const debouncedReload = useCallback(
    debounce(() => {
      if (sedeIdRef.current) {
        console.log('🔄 Dashboard: Recarga programada ejecutándose...');
        // Resetear el flag de loading para permitir recarga
        loadingRef.current = false;
        loadDashboardOrders();
      }
    }, 300), // Reducido a 300ms para respuesta más rápida
    [loadDashboardOrders]
  );

  const realtimeStatus = useRealtimeOrders({
    sedeId: sedeIdRef.current?.toString(),
    onOrderUpdated: () => {
      console.log('🔄 Dashboard: Orden actualizada, forzando recarga inmediata...');
      // Usar recarga inmediata para cualquier cambio
      forceReload();
    },
    onNewOrder: (order) => {
      console.log('📝 Dashboard: Nueva orden recibida:', order);
      toast({
        title: "Nueva orden",
        description: `Orden #${order.id} recibida`,
        duration: 3000,
      });
      // Recarga inmediata para nuevas órdenes
      forceReload();
    },
    onOrderStatusChanged: (orderId, newStatus) => {
      console.log(`📊 Dashboard: Orden #${orderId} cambió a ${newStatus}`);
      toast({
        title: "Estado actualizado",
        description: `Orden #${orderId} → ${newStatus}`,
        duration: 2000,
      });
      // Para cambios de estado, recarga inmediata (crítico)
      forceReload();
    }
  });

  // Función para registrar la función de refresh del Dashboard
  const registerRefreshFunction = useCallback((refreshFn: () => void) => {
    refreshFunctionRef.current = refreshFn;
    console.log('🔄 Dashboard: Función de refresh registrada');
  }, []);

  return {
    orders,
    stats,
    loading,
    error,
    loadDashboardOrders,
    filterOrdersByStatus,
    refreshData,
    deleteOrder,
    realtimeStatus, // Exponer estado de conexión realtime
    registerRefreshFunction // Nueva función para registrar refresh con filtros
  };
}; 