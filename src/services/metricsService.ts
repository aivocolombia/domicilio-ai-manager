import { supabase } from '@/lib/supabase';
import { formatDateForQuery } from '@/utils/dateUtils';

export interface MetricsByDay {
  fecha: string;
  total_pedidos: number;
  total_ingresos: number;
  promedio_por_pedido: number;
}

export interface ProductMetrics {
  producto_nombre: string;
  total_vendido: number;
  total_ingresos: number;
  porcentaje_ventas: number;
}

export interface SedeMetrics {
  sede_id: string;
  sede_nombre: string;
  total_pedidos: number;
  total_ingresos: number;
  promedio_por_pedido: number;
  pedidos_activos: number;
}

export interface CancelledOrderMetrics {
  total: number;
  porcentaje: number;
  montoTotal: number;
  porSede: Array<{
    sede_id: string;
    nombre: string;
    cancelados: number;
    porcentaje: number;
    monto: number;
  }>;
}

export interface HourlyMetrics {
  hora: string;
  cantidad_pedidos: number;
}

export interface DeliveryPersonMetrics {
  repartidor_id: number;
  repartidor_nombre: string;
  total_asignados: number;
  total_entregados: number;
  total_cancelados: number;
  porcentaje_exito: number;
  promedio_tiempo_entrega: number;
  dias_trabajados: number;
  monto_total_entregado: number;
}

export interface DeliveryPersonPerformance {
  repartidores: DeliveryPersonMetrics[];
  resumen: {
    total_repartidores: number;
    mejor_repartidor: string;
    promedio_entregas: number;
    promedio_exito: number;
  };
}

export interface DashboardMetrics {
  metricasPorDia: MetricsByDay[];
  productosMasVendidos: ProductMetrics[];
  metricasPorSede: SedeMetrics[];
  metricasPorHora: HourlyMetrics[];
  pedidosCancelados: CancelledOrderMetrics;
  totalGeneral: {
    pedidos: number;
    ingresos: number;
    promedio: number;
  };
}

// Interfaz para métricas de tiempo por fases
export interface OrderTimeMetrics {
  id: number;
  sede_id: string;
  created_at: string;
  status: string;
  recibidos_at: string | null;
  cocina_at: string | null;
  camino_at: string | null;
  entregado_at: string | null;
  cancelado_at: string | null;
  updated_at_final: string | null;
  min_recibidos_a_cocina: number | null;
  min_cocina_a_camino: number | null;
  min_camino_a_fin: number | null;
  min_total_desde_recibidos: number | null;
  min_total_desde_creacion: number | null;
  sede_nombre: string | null;
}

export interface PhaseTimeStats {
  avg_recibidos_a_cocina: number;
  avg_cocina_a_camino: number;
  avg_camino_a_fin: number;
  avg_total_desde_recibidos: number;
  avg_total_desde_creacion: number;
  total_orders: number;
  completed_orders: number;
}

export interface PhaseDistribution {
  phase: string;
  avg_minutes: number;
  min_minutes: number;
  max_minutes: number;
  count: number;
  color: string;
}

export interface MetricsFilters {
  fecha_inicio: string;
  fecha_fin: string;
  sede_id?: string;
}

export class MetricsService {
  // Obtener métricas por día en un rango de fechas
  async getMetricsByDay(filters: MetricsFilters): Promise<MetricsByDay[]> {
    try {
      console.log('📊 Obteniendo métricas por día:', filters);

      // Convertir fechas del filtro a rangos UTC correctos
      const startDate = new Date(`${filters.fecha_inicio}T00:00:00`);
      const endDate = new Date(`${filters.fecha_fin}T23:59:59`);
      
      const startQuery = formatDateForQuery(startDate, false);
      const endQuery = formatDateForQuery(endDate, true);
      
      console.log('📅 MetricsService: Fechas de consulta convertidas:', {
        original: { inicio: filters.fecha_inicio, fin: filters.fecha_fin },
        converted: { inicio: startQuery, fin: endQuery }
      });

      // Query principal usando ordenes_duraciones_con_sede que tiene los datos completos
      let query = supabase
        .from('ordenes_duraciones_con_sede')
        .select(`
          id,
          created_at,
          status,
          sede_id,
          sede_nombre
        `)
        .gte('created_at', startQuery)
        .lte('created_at', endQuery);

      if (filters.sede_id) {
        query = query.eq('sede_id', filters.sede_id);
      }

      const { data: ordenesData, error } = await query;

      if (error) {
        console.error('❌ Error obteniendo métricas por día:', error);
        throw new Error(`Error obteniendo métricas: ${error.message}`);
      }

      console.log('✅ Órdenes obtenidas para métricas:', ordenesData?.length || 0);
      console.log('🔍 DEBUG getMetricsByDay - Rango aplicado:', {
        fecha_inicio: `${filters.fecha_inicio}T00:00:00`,
        fecha_fin: `${filters.fecha_fin}T23:59:59`
      });
      if (ordenesData && ordenesData.length > 0) {
        console.log('📅 DEBUG - Fechas de órdenes encontradas:', ordenesData.map(o => ({
          id: o.id,
          fecha: o.created_at,
          fecha_solo: new Date(o.created_at).toISOString().split('T')[0]
        })));
      }

      // Obtener pagos por separado
      let pagosData: any[] = [];
      if (ordenesData && ordenesData.length > 0) {
        const ordenIds = ordenesData.map(o => o.id).filter(id => id !== undefined && id !== null);
        
        // Solo hacer la consulta si hay IDs válidos
        if (ordenIds.length > 0) {
          const { data: pagosResult, error: pagosError } = await supabase
            .from('ordenes')
            .select(`
              id,
              pagos!payment_id(total_pago)
            `)
            .in('id', ordenIds);

          if (pagosError) {
            console.error('⚠️ Error obteniendo pagos:', pagosError);
          } else {
            pagosData = pagosResult || [];
          }
        }
      }

      // Crear mapa de pagos por orden_id
      const pagosMap = new Map();
      pagosData.forEach(orden => {
        if (orden.pagos) {
          pagosMap.set(orden.id, orden.pagos.total_pago);
        }
      });

      // Procesar datos para agrupar por día
      const metricasPorDia = new Map<string, { pedidos: number; pedidos_entregados: number; ingresos: number }>();

      ordenesData?.forEach((orden) => {
        const fecha = new Date(orden.created_at).toISOString().split('T')[0];
        // Solo contar ingresos de órdenes entregadas
        const ingresos = orden.status === 'Entregados' ? (pagosMap.get(orden.id) || 0) : 0;
        const esEntregado = orden.status === 'Entregados' ? 1 : 0;

        if (metricasPorDia.has(fecha)) {
          const existing = metricasPorDia.get(fecha)!;
          existing.pedidos += 1; // Contar todos los pedidos
          existing.pedidos_entregados += esEntregado; // Contar solo entregados
          existing.ingresos += ingresos; // Solo ingresos de entregados
        } else {
          metricasPorDia.set(fecha, { pedidos: 1, pedidos_entregados: esEntregado, ingresos });
        }
      });

      // Convertir a array y calcular promedios basados en pedidos entregados
      const resultado: MetricsByDay[] = Array.from(metricasPorDia.entries()).map(([fecha, datos]) => ({
        fecha,
        total_pedidos: datos.pedidos,
        total_ingresos: datos.ingresos,
        promedio_por_pedido: datos.pedidos_entregados > 0 ? datos.ingresos / datos.pedidos_entregados : 0
      }));

      console.log('✅ Métricas por día calculadas:', resultado.length, 'días');
      return resultado.sort((a, b) => a.fecha.localeCompare(b.fecha));
    } catch (error) {
      console.error('❌ Error en getMetricsByDay:', error);
      throw error;
    }
  }

  // Obtener productos más vendidos
  async getProductMetrics(filters: MetricsFilters): Promise<ProductMetrics[]> {
    try {
      console.log('🍽️ Obteniendo métricas de productos:', filters);

      let query = supabase
        .from('ordenes')
        .select(`
          id,
          created_at,
          sede_id,
          ordenes_platos(
            plato_id,
            platos(id, name)
          ),
          ordenes_bebidas(
            bebidas_id,
            bebidas(id, name)
          )
        `)
        .gte('created_at', formatDateForQuery(new Date(`${filters.fecha_inicio}T00:00:00`), false))
        .lte('created_at', formatDateForQuery(new Date(`${filters.fecha_fin}T23:59:59`), true));

      if (filters.sede_id) {
        query = query.eq('sede_id', filters.sede_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error obteniendo métricas de productos:', error);
        throw new Error(`Error obteniendo productos: ${error.message}`);
      }

      console.log('💰 Obteniendo precios de sede para métricas de productos...');

      // Obtener todos los IDs únicos de productos y sedes
      const sedeIds = [...new Set(data?.map(o => o.sede_id).filter(id => id))];
      const platoIds = [...new Set(data?.flatMap(o => o.ordenes_platos?.map((item: any) => item.plato_id)).filter(id => id))];
      const bebidaIds = [...new Set(data?.flatMap(o => o.ordenes_bebidas?.map((item: any) => item.bebidas_id)).filter(id => id))];

      // Obtener precios de sede para platos
      const sedePlatosMap = new Map<string, number>(); // key: "sedeId-platoId", value: precio
      if (platoIds.length > 0 && sedeIds.length > 0) {
        const { data: sedePlatos } = await supabase
          .from('sede_platos')
          .select('sede_id, plato_id, price_override')
          .in('sede_id', sedeIds)
          .in('plato_id', platoIds);

        sedePlatos?.forEach(sp => {
          if (sp.price_override !== null && sp.price_override !== undefined) {
            sedePlatosMap.set(`${sp.sede_id}-${sp.plato_id}`, sp.price_override);
          }
        });
        console.log(`✅ Precios de sede cargados para ${sedePlatosMap.size} platos`);
      }

      // Obtener precios de sede para bebidas
      const sedeBebidasMap = new Map<string, number>(); // key: "sedeId-bebidaId", value: precio
      if (bebidaIds.length > 0 && sedeIds.length > 0) {
        const { data: sedeBebidas } = await supabase
          .from('sede_bebidas')
          .select('sede_id, bebida_id, price_override')
          .in('sede_id', sedeIds)
          .in('bebida_id', bebidaIds);

        sedeBebidas?.forEach(sb => {
          if (sb.price_override !== null && sb.price_override !== undefined) {
            sedeBebidasMap.set(`${sb.sede_id}-${sb.bebida_id}`, sb.price_override);
          }
        });
        console.log(`✅ Precios de sede cargados para ${sedeBebidasMap.size} bebidas`);
      }

      // Procesar datos para contar productos vendidos usando precios de sede
      const productosMap = new Map<string, { cantidad: number; ingresos: number }>();

      data?.forEach(orden => {
        const sedeId = orden.sede_id;

        // Procesar platos con precios de sede
        (orden.ordenes_platos || []).forEach((item: any) => {
          const producto = item.platos;
          if (producto) {
            const key = `plato-${producto.id}`;
            const precioSede = sedePlatosMap.get(`${sedeId}-${item.plato_id}`);
            const precio = precioSede !== undefined ? precioSede : 0;

            if (productosMap.has(key)) {
              const existing = productosMap.get(key)!;
              existing.cantidad += 1;
              existing.ingresos += precio;
            } else {
              productosMap.set(key, {
                cantidad: 1,
                ingresos: precio
              });
              // Guardar también el nombre del producto
              productosMap.set(`${key}-name`, producto.name);
            }
          }
        });

        // Procesar bebidas con precios de sede
        (orden.ordenes_bebidas || []).forEach((item: any) => {
          const producto = item.bebidas;
          if (producto) {
            const key = `bebida-${producto.id}`;
            const precioSede = sedeBebidasMap.get(`${sedeId}-${item.bebidas_id}`);
            const precio = precioSede !== undefined ? precioSede : 0;

            if (productosMap.has(key)) {
              const existing = productosMap.get(key)!;
              existing.cantidad += 1;
              existing.ingresos += precio;
            } else {
              productosMap.set(key, {
                cantidad: 1,
                ingresos: precio
              });
              // Guardar también el nombre del producto
              productosMap.set(`${key}-name`, producto.name);
            }
          }
        });
      });

      // Convertir a array y calcular porcentajes
      const totalVentas = Array.from(productosMap.entries())
        .filter(([key]) => !key.includes('-name'))
        .reduce((total, [, datos]) => total + datos.cantidad, 0);

      const resultado: ProductMetrics[] = Array.from(productosMap.entries())
        .filter(([key]) => !key.includes('-name'))
        .map(([key, datos]) => ({
          producto_nombre: productosMap.get(`${key}-name`) || 'Producto desconocido',
          total_vendido: datos.cantidad,
          total_ingresos: datos.ingresos,
          porcentaje_ventas: totalVentas > 0 ? (datos.cantidad / totalVentas) * 100 : 0
        }))
        .sort((a, b) => b.total_vendido - a.total_vendido)
        .slice(0, 10); // Top 10

      console.log('✅ Métricas de productos obtenidas:', resultado.length);
      return resultado;
    } catch (error) {
      console.error('❌ Error en getProductMetrics:', error);
      throw error;
    }
  }

  // Obtener métricas por sede
  async getSedeMetrics(filters: MetricsFilters): Promise<SedeMetrics[]> {
    try {
      console.log('🏢 Obteniendo métricas por sede:', filters);

      // Obtener datos de sedes desde ordenes_duraciones_con_sede
      const { data: sedeData, error: sedeError } = await supabase
        .from('ordenes_duraciones_con_sede')
        .select(`
          sede_id,
          status,
          created_at,
          sede_nombre
        `)
        .gte('created_at', formatDateForQuery(new Date(`${filters.fecha_inicio}T00:00:00`), false))
        .lte('created_at', formatDateForQuery(new Date(`${filters.fecha_fin}T23:59:59`), true));

      if (sedeError) {
        console.error('❌ Error obteniendo métricas por sede:', sedeError);
        throw new Error(`Error obteniendo métricas por sede: ${sedeError.message}`);
      }

      // Obtener pagos por separado
      let pagosData: any[] = [];
      if (sedeData && sedeData.length > 0) {
        const ordenIds = sedeData.map(o => o.id).filter(id => id !== undefined && id !== null);
        
        // Solo hacer la consulta si hay IDs válidos
        if (ordenIds.length > 0) {
          const { data: pagosResult, error: pagosError } = await supabase
            .from('ordenes')
            .select(`
              id,
              pagos!payment_id(total_pago)
            `)
            .in('id', ordenIds);

          if (pagosError) {
            console.error('⚠️ Error obteniendo pagos para sede metrics:', pagosError);
          } else {
            pagosData = pagosResult || [];
          }
        }
      }

      // Crear mapa de pagos por orden_id
      const pagosMap = new Map();
      pagosData.forEach(orden => {
        if (orden.pagos) {
          pagosMap.set(orden.id, orden.pagos.total_pago);
        }
      });

      const data = sedeData;

      // Procesar datos por sede
      const sedesMap = new Map<string, {
        nombre: string;
        completados: number;
        activos: number;
        ingresos: number;
      }>();

      data?.forEach(orden => {
        const sedeId = orden.sede_id;
        const sedeName = orden.sede_nombre || 'Sede desconocida';
        const ingresos = orden.status === 'Entregados' ? (pagosMap.get(orden.id) || 0) : 0;
        const esCompletado = orden.status === 'Entregados';
        const esActivo = !esCompletado;

        if (sedesMap.has(sedeId)) {
          const existing = sedesMap.get(sedeId)!;
          if (esCompletado) {
            existing.completados += 1;
            existing.ingresos += ingresos;
          }
          if (esActivo) {
            existing.activos += 1;
          }
        } else {
          sedesMap.set(sedeId, {
            nombre: sedeName,
            completados: esCompletado ? 1 : 0,
            activos: esActivo ? 1 : 0,
            ingresos: ingresos
          });
        }
      });

      // Convertir a array
      const resultado: SedeMetrics[] = Array.from(sedesMap.entries()).map(([sedeId, datos]) => ({
        sede_id: sedeId,
        sede_nombre: datos.nombre,
        total_pedidos: datos.completados,
        total_ingresos: datos.ingresos,
        promedio_por_pedido: datos.completados > 0 ? datos.ingresos / datos.completados : 0,
        pedidos_activos: datos.activos
      }));

      console.log('✅ Métricas por sede obtenidas:', resultado.length);
      return resultado.sort((a, b) => b.total_ingresos - a.total_ingresos);
    } catch (error) {
      console.error('❌ Error en getSedeMetrics:', error);
      throw error;
    }
  }

  // Obtener métricas por hora del día
  async getHourlyMetrics(filters: MetricsFilters): Promise<HourlyMetrics[]> {
    try {
      console.log('⏰ Obteniendo métricas por hora:', filters);

      let query = supabase
        .from('ordenes_duraciones_con_sede')
        .select(`
          created_at,
          sede_id
        `)
        .gte('created_at', formatDateForQuery(new Date(`${filters.fecha_inicio}T00:00:00`), false))
        .lte('created_at', formatDateForQuery(new Date(`${filters.fecha_fin}T23:59:59`), true));

      if (filters.sede_id) {
        query = query.eq('sede_id', filters.sede_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error obteniendo métricas por hora:', error);
        throw new Error(`Error obteniendo métricas por hora: ${error.message}`);
      }

      // Procesar datos por hora
      const horasMap = new Map<string, number>();

      data?.forEach(orden => {
        const hora = new Date(orden.created_at).getHours();
        const horaKey = `${hora.toString().padStart(2, '0')}:00`;

        if (horasMap.has(horaKey)) {
          horasMap.set(horaKey, horasMap.get(horaKey)! + 1);
        } else {
          horasMap.set(horaKey, 1);
        }
      });

      // Crear array con todas las horas del día
      const resultado: HourlyMetrics[] = [];
      for (let hora = 0; hora < 24; hora++) {
        const horaKey = `${hora.toString().padStart(2, '0')}:00`;
        resultado.push({
          hora: horaKey,
          cantidad_pedidos: horasMap.get(horaKey) || 0
        });
      }

      console.log('✅ Métricas por hora obtenidas');
      return resultado;
    } catch (error) {
      console.error('❌ Error en getHourlyMetrics:', error);
      throw error;
    }
  }

  // Obtener métricas de pedidos cancelados
  async getCancelledOrderMetrics(filters: MetricsFilters): Promise<CancelledOrderMetrics> {
    try {
      console.log('❌ Obteniendo métricas de pedidos cancelados:', filters);

      // Query base para obtener pedidos cancelados
      let query = supabase
        .from('ordenes')
        .select(`
          id,
          status,
          sede_id,
          motivo_cancelacion,
          created_at,
          sedes!left(name),
          pagos!payment_id(total_pago)
        `)
        .eq('status', 'Cancelado')
        .order('created_at', { ascending: false });

      // Aplicar filtros de fecha con formato correcto de zona horaria
      if (filters.fecha_inicio && filters.fecha_fin) {
        const startDate = new Date(`${filters.fecha_inicio}T00:00:00`);
        const endDate = new Date(`${filters.fecha_fin}T23:59:59`);
        const startQuery = formatDateForQuery(startDate, false);
        const endQuery = formatDateForQuery(endDate, true);

        query = query
          .gte('created_at', startQuery)
          .lte('created_at', endQuery);
      }

      // Las métricas de cancelación son globales - no se filtra por sede

      const { data: cancelados, error } = await query;

      if (error) {
        console.error('❌ Error obteniendo pedidos cancelados:', error);
        throw new Error(`Error obteniendo pedidos cancelados: ${error.message}`);
      }

      // También obtener el total de pedidos para calcular porcentaje
      let totalQuery = supabase
        .from('ordenes')
        .select('id, pagos!payment_id(total_pago)')
        .neq('status', null);

      // Solo aplicar filtros de fecha (las métricas de cancelación son globales)
      if (filters.fecha_inicio && filters.fecha_fin) {
        const startDate = new Date(`${filters.fecha_inicio}T00:00:00`);
        const endDate = new Date(`${filters.fecha_fin}T23:59:59`);
        const startQuery = formatDateForQuery(startDate, false);
        const endQuery = formatDateForQuery(endDate, true);

        totalQuery = totalQuery
          .gte('created_at', startQuery)
          .lte('created_at', endQuery);
      }

      const { data: totalPedidos, error: totalError } = await totalQuery;

      if (totalError) {
        console.error('❌ Error obteniendo total de pedidos:', totalError);
        throw new Error(`Error obteniendo total de pedidos: ${totalError.message}`);
      }

      // Procesar datos
      const totalCancelados = cancelados?.length || 0;
      const totalGeneral = totalPedidos?.length || 0;
      const porcentajeCancelacion = totalGeneral > 0 ? (totalCancelados / totalGeneral) * 100 : 0;

      // Calcular monto total perdido
      const montoTotal = cancelados?.reduce((sum, orden) => {
        const monto = orden.pagos?.total_pago || 0;
        return sum + monto;
      }, 0) || 0;

      // Agrupar por sede
      const sedeMap = new Map<string, { nombre: string; cancelados: number; monto: number }>();

      cancelados?.forEach(orden => {
        const sedeId = orden.sede_id || 'sin-sede';
        const sedeNombre = orden.sedes?.name || 'Sin sede';
        const monto = orden.pagos?.total_pago || 0;

        if (sedeMap.has(sedeId)) {
          const existing = sedeMap.get(sedeId)!;
          existing.cancelados += 1;
          existing.monto += monto;
        } else {
          sedeMap.set(sedeId, {
            nombre: sedeNombre,
            cancelados: 1,
            monto: monto
          });
        }
      });

      // Convertir a array y calcular porcentajes por sede
      const porSede = Array.from(sedeMap.entries()).map(([sede_id, data]) => ({
        sede_id,
        nombre: data.nombre,
        cancelados: data.cancelados,
        porcentaje: totalCancelados > 0 ? (data.cancelados / totalCancelados) * 100 : 0,
        monto: data.monto
      })).sort((a, b) => b.cancelados - a.cancelados); // Ordenar por cantidad

      const resultado: CancelledOrderMetrics = {
        total: totalCancelados,
        porcentaje: porcentajeCancelacion,
        montoTotal,
        porSede
      };

      console.log('✅ Métricas de cancelaciones obtenidas:', {
        totalCancelados,
        porcentajeCancelacion: `${porcentajeCancelacion.toFixed(1)}%`,
        montoTotal,
        sedesAfectadas: porSede.length
      });

      return resultado;
    } catch (error) {
      console.error('❌ Error en getCancelledOrderMetrics:', error);
      throw error;
    }
  }

  // Obtener todas las métricas del dashboard
  async getDashboardMetrics(filters: MetricsFilters): Promise<DashboardMetrics> {
    try {
      console.log('📈 Obteniendo métricas del dashboard:', filters);

      const [
        metricasPorDia,
        productosMasVendidos,
        metricasPorSede,
        metricasPorHora,
        pedidosCancelados
      ] = await Promise.all([
        this.getMetricsByDay(filters),
        this.getProductMetrics(filters),
        this.getSedeMetrics(filters),
        this.getHourlyMetrics(filters),
        this.getCancelledOrderMetrics(filters)
      ]);

      // Calcular totales generales
      const totalPedidos = metricasPorDia.reduce((sum, dia) => sum + dia.total_pedidos, 0);
      const totalIngresos = metricasPorDia.reduce((sum, dia) => sum + dia.total_ingresos, 0);
      const promedioGeneral = totalPedidos > 0 ? totalIngresos / totalPedidos : 0;

      const resultado: DashboardMetrics = {
        metricasPorDia,
        productosMasVendidos,
        metricasPorSede,
        metricasPorHora,
        pedidosCancelados,
        totalGeneral: {
          pedidos: totalPedidos,
          ingresos: totalIngresos,
          promedio: promedioGeneral
        }
      };

      console.log('✅ Todas las métricas del dashboard obtenidas:', {
        metricasPorDia_count: metricasPorDia.length,
        totalPedidos,
        totalIngresos,
        promedioGeneral,
        productosMasVendidos_count: productosMasVendidos.length
      });
      return resultado;
    } catch (error) {
      console.error('❌ Error en getDashboardMetrics:', error);
      throw error;
    }
  }

  // ========== NUEVAS MÉTRICAS DE TIEMPO POR FASES ==========

  // Obtener métricas de tiempo de órdenes
  async getOrderTimeMetrics(filters: MetricsFilters): Promise<OrderTimeMetrics[]> {
    try {
      console.log('⏱️ MetricsService: Consultando métricas de tiempo de órdenes...');
      console.log('🔍 MetricsService: Filtros aplicados:', filters);

      // Construir query base - usar la tabla correcta de métricas de tiempo
      let query = supabase
        .from('ordenes_duraciones_con_sede')
        .select('*')
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (filters.sede_id) {
        console.log('🏢 MetricsService: Filtrando por sede_id:', filters.sede_id);
        query = query.eq('sede_id', filters.sede_id);
      }

      if (filters.fecha_inicio) {
        console.log('📅 MetricsService: Filtrando desde fecha:', filters.fecha_inicio);
        query = query.gte('created_at', formatDateForQuery(new Date(`${filters.fecha_inicio}T00:00:00`), false));
      }

      if (filters.fecha_fin) {
        console.log('📅 MetricsService: Filtrando hasta fecha:', filters.fecha_fin);
        query = query.lte('created_at', formatDateForQuery(new Date(`${filters.fecha_fin}T23:59:59`), true));
      }

      const { data, error } = await query.limit(500); // Incrementar límite para más datos

      if (error) {
        console.error('❌ MetricsService: Error al obtener métricas de tiempo:', error);
        throw new Error(`Error al obtener métricas: ${error.message}`);
      }

      console.log('✅ MetricsService: Métricas de tiempo obtenidas:', data?.length || 0);
      
      // Debug: Mostrar algunos registros si existen
      if (data && data.length > 0) {
        console.log('🔍 MetricsService: Primeros 3 registros:', data.slice(0, 3));
      } else {
        console.log('⚠️ MetricsService: No se encontraron datos en ordenes_duraciones_con_sede');
        
        // Verificar si la tabla/vista existe
        const { data: tableCheck, error: tableError } = await supabase
          .from('ordenes_duraciones_con_sede')
          .select('id')
          .limit(1);
        
        if (tableError) {
          console.error('❌ MetricsService: Error verificando tabla ordenes_duraciones_con_sede:', tableError);
        } else {
          console.log('✅ MetricsService: Tabla ordenes_duraciones_con_sede existe, pero no hay datos en el rango especificado');
        }
      }
      
      return data || [];
    } catch (error) {
      console.error('❌ Error en getOrderTimeMetrics:', error);
      throw error;
    }
  }

  // Obtener estadísticas promedio por fase
  async getPhaseTimeStats(filters: MetricsFilters): Promise<PhaseTimeStats> {
    try {
      console.log('📊 MetricsService: Calculando estadísticas por fase...');
      
      const data = await this.getOrderTimeMetrics(filters);
      
      // Filtrar solo órdenes con datos válidos
      const validData = data.filter(d => d.min_total_desde_recibidos !== null || d.status === 'Entregados');
      
      const calculateAvg = (values: (number | null)[]) => {
        const validValues = values.filter((v): v is number => v !== null && !isNaN(v));
        return validValues.length > 0 ? validValues.reduce((sum, val) => sum + val, 0) / validValues.length : 0;
      };

      const stats: PhaseTimeStats = {
        avg_recibidos_a_cocina: calculateAvg(validData.map(d => d.min_recibidos_a_cocina)),
        avg_cocina_a_camino: calculateAvg(validData.map(d => d.min_cocina_a_camino)),
        avg_camino_a_fin: calculateAvg(validData.map(d => d.min_camino_a_fin)),
        avg_total_desde_recibidos: calculateAvg(validData.map(d => d.min_total_desde_recibidos)),
        avg_total_desde_creacion: calculateAvg(validData.map(d => d.min_total_desde_creacion)),
        total_orders: data.length,
        completed_orders: data.filter(d => d.status === 'Entregados').length
      };

      console.log('✅ MetricsService: Estadísticas por fase calculadas:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Error en getPhaseTimeStats:', error);
      throw error;
    }
  }

  // Obtener distribución de tiempos por fase
  async getPhaseDistribution(filters: MetricsFilters): Promise<PhaseDistribution[]> {
    try {
      console.log('📊 MetricsService: Calculando distribución por fases...');
      
      const data = await this.getOrderTimeMetrics(filters);
      
      const phases = [
        { key: 'min_recibidos_a_cocina' as keyof OrderTimeMetrics, name: 'Recibidos → Cocina', color: '#FFC107' },
        { key: 'min_cocina_a_camino' as keyof OrderTimeMetrics, name: 'Cocina → Camino', color: '#2196F3' },
        { key: 'min_camino_a_fin' as keyof OrderTimeMetrics, name: 'Camino → Entregado', color: '#4CAF50' }
      ];

      const distribution: PhaseDistribution[] = phases.map(phase => {
        const values = data
          .map(d => d[phase.key] as number)
          .filter(v => v !== null && v !== undefined && !isNaN(v));

        return {
          phase: phase.name,
          avg_minutes: values.length > 0 ? Math.round((values.reduce((sum, val) => sum + val, 0) / values.length) * 100) / 100 : 0,
          min_minutes: values.length > 0 ? Math.min(...values) : 0,
          max_minutes: values.length > 0 ? Math.max(...values) : 0,
          count: values.length,
          color: phase.color
        };
      });

      console.log('✅ MetricsService: Distribución por fases calculada:', distribution);
      return distribution;
    } catch (error) {
      console.error('❌ Error en getPhaseDistribution:', error);
      throw error;
    }
  }

  // Obtener tendencias de tiempo por día
  async getPhaseTimeTrends(filters: MetricsFilters): Promise<{ date: string; avg_total_time: number; order_count: number }[]> {
    try {
      console.log('📈 MetricsService: Calculando tendencias de tiempo...');
      
      const data = await this.getOrderTimeMetrics(filters);
      
      // Agrupar por día
      const trendMap = new Map<string, { times: number[]; count: number }>();
      
      data.forEach(order => {
        if (order.min_total_desde_recibidos !== null) {
          const date = new Date(order.created_at).toISOString().split('T')[0];
          
          if (trendMap.has(date)) {
            const existing = trendMap.get(date)!;
            existing.times.push(order.min_total_desde_recibidos);
            existing.count += 1;
          } else {
            trendMap.set(date, { times: [order.min_total_desde_recibidos], count: 1 });
          }
        }
      });

      // Convertir a array y calcular promedios
      const trends = Array.from(trendMap.entries()).map(([date, data]) => ({
        date,
        avg_total_time: Math.round((data.times.reduce((sum, val) => sum + val, 0) / data.times.length) * 100) / 100,
        order_count: data.count
      }));

      console.log('✅ MetricsService: Tendencias calculadas:', trends.length);
      return trends.sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      console.error('❌ Error en getPhaseTimeTrends:', error);
      throw error;
    }
  }

  // ========== MÉTRICAS DE RENDIMIENTO DE REPARTIDORES ==========

  // Obtener métricas de rendimiento de repartidores
  async getDeliveryPersonPerformance(filters: MetricsFilters): Promise<DeliveryPersonPerformance> {
    try {
      console.log('🚚 Obteniendo métricas de rendimiento de repartidores:', filters);

      // Query para obtener órdenes con repartidores asignados
      let query = supabase
        .from('ordenes')
        .select(`
          id,
          status,
          repartidor_id,
          created_at,
          hora_entrega,
          repartidores!left(id, nombre),
          pagos!payment_id(total_pago)
        `)
        .not('repartidor_id', 'is', null)
        .order('created_at', { ascending: false });

      // Aplicar filtros de fecha con formato correcto de zona horaria
      if (filters.fecha_inicio && filters.fecha_fin) {
        const startDate = new Date(`${filters.fecha_inicio}T00:00:00`);
        const endDate = new Date(`${filters.fecha_fin}T23:59:59`);
        const startQuery = formatDateForQuery(startDate, false);
        const endQuery = formatDateForQuery(endDate, true);

        query = query
          .gte('created_at', startQuery)
          .lte('created_at', endQuery);
      }

      // Aplicar filtro de sede si se especifica
      if (filters.sede_id && filters.sede_id !== 'all') {
        query = query.eq('sede_id', filters.sede_id);
      }

      const { data: ordenes, error } = await query;

      if (error) {
        console.error('❌ Error obteniendo órdenes para métricas de repartidores:', error);
        throw new Error(`Error obteniendo órdenes: ${error.message}`);
      }

      // Procesar datos por repartidor
      const repartidorMap = new Map<number, {
        nombre: string;
        asignados: number;
        entregados: number;
        cancelados: number;
        monto_total: number;
        tiempos_entrega: number[];
        dias_trabajados: Set<string>;
      }>();

      ordenes?.forEach(orden => {
        const repartidorId = orden.repartidor_id;
        const repartidorNombre = orden.repartidores?.nombre || 'Sin nombre';
        const fechaOrden = new Date(orden.created_at).toDateString();

        if (!repartidorMap.has(repartidorId)) {
          repartidorMap.set(repartidorId, {
            nombre: repartidorNombre,
            asignados: 0,
            entregados: 0,
            cancelados: 0,
            monto_total: 0,
            tiempos_entrega: [],
            dias_trabajados: new Set()
          });
        }

        const repartidorStats = repartidorMap.get(repartidorId)!;
        repartidorStats.asignados += 1;
        repartidorStats.dias_trabajados.add(fechaOrden);

        if (orden.status === 'Entregados') {
          repartidorStats.entregados += 1;
          repartidorStats.monto_total += orden.pagos?.total_pago || 0;
          
          // Calcular tiempo de entrega si está disponible
          if (orden.hora_entrega && orden.created_at) {
            const tiempoEntrega = new Date(orden.hora_entrega).getTime() - new Date(orden.created_at).getTime();
            const minutosEntrega = tiempoEntrega / (1000 * 60); // Convertir a minutos
            if (minutosEntrega > 0 && minutosEntrega < 480) { // Filtrar tiempos razonables (menos de 8 horas)
              repartidorStats.tiempos_entrega.push(minutosEntrega);
            }
          }
        } else if (orden.status === 'Cancelado') {
          repartidorStats.cancelados += 1;
        }
      });

      // Convertir a array de métricas
      const repartidores: DeliveryPersonMetrics[] = Array.from(repartidorMap.entries()).map(([id, stats]) => ({
        repartidor_id: id,
        repartidor_nombre: stats.nombre,
        total_asignados: stats.asignados,
        total_entregados: stats.entregados,
        total_cancelados: stats.cancelados,
        porcentaje_exito: stats.asignados > 0 ? (stats.entregados / stats.asignados) * 100 : 0,
        promedio_tiempo_entrega: stats.tiempos_entrega.length > 0 
          ? stats.tiempos_entrega.reduce((sum, time) => sum + time, 0) / stats.tiempos_entrega.length
          : 0,
        dias_trabajados: stats.dias_trabajados.size,
        monto_total_entregado: stats.monto_total
      }));

      // Calcular resumen
      const totalRepartidores = repartidores.length;
      const promedioEntregas = totalRepartidores > 0 
        ? repartidores.reduce((sum, r) => sum + r.total_entregados, 0) / totalRepartidores
        : 0;
      const promedioExito = totalRepartidores > 0
        ? repartidores.reduce((sum, r) => sum + r.porcentaje_exito, 0) / totalRepartidores
        : 0;
      
      // Encontrar mejor repartidor (por porcentaje de éxito y cantidad de entregas)
      const mejorRepartidor = repartidores.length > 0
        ? repartidores.reduce((mejor, actual) => {
            const puntajeMejor = mejor.porcentaje_exito * 0.7 + mejor.total_entregados * 0.3;
            const puntajeActual = actual.porcentaje_exito * 0.7 + actual.total_entregados * 0.3;
            return puntajeActual > puntajeMejor ? actual : mejor;
          }).repartidor_nombre
        : 'N/A';

      const resultado: DeliveryPersonPerformance = {
        repartidores: repartidores.sort((a, b) => b.total_entregados - a.total_entregados),
        resumen: {
          total_repartidores: totalRepartidores,
          mejor_repartidor: mejorRepartidor,
          promedio_entregas: Math.round(promedioEntregas * 100) / 100,
          promedio_exito: Math.round(promedioExito * 100) / 100
        }
      };

      console.log('✅ Métricas de repartidores obtenidas:', {
        totalRepartidores,
        mejorRepartidor,
        promedioEntregas: resultado.resumen.promedio_entregas
      });

      return resultado;
    } catch (error) {
      console.error('❌ Error en getDeliveryPersonPerformance:', error);
      throw error;
    }
  }
}

export const metricsService = new MetricsService();