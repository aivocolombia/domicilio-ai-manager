import { supabase } from '@/lib/supabase';

export interface DashboardOrder {
  id_display: string;
  cliente_nombre: string;
  cliente_telefono: string;
  direccion: string;
  sede: string;
  estado: string;
  pago_tipo: string;
  pago_estado: string;
  repartidor: string;
  total: number;
  entrega_hora: string;
  creado_hora: string;
  creado_fecha: string;
  orden_id: number;
  payment_id: number;
}

export interface DashboardFilters {
  estado?: string;
  limit?: number;
  offset?: number;
  sede_id?: string | number; // Support both string (UUID) and number
}

export class DashboardService {
  // Obtener órdenes para el dashboard
  async getDashboardOrders(filters: DashboardFilters = {}): Promise<DashboardOrder[]> {
    try {
      console.log('📊 DashboardService: Consultando órdenes del dashboard...');
      console.log('🔍 DashboardService: Filtros aplicados:', filters);

      // Construir la query base
      let query = supabase
        .from('ordenes')
        .select(`
          id,
          status,
          payment_id,
          hora_entrega,
          created_at,
          cliente_id,
          repartidor_id,
          sede_id,
          clientes!inner(nombre, telefono, direccion),
          pagos!left(type, status, total_pago),
          repartidores!left(nombre),
          sedes!left(name)
        `)
        .order('created_at', { ascending: false });

      // IMPORTANTE: Aplicar filtros
      if (filters.estado) {
        console.log('🔍 DashboardService: Filtrando por estado:', filters.estado);
        query = query.eq('status', filters.estado);
      }

      // Filtrar por sede (obligatorio para seguridad)
      if (filters.sede_id) {
        console.log('🏢 DashboardService: Filtrando por sede_id:', filters.sede_id);
        query = query.eq('sede_id', filters.sede_id);
      } else {
        console.log('⚠️ DashboardService: NO SE PROPORCIONÓ SEDE_ID - esto puede causar problemas');
      }

      if (filters.limit) {
        console.log('🔢 DashboardService: Limitando a:', filters.limit);
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      console.log('🔍 DashboardService: Ejecutando query...');
      const { data, error } = await query;

      if (error) {
        console.error('❌ DashboardService: Error al obtener órdenes del dashboard:', error);
        throw new Error(`Error al obtener órdenes: ${error.message}`);
      }

      console.log('✅ DashboardService: Query exitosa');
      console.log('📊 DashboardService: Datos recibidos:', data?.length || 0, 'órdenes');

      if (!data || data.length === 0) {
        console.log('ℹ️ DashboardService: No hay órdenes para mostrar');
        
        // Debug: intentar una query más simple para ver si hay órdenes en la tabla
        console.log('🔍 DashboardService: Intentando query simple para debug...');
        const { data: simpleData, error: simpleError } = await supabase
          .from('ordenes')
          .select('id, status, sede_id, created_at')
          .limit(5);
        
        if (simpleError) {
          console.error('❌ DashboardService: Error en query simple:', simpleError);
        } else {
          console.log('📊 DashboardService: Query simple encontró:', simpleData?.length || 0, 'órdenes');
          console.log('📋 DashboardService: Muestra de órdenes:', simpleData);
        }
        
        // Debug: verificar sedes disponibles
        console.log('🔍 DashboardService: Verificando sedes disponibles...');
        const { data: sedesData, error: sedesError } = await supabase
          .from('sedes')
          .select('id, name, is_active');
        
        if (sedesError) {
          console.error('❌ DashboardService: Error al consultar sedes:', sedesError);
        } else {
          console.log('🏢 DashboardService: Sedes encontradas:', sedesData);
        }
        
        return [];
      }

      // Transformar los datos al formato esperado
      const transformedOrders: DashboardOrder[] = data.map(order => ({
        id_display: `ORD-${order.id.toString().padStart(4, '0')}`,
        cliente_nombre: order.clientes?.nombre || 'Sin nombre',
        cliente_telefono: order.clientes?.telefono || 'Sin teléfono',
        direccion: order.clientes?.direccion || 'Sin dirección',
        sede: order.sedes?.name || 'Sin sede',
        estado: order.status || 'Desconocido',
        pago_tipo: order.pagos?.type || 'Sin pago',
        pago_estado: this.mapPaymentStatus(order.pagos?.status),
        repartidor: order.repartidores?.nombre || 'Sin asignar',
        total: order.pagos?.total_pago || 0,
        entrega_hora: order.hora_entrega ? 
          new Date(order.hora_entrega).toLocaleTimeString('es-CO', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
          }) : 'No definida',
        creado_hora: new Date(order.created_at).toLocaleTimeString('es-CO', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }),
        creado_fecha: new Date(order.created_at).toLocaleDateString('es-CO'),
        orden_id: order.id,
        payment_id: order.payment_id || 0
      }));

      console.log('✅ Órdenes del dashboard obtenidas:', transformedOrders.length);
      return transformedOrders;
    } catch (error) {
      console.error('❌ Error en getDashboardOrders:', error);
      throw error;
    }
  }

  // Mapear estado de pago
  private mapPaymentStatus(status?: string): string {
    switch (status) {
      case 'paid': return 'Pagado';
      case 'pending': return 'Pendiente';
      case 'failed': return 'Fallido';
      default: return 'Desconocido';
    }
  }

  // Obtener estadísticas del dashboard
  async getDashboardStats(sede_id?: string | number) {
    try {
      console.log('📊 Consultando estadísticas del dashboard...');
      console.log('🏢 Sede ID:', sede_id);

      // Construir query base para estadísticas
      let query = supabase
        .from('ordenes')
        .select('status');

      // Filtrar por sede si se proporciona
      if (sede_id) {
        query = query.eq('sede_id', sede_id);
      }

      const { data: statusCounts, error: statusError } = await query;

      if (statusError) {
        console.error('❌ Error al obtener estadísticas de estado:', statusError);
        throw new Error(`Error al obtener estadísticas: ${statusError.message}`);
      }

      // Calcular estadísticas
      const stats = {
        total: statusCounts?.length || 0,
        recibidos: statusCounts?.filter(o => o.status === 'Recibidos').length || 0,
        cocina: statusCounts?.filter(o => o.status === 'Cocina').length || 0,
        camino: statusCounts?.filter(o => o.status === 'Camino').length || 0,
        entregados: statusCounts?.filter(o => o.status === 'Entregados').length || 0,
        cancelados: statusCounts?.filter(o => o.status === 'Cancelado').length || 0
      };

      console.log('✅ Estadísticas del dashboard obtenidas:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Error en getDashboardStats:', error);
      throw error;
    }
  }
}

export const dashboardService = new DashboardService(); 