import { supabase } from '@/lib/supabase';

export interface CRMUser {
  id: string;
  nickname: string;
  display_name: string;
  role: string;
  sede_id: string;
  sede_name?: string;
  is_active: boolean;
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
  total_users: number;
  active_users: number;
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
  top_users: CRMUser[];
}

class CRMService {
  // Obtener estadísticas generales de CRM
  async getCRMStats(sedeId?: string): Promise<CRMStats> {
    try {
      // Obtener usuarios de la sede
      let usersQuery = supabase
        .from('profiles')
        .select(`
          id,
          nickname,
          display_name,
          role,
          sede_id,
          is_active,
          created_at,
          updated_at
        `);

      if (sedeId) {
        usersQuery = usersQuery.eq('sede_id', sedeId);
      }

      const { data: users, error: usersError } = await usersQuery;
      if (usersError) throw usersError;

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

      // Calcular estadísticas
      const totalUsers = users?.length || 0;
      const activeUsers = users?.filter(u => u.is_active).length || 0;
      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, order) => sum + (order.pagos?.total_pago || 0), 0) || 0;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Obtener top usuarios (usuarios con más órdenes)
      const topUsers = await this.getTopUsers(sedeId);

      return {
        total_users: totalUsers,
        active_users: activeUsers,
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        average_order_value: averageOrderValue,
        top_users: topUsers
      };
    } catch (error) {
      console.error('Error getting CRM stats:', error);
      throw error;
    }
  }

  // Obtener lista de usuarios con estadísticas
  async getCRMUsers(sedeId?: string): Promise<CRMUser[]> {
    try {
      // Obtener usuarios
      let usersQuery = supabase
        .from('profiles')
        .select(`
          id,
          nickname,
          display_name,
          role,
          sede_id,
          is_active,
          created_at,
          updated_at
        `);

      if (sedeId) {
        usersQuery = usersQuery.eq('sede_id', sedeId);
      }

      const { data: users, error: usersError } = await usersQuery;
      if (usersError) throw usersError;

      if (!users) return [];

      // Para cada usuario, obtener estadísticas de órdenes
      const usersWithStats = await Promise.all(
        users.map(async (user) => {
           // Obtener órdenes del usuario
           const { data: orders, error: ordersError } = await supabase
             .from('ordenes')
             .select(`
               id,
               created_at,
               status,
               pagos!inner(total_pago)
             `)
             .eq('cliente_id', user.id);

          if (ordersError) {
            console.error('Error getting orders for user:', user.id, ordersError);
            return {
              ...user,
              sede_name: '', // Se llenará después
              total_orders: 0,
              total_spent: 0,
              last_order_date: undefined,
              average_order_value: 0
            };
          }

           const totalOrders = orders?.length || 0;
           const totalSpent = orders?.reduce((sum, order) => sum + (order.pagos?.total_pago || 0), 0) || 0;
           const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
          const lastOrderDate = orders && orders.length > 0 
            ? orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
            : undefined;

          return {
            ...user,
            sede_name: '', // Se llenará después
            total_orders: totalOrders,
            total_spent: totalSpent,
            last_order_date: lastOrderDate,
            average_order_value: averageOrderValue
          };
        })
      );

      // Obtener nombres de sedes
      const sedeIds = [...new Set(usersWithStats.map(u => u.sede_id))];
      const { data: sedes, error: sedesError } = await supabase
        .from('sedes')
        .select('id, name')
        .in('id', sedeIds);

      if (sedesError) {
        console.error('Error getting sedes:', sedesError);
      }

      // Mapear nombres de sedes
      const sedeMap = new Map(sedes?.map(s => [s.id, s.name]) || []);
      
      return usersWithStats.map(user => ({
        ...user,
        sede_name: sedeMap.get(user.sede_id) || 'Sede no encontrada'
      }));
    } catch (error) {
      console.error('Error getting CRM users:', error);
      throw error;
    }
  }

  // Obtener órdenes de un usuario específico
  async getUserOrders(userId: string, limit: number = 10): Promise<CRMOrder[]> {
    try {
       const { data: orders, error } = await supabase
         .from('ordenes')
         .select(`
           id,
           created_at,
           status,
           cliente_id,
           repartidor_id,
           clientes!inner(
             nombre,
             telefono,
             direccion
           ),
           repartidores(
             nombre
           ),
           pagos!inner(total_pago)
         `)
        .eq('cliente_id', userId)
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
             cliente_direccion: order.clientes?.direccion || '',
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

  // Obtener top usuarios por número de órdenes
  private async getTopUsers(sedeId?: string, limit: number = 5): Promise<CRMUser[]> {
    try {
      // Obtener usuarios con conteo de órdenes
      let query = supabase
        .from('profiles')
        .select(`
          id,
          nickname,
          display_name,
          role,
          sede_id,
          is_active,
          created_at,
          updated_at
        `);

      if (sedeId) {
        query = query.eq('sede_id', sedeId);
      }

      const { data: users, error: usersError } = await query;
      if (usersError) throw usersError;

      if (!users) return [];

      // Obtener conteo de órdenes para cada usuario
      const usersWithOrderCount = await Promise.all(
        users.map(async (user) => {
          const { count } = await supabase
            .from('ordenes')
            .select('*', { count: 'exact', head: true })
            .eq('cliente_id', user.id);

          return {
            ...user,
            sede_name: '',
            total_orders: count || 0,
            total_spent: 0,
            last_order_date: undefined,
            average_order_value: 0
          };
        })
      );

      // Ordenar por número de órdenes y tomar los primeros
      return usersWithOrderCount
        .sort((a, b) => b.total_orders - a.total_orders)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting top users:', error);
      return [];
    }
  }
}

export const crmService = new CRMService();
