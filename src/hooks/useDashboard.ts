import { useState, useCallback, useEffect, useRef } from 'react';
import { dashboardService, DashboardOrder, DashboardFilters } from '@/services/dashboardService';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';

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
    // Prevenir cargas concurrentes
    if (loadingRef.current) {
      console.log('🔄 Ya hay una carga en progreso, saltando...');
      return;
    }

    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      console.log('🔄 Cargando órdenes del dashboard...');
      console.log('🏢 UseDashboard Sede ID:', sede_id);
      console.log('🔍 UseDashboard Filtros:', filters);

      // Usar la referencia actualizada de sede_id
      const currentSedeId = sedeIdRef.current;
      
      // Verificar que tenemos sede_id antes de proceder
      if (!currentSedeId) {
        console.warn('⚠️ No hay sede_id, saltando carga de dashboard');
        return;
      }

      // Agregar sede_id a los filtros si existe
      const filtersWithSede = { ...filters, sede_id: currentSedeId };
      console.log('🔍 UseDashboard Filtros finales:', filtersWithSede);

      const [ordersData, statsData] = await Promise.all([
        dashboardService.getDashboardOrders(filtersWithSede),
        dashboardService.getDashboardStats(currentSedeId, filters)
      ]);

      setOrders(ordersData);
      setStats(statsData);

      console.log('✅ Dashboard cargado exitosamente');
      console.log('📊 Órdenes recibidas:', ordersData.length);
      console.log('📈 Estadísticas:', statsData);
      
      // Debug: Mostrar algunas órdenes de ejemplo
      if (ordersData.length > 0) {
        console.log('📋 Primeras 3 órdenes:', ordersData.slice(0, 3));
      } else {
        console.log('⚠️ No se recibieron órdenes desde el servicio');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al cargar dashboard';
      console.error('❌ Error al cargar dashboard:', err);
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

  // Cargar datos al montar el componente con protección contra bucles
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const loadInitialData = () => {
      // Pequeno delay para evitar bucles en el render inicial
      timeoutId = setTimeout(() => {
        const currentSedeId = sedeIdRef.current;
        if (currentSedeId && !loadingRef.current) {
          console.log('🔄 UseDashboard: Cargando datos iniciales para sede:', currentSedeId);
          loadDashboardOrders();
        }
      }, 100);
    };
    
    loadInitialData();
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [sede_id]); // Solo dependemos de sede_id, no de loadDashboardOrders

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

  // Configurar suscripción en tiempo real
  useRealtimeOrders({
    sedeId: sedeIdRef.current?.toString(),
    onOrderUpdated: () => {
      console.log('🔄 Dashboard: Orden actualizada, recargando datos...');
      // Verificar que no estemos ya cargando
      if (!loadingRef.current) {
        loadDashboardOrders();
      }
    },
    onNewOrder: (order) => {
      console.log('📝 Dashboard: Nueva orden recibida:', order);
      toast({
        title: "Nueva orden",
        description: `Orden #${order.id} recibida`,
      });
    },
    onOrderStatusChanged: (orderId, newStatus) => {
      console.log(`📊 Dashboard: Orden #${orderId} cambió a ${newStatus}`);
      toast({
        title: "Estado actualizado",
        description: `Orden #${orderId} → ${newStatus}`,
      });
    }
  });

  return {
    orders,
    stats,
    loading,
    error,
    loadDashboardOrders,
    filterOrdersByStatus,
    refreshData,
    deleteOrder
  };
}; 