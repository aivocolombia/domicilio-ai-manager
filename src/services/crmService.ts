import { supabase } from '@/lib/supabase';

export interface CRMCustomer {
  id: string;
  nombre: string;
  telefono: string;
  direccion: string;
  created_at: string;
  updated_at: string;
  total_orders: number;
  total_spent: number;
  last_order_date?: string;
  average_order_value: number;
}

export interface CRMOrder {
  id: string;
  order_at: string;
  status: string;
  total_amount: number;
  cliente_name: string;
  cliente_telefono: string;
  cliente_direccion: string;
  repartidor_name?: string;
  platos_count: number;
  bebidas_count: number;
}

export interface CRMStats {
  total_customers: number;
  active_customers: number;
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
  top_customers: CRMCustomer[];
}

class CRMService {
  // Obtener estadísticas generales de CRM
  async getCRMStats(sedeId?: string): Promise<CRMStats> {
    try {
      // Obtener estadísticas de órdenes
      let ordersQuery = supabase
        .from('ordenes')
        .select(`
          id,
          created_at,
          status,
          cliente_id,
          repartidor_id,
          sede_id,
          pagos!inner(total_pago)
        `);

      if (sedeId) {
        // Filtrar órdenes por sede directamente
        ordersQuery = ordersQuery.eq('sede_id', sedeId);
      }

      const { data: orders, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      // Obtener clientes únicos que han hecho órdenes
      const uniqueClienteIds = [...new Set(orders?.map(o => o.cliente_id) || [])];
      
      let customersQuery = supabase
        .from('clientes')
        .select(`
          id,
          nombre,
          telefono,
          direccion,
          created_at,
          updated_at
        `);

      // Si hay filtro por sede, solo obtener clientes que han hecho órdenes en esa sede
      if (uniqueClienteIds.length > 0) {
        customersQuery = customersQuery.in('id', uniqueClienteIds);
      }

      const { data: customers, error: customersError } = await customersQuery;
      if (customersError) throw customersError;

      // Calcular estadísticas
      const totalCustomers = customers?.length || 0;
      
      // Clientes activos: que han hecho al menos una orden en los últimos 30 días
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentOrders = orders?.filter(o => new Date(o.created_at) >= thirtyDaysAgo) || [];
      const activeCustomerIds = [...new Set(recentOrders.map(o => o.cliente_id))];
      const activeCustomers = activeCustomerIds.length;
      
      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, order) => sum + (order.pagos?.total_pago || 0), 0) || 0;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Obtener top clientes (clientes con más órdenes)
      const topCustomers = await this.getTopCustomers(sedeId);

      return {
        total_customers: totalCustomers,
        active_customers: activeCustomers,
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        average_order_value: averageOrderValue,
        top_customers: topCustomers
      };
    } catch (error) {
      console.error('Error getting CRM stats:', error);
      throw error;
    }
  }

  // Obtener lista de clientes con estadísticas
  async getCRMCustomers(sedeId?: string): Promise<CRMCustomer[]> {
    try {
      // Primero obtener todas las órdenes (filtradas por sede si aplica)
      let ordersQuery = supabase
        .from('ordenes')
        .select(`
          id,
          created_at,
          status,
          cliente_id,
          sede_id,
          pagos!inner(total_pago)
        `);

      if (sedeId) {
        ordersQuery = ordersQuery.eq('sede_id', sedeId);
      }

      const { data: orders, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      // Obtener clientes únicos de las órdenes
      const uniqueClienteIds = [...new Set(orders?.map(o => o.cliente_id) || [])];
      
      if (uniqueClienteIds.length === 0) return [];

      // Obtener información de clientes
      const { data: customers, error: customersError } = await supabase
        .from('clientes')
        .select(`
          id,
          nombre,
          telefono,
          direccion,
          created_at,
          updated_at
        `)
        .in('id', uniqueClienteIds);

      if (customersError) throw customersError;

      if (!customers) return [];

      // Para cada cliente, calcular estadísticas de órdenes
      const customersWithStats = customers.map((customer) => {
        // Filtrar órdenes de este cliente
        const customerOrders = orders?.filter(o => o.cliente_id === customer.id) || [];
        
        const totalOrders = customerOrders.length;
        const totalSpent = customerOrders.reduce((sum, order) => sum + (order.pagos?.total_pago || 0), 0);
        const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
        const lastOrderDate = customerOrders.length > 0 
          ? customerOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
          : undefined;

        return {
          ...customer,
          total_orders: totalOrders,
          total_spent: totalSpent,
          last_order_date: lastOrderDate,
          average_order_value: averageOrderValue
        };
      });

      // Ordenar por total gastado (mejores clientes primero)
      return customersWithStats.sort((a, b) => b.total_spent - a.total_spent);
    } catch (error) {
      console.error('Error getting CRM customers:', error);
      throw error;
    }
  }

  // Obtener órdenes de un cliente específico
  async getCustomerOrders(customerId: string, limit: number = 10): Promise<CRMOrder[]> {
    try {
       const { data: orders, error } = await supabase
         .from('ordenes')
         .select(`
           id,
           created_at,
           status,
           cliente_id,
           repartidor_id,
           address,
           clientes!inner(
             nombre,
             telefono
           ),
           repartidores(
             nombre
           ),
           pagos!inner(total_pago)
         `)
        .eq('cliente_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      if (!orders) return [];

      // Obtener conteo de platos y bebidas para cada orden
      const ordersWithDetails = await Promise.all(
        orders.map(async (order) => {
          // Contar platos
          const { count: platosCount } = await supabase
            .from('ordenes_platos')
            .select('*', { count: 'exact', head: true })
            .eq('orden_id', order.id);

          // Contar bebidas
          const { count: bebidasCount } = await supabase
            .from('ordenes_bebidas')
            .select('*', { count: 'exact', head: true })
            .eq('orden_id', order.id);

           return {
             id: order.id,
             order_at: order.created_at,
             status: order.status,
             total_amount: order.pagos?.total_pago || 0,
             cliente_name: order.clientes?.nombre || 'Cliente desconocido',
             cliente_telefono: order.clientes?.telefono || '',
             cliente_direccion: order.address || 'Sin dirección',
             repartidor_name: order.repartidores?.nombre,
             platos_count: platosCount || 0,
             bebidas_count: bebidasCount || 0
           };
        })
      );

      return ordersWithDetails;
    } catch (error) {
      console.error('Error getting user orders:', error);
      throw error;
    }
  }

  // Obtener top clientes por número de órdenes
  private async getTopCustomers(sedeId?: string, limit: number = 5): Promise<CRMCustomer[]> {
    try {
      // Obtener órdenes (filtradas por sede si aplica)
      let ordersQuery = supabase
        .from('ordenes')
        .select(`
          cliente_id,
          pagos!inner(total_pago)
        `);

      if (sedeId) {
        ordersQuery = ordersQuery.eq('sede_id', sedeId);
      }

      const { data: orders, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) return [];

      // Agrupar órdenes por cliente y calcular estadísticas
      const customerStats = orders.reduce((acc, order) => {
        const customerId = order.cliente_id;
        if (!acc[customerId]) {
          acc[customerId] = {
            total_orders: 0,
            total_spent: 0
          };
        }
        acc[customerId].total_orders += 1;
        acc[customerId].total_spent += order.pagos?.total_pago || 0;
        return acc;
      }, {} as Record<string, { total_orders: number; total_spent: number }>);

      // Obtener top clientes por total gastado
      const topCustomerIds = Object.entries(customerStats)
        .sort(([,a], [,b]) => b.total_spent - a.total_spent)
        .slice(0, limit)
        .map(([customerId]) => customerId);

      if (topCustomerIds.length === 0) return [];

      // Obtener información completa de los top clientes
      const { data: customers, error: customersError } = await supabase
        .from('clientes')
        .select(`
          id,
          nombre,
          telefono,
          direccion,
          created_at,
          updated_at
        `)
        .in('id', topCustomerIds);

      if (customersError) throw customersError;

      if (!customers) return [];

      // Combinar información del cliente con estadísticas
      return customers.map(customer => {
        const stats = customerStats[customer.id];
        return {
          ...customer,
          total_orders: stats.total_orders,
          total_spent: stats.total_spent,
          last_order_date: undefined, // Se puede calcular si es necesario
          average_order_value: stats.total_orders > 0 ? stats.total_spent / stats.total_orders : 0
        };
      }).sort((a, b) => b.total_spent - a.total_spent);
    } catch (error) {
      console.error('Error getting top customers:', error);
      return [];
    }
  }
}

export const crmService = new CRMService();
