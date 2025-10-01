import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Check, Loader2, Calculator, CreditCard } from 'lucide-react';
import { discountService, type DiscountRequest, type PaymentOption } from '@/services/discountService';
import { useAuth } from '@/hooks/useAuth';

// Tipos para la orden
interface Order {
  orden_id: number;
  id_display: string;
  cliente_nombre: string;
  total: number;
  estado: string;
  pago_estado: string;
  sede: string;
}

interface DiscountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onDiscountApplied: (orderId: number, discountAmount: number) => void;
}

export function DiscountDialog({
  isOpen,
  onClose,
  order,
  onDiscountApplied
}: DiscountDialogProps) {
  const { user } = useAuth();
  const [discountAmount, setDiscountAmount] = useState<string>('');
  const [discountComment, setDiscountComment] = useState<string>('');
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Cargar opciones de pago cuando se abre el diálogo
  useEffect(() => {
    if (isOpen && order) {
      loadPaymentOptions();
    }
  }, [isOpen, order]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setDiscountAmount('');
      setDiscountComment('');
      setSelectedPaymentId(null);
      setPaymentOptions([]);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  // Cargar opciones de pago para la orden
  const loadPaymentOptions = async () => {
    if (!order) return;

    setIsLoadingPayments(true);
    try {
      const options = await discountService.getOrderPaymentOptions(order.orden_id);
      setPaymentOptions(options);

      // Auto-seleccionar el primer pago si solo hay uno
      if (options.length === 1) {
        setSelectedPaymentId(options[0].paymentId);
      } else if (options.length > 1) {
        // Auto-seleccionar el pago principal si hay múltiples
        const primaryPayment = options.find(p => p.isPrimary);
        if (primaryPayment) {
          setSelectedPaymentId(primaryPayment.paymentId);
        }
      }
    } catch (error) {
      console.error('❌ Error cargando opciones de pago:', error);
      setError('Error cargando información de pagos');
    } finally {
      setIsLoadingPayments(false);
    }
  };

  // Validar entrada de descuento
  const validateInput = () => {
    const amount = parseFloat(discountAmount);

    if (!discountAmount || isNaN(amount) || amount <= 0) {
      setError('El monto del descuento debe ser mayor a 0');
      return false;
    }

    // Validar contra el método de pago seleccionado
    const selectedPayment = paymentOptions.find(p => p.paymentId === selectedPaymentId);
    if (selectedPayment && amount > selectedPayment.amount) {
      setError(`El descuento no puede ser mayor al monto del pago seleccionado (${formatCurrency(selectedPayment.amount)})`);
      return false;
    }

    if (!selectedPayment && amount > (order?.total || 0)) {
      setError('El descuento no puede ser mayor al total de la orden');
      return false;
    }

    if (amount > 100000) {
      setError('El monto del descuento no puede exceder $100,000');
      return false;
    }

    if (!discountComment.trim()) {
      setError('El comentario es obligatorio para aplicar descuentos');
      return false;
    }

    if (discountComment.trim().length < 10) {
      setError('El comentario debe tener al menos 10 caracteres');
      return false;
    }

    if (discountComment.trim().length > 500) {
      setError('El comentario no puede exceder 500 caracteres');
      return false;
    }

    return true;
  };

  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateInput()) {
      return;
    }

    // Aplicar descuento directamente sin modal de confirmación extra
    await applyDiscount();
  };

  // Aplicar descuento
  const applyDiscount = async () => {
    if (!order || !user) {
      setError('Información de usuario u orden no disponible');
      return;
    }

    setIsApplying(true);
    setError(null);

    try {
      const request: DiscountRequest = {
        orderId: order.orden_id,
        discountAmount: parseFloat(discountAmount),
        discountComment: discountComment.trim(),
        userId: user.id,
        userRole: user.role,
        userSedeId: user.sede_id,
        targetPaymentId: selectedPaymentId || undefined
      };

      await discountService.applyDiscount(request);

      setSuccess(true);
      onDiscountApplied(order.orden_id, parseFloat(discountAmount));

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('❌ Error aplicando descuento:', error);
      setError(error instanceof Error ? error.message : 'Error aplicando descuento');
    } finally {
      setIsApplying(false);
    }
  };

  // Formatear números
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Calcular nuevo total del pago seleccionado
  const calculateNewPaymentAmount = () => {
    const discount = parseFloat(discountAmount) || 0;
    const selectedPayment = paymentOptions.find(p => p.paymentId === selectedPaymentId);
    if (selectedPayment) {
      return Math.max(0, selectedPayment.amount - discount);
    }
    return 0;
  };

  // Obtener información del pago seleccionado
  const getSelectedPaymentInfo = () => {
    const selectedPayment = paymentOptions.find(p => p.paymentId === selectedPaymentId);
    return selectedPayment;
  };

  if (!order) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Aplicar Descuento
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-600">¡Descuento Aplicado!</h3>
              <p className="text-sm text-gray-600">
                Descuento de {formatCurrency(parseFloat(discountAmount))} aplicado exitosamente
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Información de la orden */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">Orden:</span>
                <Badge variant="outline">{order.id_display}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Cliente:</span>
                <span>{order.cliente_nombre}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Total actual:</span>
                <span className="font-bold">{formatCurrency(order.total)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Estado:</span>
                <Badge>{order.estado}</Badge>
              </div>
            </div>

            {/* Selector de método de pago (solo si hay múltiples) */}
            {paymentOptions.length > 1 && (
              <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">Métodos de Pago Disponibles</span>
                </div>

                <div>
                  <Label htmlFor="paymentMethod">
                    Selecciona el método de pago al que aplicar el descuento *
                  </Label>
                  <Select
                    value={selectedPaymentId?.toString() || ''}
                    onValueChange={(value) => setSelectedPaymentId(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar método de pago" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentOptions.map((payment) => (
                        <SelectItem key={payment.paymentId} value={payment.paymentId.toString()}>
                          <div className="flex items-center justify-between w-full">
                            <span>{payment.displayName}</span>
                            {payment.isPrimary && (
                              <Badge variant="secondary" className="ml-2 text-xs">Principal</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Campos del descuento */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="discountAmount">
                  Monto del descuento *
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <Input
                    id="discountAmount"
                    type="number"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    placeholder="0"
                    className="pl-8"
                    min="0"
                    max={getSelectedPaymentInfo()?.amount || order.total}
                    step="1000"
                    required
                  />
                </div>

                {/* Mostrar información del pago seleccionado */}
                {getSelectedPaymentInfo() && discountAmount && !isNaN(parseFloat(discountAmount)) && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-md">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Método seleccionado:</span>
                        <span className="font-medium">{getSelectedPaymentInfo()?.displayName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Monto original:</span>
                        <span>{formatCurrency(getSelectedPaymentInfo()?.amount || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Descuento:</span>
                        <span className="text-red-600">-{formatCurrency(parseFloat(discountAmount))}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1 font-medium">
                        <span>Nuevo monto:</span>
                        <span className="text-green-600">{formatCurrency(calculateNewPaymentAmount())}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="discountComment">
                  Motivo del descuento *
                </Label>
                <Textarea
                  id="discountComment"
                  value={discountComment}
                  onChange={(e) => setDiscountComment(e.target.value)}
                  placeholder="Explica el motivo del descuento (mínimo 10 caracteres)..."
                  rows={3}
                  maxLength={500}
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  {discountComment.length}/500 caracteres
                </p>
              </div>
            </div>

            {/* Indicador de carga de pagos */}
            {isLoadingPayments && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>Cargando métodos de pago...</AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  !discountAmount ||
                  !discountComment.trim() ||
                  isApplying ||
                  isLoadingPayments ||
                  (paymentOptions.length > 1 && !selectedPaymentId)
                }
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  'Aplicar Descuento'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

      </DialogContent>
    </Dialog>
  );
}