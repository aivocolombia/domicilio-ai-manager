import { supabase } from '@/lib/supabase';
import { formatDateForQuery } from '@/utils/dateUtils';

export interface DiscountApplication {
  orderId: number;
  discountAmount: number;
  discountComment: string;
  appliedBy: string;
  appliedDate: string;
}

export interface DiscountValidation {
  isValid: boolean;
  error?: string;
  allowedStatuses: string[];
}

export interface DiscountRequest {
  orderId: number;
  discountAmount: number;
  discountComment: string;
  userId: string;
  userRole: string;
  userSedeId: string;
  targetPaymentId?: number; // ID específico del pago al que aplicar el descuento
}

export interface PaymentOption {
  paymentId: number;
  type: string;
  amount: number;
  isPrimary: boolean;
  displayName: string;
}

export interface DiscountMetrics {
  totalDiscounts: number;
  totalDiscountAmount: number;
  averageDiscount: number;
  discountsByStatus: Record<string, number>;
  recentDiscounts: DiscountApplication[];
}

export class DiscountService {
  // Estados permitidos para aplicar descuentos (tanto en inglés como español)
  private readonly allowedStatuses = [
    'received', 'kitchen', 'delivery', 'delivered', // Estados en inglés
    'Recibidos', 'Cocina', 'Camino', 'Entregados'   // Estados en español (base de datos)
  ];

  // Validar permisos para aplicar descuentos
  async validateDiscountPermissions(userId: string, userRole: string, userSedeId: string, orderId: number): Promise<DiscountValidation> {
    try {
      console.log('🔍 DiscountService: Validando permisos de descuento');
      console.log('📋 Usuario:', { userId, userRole, userSedeId });
      console.log('📋 Orden ID:', orderId);

      // Solo admin_punto y admin_global pueden aplicar descuentos
      if (!['admin_punto', 'admin_global'].includes(userRole)) {
        console.log('❌ Rol no autorizado:', userRole);
        return {
          isValid: false,
          error: 'Solo administradores pueden aplicar descuentos',
          allowedStatuses: this.allowedStatuses
        };
      }

      // Obtener información de la orden
      const { data: orderData, error: orderError } = await supabase
        .from('ordenes')
        .select('id, status, sede_id, descuento_valor')
        .eq('id', orderId)
        .single();

      if (orderError || !orderData) {
        console.error('❌ Error obteniendo orden:', orderError);
        return {
          isValid: false,
          error: 'Orden no encontrada',
          allowedStatuses: this.allowedStatuses
        };
      }

      console.log('📋 Datos de la orden:', orderData);

      // admin_punto solo puede aplicar descuentos en su sede
      if (userRole === 'admin_punto' && orderData.sede_id !== userSedeId) {
        console.log('❌ Sede no autorizada. Usuario sede:', userSedeId, 'Orden sede:', orderData.sede_id);
        return {
          isValid: false,
          error: 'No tienes permisos para aplicar descuentos en esta sede',
          allowedStatuses: this.allowedStatuses
        };
      }

      // Validar estado de la orden
      if (!this.allowedStatuses.includes(orderData.status)) {
        console.log('❌ Estado no permitido:', orderData.status);
        console.log('📋 Estados permitidos:', this.allowedStatuses);

        // Proporcionar mensaje más específico basado en el estado
        let errorMessage = 'No se pueden aplicar descuentos a órdenes canceladas';
        if (orderData.status === 'Cancelado' || orderData.status === 'cancelled') {
          errorMessage = 'No se pueden aplicar descuentos a órdenes canceladas';
        } else {
          errorMessage = `No se pueden aplicar descuentos a órdenes con estado: ${orderData.status}`;
        }

        return {
          isValid: false,
          error: errorMessage,
          allowedStatuses: this.allowedStatuses
        };
      }

      // Validar que no tenga descuento ya aplicado
      if (orderData.descuento_valor && orderData.descuento_valor > 0) {
        console.log('❌ Orden ya tiene descuento aplicado:', orderData.descuento_valor);
        return {
          isValid: false,
          error: `Esta orden ya tiene un descuento aplicado de $${orderData.descuento_valor.toLocaleString()}`,
          allowedStatuses: this.allowedStatuses
        };
      }

      console.log('✅ Validación de permisos exitosa');
      return {
        isValid: true,
        allowedStatuses: this.allowedStatuses
      };
    } catch (error) {
      console.error('❌ Error en validateDiscountPermissions:', error);
      return {
        isValid: false,
        error: 'Error al validar permisos',
        allowedStatuses: this.allowedStatuses
      };
    }
  }

  // Validar solicitud de descuento básica (sin total)
  validateDiscountRequest(discountAmount: number, discountComment: string): { isValid: boolean; error?: string } {
    // Validar monto del descuento
    if (!discountAmount || discountAmount <= 0) {
      return {
        isValid: false,
        error: 'El monto del descuento debe ser mayor a 0'
      };
    }

    if (discountAmount > 100000) {
      return {
        isValid: false,
        error: 'El monto del descuento no puede exceder $100,000'
      };
    }

    // Validar comentario obligatorio
    if (!discountComment || discountComment.trim().length === 0) {
      return {
        isValid: false,
        error: 'El comentario es obligatorio para aplicar descuentos'
      };
    }

    if (discountComment.trim().length < 10) {
      return {
        isValid: false,
        error: 'El comentario debe tener al menos 10 caracteres'
      };
    }

    if (discountComment.trim().length > 500) {
      return {
        isValid: false,
        error: 'El comentario no puede exceder 500 caracteres'
      };
    }

    return { isValid: true };
  }

  // Validar descuento contra el total de la orden
  validateDiscountAgainstTotal(discountAmount: number, orderTotal: number): { isValid: boolean; error?: string } {
    if (discountAmount > orderTotal) {
      return {
        isValid: false,
        error: `El descuento ($${discountAmount.toLocaleString()}) no puede ser mayor al total de la orden ($${orderTotal.toLocaleString()})`
      };
    }

    if (discountAmount === orderTotal) {
      return {
        isValid: false,
        error: 'El descuento no puede ser igual al total de la orden (total quedaría en $0)'
      };
    }

    return { isValid: true };
  }

  // Aplicar descuento a una orden
  async applyDiscount(request: DiscountRequest): Promise<DiscountApplication> {
    try {
      console.log('💰 DiscountService: Aplicando descuento');
      console.log('📋 Solicitud:', request);

      // Validar permisos
      const permissionValidation = await this.validateDiscountPermissions(
        request.userId,
        request.userRole,
        request.userSedeId,
        request.orderId
      );

      if (!permissionValidation.isValid) {
        console.log('❌ Permisos insuficientes:', permissionValidation.error);
        throw new Error(`Permisos Insuficientes - ${permissionValidation.error}`);
      }

      // Validar solicitud
      const requestValidation = this.validateDiscountRequest(request.discountAmount, request.discountComment);
      if (!requestValidation.isValid) {
        console.log('❌ Solicitud inválida:', requestValidation.error);
        throw new Error(`Solicitud Inválida - ${requestValidation.error}`);
      }

      // Obtener opciones de pago disponibles
      const paymentOptions = await this.getOrderPaymentOptions(request.orderId);

      if (paymentOptions.length === 0) {
        throw new Error('No se encontraron métodos de pago para esta orden');
      }

      // Determinar a qué pago aplicar el descuento
      let targetPayment: PaymentOption;

      if (request.targetPaymentId) {
        // Buscar el pago específico seleccionado
        const selectedPayment = paymentOptions.find(p => p.paymentId === request.targetPaymentId);
        if (!selectedPayment) {
          throw new Error('El método de pago seleccionado no existe para esta orden');
        }
        targetPayment = selectedPayment;
      } else {
        // Si no se especificó, usar el pago principal (o el único si hay uno solo)
        targetPayment = paymentOptions.find(p => p.isPrimary) || paymentOptions[0];
      }

      console.log('💳 Aplicando descuento a pago:', {
        paymentId: targetPayment.paymentId,
        type: targetPayment.type,
        amount: targetPayment.amount
      });

      // Validar descuento contra el monto del pago seleccionado
      const paymentValidation = this.validateDiscountAgainstTotal(request.discountAmount, targetPayment.amount);
      if (!paymentValidation.isValid) {
        console.log('❌ Descuento inválido contra pago:', paymentValidation.error);
        throw new Error(`Descuento Inválido - ${paymentValidation.error}`);
      }

      const newPaymentAmount = Math.max(0, targetPayment.amount - request.discountAmount);

      console.log('💰 Calculando nuevo monto de pago:', {
        originalAmount: targetPayment.amount,
        discountAmount: request.discountAmount,
        newAmount: newPaymentAmount,
        paymentType: targetPayment.type
      });

      // Aplicar descuento en la base de datos (transacción)
      const appliedDate = new Date().toISOString();

      // Preparar comentario con información del método de pago
      const paymentInfo = paymentOptions.length > 1
        ? ` (aplicado a ${targetPayment.type}: $${targetPayment.amount.toLocaleString()})`
        : '';

      const fullComment = `${request.discountComment.trim()}${paymentInfo}`;

      // Actualizar campos de descuento en la orden
      const { error: updateOrderError } = await supabase
        .from('ordenes')
        .update({
          descuento_valor: request.discountAmount,
          descuento_comentario: fullComment,
          descuento_aplicado_por: request.userId,
          descuento_aplicado_fecha: appliedDate
        })
        .eq('id', request.orderId);

      if (updateOrderError) {
        console.error('❌ Error actualizando orden:', updateOrderError);
        throw new Error(`Error aplicando descuento en orden: ${updateOrderError.message}`);
      }

      // Actualizar el monto del pago específico
      const { error: updatePaymentError } = await supabase
        .from('pagos')
        .update({
          total_pago: newPaymentAmount
        })
        .eq('id', targetPayment.paymentId);

      if (updatePaymentError) {
        console.error('❌ Error actualizando monto de pago:', updatePaymentError);
        throw new Error(`Error actualizando monto de pago: ${updatePaymentError.message}`);
      }

      console.log('✅ Monto de pago actualizado:', {
        paymentId: targetPayment.paymentId,
        paymentType: targetPayment.type,
        originalAmount: targetPayment.amount,
        newAmount: newPaymentAmount,
        discount: request.discountAmount
      });

      const discountApplication: DiscountApplication = {
        orderId: request.orderId,
        discountAmount: request.discountAmount,
        discountComment: fullComment,
        appliedBy: request.userId,
        appliedDate
      };

      console.log('✅ Descuento aplicado exitosamente:', discountApplication);
      return discountApplication;
    } catch (error) {
      console.error('❌ Error en applyDiscount:', error);
      throw error;
    }
  }

  // Obtener métricas de descuentos
  async getDiscountMetrics(sedeId?: string, startDate?: string, endDate?: string): Promise<DiscountMetrics> {
    try {
      console.log('📊 DiscountService: Obteniendo métricas de descuentos');

      // Construir query base
      let query = supabase
        .from('ordenes')
        .select(`
          id,
          status,
          descuento_valor,
          descuento_comentario,
          descuento_aplicado_por,
          descuento_aplicado_fecha,
          profiles!descuento_aplicado_por(display_name)
        `)
        .not('descuento_valor', 'is', null)
        .gt('descuento_valor', 0);

      // Filtrar por sede si se especifica
      if (sedeId) {
        query = query.eq('sede_id', sedeId);
      }

      // Filtrar por rango de fechas si se especifica
      if (startDate) {
        const startQuery = formatDateForQuery(new Date(`${startDate}T00:00:00`), false);
        query = query.gte('descuento_aplicado_fecha', startQuery);
        console.log('📅 Filtro fecha inicio:', { startDate, startQuery });
      }

      if (endDate) {
        const endQuery = formatDateForQuery(new Date(`${endDate}T23:59:59`), true);
        query = query.lte('descuento_aplicado_fecha', endQuery);
        console.log('📅 Filtro fecha fin:', { endDate, endQuery });
      }

      const { data: discountData, error } = await query.order('descuento_aplicado_fecha', { ascending: false });

      if (error) {
        console.error('❌ Error obteniendo métricas:', error);
        throw new Error(`Error obteniendo métricas: ${error.message}`);
      }

      if (!discountData || discountData.length === 0) {
        return {
          totalDiscounts: 0,
          totalDiscountAmount: 0,
          averageDiscount: 0,
          discountsByStatus: {},
          recentDiscounts: []
        };
      }

      // Calcular métricas
      const totalDiscounts = discountData.length;
      const totalDiscountAmount = discountData.reduce((sum, item) => sum + (item.descuento_valor || 0), 0);
      const averageDiscount = totalDiscountAmount / totalDiscounts;

      // Agrupar por estado
      const discountsByStatus = discountData.reduce((acc, item) => {
        const status = item.status || 'Desconocido';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Obtener descuentos recientes (últimos 10)
      const recentDiscounts: DiscountApplication[] = discountData.slice(0, 10).map(item => ({
        orderId: item.id,
        discountAmount: item.descuento_valor || 0,
        discountComment: item.descuento_comentario || '',
        appliedBy: item.profiles?.display_name || item.descuento_aplicado_por || 'Usuario desconocido',
        appliedDate: item.descuento_aplicado_fecha || ''
      }));

      const metrics: DiscountMetrics = {
        totalDiscounts,
        totalDiscountAmount,
        averageDiscount,
        discountsByStatus,
        recentDiscounts
      };

      console.log('✅ Métricas obtenidas:', metrics);
      return metrics;
    } catch (error) {
      console.error('❌ Error en getDiscountMetrics:', error);
      throw error;
    }
  }

  // Obtener opciones de pago disponibles para una orden
  async getOrderPaymentOptions(orderId: number): Promise<PaymentOption[]> {
    try {
      console.log('💳 Obteniendo opciones de pago para orden:', orderId);

      const { data: orderData, error: orderError } = await supabase
        .from('ordenes')
        .select(`
          id,
          payment_id,
          payment_id_2,
          pagos!payment_id(id, type, total_pago),
          pagos_secondary:pagos!payment_id_2(id, type, total_pago)
        `)
        .eq('id', orderId)
        .single();

      if (orderError || !orderData) {
        console.error('❌ Error obteniendo orden:', orderError);
        return [];
      }

      const options: PaymentOption[] = [];

      // Pago principal
      if (orderData.pagos) {
        const payment = orderData.pagos as any;
        options.push({
          paymentId: payment.id,
          type: payment.type || 'efectivo',
          amount: payment.total_pago || 0,
          isPrimary: true,
          displayName: `${this.getPaymentDisplayName(payment.type)} - $${(payment.total_pago || 0).toLocaleString()}`
        });
      }

      // Pago secundario
      if (orderData.pagos_secondary) {
        const payment = orderData.pagos_secondary as any;
        options.push({
          paymentId: payment.id,
          type: payment.type || 'efectivo',
          amount: payment.total_pago || 0,
          isPrimary: false,
          displayName: `${this.getPaymentDisplayName(payment.type)} - $${(payment.total_pago || 0).toLocaleString()}`
        });
      }

      console.log('✅ Opciones de pago obtenidas:', options);
      return options;
    } catch (error) {
      console.error('❌ Error en getOrderPaymentOptions:', error);
      return [];
    }
  }

  // Obtener nombre de visualización para método de pago
  private getPaymentDisplayName(type: string): string {
    const displayNames: Record<string, string> = {
      'efectivo': 'Efectivo',
      'tarjeta': 'Tarjeta',
      'transferencia': 'Transferencia',
      'nequi': 'Nequi',
      'daviplata': 'Daviplata'
    };
    return displayNames[type] || type;
  }

  // Validar si una orden puede recibir descuento
  async canApplyDiscount(orderId: number): Promise<boolean> {
    try {
      const { data: orderData, error } = await supabase
        .from('ordenes')
        .select('status')
        .eq('id', orderId)
        .single();

      if (error || !orderData) {
        return false;
      }

      return this.allowedStatuses.includes(orderData.status);
    } catch (error) {
      console.error('❌ Error en canApplyDiscount:', error);
      return false;
    }
  }

  // Obtener historial de descuentos de una orden
  async getOrderDiscountHistory(orderId: number): Promise<DiscountApplication | null> {
    try {
      const { data: orderData, error } = await supabase
        .from('ordenes')
        .select(`
          id,
          descuento_valor,
          descuento_comentario,
          descuento_aplicado_por,
          descuento_aplicado_fecha,
          profiles!descuento_aplicado_por(display_name)
        `)
        .eq('id', orderId)
        .not('descuento_valor', 'is', null)
        .gt('descuento_valor', 0)
        .single();

      if (error || !orderData) {
        return null;
      }

      return {
        orderId: orderData.id,
        discountAmount: orderData.descuento_valor || 0,
        discountComment: orderData.descuento_comentario || '',
        appliedBy: orderData.profiles?.display_name || orderData.descuento_aplicado_por || 'Usuario desconocido',
        appliedDate: orderData.descuento_aplicado_fecha || ''
      };
    } catch (error) {
      console.error('❌ Error en getOrderDiscountHistory:', error);
      return null;
    }
  }
}

export const discountService = new DiscountService();