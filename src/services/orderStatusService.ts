import { supabase } from '@/lib/supabase';
import { formatDateTimeForDisplay } from '@/utils/dateUtils';

export interface UpdateOrderStatusData {
  order_id: number;
  new_status: string;
  assigned_delivery_person_id?: string;
  extra_time?: number;
  extra_time_reason?: string;
  payment_status?: string;
}

export interface OrderStatusUpdate {
  orderId: string;
  newStatus: string;
  extraTime?: number;
  extraTimeReason?: string;
  assignedDeliveryPersonId?: string;
  paymentStatus?: string;
  paymentStatus2?: string;
}

export class OrderStatusService {
  // Actualizar estado de una orden
  async updateOrderStatus(update: OrderStatusUpdate): Promise<void> {
    try {
      console.log('🔄 Actualizando estado de orden:', update);

      const orderId = parseInt(update.orderId.replace('ORD-', ''));

      // Actualizar estado en la tabla ordenes
      if (update.newStatus) {
        const { error: statusError } = await supabase
          .from('ordenes')
          .update({ 
            status: update.newStatus
          })
          .eq('id', orderId);

        if (statusError) {
          console.error('❌ Error actualizando estado:', statusError);
          throw new Error(`Error actualizando estado: ${statusError.message}`);
        }

        // 🔄 AUTO-PAGO: Si el estado cambia a "Entregados", marcar pago como "Pagado" automáticamente
        if (update.newStatus === 'Entregados' || update.newStatus === 'delivered') {
          console.log('💰 Estado cambiado a entregado, marcando pago como pagado automáticamente...');
          
          // Obtener el payment_id de la orden
          const { data: orderData, error: orderError } = await supabase
            .from('ordenes')
            .select('payment_id')
            .eq('id', orderId)
            .single();

          if (orderError) {
            console.warn('⚠️ Error obteniendo payment_id para auto-pago:', orderError);
          } else if (orderData?.payment_id) {
            const { error: paymentError } = await supabase
              .from('pagos')
              .update({ 
                status: 'paid' // Marcar como pagado automáticamente
              })
              .eq('id', orderData.payment_id);

            if (paymentError) {
              console.warn('⚠️ Error actualizando estado de pago automáticamente:', paymentError);
            } else {
              console.log('✅ Pago marcado como "Pagado" automáticamente');
            }
          } else {
            console.log('ℹ️ Orden sin payment_id asociado, no se puede marcar pago');
          }
        }
      }

      // Actualizar repartidor asignado si se proporciona
      if (update.assignedDeliveryPersonId) {
        const { error: deliveryError } = await supabase
          .from('ordenes')
          .update({ 
            repartidor_id: update.assignedDeliveryPersonId
          })
          .eq('id', orderId);

        if (deliveryError) {
          console.error('❌ Error asignando repartidor:', deliveryError);
          throw new Error(`Error asignando repartidor: ${deliveryError.message}`);
        }
      }

      // Actualizar tiempo extra si se proporciona
      if (update.extraTime && update.extraTime > 0) {
        // Obtener la hora de entrega actual
        const { data: currentOrder, error: fetchError } = await supabase
          .from('ordenes')
          .select('hora_entrega')
          .eq('id', orderId)
          .single();

        if (fetchError) {
          console.error('❌ Error obteniendo orden actual:', fetchError);
          throw new Error(`Error obteniendo orden: ${fetchError.message}`);
        }

        if (currentOrder?.hora_entrega) {
          // Agregar tiempo extra a la hora de entrega
          const currentDeliveryTime = new Date(currentOrder.hora_entrega);
          currentDeliveryTime.setMinutes(currentDeliveryTime.getMinutes() + update.extraTime);

          const { error: timeError } = await supabase
            .from('ordenes')
            .update({ 
              hora_entrega: currentDeliveryTime.toISOString()
            })
            .eq('id', orderId);

          if (timeError) {
            console.error('❌ Error actualizando tiempo extra:', timeError);
            throw new Error(`Error actualizando tiempo: ${timeError.message}`);
          }

          // Registrar la razón del tiempo extra si se proporciona
          if (update.extraTimeReason) {
            // Aquí podrías crear una tabla de logs o comentarios si es necesario
            console.log('📝 Razón tiempo extra:', update.extraTimeReason);
          }
        }
      }

      // Actualizar estado de pago si se proporciona
      if (update.paymentStatus) {
        // Obtener el payment_id de la orden
        const { data: orderData, error: orderError } = await supabase
          .from('ordenes')
          .select('payment_id')
          .eq('id', orderId)
          .single();

        if (orderError) {
          console.error('❌ Error obteniendo payment_id:', orderError);
          throw new Error(`Error obteniendo información de pago: ${orderError.message}`);
        }

        if (orderData?.payment_id) {
          const { error: paymentError } = await supabase
            .from('pagos')
            .update({
              status: update.paymentStatus
            })
            .eq('id', orderData.payment_id);

          if (paymentError) {
            console.error('❌ Error actualizando estado de pago:', paymentError);
            throw new Error(`Error actualizando pago: ${paymentError.message}`);
          }
        }
      }

      // Actualizar estado del segundo pago si se proporciona
      if (update.paymentStatus2) {
        // Obtener el payment_id_2 de la orden
        const { data: orderData2, error: orderError2 } = await supabase
          .from('ordenes')
          .select('payment_id_2')
          .eq('id', orderId)
          .single();

        if (orderError2) {
          console.error('❌ Error obteniendo payment_id_2:', orderError2);
          throw new Error(`Error obteniendo información del segundo pago: ${orderError2.message}`);
        }

        if (orderData2?.payment_id_2) {
          const { error: paymentError2 } = await supabase
            .from('pagos')
            .update({
              status: update.paymentStatus2
            })
            .eq('id', orderData2.payment_id_2);

          if (paymentError2) {
            console.error('❌ Error actualizando estado del segundo pago:', paymentError2);
            throw new Error(`Error actualizando segundo pago: ${paymentError2.message}`);
          }
        }
      }

      console.log('✅ Estado de orden actualizado exitosamente');
    } catch (error) {
      console.error('❌ Error en updateOrderStatus:', error);
      throw error;
    }
  }

  // Actualizar múltiples órdenes
  async updateMultipleOrderStatus(updates: OrderStatusUpdate[]): Promise<void> {
    try {
      console.log('🔄 Actualizando múltiples órdenes:', updates.length);

      // Procesar actualizaciones una por una para mejor control de errores
      for (const update of updates) {
        await this.updateOrderStatus(update);
      }

      console.log('✅ Todas las órdenes actualizadas exitosamente');
    } catch (error) {
      console.error('❌ Error en updateMultipleOrderStatus:', error);
      throw error;
    }
  }

  // Obtener repartidores disponibles
  async getAvailableDeliveryPersonnel(sede_id?: string): Promise<Array<{
    id: string;
    nombre: string;
    telefono: string;
    disponible: boolean;
    ordenes_activas: number;
  }>> {
    try {
      console.log('👥 [DEBUG] Obteniendo repartidores disponibles para sede:', sede_id);
      console.log('👥 [DEBUG] Tipo de sede_id:', typeof sede_id, 'Valor:', sede_id);

      let query = supabase
        .from('repartidores')
        .select(`
          id,
          nombre,
          telefono,
          disponible,
          sede_id
        `)
        .eq('disponible', true);

      // Si se proporciona sede_id, filtrar por sede
      if (sede_id) {
        // Incluir siempre el repartidor especial id=1 en cualquier sede
        // Nota: .or aplica condiciones OR entre paréntesis lógicos
        query = query.or(`sede_id.eq.${sede_id},id.eq.1`);
        console.log('🏢 Filtrando repartidores por sede:', sede_id);
      }

      const { data, error } = await query;

      console.log('👥 [DEBUG] Query ejecutada, datos recibidos:', data?.length || 0, 'repartidores');
      console.log('👥 [DEBUG] Primeros 3 repartidores:', data?.slice(0, 3));

      if (error) {
        console.error('❌ Error obteniendo repartidores:', error);
        throw new Error(`Error obteniendo repartidores: ${error.message}`);
      }

      // Para cada repartidor, contar órdenes activas
      const repartidoresConStats = await Promise.all(
        (data || []).map(async (repartidor) => {
          const { data: ordenesActivas, error: ordenesError } = await supabase
            .from('ordenes')
            .select('id')
            .eq('repartidor_id', repartidor.id)
            .in('status', ['Cocina', 'Camino']) // Estados que se consideran activos
            .limit(10);

          if (ordenesError) {
            console.error('❌ Error contando órdenes activas:', ordenesError);
          }

          return {
            id: repartidor.id,
            nombre: repartidor.nombre,
            telefono: repartidor.telefono,
            disponible: repartidor.disponible,
            ordenes_activas: ordenesActivas?.length || 0
          };
        })
      );

      console.log('✅ [DEBUG] Repartidores finales obtenidos:', repartidoresConStats.length);
      console.log('👥 [DEBUG] Lista final de repartidores:', repartidoresConStats.map(r => ({ id: r.id, nombre: r.nombre })));
      return repartidoresConStats;
    } catch (error) {
      console.error('❌ Error en getAvailableDeliveryPersonnel:', error);
      throw error;
    }
  }

  // Obtener estados válidos para órdenes basado en el estado actual y tipo de orden
  getValidOrderStatuses(currentStatuses?: string[], orderTypes?: string[]): Array<{ value: string; label: string }> {
    // Si no hay estados actuales, devolver todos los estados
    if (!currentStatuses || currentStatuses.length === 0) {
      return [
        { value: 'Recibidos', label: 'Recibido' },
        { value: 'Cocina', label: 'En Cocina' },
        { value: 'Camino', label: 'En Camino' },
        { value: 'En espera', label: 'En Espera' },
        { value: 'Entregados', label: 'Entregado' }
      ];
    }

    // Verificar si hay órdenes de pickup en la selección
    const hasPickupOrders = orderTypes && orderTypes.some(type => type === 'pickup');
    const hasDeliveryOrders = orderTypes && orderTypes.some(type => type === 'delivery');

    // Definir el flujo secuencial para delivery
    const deliveryStatusFlow = {
      'Recibidos': ['Cocina'],
      'Cocina': ['Camino'],
      'Camino': ['Entregados'],
      'Entregados': [] // No se puede cambiar desde entregado
    };

    // Definir el flujo secuencial para pickup (usar Camino internamente pero mostrar como "En espera")
    const pickupStatusFlow = {
      'Recibidos': ['Cocina'],
      'Cocina': ['Camino'], // Usar Camino internamente para pickup
      'Camino': ['Entregados'],
      'Entregados': [] // No se puede cambiar desde entregado
    };

    // Encontrar todos los próximos estados válidos para los estados actuales
    const validNextStates = new Set<string>();
    
    currentStatuses.forEach(currentStatus => {
      // Si hay mezcla de tipos o no se especifican tipos, usar flujo de delivery por defecto
      let nextStates: string[] = [];
      
      if (hasPickupOrders && !hasDeliveryOrders) {
        // Solo órdenes de pickup
        nextStates = pickupStatusFlow[currentStatus as keyof typeof pickupStatusFlow] || [];
      } else {
        // Solo delivery o mezcla (usar delivery por defecto)
        nextStates = deliveryStatusFlow[currentStatus as keyof typeof deliveryStatusFlow] || [];
      }
      
      nextStates.forEach(state => validNextStates.add(state));
    });

    // Mapear a formato de opciones con lógica especial para pickup
    const stateLabels: Record<string, string> = {
      'Recibidos': 'Recibido',
      'Cocina': 'En Cocina',
      'Camino': hasPickupOrders && !hasDeliveryOrders ? 'En Espera' : 'En Camino',
      'Entregados': 'Entregado'
    };

    return Array.from(validNextStates).map(state => ({
      value: state,
      label: stateLabels[state] || state
    }));
  }

  // Obtener estados de pago válidos
  getValidPaymentStatuses(): Array<{ value: string; label: string }> {
    return [
      { value: 'pending', label: 'Pendiente' },
      { value: 'paid', label: 'Pagado' },
      { value: 'failed', label: 'Fallido' }
    ];
  }
}

export const orderStatusService = new OrderStatusService();