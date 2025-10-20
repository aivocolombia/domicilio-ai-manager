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
  sede_nombre?: string;
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

      // NUEVO: Obtener TODAS las órdenes sin límite usando paginación
      let allOrders: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let ordersQuery = supabase
          .from('ordenes')
          .select(`
            id,
            created_at,
            status,
            cliente_id,
            sede_id,
            payment_id,
            payment_id_2
          `)
          .range(offset, offset + batchSize - 1);

        if (sedeId) {
          ordersQuery = ordersQuery.eq('sede_id', sedeId);
        }

        const { data: ordersBatch, error: ordersError } = await ordersQuery;

        if (ordersError) {
          console.error('❌ CRM: Error obteniendo órdenes:', ordersError);
          throw ordersError;
        }

        if (!ordersBatch || ordersBatch.length === 0) {
          hasMore = false;
        } else {
          allOrders = allOrders.concat(ordersBatch);

          // Si obtuvimos menos de batchSize, no hay más datos
          if (ordersBatch.length < batchSize) {
            hasMore = false;
          } else {
            offset += batchSize;
          }
        }
      }

      const orders = allOrders;

      console.log('✅ CRM: Órdenes obtenidas:', orders?.length);

      // Obtener pagos usando payment_id Y payment_id_2 de las órdenes
      const paymentIds1 = orders?.filter(o => o.payment_id).map(o => o.payment_id) || [];
      const paymentIds2 = orders?.filter(o => o.payment_id_2).map(o => o.payment_id_2) || [];
      const paymentIds = [...new Set([...paymentIds1, ...paymentIds2])];
      let totalRevenue = 0;

      console.log(`🔄 CRM Stats: Obteniendo ${paymentIds.length} pagos únicos (incluyendo payment_id_2)...`);

      if (paymentIds.length > 0) {
        // NUEVO: Dividir en lotes para evitar límites de .in()
        const batchSize = 1000;
        let allPagos: any[] = [];

        for (let i = 0; i < paymentIds.length; i += batchSize) {
          const batchIds = paymentIds.slice(i, i + batchSize);

          const { data: pagosBatch, error: pagosError } = await supabase
            .from('pagos')
            .select('id, total_pago')
            .in('id', batchIds);

          if (pagosError) {
            console.warn(`⚠️ CRM Stats: Error obteniendo lote de pagos (${i}-${i + batchSize}):`, pagosError);
          } else if (pagosBatch) {
            allPagos = allPagos.concat(pagosBatch);
          }
        }

        totalRevenue = allPagos.reduce((sum, pago) => sum + (pago.total_pago || 0), 0) || 0;
        console.log(`✅ CRM Stats: Total revenue calculado: ${totalRevenue} de ${allPagos.length} pagos`);
      }

      // Obtener clientes únicos que han hecho órdenes
      const uniqueClienteIds = [...new Set(orders?.map(o => o.cliente_id) || [])];
      let totalCustomers = 0;

      console.log(`🔄 CRM Stats: Verificando ${uniqueClienteIds.length} clientes únicos...`);

      if (uniqueClienteIds.length > 0) {
        // NUEVO: Paginar si hay muchos IDs
        let allCustomersCount = 0;
        const customerBatchSize = 1000;

        for (let i = 0; i < uniqueClienteIds.length; i += customerBatchSize) {
          const batchIds = uniqueClienteIds.slice(i, i + customerBatchSize);

          const { data: customers, error: customersError } = await supabase
            .from('clientes')
            .select('id')
            .in('id', batchIds);

          if (customersError) {
            console.warn(`⚠️ CRM Stats: Error obteniendo lote de clientes (${i}-${i + customerBatchSize}):`, customersError);
          } else {
            allCustomersCount += customers?.length || 0;
          }
        }

        totalCustomers = allCustomersCount;
        console.log(`✅ CRM Stats: Total clientes verificados: ${totalCustomers}`);
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

      // NUEVO: Obtener TODAS las órdenes sin límite usando paginación
      let allOrders: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let ordersQuery = supabase
          .from('ordenes')
          .select(`
            id,
            created_at,
            status,
            cliente_id,
            sede_id,
            payment_id,
            payment_id_2
          `)
          .range(offset, offset + batchSize - 1);

        if (sedeId) {
          ordersQuery = ordersQuery.eq('sede_id', sedeId);
        }

        const { data: ordersBatch, error: ordersError } = await ordersQuery;

        if (ordersError) {
          console.error('❌ CRM: Error obteniendo órdenes:', ordersError);
          throw ordersError;
        }

        if (!ordersBatch || ordersBatch.length === 0) {
          hasMore = false;
        } else {
          allOrders = allOrders.concat(ordersBatch);
          console.log(`✅ CRM: Lote obtenido: ${ordersBatch.length} órdenes (total: ${allOrders.length})`);

          // Si obtuvimos menos de batchSize, no hay más datos
          if (ordersBatch.length < batchSize) {
            hasMore = false;
          } else {
            offset += batchSize;
          }
        }
      }

      const orders = allOrders;
      const { error: ordersError } = { error: null }; // Ya manejamos errores arriba
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

      // Obtener información de clientes - PAGINAR si hay muchos IDs
      console.log(`🔄 CRM: Obteniendo información de ${uniqueClienteIds.length} clientes únicos...`);

      let allCustomers: any[] = [];
      const customerBatchSize = 1000;

      for (let i = 0; i < uniqueClienteIds.length; i += customerBatchSize) {
        const batchIds = uniqueClienteIds.slice(i, i + customerBatchSize);

        const { data: customersBatch, error: customersError } = await supabase
          .from('clientes')
          .select(`
            id,
            nombre,
            telefono,
            direccion,
            created_at,
            updated_at
          `)
          .in('id', batchIds);

        if (customersError) {
          console.error(`❌ CRM: Error obteniendo lote de clientes (${i}-${i + customerBatchSize}):`, customersError);
          throw customersError;
        }

        if (customersBatch) {
          allCustomers = allCustomers.concat(customersBatch);
          console.log(`✅ CRM: Lote de clientes obtenido: ${customersBatch.length} (total: ${allCustomers.length})`);
        }
      }

      const customers = allCustomers;

      if (!customers || customers.length === 0) {
        console.log('ℹ️ CRM: No se encontraron clientes');
        return [];
      }

      console.log('✅ CRM: Clientes obtenidos:', customers.length);

      // Obtener pagos usando payment_id Y payment_id_2 de las órdenes
      const paymentIds1 = orders?.filter(o => o.payment_id).map(o => o.payment_id) || [];
      const paymentIds2 = orders?.filter(o => o.payment_id_2).map(o => o.payment_id_2) || [];
      const paymentIds = [...new Set([...paymentIds1, ...paymentIds2])];
      let pagosMap: Record<number, number> = {};

      console.log(`🔄 CRM: Obteniendo ${paymentIds.length} pagos únicos (incluyendo payment_id_2)...`);

      if (paymentIds.length > 0) {
        // NUEVO: Dividir en lotes para evitar límites de .in()
        const batchSize = 1000; // Supabase tiene límite en .in()
        let allPagos: any[] = [];

        for (let i = 0; i < paymentIds.length; i += batchSize) {
          const batchIds = paymentIds.slice(i, i + batchSize);

          const { data: pagosBatch, error: pagosError } = await supabase
            .from('pagos')
            .select('id, total_pago')
            .in('id', batchIds);

          if (pagosError) {
            console.warn(`⚠️ CRM: Error obteniendo lote de pagos (${i}-${i + batchSize}):`, pagosError);
          } else if (pagosBatch) {
            allPagos = allPagos.concat(pagosBatch);
            console.log(`✅ CRM: Lote de pagos obtenido: ${pagosBatch.length} (total: ${allPagos.length})`);
          }
        }

        pagosMap = allPagos.reduce((acc, pago) => {
          acc[pago.id] = pago.total_pago || 0;
          return acc;
        }, {} as Record<number, number>) || {};

        console.log(`✅ CRM: Total pagos en mapa: ${Object.keys(pagosMap).length}`);
      }

      // Para cada cliente, calcular estadísticas de órdenes
      const customersWithStats = customers.map((customer) => {
        // Filtrar órdenes de este cliente
        const customerOrders = orders?.filter(o => o.cliente_id === customer.id) || [];

        const totalOrders = customerOrders.length;
        // CORREGIDO: Sumar AMBOS payment_id y payment_id_2
        const totalSpent = customerOrders.reduce((sum, order) => {
          const pago1 = order.payment_id ? (pagosMap[order.payment_id] || 0) : 0;
          const pago2 = order.payment_id_2 ? (pagosMap[order.payment_id_2] || 0) : 0;
          return sum + pago1 + pago2;
        }, 0);
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
          payment_id_2,
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

      // Obtener pagos usando payment_id Y payment_id_2 de las órdenes
      const paymentIds1 = orders.filter(o => o.payment_id).map(o => o.payment_id);
      const paymentIds2 = orders.filter(o => o.payment_id_2).map(o => o.payment_id_2);
      const paymentIds = [...new Set([...paymentIds1, ...paymentIds2])];
      let pagosMap: Record<number, number> = {};

      console.log(`🔄 CRM Customer Orders: Obteniendo ${paymentIds.length} pagos (incluyendo payment_id_2)...`);

      if (paymentIds.length > 0) {
        // Aunque sea un límite pequeño, mantener consistencia con la paginación
        const batchSize = 1000;
        let allPagos: any[] = [];

        for (let i = 0; i < paymentIds.length; i += batchSize) {
          const batchIds = paymentIds.slice(i, i + batchSize);

          const { data: pagosBatch, error: pagosError } = await supabase
            .from('pagos')
            .select('id, total_pago')
            .in('id', batchIds);

          if (pagosError) {
            console.warn(`⚠️ CRM Customer Orders: Error obteniendo pagos:`, pagosError);
          } else if (pagosBatch) {
            allPagos = allPagos.concat(pagosBatch);
          }
        }

        pagosMap = allPagos.reduce((acc, pago) => {
          acc[pago.id] = pago.total_pago || 0;
          return acc;
        }, {} as Record<number, number>) || {};

        console.log(`✅ CRM Customer Orders: ${Object.keys(pagosMap).length} pagos obtenidos`);
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

      // NUEVO: Obtener información de sedes para las órdenes
      const sedeIds = [...new Set(orders.filter(o => o.sede_id).map(o => o.sede_id))];
      let sedesMap: Record<string, string> = {};

      console.log('🔍 CRM Customer Orders: Sede IDs encontrados:', sedeIds);

      if (sedeIds.length > 0) {
        const { data: sedes, error: sedesError } = await supabase
          .from('sedes')
          .select('id, name')
          .in('id', sedeIds);

        if (sedesError) {
          console.error('❌ CRM: Error obteniendo sedes:', {
            error: sedesError,
            message: sedesError.message,
            details: sedesError.details,
            hint: sedesError.hint,
            code: sedesError.code,
            sedeIds: sedeIds
          });
        } else {
          sedesMap = sedes?.reduce((acc, sede) => {
            acc[sede.id] = sede.name;
            return acc;
          }, {} as Record<string, string>) || {};
          console.log('✅ CRM Customer Orders: Sedes mapeadas:', sedesMap);
        }
        console.log(`✅ CRM Customer Orders: ${Object.keys(sedesMap).length} sedes obtenidas`);
      } else {
        console.warn('⚠️ CRM Customer Orders: No se encontraron sede_ids en las órdenes');
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

          // CORREGIDO: Sumar AMBOS payment_id y payment_id_2
          const pago1 = order.payment_id ? (pagosMap[order.payment_id] || 0) : 0;
          const pago2 = order.payment_id_2 ? (pagosMap[order.payment_id_2] || 0) : 0;

          const sedeNombre = order.sede_id ? sedesMap[order.sede_id] : undefined;

          // Log para debug
          if (order.sede_id) {
            console.log(`🏢 Orden ${order.id}: sede_id=${order.sede_id}, sede_nombre=${sedeNombre}`);
          }

          return {
            id: order.id,
            order_at: order.created_at,
            status: order.status,
            total_amount: pago1 + pago2,
            cliente_name: cliente?.nombre || 'Cliente desconocido',
            cliente_telefono: cliente?.telefono || '',
            cliente_direccion: order.address || 'Sin dirección',
            repartidor_name: order.repartidor_id ? repartidoresMap[order.repartidor_id] : undefined,
            platos_count: platosCount || 0,
            bebidas_count: bebidasCount || 0,
            sede_nombre: sedeNombre
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

      // NUEVO: Obtener TODAS las órdenes sin límite usando paginación
      let allOrders: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let ordersQuery = supabase
          .from('ordenes')
          .select('id, cliente_id, sede_id, payment_id, payment_id_2')
          .range(offset, offset + batchSize - 1);

        if (sedeId) {
          ordersQuery = ordersQuery.eq('sede_id', sedeId);
        }

        const { data: ordersBatch, error: ordersError } = await ordersQuery;

        if (ordersError) {
          console.error('❌ CRM: Error obteniendo órdenes para top customers:', ordersError);
          throw ordersError;
        }

        if (!ordersBatch || ordersBatch.length === 0) {
          hasMore = false;
        } else {
          allOrders = allOrders.concat(ordersBatch);

          if (ordersBatch.length < batchSize) {
            hasMore = false;
          } else {
            offset += batchSize;
          }
        }
      }

      const orders = allOrders;

      if (!orders || orders.length === 0) {
        console.log('ℹ️ CRM: No hay órdenes para calcular top customers');
        return [];
      }

      // Obtener pagos usando payment_id Y payment_id_2
      const paymentIds1 = orders.filter(o => o.payment_id).map(o => o.payment_id);
      const paymentIds2 = orders.filter(o => o.payment_id_2).map(o => o.payment_id_2);
      const paymentIds = [...new Set([...paymentIds1, ...paymentIds2])];
      let pagosMap: Record<number, number> = {};

      console.log(`🔄 CRM Top Customers: Obteniendo ${paymentIds.length} pagos únicos (incluyendo payment_id_2)...`);

      if (paymentIds.length > 0) {
        // NUEVO: Dividir en lotes para evitar límites de .in()
        const batchSize = 1000;
        let allPagos: any[] = [];

        for (let i = 0; i < paymentIds.length; i += batchSize) {
          const batchIds = paymentIds.slice(i, i + batchSize);

          const { data: pagosBatch, error: pagosError } = await supabase
            .from('pagos')
            .select('id, total_pago')
            .in('id', batchIds);

          if (pagosError) {
            console.warn(`⚠️ CRM Top Customers: Error obteniendo lote de pagos (${i}-${i + batchSize}):`, pagosError);
          } else if (pagosBatch) {
            allPagos = allPagos.concat(pagosBatch);
          }
        }

        pagosMap = allPagos.reduce((acc, pago) => {
          acc[pago.id] = pago.total_pago || 0;
          return acc;
        }, {} as Record<number, number>) || {};

        console.log(`✅ CRM Top Customers: Total pagos en mapa: ${Object.keys(pagosMap).length}`);
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
        // CORREGIDO: Sumar AMBOS payment_id y payment_id_2
        const pago1 = order.payment_id ? (pagosMap[order.payment_id] || 0) : 0;
        const pago2 = order.payment_id_2 ? (pagosMap[order.payment_id_2] || 0) : 0;
        acc[customerId].total_spent += pago1 + pago2;
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
