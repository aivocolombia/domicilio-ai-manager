// Tipos para el sistema de múltiples métodos de pago

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'nequi' | 'daviplata';
export type PaymentStatus = 'pendiente' | 'pagado' | 'fallido' | 'parcial';

export interface Payment {
  id: number;
  type: PaymentMethod;
  status: PaymentStatus;
  total_pago: number;
  token?: string;
  created_at: string;
  updated_at?: string;
}

export interface MultiPaymentOrder {
  id: number;
  payment_id: number | null; // Pago principal
  payment_id_2: number | null; // Pago secundario
  total_amount: number; // Total de la orden
}

export interface PaymentBreakdown {
  payment1?: Payment & { amount: number };
  payment2?: Payment & { amount: number };
  totalPaid: number;
  totalOrder: number;
  isComplete: boolean;
  primaryPaymentMethod: PaymentMethod;
  hasMultiplePayments: boolean;
}

export interface PaymentValidation {
  isValid: boolean;
  totalPaid: number;
  totalOrder: number;
  difference: number;
  errors: string[];
}

export interface CreateMultiPaymentRequest {
  orderId: number;
  totalAmount: number;
  payments: Array<{
    type: PaymentMethod;
    amount: number;
    status?: PaymentStatus;
  }>;
}

export interface UpdatePaymentStatusRequest {
  paymentId: number;
  status: PaymentStatus;
  reason?: string;
}