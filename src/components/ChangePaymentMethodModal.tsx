import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CreditCard, Banknote, Smartphone, Building2, Plus } from 'lucide-react';
import { PaymentMethod } from '@/types/delivery';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface PaymentMethodData {
  id: string;
  type: string;
  amount: number;
}

interface ChangePaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  currentPaymentMethod?: PaymentMethod; // Para compatibilidad con código existente
  currentPaymentMethods?: PaymentMethodData[]; // Para múltiples métodos
  onPaymentMethodChanged: () => void;
}

const paymentMethodOptions = [
  { value: 'card', label: 'Tarjeta', icon: CreditCard },
  { value: 'cash', label: 'Efectivo', icon: Banknote },
  { value: 'nequi', label: 'Nequi', icon: Smartphone },
  { value: 'transfer', label: 'Transferencia', icon: Building2 }
] as const;

export function ChangePaymentMethodModal({
  isOpen,
  onClose,
  orderId,
  currentPaymentMethod,
  currentPaymentMethods,
  onPaymentMethodChanged
}: ChangePaymentMethodModalProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [newPaymentType, setNewPaymentType] = useState<string>('cash');
  const [newPaymentAmount, setNewPaymentAmount] = useState<number>(0);
  const [orderTotal, setOrderTotal] = useState<number>(0);
  const { toast } = useToast();

  // Cargar métodos de pago actuales cuando se abre el modal
  React.useEffect(() => {
    if (isOpen && orderId) {
      loadCurrentPaymentMethods();
    }
  }, [isOpen, orderId]);

  const loadCurrentPaymentMethods = async () => {
    if (currentPaymentMethods) {
      // Si ya se pasaron los métodos de pago
      setPaymentMethods(currentPaymentMethods.map(pm => ({
        id: pm.id,
        type: pm.type,
        amount: pm.amount
      })));
      return;
    }

    setIsLoadingData(true);
    try {
      // Obtener el total real de la orden y los IDs de pago
      const { data: orderData, error: orderError } = await supabase
        .from('ordenes')
        .select('payment_id, payment_id_2, total')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Establecer el total real de la orden
      const realTotal = orderData.total || 0;
      setOrderTotal(realTotal);

      const paymentIds = [orderData.payment_id, orderData.payment_id_2].filter(Boolean);

      if (paymentIds.length === 0) {
        throw new Error('Esta orden no tiene métodos de pago asociados');
      }

      // Obtener detalles de los pagos
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('pagos')
        .select('id, type, total_pago')
        .in('id', paymentIds);

      if (paymentsError) throw paymentsError;

      const methods = paymentsData.map(payment => ({
        id: payment.id,
        type: payment.type,
        amount: payment.total_pago || 0
      }));

      setPaymentMethods(methods);

    } catch (error) {
      console.error('❌ Error cargando métodos de pago:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los métodos de pago actuales.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const updatePaymentMethod = async (paymentId: string, newType: string) => {
    const dbPaymentType = newType === 'cash' ? 'efectivo' :
                         newType === 'card' ? 'tarjeta' :
                         newType === 'nequi' ? 'nequi' :
                         newType === 'transfer' ? 'transferencia' :
                         newType;

    const { error } = await supabase
      .from('pagos')
      .update({
        type: dbPaymentType,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (error) throw error;

    return dbPaymentType;
  };

  const handleUpdatePaymentMethod = async (paymentIndex: number, newType: string) => {
    if (paymentMethods[paymentIndex].type === newType) {
      toast({
        title: "Sin cambios",
        description: "Has seleccionado el mismo método de pago.",
        variant: "default"
      });
      return;
    }

    setIsLoading(true);
    try {
      const paymentId = paymentMethods[paymentIndex].id;

      console.log('🔄 Cambiando método de pago...', {
        orderId,
        paymentId,
        from: paymentMethods[paymentIndex].type,
        to: newType
      });

      const dbPaymentType = await updatePaymentMethod(paymentId, newType);

      // Actualizar el estado local
      const updatedMethods = [...paymentMethods];
      updatedMethods[paymentIndex] = {
        ...updatedMethods[paymentIndex],
        type: dbPaymentType
      };
      setPaymentMethods(updatedMethods);

      toast({
        title: "Método de pago actualizado",
        description: `Método ${paymentIndex + 1} cambió a ${paymentMethodOptions.find(p => p.value === newType)?.label || newType}`,
        variant: "default"
      });

      onPaymentMethodChanged();
    } catch (error) {
      console.error('❌ Error cambiando método de pago:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar el método de pago. Inténtalo de nuevo.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSecondPayment = async () => {
    if (paymentMethods.length !== 1) {
      toast({
        title: "Error",
        description: "Solo se puede agregar un segundo método cuando hay exactamente un método de pago.",
        variant: "destructive"
      });
      return;
    }

    if (newPaymentAmount <= 0 || newPaymentAmount >= orderTotal) {
      toast({
        title: "Monto inválido",
        description: `El monto debe ser mayor a $0 y menor a $${orderTotal.toLocaleString()}`,
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const dbPaymentType = newPaymentType === 'cash' ? 'efectivo' :
                           newPaymentType === 'card' ? 'tarjeta' :
                           newPaymentType === 'nequi' ? 'nequi' :
                           newPaymentType === 'transfer' ? 'transferencia' :
                           newPaymentType;

      console.log('➕ Agregando segundo método de pago:', {
        orderId,
        type: dbPaymentType,
        amount: newPaymentAmount
      });

      // Crear nuevo pago
      const { data: newPayment, error: createError } = await supabase
        .from('pagos')
        .insert({
          type: dbPaymentType,
          status: 'pending',
          total_pago: newPaymentAmount
        })
        .select('id')
        .single();

      if (createError) throw createError;

      // Actualizar el monto del primer pago
      const firstPaymentId = paymentMethods[0].id;
      const remainingAmount = orderTotal - newPaymentAmount;

      const { error: updateError } = await supabase
        .from('pagos')
        .update({ total_pago: remainingAmount })
        .eq('id', firstPaymentId);

      if (updateError) throw updateError;

      // Agregar el segundo pago a la orden
      const { error: orderUpdateError } = await supabase
        .from('ordenes')
        .update({ payment_id_2: newPayment.id })
        .eq('id', orderId);

      if (orderUpdateError) throw orderUpdateError;

      toast({
        title: "Segundo método agregado",
        description: `Pago dividido: $${remainingAmount.toLocaleString()} (${paymentMethods[0].type}) + $${newPaymentAmount.toLocaleString()} (${dbPaymentType})`,
        variant: "default"
      });

      // Recargar métodos de pago
      await loadCurrentPaymentMethods();
      setShowAddPayment(false);
      setNewPaymentAmount(0);
      onPaymentMethodChanged();

    } catch (error) {
      console.error('❌ Error agregando segundo método de pago:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo agregar el segundo método de pago.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getPaymentMethodLabel = (type: string) => {
    // Mapear tipos de base de datos a valores de UI
    const uiType = type === 'efectivo' ? 'cash' :
                   type === 'tarjeta' ? 'card' :
                   type === 'nequi' ? 'nequi' :
                   type === 'transferencia' ? 'transfer' :
                   type;

    return paymentMethodOptions.find(p => p.value === uiType)?.label || type;
  };

  const getPaymentMethodIcon = (type: string) => {
    // Mapear tipos de base de datos a valores de UI
    const uiType = type === 'efectivo' ? 'cash' :
                   type === 'tarjeta' ? 'card' :
                   type === 'nequi' ? 'nequi' :
                   type === 'transferencia' ? 'transfer' :
                   type;

    return paymentMethodOptions.find(p => p.value === uiType)?.icon || CreditCard;
  };

  const getDbToUiType = (dbType: string) => {
    return dbType === 'efectivo' ? 'cash' :
           dbType === 'tarjeta' ? 'card' :
           dbType === 'nequi' ? 'nequi' :
           dbType === 'transferencia' ? 'transfer' :
           dbType;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Editar Métodos de Pago
          </DialogTitle>
          <DialogDescription>
            Orden #{orderId} - Modificar los métodos de pago de la orden
          </DialogDescription>
        </DialogHeader>

        {isLoadingData ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <span className="ml-2">Cargando métodos de pago...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {paymentMethods.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No se encontraron métodos de pago para esta orden
              </div>
            ) : (
              paymentMethods.map((payment, index) => (
                <div key={payment.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">
                      Método de Pago {index + 1}
                    </h4>
                    <span className="text-sm font-medium text-green-600">
                      ${payment.amount.toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">Método actual</Label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-md border">
                      <div className="flex items-center gap-2">
                        {React.createElement(
                          getPaymentMethodIcon(payment.type),
                          { className: "h-4 w-4" }
                        )}
                        <span className="font-medium">{getPaymentMethodLabel(payment.type)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Cambiar a
                    </Label>
                    <Select
                      value={getDbToUiType(payment.type)}
                      onValueChange={(value: PaymentMethod) => handleUpdatePaymentMethod(index, value)}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Seleccionar método de pago" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethodOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <option.icon className="h-4 w-4" />
                              <span>{option.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))
            )}

            {/* Botón para agregar segundo método de pago */}
            {paymentMethods.length === 1 && !showAddPayment && (
              <Button
                variant="outline"
                onClick={() => setShowAddPayment(true)}
                disabled={isLoading}
                className="w-full border-dashed border-2 border-green-300 text-green-600 hover:bg-green-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar segundo método de pago
              </Button>
            )}

            {/* Formulario para agregar segundo método */}
            {showAddPayment && paymentMethods.length === 1 && (
              <div className="border-2 border-green-300 rounded-lg p-4 space-y-4 bg-green-50/30">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">
                    Dividir pago en dos métodos
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddPayment(false);
                      setNewPaymentAmount(0);
                    }}
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                  <p className="font-medium text-blue-900">Total de la orden: ${orderTotal.toLocaleString()}</p>
                  <p className="text-blue-700 mt-1">
                    El pago se dividirá entre el método actual y el nuevo método
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Tipo de segundo método
                  </Label>
                  <Select
                    value={newPaymentType}
                    onValueChange={setNewPaymentType}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Seleccionar método" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethodOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <option.icon className="h-4 w-4" />
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Monto del segundo método
                  </Label>
                  <Input
                    type="number"
                    value={newPaymentAmount || ''}
                    onChange={(e) => setNewPaymentAmount(Number(e.target.value))}
                    placeholder="0"
                    disabled={isLoading}
                    className="mt-1"
                    min={1}
                    max={orderTotal - 1}
                  />
                  {newPaymentAmount > 0 && newPaymentAmount < orderTotal && (
                    <p className="text-sm text-gray-600 mt-2">
                      Método 1 ({paymentMethods[0].type}): <span className="font-medium">${(orderTotal - newPaymentAmount).toLocaleString()}</span>
                      <br />
                      Método 2 ({getPaymentMethodLabel(newPaymentType)}): <span className="font-medium">${newPaymentAmount.toLocaleString()}</span>
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleAddSecondPayment}
                  disabled={isLoading || newPaymentAmount <= 0 || newPaymentAmount >= orderTotal}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? 'Procesando...' : 'Confirmar división de pago'}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading || isLoadingData}
          >
            {isLoading ? 'Procesando...' : 'Cerrar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}