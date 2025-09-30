import { supabase } from '@/lib/supabase';
import type {
  Payment,
  PaymentBreakdown,
  PaymentValidation,
  CreateMultiPaymentRequest,
  UpdatePaymentStatusRequest,
  PaymentMethod
} from '@/types/payment';

export class MultiPaymentService {

  /**
   * Obtener el desglose de pagos de una orden
   */
  async getOrderPaymentBreakdown(orderId: number): Promise<PaymentBreakdown | null> {
    try {
      console.log('🔍 Obteniendo desglose de pagos para orden:', orderId);

      // Obtener información de la orden con ambos payment_ids
      const { data: orderData, error: orderError } = await supabase
        .from('ordenes')
        .select(`
          id,
          payment_id,
          payment_id_2,
          pagos!payment_id(id, type, status, total_pago, created_at, updated_at),
          pagos_secondary:pagos!payment_id_2(id, type, status, total_pago, created_at, updated_at)
        `)
        .eq('id', orderId)
        .single();

      if (orderError || !orderData) {
        console.error('❌ Error obteniendo orden:', orderError);
        return null;
      }

      // Calcular total de la orden (sumar productos + envío)
      const { data: totalData } = await supabase.rpc('calculate_order_total', { order_id: orderId });
      const totalOrder = totalData || 0;

      const payment1 = orderData.pagos as any;
      const payment2 = orderData.pagos_secondary as any;

      let totalPaid = 0;
      let primaryPaymentMethod: PaymentMethod = 'efectivo';

      const breakdown: PaymentBreakdown = {
        totalOrder,
        totalPaid: 0,
        isComplete: false,
        primaryPaymentMethod: 'efectivo',
        hasMultiplePayments: !!(payment1 && payment2)
      };

      // Procesar pago principal
      if (payment1) {
        breakdown.payment1 = {
          ...payment1,
          amount: payment1.total_pago || 0
        };
        totalPaid += payment1.total_pago || 0;
        primaryPaymentMethod = payment1.type || 'efectivo';
      }

      // Procesar pago secundario
      if (payment2) {
        breakdown.payment2 = {
          ...payment2,
          amount: payment2.total_pago || 0
        };
        totalPaid += payment2.total_pago || 0;

        // Si el pago secundario tiene más monto, es el principal
        if ((payment2.total_pago || 0) > (payment1?.total_pago || 0)) {
          primaryPaymentMethod = payment2.type || primaryPaymentMethod;
        }
      }

      breakdown.totalPaid = totalPaid;
      breakdown.primaryPaymentMethod = primaryPaymentMethod;
      breakdown.isComplete = Math.abs(totalPaid - totalOrder) < 1; // Tolerancia de 1 peso

      console.log('✅ Desglose de pagos obtenido:', breakdown);
      return breakdown;

    } catch (error) {
      console.error('❌ Error en getOrderPaymentBreakdown:', error);
      return null;
    }
  }

  /**
   * Validar que los pagos sumen el total de la orden
   */
  validatePaymentAmounts(payments: Array<{amount: number}>, totalOrder: number): PaymentValidation {
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const difference = totalPaid - totalOrder;

    const validation: PaymentValidation = {
      isValid: Math.abs(difference) < 1, // Tolerancia de 1 peso
      totalPaid,
      totalOrder,
      difference,
      errors: []
    };

    if (totalPaid < totalOrder - 1) {
      validation.errors.push(`Falta dinero: ${Math.abs(difference).toLocaleString('es-CO', {style: 'currency', currency: 'COP'})}`);
    } else if (totalPaid > totalOrder + 1) {
      validation.errors.push(`Sobra dinero: ${difference.toLocaleString('es-CO', {style: 'currency', currency: 'COP'})}`);
    }

    if (payments.some(p => p.amount <= 0)) {
      validation.errors.push('Todos los pagos deben ser mayor a $0');
    }

    if (payments.length > 2) {
      validation.errors.push('Máximo 2 métodos de pago permitidos');
    }

    return validation;
  }

  /**
   * Crear múltiples pagos para una orden
   */
  async createMultiPayment(request: CreateMultiPaymentRequest): Promise<boolean> {
    try {
      console.log('💳 Creando múltiples pagos:', request);

      // Validar montos
      const validation = this.validatePaymentAmounts(request.payments, request.totalAmount);
      if (!validation.isValid) {
        console.error('❌ Validación fallida:', validation.errors);
        throw new Error(`Validación de pagos fallida: ${validation.errors.join(', ')}`);
      }

      // Crear registros de pago
      const paymentIds: number[] = [];

      for (const payment of request.payments) {
        const { data: pagoData, error: pagoError } = await supabase
          .from('pagos')
          .insert({
            type: payment.type,
            status: payment.status || 'pagado',
            total_pago: payment.amount
          })
          .select('id')
          .single();

        if (pagoError || !pagoData) {
          console.error('❌ Error creando pago:', pagoError);
          throw new Error('Error creando registro de pago');
        }

        paymentIds.push(pagoData.id);
      }

      // Actualizar orden con los payment_ids
      const updateData: any = {
        payment_id: paymentIds[0]
      };

      if (paymentIds[1]) {
        updateData.payment_id_2 = paymentIds[1];
      }

      const { error: updateError } = await supabase
        .from('ordenes')
        .update(updateData)
        .eq('id', request.orderId);

      if (updateError) {
        console.error('❌ Error actualizando orden:', updateError);
        throw new Error('Error vinculando pagos a la orden');
      }

      console.log('✅ Múltiples pagos creados exitosamente');
      return true;

    } catch (error) {
      console.error('❌ Error en createMultiPayment:', error);
      throw error;
    }
  }

  /**
   * Actualizar estado de un pago específico
   */
  async updatePaymentStatus(request: UpdatePaymentStatusRequest): Promise<boolean> {
    try {
      console.log('🔄 Actualizando estado de pago:', request);

      const { error } = await supabase
        .from('pagos')
        .update({
          status: request.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.paymentId);

      if (error) {
        console.error('❌ Error actualizando estado:', error);
        return false;
      }

      console.log('✅ Estado de pago actualizado');
      return true;

    } catch (error) {
      console.error('❌ Error en updatePaymentStatus:', error);
      return false;
    }
  }

  /**
   * Obtener formato de visualización para el dashboard
   */
  formatPaymentForDashboard(breakdown: PaymentBreakdown): {
    displayText: string;
    hasMultiple: boolean;
    primaryMethod: PaymentMethod;
  } {
    if (!breakdown.hasMultiplePayments) {
      return {
        displayText: breakdown.primaryPaymentMethod,
        hasMultiple: false,
        primaryMethod: breakdown.primaryPaymentMethod
      };
    }

    return {
      displayText: `${breakdown.primaryPaymentMethod} +1`,
      hasMultiple: true,
      primaryMethod: breakdown.primaryPaymentMethod
    };
  }
}

// Instancia singleton del servicio
export const multiPaymentService = new MultiPaymentService();