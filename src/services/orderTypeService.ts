import { supabase } from '@/lib/supabase';
import { logDebug, logInfo, logWarn, logError } from '@/utils/logger';

export interface ChangeOrderTypeParams {
  ordenId: number;
  newType: 'delivery' | 'pickup';
  currentStatus: string;
  currentType: string;
}

export interface ChangeOrderTypeResult {
  success: boolean;
  message: string;
  updatedOrder?: any;
}

/**
 * Servicio para cambiar el tipo de orden entre delivery y pickup
 */
export class OrderTypeService {
  /**
   * Valida si se puede cambiar el tipo de orden según el estado actual
   */
  canChangeOrderType(status: string): boolean {
    const validStatuses = ['Recibidos', 'Cocina', 'received', 'kitchen'];
    return validStatuses.includes(status);
  }

  /**
   * Cambia el tipo de orden de delivery a pickup o viceversa
   */
  async changeOrderType(params: ChangeOrderTypeParams): Promise<ChangeOrderTypeResult> {
    const { ordenId, newType, currentStatus, currentType } = params;

    try {
      logInfo('OrderTypeService', 'Iniciando cambio de tipo de orden', {
        ordenId,
        newType,
        currentStatus,
        currentType
      });

      // Validar que el estado permite el cambio
      if (!this.canChangeOrderType(currentStatus)) {
        const message = `No se puede cambiar el tipo de orden. El pedido está en estado "${currentStatus}". Solo se puede cambiar cuando está en "Recibidos" o "Cocina".`;
        logWarn('OrderTypeService', message, { ordenId, currentStatus });
        return {
          success: false,
          message
        };
      }

      // Validar que realmente se está haciendo un cambio
      if (currentType === newType) {
        const message = `El pedido ya es de tipo "${newType}". No hay cambios que aplicar.`;
        logWarn('OrderTypeService', message, { ordenId });
        return {
          success: false,
          message
        };
      }

      // Preparar los datos de actualización
      const updateData: any = {
        type_order: newType
      };

      // Si cambiamos de delivery a pickup, quitamos el repartidor
      if (newType === 'pickup' && currentType === 'delivery') {
        updateData.repartidor_id = null;
        logInfo('OrderTypeService', 'Cambiando a pickup: removiendo repartidor asignado', { ordenId });
      }

      // Si cambiamos de pickup a delivery, el repartidor se puede asignar después
      if (newType === 'delivery' && currentType === 'pickup') {
        logInfo('OrderTypeService', 'Cambiando a delivery: repartidor se asignará posteriormente', { ordenId });
      }

      // Ejecutar la actualización
      const { data, error } = await supabase
        .from('ordenes')
        .update(updateData)
        .eq('id', ordenId)
        .select()
        .single();

      if (error) {
        logError('OrderTypeService', 'Error al actualizar tipo de orden en BD', { error, ordenId });
        return {
          success: false,
          message: `Error al cambiar el tipo de orden: ${error.message}`
        };
      }

      // Verificar que se actualizó
      if (!data) {
        logError('OrderTypeService', 'No se recibió confirmación de la actualización', { ordenId });
        return {
          success: false,
          message: 'No se pudo confirmar el cambio del tipo de orden'
        };
      }

      logInfo('OrderTypeService', 'Tipo de orden actualizado exitosamente', {
        ordenId,
        oldType: currentType,
        newType,
        removedRepartidor: newType === 'pickup'
      });

      const successMessage = newType === 'pickup'
        ? 'Orden cambiada a RECOGIDA exitosamente. El repartidor asignado ha sido removido.'
        : 'Orden cambiada a DOMICILIO exitosamente. Podrás asignar un repartidor cuando esté lista.';

      return {
        success: true,
        message: successMessage,
        updatedOrder: data
      };

    } catch (error) {
      logError('OrderTypeService', 'Error inesperado al cambiar tipo de orden', { error, ordenId });
      return {
        success: false,
        message: `Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }

  /**
   * Obtiene información de una orden para verificar su tipo y estado
   */
  async getOrderInfo(ordenId: number): Promise<{ status: string; type_order: string; repartidor_id: number | null } | null> {
    try {
      const { data, error } = await supabase
        .from('ordenes')
        .select('status, type_order, repartidor_id')
        .eq('id', ordenId)
        .single();

      if (error) {
        logError('OrderTypeService', 'Error al obtener info de orden', { error, ordenId });
        return null;
      }

      return data;
    } catch (error) {
      logError('OrderTypeService', 'Error inesperado al obtener info de orden', { error, ordenId });
      return null;
    }
  }
}

export const orderTypeService = new OrderTypeService();
