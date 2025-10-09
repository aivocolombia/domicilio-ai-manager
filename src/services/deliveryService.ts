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
  entregado_tarjeta: number; // Dinero por tarjeta del día
  entregado_nequi: number; // Dinero por Nequi del día
  entregado_transferencia: number; // Dinero por transferencia del día
  entregado_otros: number; // Dinero por otros métodos del día (para compatibilidad)
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
  async getRepartidoresConEstadisticas(sedeId?: string, filterDate?: Date): Promise<RepartidorConEstadisticas[]> {
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
          // Para el repartidor especial id=1 (Pickap), calcular estadísticas filtradas por sede
          if (repartidor.id === 1 && sedeId) {
            console.log(`📊 Calculando estadísticas de Pickap para sede específica: ${sedeId}`);
          }
          try {
            console.log(`📊 Obteniendo estadísticas para repartidor ${repartidor.id}...`);
            
            // Crear rango de fechas (Colombia timezone UTC-5)
            // FIX: Corregir el manejo de la zona horaria para filtrar correctamente el día.
            // El método anterior era propenso a errores. Este es más robusto.
            const targetDate = filterDate || new Date();
            const year = targetDate.getFullYear();
            const month = targetDate.getMonth();
            const day = targetDate.getDate();
            
            // Establecer el inicio y fin del día en la zona horaria local del navegador (que debe ser Colombia)
            const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
            const endOfDay = new Date(year, month, day, 23, 59, 59, 999);

            // Query SQL directo para obtener estadísticas del repartidor
            console.log(`🔍 [DEBUG] Obteniendo órdenes para repartidor ${repartidor.id}${sedeId && repartidor.id === 1 ? ` filtradas por sede ${sedeId}` : ''}`);

            let query = supabase
              .from('ordenes')
              .select(`
                id,
                status,
                payment_id,
                payment_id_2,
                created_at,
                sede_id
              `)
              .eq('repartidor_id', repartidor.id);

            // Para el repartidor especial (id=1, Pickap), filtrar también por sede si se especifica
            if (repartidor.id === 1 && sedeId) {
              query = query.eq('sede_id', sedeId);
            }

            const { data: stats, error: errorStats } = await query;

            console.log(`📊 [DEBUG] Órdenes encontradas para repartidor ${repartidor.id}:`, stats?.length || 0);

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
                entregado_tarjeta: 0,
                entregado_nequi: 0,
                entregado_transferencia: 0,
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

            // Total asignados solo del día de hoy
            const totalAsignados = ordersToday.length;

            // Obtener información de pagos para las órdenes entregadas hoy con desglose detallado
            let entregadosEfectivo = 0;
            let entregadosTarjeta = 0;
            let entregadosNequi = 0;
            let entregadosTransferencia = 0;
            let entregadosOtros = 0;

            if (entregadosHoy.length > 0) {
              // Obtener payment_ids de las órdenes entregadas hoy
              const paymentIds = [];
              entregadosHoy.forEach(order => {
                if (order.payment_id) paymentIds.push(order.payment_id);
                if (order.payment_id_2) paymentIds.push(order.payment_id_2);
              });

              if (paymentIds.length > 0) {
                console.log(`💳 [DEBUG] Consultando ${paymentIds.length} pagos para repartidor ${repartidor.id}`);
                const { data: pagos, error: errorPagos } = await supabase
                  .from('pagos')
                  .select('total_pago, type')
                  .in('id', paymentIds);

                if (!errorPagos && pagos) {
                  // Desglosar por tipo específico de pago
                  entregadosEfectivo = pagos
                    .filter(pago => pago.type === 'efectivo')
                    .reduce((sum, pago) => sum + (pago.total_pago || 0), 0);

                  entregadosTarjeta = pagos
                    .filter(pago => pago.type === 'tarjeta')
                    .reduce((sum, pago) => sum + (pago.total_pago || 0), 0);

                  entregadosNequi = pagos
                    .filter(pago => pago.type === 'nequi')
                    .reduce((sum, pago) => sum + (pago.total_pago || 0), 0);

                  entregadosTransferencia = pagos
                    .filter(pago => pago.type === 'transferencia')
                    .reduce((sum, pago) => sum + (pago.total_pago || 0), 0);

                  // Otros métodos de pago no clasificados
                  entregadosOtros = pagos
                    .filter(pago => !['efectivo', 'tarjeta', 'nequi', 'transferencia'].includes(pago.type))
                    .reduce((sum, pago) => sum + (pago.total_pago || 0), 0);
                } else {
                  console.warn(`⚠️ [DEBUG] Error obteniendo pagos para repartidor ${repartidor.id}:`, errorPagos);
                }
              }
            }

            const totalEntregadoHoy = entregadosEfectivo + entregadosTarjeta + entregadosNequi + entregadosTransferencia + entregadosOtros;

            console.log(`💰 [DEBUG] Cálculos financieros para repartidor ${repartidor.id}:`, {
              entregadosHoy: entregadosHoy.length,
              totalEntregadoHoy,
              entregadosEfectivo,
              entregadosTarjeta,
              entregadosNequi,
              entregadosTransferencia,
              entregadosOtros
            });

            const estadisticas = {
              pedidos_activos: pedidosActivos,
              entregados: entregadosHoy.length, // Solo entregas de hoy
              total_asignados: totalAsignados,
              total_entregado: totalEntregadoHoy, // Solo del día de hoy
              entregado_efectivo: entregadosEfectivo,
              entregado_tarjeta: entregadosTarjeta,
              entregado_nequi: entregadosNequi,
              entregado_transferencia: entregadosTransferencia,
              entregado_otros: entregadosOtros
            };

            console.log(`📊 Estadísticas calculadas para repartidor ${repartidor.id}:`, estadisticas);

            return {
              ...repartidor,
              pedidos_activos: estadisticas.pedidos_activos,
              entregados: estadisticas.entregados,
              total_asignados: estadisticas.total_asignados,
              total_entregado: estadisticas.total_entregado,
              entregado_efectivo: estadisticas.entregado_efectivo,
              entregado_tarjeta: estadisticas.entregado_tarjeta,
              entregado_nequi: estadisticas.entregado_nequi,
              entregado_transferencia: estadisticas.entregado_transferencia,
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
              entregado_tarjeta: 0,
              entregado_nequi: 0,
              entregado_transferencia: 0,
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
  async getHistorialRepartidor(repartidorId: number, sedeId?: string): Promise<any[]> {
    try {
      console.log('📋 [DEBUG] Consultando historial del repartidor:', repartidorId, sedeId && repartidorId === 1 ? `filtrado por sede ${sedeId}` : '');

      // Construir query para obtener órdenes del repartidor
      let query = supabase
        .from('ordenes')
        .select(`
          *,
          clientes (
            nombre,
            telefono,
            direccion
          )
        `)
        .eq('repartidor_id', repartidorId);

      // Para el repartidor especial (id=1, Pickap), filtrar también por sede si se especifica
      if (repartidorId === 1 && sedeId) {
        query = query.eq('sede_id', sedeId);
      }

      const { data: ordenes, error: ordenesError } = await query.order('created_at', { ascending: false });

      if (ordenesError) {
        console.error('❌ Error al obtener órdenes del repartidor:', ordenesError);
        throw new Error(`Error al obtener historial: ${ordenesError.message}`);
      }

      console.log('📋 [DEBUG] Órdenes obtenidas:', ordenes?.length || 0);

      // Para cada orden, obtener información de pagos si existe
      const ordenesConPagos = await Promise.all(
        (ordenes || []).map(async (orden) => {
          try {
            let pagos = null;

            // Intentar obtener pago principal
            if (orden.payment_id) {
              const { data: pagoData, error: pagoError } = await supabase
                .from('pagos')
                .select('total_pago, type')
                .eq('id', orden.payment_id)
                .single();

              if (!pagoError && pagoData) {
                pagos = pagoData;
              }
            }

            // Si no hay pago principal, intentar con payment_id_2
            if (!pagos && orden.payment_id_2) {
              const { data: pagoData2, error: pagoError2 } = await supabase
                .from('pagos')
                .select('total_pago, type')
                .eq('id', orden.payment_id_2)
                .single();

              if (!pagoError2 && pagoData2) {
                pagos = pagoData2;
              }
            }

            console.log(`💳 [DEBUG] Pago para orden ${orden.id}:`, pagos);

            return {
              ...orden,
              pagos: pagos
            };
          } catch (error) {
            console.warn(`⚠️ [DEBUG] Error obteniendo pago para orden ${orden.id}:`, error);
            return {
              ...orden,
              pagos: null
            };
          }
        })
      );

      console.log('✅ [DEBUG] Historial completo obtenido:', ordenesConPagos.length, 'pedidos con información de pagos');
      return ordenesConPagos;
    } catch (error) {
      console.error('❌ Error en getHistorialRepartidor:', error);
      throw error;
    }
  }
}

export const deliveryService = new DeliveryService(); 