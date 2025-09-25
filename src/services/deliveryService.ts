import { supabase } from '@/lib/supabase';

export interface Repartidor {
  id: number;
  disponible: boolean;
  nombre: string | null;
  telefono: string | null;
  placas: string | null;
  sede_id: string | null;
  created_at: string;
}

export interface RepartidorConEstadisticas extends Repartidor {
  pedidos_activos: number;
  entregados: number;
  total_asignados: number;
  total_entregado: number;
  entregado_efectivo: number; // Dinero en efectivo del día
  entregado_otros: number; // Dinero por otros métodos del día
}

class DeliveryService {
  // Obtener todos los repartidores
  async getRepartidores(): Promise<Repartidor[]> {
    try {
      console.log('🚚 Consultando repartidores...');
      
      const { data, error } = await supabase
        .from('repartidores')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error al obtener repartidores:', error);
        throw new Error(`Error al obtener repartidores: ${error.message}`);
      }

      console.log('✅ Repartidores obtenidos:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('❌ Error en getRepartidores:', error);
      throw error;
    }
  }

  // Función de prueba para verificar datos
  async testData(): Promise<void> {
    try {
      console.log('🧪 Probando datos de la base de datos...');
      
      // Verificar repartidores
      const { data: repartidores, error: errorRepartidores } = await supabase
        .from('repartidores')
        .select('*');
      
      console.log('📊 Repartidores encontrados:', repartidores?.length || 0);
      if (repartidores && repartidores.length > 0) {
        console.log('📊 Primer repartidor:', repartidores[0]);
      }
      
      // Verificar órdenes
      const { data: ordenes, error: errorOrdenes } = await supabase
        .from('ordenes')
        .select('*');
      
      console.log('📊 Órdenes encontradas:', ordenes?.length || 0);
      if (ordenes && ordenes.length > 0) {
        console.log('📊 Primera orden:', ordenes[0]);
      }
      
      // Verificar órdenes con repartidor asignado
      const { data: ordenesConRepartidor, error: errorOrdenesConRepartidor } = await supabase
        .from('ordenes')
        .select('*')
        .not('repartidor_id', 'is', null);
      
      console.log('📊 Órdenes con repartidor asignado:', ordenesConRepartidor?.length || 0);
      if (ordenesConRepartidor && ordenesConRepartidor.length > 0) {
        console.log('📊 Primera orden con repartidor:', ordenesConRepartidor[0]);
      }
      
    } catch (error) {
      console.error('❌ Error en testData:', error);
    }
  }

  // Obtener repartidores con estadísticas usando SQL personalizado
  async getRepartidoresConEstadisticas(sedeId?: string): Promise<RepartidorConEstadisticas[]> {
    try {
      console.log('📊 Consultando repartidores con estadísticas...', sedeId ? `para sede: ${sedeId}` : 'todas las sedes');
      
      // Construir query base
      let query = supabase
        .from('repartidores')
        .select('*')
        .order('created_at', { ascending: false });

      // Filtrar por sede si se proporciona, pero incluir siempre el repartidor especial id=1
      if (sedeId) {
        query = query.or(`sede_id.eq.${sedeId},id.eq.1`);
      }

      const { data: repartidores, error: errorRepartidores } = await query;

      if (errorRepartidores) {
        console.error('❌ Error al obtener repartidores:', errorRepartidores);
        throw new Error(`Error al obtener repartidores: ${errorRepartidores.message}`);
      }

      if (!repartidores || repartidores.length === 0) {
        console.log('ℹ️ No hay repartidores registrados');
        return [];
      }

      // Para cada repartidor, obtenemos sus estadísticas usando SQL directo
      const repartidoresConStats = await Promise.all(
        repartidores.map(async (repartidor) => {
          // Para el repartidor especial id=1, no calcular estadísticas
          if (repartidor.id === 1) {
            return {
              ...repartidor,
              pedidos_activos: 0,
              entregados: 0,
              total_asignados: 0,
              total_entregado: 0,
              entregado_efectivo: 0,
              entregado_otros: 0
            } as RepartidorConEstadisticas;
          }
          try {
            console.log(`📊 Obteniendo estadísticas para repartidor ${repartidor.id}...`);
            
            // Crear rango de fechas del día actual (Colombia timezone)
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

            // Query SQL directo para obtener estadísticas del repartidor
            const { data: stats, error: errorStats } = await supabase
              .from('ordenes')
              .select(`
                id,
                status,
                payment_id,
                created_at,
                pagos!inner(total_pago, type)
              `)
              .eq('repartidor_id', repartidor.id);

            if (errorStats) {
              console.error(`❌ Error al obtener estadísticas para repartidor ${repartidor.id}:`, errorStats);
              // Retornar valores por defecto si hay error
              return {
                ...repartidor,
                pedidos_activos: 0,
                entregados: 0,
                total_asignados: 0,
                total_entregado: 0,
                entregado_efectivo: 0,
                entregado_otros: 0
              };
            }

            // Filtrar órdenes del día de hoy
            const ordersToday = stats?.filter(order => {
              const orderDate = new Date(order.created_at);
              return orderDate >= startOfDay && orderDate <= endOfDay;
            }) || [];

            // Calcular estadísticas manualmente (activos de cualquier día)
            const pedidosActivos = stats?.filter(order => 
              ['Recibidos', 'Cocina', 'Camino'].includes(order.status)
            ).length || 0;
            
            // Entregados solo del día de hoy
            const entregadosHoy = ordersToday.filter(order => 
              order.status === 'Entregados'
            );
            
            const totalAsignados = stats?.length || 0;
            
            // Calcular totales por método de pago (solo entregas de hoy)
            const entregadosEfectivo = entregadosHoy
              .filter(order => order.pagos?.type === 'efectivo')
              .reduce((sum, order) => sum + (order.pagos?.total_pago || 0), 0);
              
            const entregadosOtros = entregadosHoy
              .filter(order => order.pagos?.type !== 'efectivo')
              .reduce((sum, order) => sum + (order.pagos?.total_pago || 0), 0);
            
            const totalEntregadoHoy = entregadosEfectivo + entregadosOtros;

            const estadisticas = {
              pedidos_activos: pedidosActivos,
              entregados: entregadosHoy.length, // Solo entregas de hoy
              total_asignados: totalAsignados,
              total_entregado: totalEntregadoHoy, // Solo del día de hoy
              entregado_efectivo: entregadosEfectivo, // Nuevo campo
              entregado_otros: entregadosOtros // Nuevo campo
            };

            console.log(`📊 Estadísticas calculadas para repartidor ${repartidor.id}:`, estadisticas);

            return {
              ...repartidor,
              pedidos_activos: estadisticas.pedidos_activos,
              entregados: estadisticas.entregados,
              total_asignados: estadisticas.total_asignados,
              total_entregado: estadisticas.total_entregado,
              entregado_efectivo: estadisticas.entregado_efectivo,
              entregado_otros: estadisticas.entregado_otros
            };
          } catch (error) {
            console.error(`❌ Error procesando estadísticas para repartidor ${repartidor.id}:`, error);
            return {
              ...repartidor,
              pedidos_activos: 0,
              entregados: 0,
              total_asignados: 0,
              total_entregado: 0,
              entregado_efectivo: 0,
              entregado_otros: 0
            };
          }
        })
      );

      console.log('✅ Repartidores con estadísticas obtenidos:', repartidoresConStats.length);
      return repartidoresConStats;
    } catch (error) {
      console.error('❌ Error en getRepartidoresConEstadisticas:', error);
      throw error;
    }
  }

  // Crear nuevo repartidor
  async crearRepartidor(repartidor: Omit<Repartidor, 'id' | 'created_at'>): Promise<Repartidor> {
    try {
      console.log('➕ Creando nuevo repartidor:', repartidor);
      
      const { data, error } = await supabase
        .from('repartidores')
        .insert([repartidor])
        .select()
        .single();

      if (error) {
        console.error('❌ Error al crear repartidor:', error);
        throw new Error(`Error al crear repartidor: ${error.message}`);
      }

      console.log('✅ Repartidor creado exitosamente:', data);
      return data;
    } catch (error) {
      console.error('❌ Error en crearRepartidor:', error);
      throw error;
    }
  }

  // Actualizar repartidor
  async actualizarRepartidor(id: number, updates: Partial<Repartidor>): Promise<Repartidor> {
    try {
      console.log('🔄 Actualizando repartidor:', { id, updates });
      
      const { data, error } = await supabase
        .from('repartidores')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error al actualizar repartidor:', error);
        throw new Error(`Error al actualizar repartidor: ${error.message}`);
      }

      console.log('✅ Repartidor actualizado exitosamente:', data);
      return data;
    } catch (error) {
      console.error('❌ Error en actualizarRepartidor:', error);
      throw error;
    }
  }

  // Eliminar repartidor
  async eliminarRepartidor(id: number): Promise<void> {
    try {
      console.log('🗑️ Eliminando repartidor:', id);
      
      // Verificar si tiene pedidos activos
      const { count: pedidosActivos, error: errorVerificacion } = await supabase
        .from('ordenes')
        .select('*', { count: 'exact', head: true })
        .eq('repartidor_id', id)
        .in('status', ['received', 'kitchen', 'delivery']);

      if (errorVerificacion) {
        console.error('❌ Error al verificar pedidos activos:', errorVerificacion);
        throw new Error(`Error al verificar pedidos activos: ${errorVerificacion.message}`);
      }

      if (pedidosActivos && pedidosActivos > 0) {
        throw new Error('No se puede eliminar el repartidor porque tiene pedidos activos asignados');
      }

      const { error } = await supabase
        .from('repartidores')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Error al eliminar repartidor:', error);
        throw new Error(`Error al eliminar repartidor: ${error.message}`);
      }

      console.log('✅ Repartidor eliminado exitosamente');
    } catch (error) {
      console.error('❌ Error en eliminarRepartidor:', error);
      throw error;
    }
  }

  // Cambiar disponibilidad del repartidor
  async cambiarDisponibilidad(id: number, disponible: boolean): Promise<Repartidor> {
    try {
      console.log('🔄 Cambiando disponibilidad del repartidor:', { id, disponible });
      
      return await this.actualizarRepartidor(id, { disponible });
    } catch (error) {
      console.error('❌ Error en cambiarDisponibilidad:', error);
      throw error;
    }
  }

  // Obtener total de órdenes asignadas pendientes (filtrado por sede)
  async getTotalOrdenesAsignadasPendientes(sedeId?: string): Promise<number> {
    try {
      console.log('📊 Consultando órdenes asignadas pendientes...', sedeId ? `para sede: ${sedeId}` : 'todas las sedes');
      
      // Construir query base
      let query = supabase
        .from('ordenes')
        .select('*', { count: 'exact', head: true })
        .not('repartidor_id', 'is', null)
        .neq('status', 'Entregados');

      // Filtrar por sede si se proporciona
      if (sedeId) {
        query = query.eq('sede_id', sedeId);
      }

      const { count, error } = await query;

      if (error) {
        console.error('❌ Error al obtener órdenes asignadas pendientes:', error);
        throw new Error(`Error al obtener órdenes asignadas: ${error.message}`);
      }

      console.log('✅ Órdenes asignadas pendientes:', count || 0);
      return count || 0;
    } catch (error) {
      console.error('❌ Error en getTotalOrdenesAsignadasPendientes:', error);
      throw error;
    }
  }

  // Obtener historial de pedidos de un repartidor
  async getHistorialRepartidor(repartidorId: number): Promise<any[]> {
    try {
      console.log('📋 Consultando historial del repartidor:', repartidorId);
      
      const { data, error } = await supabase
        .from('ordenes')
        .select(`
          *,
          clientes (
            nombre,
            telefono,
            direccion
          ),
          pagos (
            total_pago,
            type
          )
        `)
        .eq('repartidor_id', repartidorId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error al obtener historial del repartidor:', error);
        throw new Error(`Error al obtener historial: ${error.message}`);
      }

      console.log('✅ Historial obtenido:', data?.length || 0, 'pedidos');
      return data || [];
    } catch (error) {
      console.error('❌ Error en getHistorialRepartidor:', error);
      throw error;
    }
  }
}

export const deliveryService = new DeliveryService(); 