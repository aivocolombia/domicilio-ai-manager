import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CreditCard, Banknote, Smartphone, Building2 } from 'lucide-react';
import { PaymentMethod } from '@/types/delivery';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface ChangePaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  currentPaymentMethod: PaymentMethod;
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
  onPaymentMethodChanged
}: ChangePaymentMethodModalProps) {
  const [newPaymentMethod, setNewPaymentMethod] = useState<PaymentMethod>(currentPaymentMethod);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (newPaymentMethod === currentPaymentMethod) {
      toast({
        title: "Sin cambios",
        description: "No has seleccionado un método de pago diferente.",
        variant: "default"
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔄 Cambiando método de pago...', {
        orderId,
        from: currentPaymentMethod,
        to: newPaymentMethod
      });

      // Primero obtener el payment_id de la orden
      const { data: orderData, error: orderError } = await supabase
        .from('ordenes')
        .select('payment_id')
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.error('❌ Error obteniendo payment_id:', orderError);
        throw orderError;
      }

      if (!orderData?.payment_id) {
        throw new Error('Esta orden no tiene un payment_id asociado');
      }

      // Mapear el payment method al formato de base de datos
      const dbPaymentType = newPaymentMethod === 'cash' ? 'efectivo' :
                           newPaymentMethod === 'card' ? 'tarjeta' :
                           newPaymentMethod === 'nequi' ? 'nequi' :
                           newPaymentMethod === 'transfer' ? 'transferencia' :
                           newPaymentMethod;

      // Actualizar el tipo de pago en la tabla pagos
      const { error } = await supabase
        .from('pagos')
        .update({
          type: dbPaymentType,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderData.payment_id);

      if (error) {
        console.error('❌ Error actualizando método de pago:', error);
        throw error;
      }

      console.log('✅ Método de pago actualizado exitosamente', {
        paymentId: orderData.payment_id,
        newType: dbPaymentType
      });

      toast({
        title: "Método de pago actualizado",
        description: `El método de pago se cambió a ${paymentMethodOptions.find(p => p.value === newPaymentMethod)?.label || newPaymentMethod}`,
        variant: "default"
      });

      onPaymentMethodChanged();
      onClose();
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

  const getCurrentMethodLabel = () => {
    return paymentMethodOptions.find(p => p.value === currentPaymentMethod)?.label || currentPaymentMethod;
  };

  const getNewMethodLabel = () => {
    return paymentMethodOptions.find(p => p.value === newPaymentMethod)?.label || newPaymentMethod;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Editar Método de Pago
          </DialogTitle>
          <DialogDescription>
            Orden #{orderId} - Cambiar método de pago existente o agregar método adicional
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700">Método actual</Label>
            <div className="mt-1 p-3 bg-gray-50 rounded-md border">
              <div className="flex items-center gap-2">
                {React.createElement(
                  paymentMethodOptions.find(p => p.value === currentPaymentMethod)?.icon || CreditCard,
                  { className: "h-4 w-4" }
                )}
                <span className="font-medium">{getCurrentMethodLabel()}</span>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="payment-method" className="text-sm font-medium text-gray-700">
              Nuevo método de pago
            </Label>
            <Select value={newPaymentMethod} onValueChange={(value: PaymentMethod) => setNewPaymentMethod(value)}>
              <SelectTrigger id="payment-method" className="mt-1">
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

          {newPaymentMethod !== currentPaymentMethod && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>Cambio:</strong> De {getCurrentMethodLabel()} → {getNewMethodLabel()}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || newPaymentMethod === currentPaymentMethod}
          >
            {isLoading ? 'Guardando...' : 'Guardar Cambio'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}