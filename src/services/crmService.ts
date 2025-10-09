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
      console.log('🔄 CRM: Obteniendo estadísticas...', { sedeId });

      // Obtener órdenes básicas con payment_id
      let ordersQuery = supabase
        .from('ordenes')
        .select(`
          id,
          created_at,
          status,
          cliente_id,
          sede_id,
          payment_id
        `);

      if (sedeId) {
        ordersQuery = ordersQuery.eq('sede_id', sedeId);
      }

      const { data: orders, error: ordersError } = await ordersQuery;
      if (ordersError) {
        console.error('❌ CRM: Error obteniendo órdenes:', ordersError);
        throw ordersError;
      }

      console.log('✅ CRM: Órdenes obtenidas:', orders?.length);

      // Obtener pagos usando payment_id de las órdenes
      const paymentIds = orders?.filter(o => o.payment_id).map(o => o.payment_id) || [];
      let totalRevenue = 0;

      if (paymentIds.length > 0) {
        const { data: pagos, error: pagosError } = await supabase
          .from('pagos')
          .select('id, total_pago')
          .in('id', paymentIds);

        if (pagosError) {
          console.warn('⚠️ CRM: Error obteniendo pagos:', pagosError);
        } else {
          totalRevenue = pagos?.reduce((sum, pago) => sum + (pago.total_pago || 0), 0) || 0;
        }
      }

      // Obtener clientes únicos que han hecho órdenes
      const uniqueClienteIds = [...new Set(orders?.map(o => o.cliente_id) || [])];
      let totalCustomers = 0;

      if (uniqueClienteIds.length > 0) {
        const { data: customers, error: customersError } = await supabase
          .from('clientes')
          .select('id')
          .in('id', uniqueClienteIds);

        if (customersError) {
          console.warn('⚠️ CRM: Error obteniendo clientes:', customersError);
        } else {
          totalCustomers = customers?.length || 0;
        }
      }

      // Calcular estadísticas
      console.log('📊 CRM: Calculando estadísticas...', { totalCustomers, totalOrders: orders?.length });

      // Clientes activos: que han hecho al menos una orden en los últimos 30 días
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentOrders = orders?.filter(o => new Date(o.created_at) >= thirtyDaysAgo) || [];
      const activeCustomerIds = [...new Set(recentOrders.map(o => o.cliente_id))];
      const activeCustomers = activeCustomerIds.length;

      const totalOrders = orders?.length || 0;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Obtener top clientes - manejo de errores graceful
      let topCustomers: CRMCustomer[] = [];
      try {
        topCustomers = await this.getTopCustomers(sedeId);
      } catch (error) {
        console.warn('⚠️ CRM: Error obteniendo top customers:', error);
      }

      const stats = {
        total_customers: totalCustomers,
        active_customers: activeCustomers,
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        average_order_value: averageOrderValue,
        top_customers: topCustomers
      };

      console.log('✅ CRM: Estadísticas calculadas:', stats);
      return stats;
    } catch (error) {
      console.error('❌ CRM: Error getting CRM stats:', error);
      // Retornar estadísticas vacías en lugar de hacer throw
      return {
        total_customers: 0,
        active_customers: 0,
        total_orders: 0,
        total_revenue: 0,
        average_order_value: 0,
        top_customers: []
      };
    }
  }

  // Obtener lista de clientes con estadísticas
  async getCRMCustomers(sedeId?: string): Promise<CRMCustomer[]> {
    try {
      console.log('🔄 CRM: Obteniendo lista de clientes...', { sedeId });

      // Obtener órdenes básicas con payment_id
      let ordersQuery = supabase
        .from('ordenes')
        .select(`
          id,
          created_at,
          status,
          cliente_id,
          sede_id,
          payment_id
        `);

      if (sedeId) {
        ordersQuery = ordersQuery.eq('sede_id', sedeId);
      }

      const { data: orders, error: ordersError } = await ordersQuery;
      if (ordersError) {
        console.error('❌ CRM: Error obteniendo órdenes:', ordersError);
        throw ordersError;
      }

      console.log('✅ CRM: Órdenes obtenidas para clientes:', orders?.length);

      // Obtener clientes únicos de las órdenes
      const uniqueClienteIds = [...new Set(orders?.map(o => o.cliente_id) || [])];

      if (uniqueClienteIds.length === 0) {
        console.log('ℹ️ CRM: No hay clientes con órdenes');
        return [];
      }

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

      if (customersError) {
        console.error('❌ CRM: Error obteniendo información de clientes:', customersError);
        throw customersError;
      }

      if (!customers) {
        console.log('ℹ️ CRM: No se encontraron clientes');
        return [];
      }

      console.log('✅ CRM: Clientes obtenidos:', customers.length);

      // Obtener pagos usando payment_id de las órdenes
      const paymentIds = orders?.filter(o => o.payment_id).map(o => o.payment_id) || [];
      let pagosMap: Record<number, number> = {};

      if (paymentIds.length > 0) {
        const { data: pagos, error: pagosError } = await supabase
          .from('pagos')
          .select('id, total_pago')
          .in('id', paymentIds);

        if (pagosError) {
          console.warn('⚠️ CRM: Error obteniendo pagos, usando valores por defecto:', pagosError);
        } else {
          pagosMap = pagos?.reduce((acc, pago) => {
            acc[pago.id] = pago.total_pago || 0;
            return acc;
          }, {} as Record<number, number>) || {};
        }
      }

      // Para cada cliente, calcular estadísticas de órdenes
      const customersWithStats = customers.map((customer) => {
        // Filtrar órdenes de este cliente
        const customerOrders = orders?.filter(o => o.cliente_id === customer.id) || [];

        const totalOrders = customerOrders.length;
        const totalSpent = customerOrders.reduce((sum, order) => sum + (order.payment_id ? pagosMap[order.payment_id] || 0 : 0), 0);
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
      const sortedCustomers = customersWithStats.sort((a, b) => b.total_spent - a.total_spent);
      console.log('✅ CRM: Clientes procesados con estadísticas:', sortedCustomers.length);

      return sortedCustomers;
    } catch (error) {
      console.error('❌ CRM: Error getting CRM customers:', error);
      // Retornar array vacío en lugar de hacer throw
      return [];
    }
  }

  // Obtener órdenes de un cliente específico
  async getCustomerOrders(customerId: string, limit: number = 10, sedeId?: string): Promise<CRMOrder[]> {
    try {
      console.log('🔄 CRM: Obteniendo órdenes del cliente:', customerId);

      // Obtener órdenes básicas del cliente
      let ordersQuery = supabase
        .from('ordenes')
        .select(`
          id,
          created_at,
          status,
          cliente_id,
          repartidor_id,
          address,
          payment_id,
          sede_id
        `)
        .eq('cliente_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (sedeId) {
        ordersQuery = ordersQuery.eq('sede_id', sedeId);
      }

      const { data: orders, error: ordersError } = await ordersQuery;

      if (ordersError) {
        console.error('❌ CRM: Error obteniendo órdenes del cliente:', ordersError);
        throw ordersError;
      }

      if (!orders || orders.length === 0) {
        console.log('ℹ️ CRM: No se encontraron órdenes para el cliente');
        return [];
      }

      console.log('✅ CRM: Órdenes del cliente obtenidas:', orders.length);

      // Obtener información del cliente
      const { data: cliente, error: clienteError } = await supabase
        .from('clientes')
        .select('nombre, telefono')
        .eq('id', customerId)
        .single();

      if (clienteError) {
        console.warn('⚠️ CRM: Error obteniendo datos del cliente:', clienteError);
      }

      // Obtener pagos usando payment_id de las órdenes
      const paymentIds = orders.filter(o => o.payment_id).map(o => o.payment_id);
      let pagosMap: Record<number, number> = {};

      if (paymentIds.length > 0) {
        const { data: pagos, error: pagosError } = await supabase
          .from('pagos')
          .select('id, total_pago')
          .in('id', paymentIds);

        if (pagosError) {
          console.warn('⚠️ CRM: Error obteniendo pagos del cliente:', pagosError);
        } else {
          pagosMap = pagos?.reduce((acc, pago) => {
            acc[pago.id] = pago.total_pago || 0;
            return acc;
          }, {} as Record<number, number>) || {};
        }
      }

      // Obtener información de repartidores para las órdenes que tienen repartidor
      const repartidorIds = orders.filter(o => o.repartidor_id).map(o => o.repartidor_id);
      let repartidoresMap: Record<string, string> = {};

      if (repartidorIds.length > 0) {
        const { data: repartidores, error: repartidoresError } = await supabase
          .from('repartidores')
          .select('id, nombre')
          .in('id', repartidorIds);

        if (repartidoresError) {
          console.warn('⚠️ CRM: Error obteniendo repartidores:', repartidoresError);
        } else {
          repartidoresMap = repartidores?.reduce((acc, rep) => {
            acc[rep.id] = rep.nombre;
            return acc;
          }, {} as Record<string, string>) || {};
        }
      }

      // Procesar cada orden para obtener conteos y detalles
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
            total_amount: order.payment_id ? pagosMap[order.payment_id] || 0 : 0,
            cliente_name: cliente?.nombre || 'Cliente desconocido',
            cliente_telefono: cliente?.telefono || '',
            cliente_direccion: order.address || 'Sin dirección',
            repartidor_name: order.repartidor_id ? repartidoresMap[order.repartidor_id] : undefined,
            platos_count: platosCount || 0,
            bebidas_count: bebidasCount || 0
          };
        })
      );

      console.log('✅ CRM: Órdenes del cliente procesadas:', ordersWithDetails.length);
      return ordersWithDetails;
    } catch (error) {
      console.error('❌ CRM: Error getting user orders:', error);
      // Retornar array vacío en lugar de hacer throw
      return [];
    }
  }

  // Obtener top clientes por número de órdenes
  private async getTopCustomers(sedeId?: string, limit: number = 5): Promise<CRMCustomer[]> {
    try {
      console.log('🔄 CRM: Obteniendo top customers...', { sedeId, limit });

      // Obtener órdenes básicas con payment_id
      let ordersQuery = supabase
        .from('ordenes')
        .select('id, cliente_id, sede_id, payment_id');

      if (sedeId) {
        ordersQuery = ordersQuery.eq('sede_id', sedeId);
      }

      const { data: orders, error: ordersError } = await ordersQuery;
      if (ordersError) {
        console.error('❌ CRM: Error obteniendo órdenes para top customers:', ordersError);
        throw ordersError;
      }

      if (!orders || orders.length === 0) {
        console.log('ℹ️ CRM: No hay órdenes para calcular top customers');
        return [];
      }

      // Obtener pagos usando payment_id
      const paymentIds = orders.filter(o => o.payment_id).map(o => o.payment_id);
      let pagosMap: Record<number, number> = {};

      if (paymentIds.length > 0) {
        const { data: pagos, error: pagosError } = await supabase
          .from('pagos')
          .select('id, total_pago')
          .in('id', paymentIds);

        if (pagosError) {
          console.warn('⚠️ CRM: Error obteniendo pagos para top customers:', pagosError);
        } else {
          pagosMap = pagos?.reduce((acc, pago) => {
            acc[pago.id] = pago.total_pago || 0;
            return acc;
          }, {} as Record<number, number>) || {};
        }
      }

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
        acc[customerId].total_spent += order.payment_id ? pagosMap[order.payment_id] || 0 : 0;
        return acc;
      }, {} as Record<string, { total_orders: number; total_spent: number }>);

      // Obtener top clientes por total gastado
      const topCustomerIds = Object.entries(customerStats)
        .sort(([,a], [,b]) => b.total_spent - a.total_spent)
        .slice(0, limit)
        .map(([customerId]) => customerId);

      if (topCustomerIds.length === 0) {
        console.log('ℹ️ CRM: No hay top customers');
        return [];
      }

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

      if (customersError) {
        console.error('❌ CRM: Error obteniendo datos de top customers:', customersError);
        throw customersError;
      }

      if (!customers) {
        console.log('ℹ️ CRM: No se encontraron datos de top customers');
        return [];
      }

      // Combinar información del cliente con estadísticas
      const topCustomers = customers.map(customer => {
        const stats = customerStats[customer.id];
        return {
          ...customer,
          total_orders: stats.total_orders,
          total_spent: stats.total_spent,
          last_order_date: undefined, // Se puede calcular si es necesario
          average_order_value: stats.total_orders > 0 ? stats.total_spent / stats.total_orders : 0
        };
      }).sort((a, b) => b.total_spent - a.total_spent);

      console.log('✅ CRM: Top customers calculados:', topCustomers.length);
      return topCustomers;
    } catch (error) {
      console.error('❌ CRM: Error getting top customers:', error);
      return [];
    }
  }
}

export const crmService = new CRMService();
