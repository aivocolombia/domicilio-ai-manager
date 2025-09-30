import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  CheckCircle,
  Clock,
  XCircle,
  Info
} from 'lucide-react';
import { multiPaymentService } from '@/services/multiPaymentService';
import type { PaymentBreakdown, PaymentMethod, PaymentStatus } from '@/types/payment';

interface PaymentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number | null;
  orderTotal?: number;
}

const PaymentIcon: React.FC<{ method: PaymentMethod }> = ({ method }) => {
  switch (method) {
    case 'efectivo':
      return <Banknote className="h-5 w-5 text-green-600" />;
    case 'tarjeta':
      return <CreditCard className="h-5 w-5 text-blue-600" />;
    case 'nequi':
    case 'daviplata':
      return <Smartphone className="h-5 w-5 text-purple-600" />;
    case 'transferencia':
      return <Building2 className="h-5 w-5 text-gray-600" />;
    default:
      return <CreditCard className="h-5 w-5 text-gray-400" />;
  }
};

const PaymentStatusIcon: React.FC<{ status: PaymentStatus }> = ({ status }) => {
  switch (status) {
    case 'pagado':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'pendiente':
    case 'parcial':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case 'fallido':
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
};

export const PaymentDetailsModal: React.FC<PaymentDetailsModalProps> = ({
  isOpen,
  onClose,
  orderId,
  orderTotal
}) => {
  const [loading, setLoading] = useState(false);
  const [breakdown, setBreakdown] = useState<PaymentBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPaymentDetails = async () => {
      if (!isOpen || !orderId) return;

      setLoading(true);
      setError(null);

      try {
        console.log('💳 Cargando detalles de pago para orden:', orderId);
        const paymentBreakdown = await multiPaymentService.getOrderPaymentBreakdown(orderId);

        if (!paymentBreakdown) {
          throw new Error('No se encontraron detalles de pago');
        }

        setBreakdown(paymentBreakdown);
      } catch (err) {
        console.error('❌ Error cargando detalles de pago:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    loadPaymentDetails();
  }, [isOpen, orderId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'pagado':
        return 'bg-green-100 text-green-800';
      case 'pendiente':
      case 'parcial':
        return 'bg-yellow-100 text-yellow-800';
      case 'fallido':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!orderId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Detalles de Pago - Orden {orderId}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Cargando detalles de pago...</span>
            </div>
          )}

          {error && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!loading && !error && breakdown && (
            <>
              {/* Resumen General */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Resumen de Pagos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total de la orden:</span>
                    <span className="font-semibold">{formatCurrency(breakdown.totalOrder)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total pagado:</span>
                    <span className="font-semibold">{formatCurrency(breakdown.totalPaid)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Estado:</span>
                    <Badge className={breakdown.isComplete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                      {breakdown.isComplete ? 'Completo' : 'Pendiente'}
                    </Badge>
                  </div>
                  {!breakdown.isComplete && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Diferencia:</span>
                      <span className="font-semibold text-red-600">
                        {formatCurrency(breakdown.totalOrder - breakdown.totalPaid)}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pago Principal */}
              {breakdown.payment1 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <PaymentIcon method={breakdown.payment1.type as PaymentMethod} />
                      Pago Principal
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Método:</span>
                      <span className="font-medium capitalize">{breakdown.payment1.type}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Monto:</span>
                      <span className="font-semibold">{formatCurrency(breakdown.payment1.amount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Estado:</span>
                      <div className="flex items-center gap-2">
                        <PaymentStatusIcon status={breakdown.payment1.status as PaymentStatus} />
                        <Badge className={getStatusColor(breakdown.payment1.status as PaymentStatus)}>
                          {breakdown.payment1.status}
                        </Badge>
                      </div>
                    </div>
                    {breakdown.payment1.token && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Token:</span>
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                          {breakdown.payment1.token}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Pago Secundario */}
              {breakdown.payment2 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <PaymentIcon method={breakdown.payment2.type as PaymentMethod} />
                      Pago Secundario
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Método:</span>
                      <span className="font-medium capitalize">{breakdown.payment2.type}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Monto:</span>
                      <span className="font-semibold">{formatCurrency(breakdown.payment2.amount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Estado:</span>
                      <div className="flex items-center gap-2">
                        <PaymentStatusIcon status={breakdown.payment2.status as PaymentStatus} />
                        <Badge className={getStatusColor(breakdown.payment2.status as PaymentStatus)}>
                          {breakdown.payment2.status}
                        </Badge>
                      </div>
                    </div>
                    {breakdown.payment2.token && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Token:</span>
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                          {breakdown.payment2.token}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Información adicional */}
              {breakdown.hasMultiplePayments && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Esta orden utiliza múltiples métodos de pago. El método principal es{' '}
                    <strong>{breakdown.primaryPaymentMethod}</strong> basado en el monto mayor.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};