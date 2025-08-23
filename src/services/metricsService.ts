import { supabase } from '@/lib/supabase';

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

      // Primero verificar órdenes entregadas sin filtro de pago para debug
      const { data: debugData, error: debugError } = await supabase
        .from('ordenes')
        .select(`
          id,
          created_at,
          status,
          payment_id,
          cliente_id,
          sede_id
        `)
        .gte('created_at', `${filters.fecha_inicio}T00:00:00.000Z`)
        .lte('created_at', `${filters.fecha_fin}T23:59:59.999Z`)
        .eq('status', 'Entregados')
        .order('created_at', { ascending: false });

      if (debugError) {
        console.error('❌ Error en query debug:', debugError);
      } else {
        console.log('🔍 DEBUG - Órdenes entregadas encontradas:', debugData?.length || 0);
        debugData?.forEach((orden, index) => {
          console.log(`🔍 Orden ${index + 1}:`, {
            id: orden.id,
            created_at: orden.created_at,
            payment_id: orden.payment_id,
            cliente_id: orden.cliente_id,
            sede_id: orden.sede_id
          });
        });
      }

      // Query principal con LEFT JOIN para no perder órdenes sin pago
      let query = supabase
        .from('ordenes')
        .select(`
          id,
          created_at,
          cliente_id,
          pagos!left(total_pago),
          sede_id
        `)
        .gte('created_at', `${filters.fecha_inicio}T00:00:00.000Z`)
        .lte('created_at', `${filters.fecha_fin}T23:59:59.999Z`)
        .eq('status', 'Entregados'); // Solo pedidos completados

      if (filters.sede_id) {
        query = query.eq('sede_id', filters.sede_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error obteniendo métricas por día:', error);
        throw new Error(`Error obteniendo métricas: ${error.message}`);
      }

      console.log('🔍 DEBUG - Datos obtenidos para métricas:', data?.length || 0);
      data?.forEach((orden, index) => {
        console.log(`🔍 Métrica ${index + 1}:`, {
          id: orden.id,
          created_at: orden.created_at,
          cliente_id: orden.cliente_id,
          total_pago: orden.pagos?.total_pago || 0,
          sede_id: orden.sede_id
        });
      });

      // Procesar datos para agrupar por día
      const metricasPorDia = new Map<string, { pedidos: number; ingresos: number }>();

      data?.forEach((orden, index) => {
        const fecha = new Date(orden.created_at).toISOString().split('T')[0];
        const ingresos = orden.pagos?.total_pago || 0;

        console.log(`🔍 Procesando orden ${index + 1} - ID: ${orden.id}:`, {
          fecha,
          ingresos,
          cliente_id: orden.cliente_id,
          existing_in_map: metricasPorDia.has(fecha)
        });

        if (metricasPorDia.has(fecha)) {
          const existing = metricasPorDia.get(fecha)!;
          existing.pedidos += 1;
          existing.ingresos += ingresos;
          console.log(`🔄 Actualizando fecha ${fecha}:`, existing);
        } else {
          metricasPorDia.set(fecha, { pedidos: 1, ingresos });
          console.log(`➕ Nueva fecha ${fecha}:`, { pedidos: 1, ingresos });
        }
      });

      // Convertir a array y calcular promedios
      const resultado: MetricsByDay[] = Array.from(metricasPorDia.entries()).map(([fecha, datos]) => ({
        fecha,
        total_pedidos: datos.pedidos,
        total_ingresos: datos.ingresos,
        promedio_por_pedido: datos.pedidos > 0 ? datos.ingresos / datos.pedidos : 0
      }));

      console.log('✅ Métricas por día obtenidas:', resultado.length);
      console.log('📊 Resultado final:', resultado);
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
          ordenes_platos(
            platos(id, name, pricing)
          ),
          ordenes_bebidas(
            bebidas(id, name, pricing)
          ),
          created_at,
          sede_id
        `)
        .gte('created_at', `${filters.fecha_inicio}T00:00:00.000Z`)
        .lte('created_at', `${filters.fecha_fin}T23:59:59.999Z`)
        .eq('status', 'Entregados');

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

      const { data, error } = await supabase
        .from('ordenes')
        .select(`
          sede_id,
          status,
          pagos!inner(total_pago),
          created_at,
          sedes!inner(name)
        `)
        .gte('created_at', `${filters.fecha_inicio}T00:00:00.000Z`)
        .lte('created_at', `${filters.fecha_fin}T23:59:59.999Z`);

      if (error) {
        console.error('❌ Error obteniendo métricas por sede:', error);
        throw new Error(`Error obteniendo métricas por sede: ${error.message}`);
      }

      // Procesar datos por sede
      const sedesMap = new Map<string, {
        nombre: string;
        completados: number;
        activos: number;
        ingresos: number;
      }>();

      data?.forEach(orden => {
        const sedeId = orden.sede_id;
        const sedeName = orden.sedes?.name || 'Sede desconocida';
        const ingresos = orden.status === 'Entregados' ? (orden.pagos?.total_pago || 0) : 0;
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
        .from('ordenes')
        .select(`
          created_at,
          sede_id
        `)
        .gte('created_at', `${filters.fecha_inicio}T00:00:00.000Z`)
        .lte('created_at', `${filters.fecha_fin}T23:59:59.999Z`)
        .eq('status', 'Entregados');

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
      console.log('📈 Obteniendo todas las métricas del dashboard:', filters);

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

      console.log('✅ Todas las métricas del dashboard obtenidas');
      return resultado;
    } catch (error) {
      console.error('❌ Error en getDashboardMetrics:', error);
      throw error;
    }
  }
}

export const metricsService = new MetricsService();