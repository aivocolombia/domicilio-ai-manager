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

export interface HourlyMetrics {
  hora: string;
  cantidad_pedidos: number;
}

export interface DashboardMetrics {
  metricasPorDia: MetricsByDay[];
  productosMasVendidos: ProductMetrics[];
  metricasPorSede: SedeMetrics[];
  metricasPorHora: HourlyMetrics[];
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
              pagos!left(total_pago)
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
      const metricasPorDia = new Map<string, { pedidos: number; ingresos: number }>();

      ordenesData?.forEach((orden) => {
        const fecha = new Date(orden.created_at).toISOString().split('T')[0];
        const ingresos = pagosMap.get(orden.id) || 0;

        if (metricasPorDia.has(fecha)) {
          const existing = metricasPorDia.get(fecha)!;
          existing.pedidos += 1;
          existing.ingresos += ingresos;
        } else {
          metricasPorDia.set(fecha, { pedidos: 1, ingresos });
        }
      });

      // Convertir a array y calcular promedios
      const resultado: MetricsByDay[] = Array.from(metricasPorDia.entries()).map(([fecha, datos]) => ({
        fecha,
        total_pedidos: datos.pedidos,
        total_ingresos: datos.ingresos,
        promedio_por_pedido: datos.pedidos > 0 ? datos.ingresos / datos.pedidos : 0
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
            platos(id, name, pricing)
          ),
          ordenes_bebidas(
            bebidas(id, name, pricing)
          )
        `)
        .gte('created_at', `${filters.fecha_inicio}T00:00:00`)
        .lte('created_at', `${filters.fecha_fin}T23:59:59`);

      if (filters.sede_id) {
        query = query.eq('sede_id', filters.sede_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error obteniendo métricas de productos:', error);
        throw new Error(`Error obteniendo productos: ${error.message}`);
      }

      // Procesar datos para contar productos vendidos
      const productosMap = new Map<string, { cantidad: number; ingresos: number }>();

      data?.forEach(orden => {
        // Procesar platos
        (orden.ordenes_platos || []).forEach((item: any) => {
          const producto = item.platos;
          if (producto) {
            const key = `plato-${producto.id}`;
            const precio = producto.pricing || 0;
            
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

        // Procesar bebidas
        (orden.ordenes_bebidas || []).forEach((item: any) => {
          const producto = item.bebidas;
          if (producto) {
            const key = `bebida-${producto.id}`;
            const precio = producto.pricing || 0;
            
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
        .gte('created_at', `${filters.fecha_inicio}T00:00:00`)
        .lte('created_at', `${filters.fecha_fin}T23:59:59`);

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
              pagos!left(total_pago)
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
        .gte('created_at', `${filters.fecha_inicio}T00:00:00`)
        .lte('created_at', `${filters.fecha_fin}T23:59:59`);

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

  // Obtener todas las métricas del dashboard
  async getDashboardMetrics(filters: MetricsFilters): Promise<DashboardMetrics> {
    try {
      console.log('📈 Obteniendo métricas del dashboard:', filters);

      const [
        metricasPorDia,
        productosMasVendidos,
        metricasPorSede,
        metricasPorHora
      ] = await Promise.all([
        this.getMetricsByDay(filters),
        this.getProductMetrics(filters),
        this.getSedeMetrics(filters),
        this.getHourlyMetrics(filters)
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
        query = query.gte('created_at', `${filters.fecha_inicio}T00:00:00`);
      }
      
      if (filters.fecha_fin) {
        console.log('📅 MetricsService: Filtrando hasta fecha:', filters.fecha_fin);
        query = query.lte('created_at', `${filters.fecha_fin}T23:59:59`);
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
}

export const metricsService = new MetricsService();