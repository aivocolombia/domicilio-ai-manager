import { supabase } from '@/lib/supabase';
import { auditAndFixDateFilters } from '@/utils/timezoneAudit';

export interface DashboardOrder {
  id_display: string;
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_direccion?: string; // Dirección del cliente
  address: string; // Dirección específica de esta orden (no del cliente)
  sede: string;
  estado: string;
  pago_tipo: string;
  pago_estado: string;
  pago_metodo?: string; // Método de pago
  repartidor: string;
  total: number;
  total_orden?: number; // Total de la orden antes de descuentos
  entrega_hora: string;
  creado_hora: string;
  creado_fecha: string;
  orden_id: number;
  payment_id: number;
  minuta_id?: string; // ID diario de la minuta (ej: "1", "2", "3")
  source?: string; // Fuente de la orden: 'sede' o 'ai_agent'
  type_order?: string; // Tipo de orden: 'delivery' o 'pickup'
  // Discount fields
  descuento_valor?: number; // Valor del descuento aplicado
  descuento_comentario?: string; // Comentario del descuento
  descuento_aplicado_fecha?: string; // Fecha de aplicación del descuento
}

export interface DashboardFilters {
  estado?: string;
  limit?: number;
  offset?: number;
  sede_id?: string | number; // Support both string (UUID) and number
  fechaInicio?: string; // Fecha de inicio en formato ISO
  fechaFin?: string;    // Fecha de fin en formato ISO
  type_order?: 'delivery' | 'pickup'; // Filtro por tipo de orden
}

export class DashboardService {
  // Obtener órdenes para el dashboard
  async getDashboardOrders(filters: DashboardFilters = {}): Promise<DashboardOrder[]> {
    try {
      console.log('📊 DashboardService: Consultando órdenes del dashboard...');
      console.log('🔍 DashboardService: Filtros aplicados:', filters);
      
      // CRÍTICO: Validación obligatoria de sede_id
      if (!filters.sede_id) {
        throw new Error('sede_id es obligatorio para consultas de dashboard');
      }
      
      // Validar formato UUID de sede_id
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(filters.sede_id.toString())) {
        throw new Error('sede_id debe ser un UUID válido');
      }
      
      // Auditar y corregir fechas si es necesario
      const correctedFilters = auditAndFixDateFilters(filters);
      if (JSON.stringify(filters) !== JSON.stringify(correctedFilters)) {
        console.log('🔧 DashboardService: Filtros de fecha corregidos');
      }

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
          source,
          type_order,
          address,
          descuento_valor,
          descuento_comentario,
          descuento_aplicado_fecha,
          clientes!cliente_id(nombre, telefono, direccion),
          pagos!payment_id(type, status, total_pago),
          repartidores!repartidor_id(nombre),
          sedes!sede_id(name),
          minutas!left(daily_id)
        `)
        .order('created_at', { ascending: false });

      // IMPORTANTE: Aplicar filtros
      if (filters.estado) {
        console.log('🔍 DashboardService: Filtrando por estado:', filters.estado);
        query = query.eq('status', filters.estado);
      }

      // Filtrar por sede (validación ya realizada arriba)
      console.log('🏢 DashboardService: Filtrando por sede_id:', filters.sede_id);
      query = query.eq('sede_id', filters.sede_id);

      // Filtrar por tipo de orden
      if (filters.type_order) {
        console.log('📦 DashboardService: Filtrando por tipo de orden:', filters.type_order);
        // Ahora que todas las órdenes tienen type_order asignado, filtrar directamente
        query = query.eq('type_order', filters.type_order);
      }

      // Filtros de fecha (usando filtros corregidos)
      if (correctedFilters.fechaInicio) {
        console.log('📅 DashboardService: Filtrando desde fecha:', correctedFilters.fechaInicio);
        query = query.gte('created_at', correctedFilters.fechaInicio);
      }
      
      if (correctedFilters.fechaFin) {
        console.log('📅 DashboardService: Filtrando hasta fecha:', correctedFilters.fechaFin);
        query = query.lte('created_at', correctedFilters.fechaFin);
      }

      if (filters.limit) {
        console.log('🔢 DashboardService: Limitando a:', filters.limit);
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      console.log('🔍 DashboardService: Ejecutando query...');
      
      // Debug: Mostrar la query SQL que se va a ejecutar
      console.log('🔍 DashboardService: Query SQL aproximada:', {
        table: 'ordenes',
        filters: {
          sede_id: filters.sede_id,
          estado: filters.estado,
          type_order: filters.type_order,
          fechaInicio: correctedFilters.fechaInicio,
          fechaFin: correctedFilters.fechaFin
        }
      });
      
      const { data, error } = await query;

      if (error) {
        console.error('❌ DashboardService: Error al obtener órdenes del dashboard:', error);
        throw new Error(`Error al obtener órdenes: ${error.message}`);
      }

      console.log('✅ DashboardService: Query exitosa');
      console.log('📊 DashboardService: Datos recibidos:', data?.length || 0, 'órdenes');
      
      // Debug: Mostrar las fechas de las órdenes encontradas
      if (data && data.length > 0) {
        console.log('🔍 DashboardService: Fechas de órdenes encontradas:');
        data.forEach((order, index) => {
          const createdAt = new Date(order.created_at);
          console.log(`  ${index + 1}. ID: ${order.id}, Created: ${createdAt.toLocaleDateString('es-CO')} ${createdAt.toLocaleTimeString('es-CO')}, Status: ${order.status}`);
        });
      }

      if (!data || data.length === 0) {
        console.log('ℹ️ DashboardService: No hay órdenes para mostrar');
        
        // Debug: intentar una query más simple para ver si hay órdenes en la tabla
        console.log('🔍 DashboardService: Intentando query simple para debug...');
        const { data: simpleData, error: simpleError } = await supabase
          .from('ordenes')
          .select('id, status, sede_id, created_at, type_order')
          .eq('sede_id', filters.sede_id)
          .limit(5);
        
        // Debug: Query con los mismos filtros pero sin JOINs
        console.log('🔍 DashboardService: Query con filtros pero sin JOINs...');
        console.log('🔍 DashboardService: Filtros aplicados:', {
          sede_id: filters.sede_id,
          type_order: filters.type_order,
          fechaInicio: correctedFilters.fechaInicio,
          fechaFin: correctedFilters.fechaFin
        });
        
        let debugQuery = supabase
          .from('ordenes')
          .select('id, status, sede_id, created_at, type_order')
          .eq('sede_id', filters.sede_id);
          
        console.log('🔍 DashboardService: Después de filtrar por sede_id:', filters.sede_id);
        
        if (filters.type_order) {
          console.log('🔍 DashboardService: Aplicando filtro type_order:', filters.type_order);
          debugQuery = debugQuery.eq('type_order', filters.type_order);
        }
        
        if (correctedFilters.fechaInicio) {
          console.log('🔍 DashboardService: Aplicando filtro fechaInicio:', correctedFilters.fechaInicio);
          debugQuery = debugQuery.gte('created_at', correctedFilters.fechaInicio);
        }
        
        if (correctedFilters.fechaFin) {
          console.log('🔍 DashboardService: Aplicando filtro fechaFin:', correctedFilters.fechaFin);
          debugQuery = debugQuery.lte('created_at', correctedFilters.fechaFin);
        }
        
        const { data: debugData, error: debugError } = await debugQuery.limit(5);
        
        if (simpleError) {
          console.error('❌ DashboardService: Error en query simple:', simpleError);
        } else {
          console.log('📊 DashboardService: Query simple encontró:', simpleData?.length || 0, 'órdenes');
          console.log('📋 DashboardService: Muestra de órdenes:', simpleData);
        }
        
        if (debugError) {
          console.error('❌ DashboardService: Error en query debug:', debugError);
        } else {
          console.log('📊 DashboardService: Query debug encontró:', debugData?.length || 0, 'órdenes');
          console.log('📋 DashboardService: Órdenes debug:', debugData);
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
        
        // Debug: verificar valores de type_order en las órdenes
        console.log('🔍 DashboardService: Verificando valores de type_order...');
        const { data: typeOrderData, error: typeOrderError } = await supabase
          .from('ordenes')
          .select('id, type_order, created_at')
          .eq('sede_id', filters.sede_id)
          .limit(10);
        
        if (typeOrderError) {
          console.error('❌ DashboardService: Error al consultar type_order:', typeOrderError);
        } else {
          console.log('📦 DashboardService: Valores de type_order encontrados:', typeOrderData);
        }
        
        return [];
      }

      // Transformar los datos al formato esperado
      const transformedOrders: DashboardOrder[] = data.map(order => ({
        id_display: `ORD-${order.id.toString().padStart(4, '0')}`,
        cliente_nombre: order.clientes?.nombre || 'Sin nombre',
        cliente_telefono: order.clientes?.telefono || 'Sin teléfono',
        address: order.address || 'Sin dirección',
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
        payment_id: order.payment_id || 0,
        minuta_id: order.minutas && order.minutas.length > 0 ? order.minutas[0].daily_id.toString() : undefined,
        source: order.source || 'sede',
        type_order: order.type_order || 'delivery',
        // Discount fields mapping
        descuento_valor: order.descuento_valor || undefined,
        descuento_comentario: order.descuento_comentario,
        descuento_aplicado_fecha: order.descuento_aplicado_fecha
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

  // Eliminar orden (solo para admins)
  async deleteOrder(orderId: number): Promise<void> {
    try {
      console.log('🗑️ DashboardService: Eliminando orden:', orderId);

      // Primero obtener la orden para verificar que existe
      const { data: orderData, error: orderError } = await supabase
        .from('ordenes')
        .select('id, payment_id')
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.error('❌ DashboardService: Error encontrando orden:', orderError);
        throw new Error(`Orden no encontrada: ${orderError.message}`);
      }

      if (!orderData) {
        throw new Error('Orden no encontrada');
      }

      // Eliminar minutas asociadas primero (soluciona foreign key constraint)
      console.log('🗑️ Eliminando minutas asociadas...');
      const { error: minutasError } = await supabase
        .from('minutas')
        .delete()
        .eq('order_id', orderId);

      if (minutasError) {
        console.error('⚠️ Error eliminando minutas (continuando):', minutasError);
      }

      // Eliminar items de toppings
      console.log('🗑️ Eliminando items de toppings...');
      const { error: toppingsError } = await supabase
        .from('ordenes_toppings')
        .delete()
        .eq('orden_id', orderId);

      if (toppingsError) {
        console.error('⚠️ Error eliminando toppings (continuando):', toppingsError);
      }

      // Eliminar items de la orden primero
      console.log('🗑️ Eliminando items de platos...');
      const { error: platosError } = await supabase
        .from('ordenes_platos')
        .delete()
        .eq('orden_id', orderId);

      if (platosError) {
        console.error('⚠️ Error eliminando platos (continuando):', platosError);
      }

      console.log('🗑️ Eliminando items de bebidas...');
      const { error: bebidasError } = await supabase
        .from('ordenes_bebidas')
        .delete()
        .eq('orden_id', orderId);

      if (bebidasError) {
        console.error('⚠️ Error eliminando bebidas (continuando):', bebidasError);
      }

      // Eliminar la orden
      console.log('🗑️ Eliminando orden...');
      const { error: deleteOrderError } = await supabase
        .from('ordenes')
        .delete()
        .eq('id', orderId);

      if (deleteOrderError) {
        console.error('❌ DashboardService: Error eliminando orden:', deleteOrderError);
        throw new Error(`Error eliminando orden: ${deleteOrderError.message}`);
      }

      // Eliminar el pago si existe
      if (orderData.payment_id) {
        console.log('🗑️ Eliminando pago...');
        const { error: deletePaymentError } = await supabase
          .from('pagos')
          .delete()
          .eq('id', orderData.payment_id);

        if (deletePaymentError) {
          console.error('⚠️ Error eliminando pago (continuando):', deletePaymentError);
        }
      }

      console.log('✅ Orden eliminada exitosamente:', orderId);
    } catch (error) {
      console.error('❌ Error en deleteOrder:', error);
      throw error;
    }
  }

  // Obtener estadísticas del dashboard
  async getDashboardStats(sede_id?: string | number, filters: Omit<DashboardFilters, 'sede_id'> = {}) {
    try {
      console.log('📊 Consultando estadísticas del dashboard...');
      console.log('🏢 Sede ID:', sede_id);
      
      // CRÍTICO: Validación obligatoria de sede_id
      if (!sede_id) {
        throw new Error('sede_id es obligatorio para consultas de estadísticas');
      }
      
      // Validar formato UUID de sede_id
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(sede_id.toString())) {
        throw new Error('sede_id debe ser un UUID válido');
      }
      
      console.log('📅 Filtros de fecha:', { fechaInicio: filters.fechaInicio, fechaFin: filters.fechaFin });

      // Auditar y corregir fechas si es necesario
      const correctedFilters = auditAndFixDateFilters(filters);
      if (JSON.stringify(filters) !== JSON.stringify(correctedFilters)) {
        console.log('🔧 DashboardStats: Filtros de fecha corregidos');
      }

      // Construir query base para estadísticas
      let query = supabase
        .from('ordenes')
        .select('status');

      // Filtrar por sede (validación ya realizada arriba)
      query = query.eq('sede_id', sede_id);

      // Aplicar filtros de fecha (usando filtros corregidos)
      if (correctedFilters.fechaInicio) {
        query = query.gte('created_at', correctedFilters.fechaInicio);
      }
      
      if (correctedFilters.fechaFin) {
        query = query.lte('created_at', correctedFilters.fechaFin);
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