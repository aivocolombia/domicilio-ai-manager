import { useState, useCallback, useEffect } from 'react';
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

  // Cargar órdenes del dashboard
  const loadDashboardOrders = useCallback(async (filters: DashboardFilters = {}) => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Cargando órdenes del dashboard...');
      console.log('🏢 UseDashboard Sede ID:', sede_id);
      console.log('🔍 UseDashboard Filtros:', filters);

      // Agregar sede_id a los filtros si existe
      const filtersWithSede = sede_id ? { ...filters, sede_id } : filters;
      console.log('🔍 UseDashboard Filtros finales:', filtersWithSede);

      const [ordersData, statsData] = await Promise.all([
        dashboardService.getDashboardOrders(filtersWithSede),
        dashboardService.getDashboardStats(sede_id)
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
      setLoading(false);
    }
  }, [toast, sede_id]);

  // Cargar datos al montar el componente
  useEffect(() => {
    if (sede_id) {
      loadDashboardOrders();
    }
  }, [loadDashboardOrders, sede_id]);

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

  // Configurar suscripción en tiempo real
  useRealtimeOrders({
    sedeId: sede_id?.toString(),
    onOrderUpdated: () => {
      console.log('🔄 Dashboard: Orden actualizada, recargando datos...');
      loadDashboardOrders();
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
    refreshData
  };
}; 