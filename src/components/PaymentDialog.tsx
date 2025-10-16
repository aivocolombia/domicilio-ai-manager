import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  ShoppingCart,
  Plus,
  DollarSign,
  User,
  Receipt
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface OrderItem {
  product: {
    id: string;
    name: string;
    price: number;
  };
  quantity: number;
}

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tableNumber: number;
  customerName?: string;
  orderItems: OrderItem[];
  onAddMoreProducts: () => void;
  onProcessPayment: (paymentMethod: string) => void;
}

type PaymentMethod = 'efectivo' | 'tarjeta' | 'nequi' | 'transferencia';

const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo', icon: Banknote },
  { value: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
  { value: 'nequi', label: 'Nequi', icon: Smartphone },
  { value: 'transferencia', label: 'Transferencia', icon: Building2 }
];

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const PaymentDialog: React.FC<PaymentDialogProps> = ({
  isOpen,
  onClose,
  tableNumber,
  customerName,
  orderItems,
  onAddMoreProducts,
  onProcessPayment
}) => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('efectivo');

  // Calcular total
  const total = orderItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const handleProcessPayment = () => {
    if (!selectedPaymentMethod) {
      toast({
        title: 'Error',
        description: 'Selecciona un método de pago',
        variant: 'destructive'
      });
      return;
    }

    onProcessPayment(selectedPaymentMethod);
    onClose();
  };

  const handleAddMore = () => {
    onAddMoreProducts();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Receipt className="h-6 w-6" />
            Pago Mesa {tableNumber}
          </DialogTitle>
          <DialogDescription>
            Resumen del pedido y método de pago
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4 overflow-y-auto flex-1 space-y-6">
          {/* Información del cliente */}
          {customerName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Cliente: {customerName}</span>
            </div>
          )}

          {/* Resumen del pedido */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Resumen del Pedido
              </h3>
              <Badge variant="secondary">{orderItems.length} items</Badge>
            </div>

            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
              {orderItems.map((item, index) => (
                <Card key={index}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{item.product.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(item.product.price)} × {item.quantity}
                        </p>
                      </div>
                      <p className="font-bold text-sm">
                        {formatCurrency(item.product.price * item.quantity)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Botón agregar más productos */}
            <Button
              variant="outline"
              onClick={handleAddMore}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Más Productos
            </Button>
          </div>

          {/* Método de pago */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Método de Pago</Label>
            <RadioGroup
              value={selectedPaymentMethod}
              onValueChange={(value) => setSelectedPaymentMethod(value as PaymentMethod)}
            >
              <div className="grid grid-cols-2 gap-3">
                {PAYMENT_METHODS.map((method) => {
                  const Icon = method.icon;
                  return (
                    <Card
                      key={method.value}
                      className={cn(
                        "cursor-pointer transition-all hover:border-primary",
                        selectedPaymentMethod === method.value && "border-primary bg-primary/5"
                      )}
                      onClick={() => setSelectedPaymentMethod(method.value as PaymentMethod)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={method.value} id={method.value} />
                          <Label
                            htmlFor={method.value}
                            className="flex items-center gap-2 cursor-pointer flex-1"
                          >
                            <Icon className="h-5 w-5" />
                            <span className="font-medium">{method.label}</span>
                          </Label>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </RadioGroup>
          </div>

          {/* Total */}
          <Card className="bg-brand-primary text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-6 w-6" />
                  <span className="font-semibold text-lg">TOTAL A PAGAR</span>
                </div>
                <span className="text-3xl font-bold">
                  {formatCurrency(total)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="px-6 pb-6 pt-4 flex-shrink-0 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleProcessPayment} className="bg-green-600 hover:bg-green-700">
            <Receipt className="h-4 w-4 mr-2" />
            Procesar Pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
