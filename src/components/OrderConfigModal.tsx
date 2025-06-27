
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Order, OrderStatus, PaymentStatus, DeliveryPerson } from '@/types/delivery';
import { toast } from '@/hooks/use-toast';

interface OrderConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrderIds: string[];
  orders: Order[];
  deliveryPersonnel: DeliveryPerson[];
  onUpdateOrders: (orders: Order[]) => void;
  onClearSelection: () => void;
}

export const OrderConfigModal: React.FC<OrderConfigModalProps> = ({
  isOpen,
  onClose,
  selectedOrderIds,
  orders,
  deliveryPersonnel,
  onUpdateOrders,
  onClearSelection
}) => {
  const [extraTime, setExtraTime] = useState<number>(0);
  const [extraTimeReason, setExtraTimeReason] = useState('');
  const [newStatus, setNewStatus] = useState<OrderStatus | ''>('');
  const [assignedDeliveryPersonId, setAssignedDeliveryPersonId] = useState<string>('');
  const [newPaymentStatus, setNewPaymentStatus] = useState<PaymentStatus | ''>('');

  const handleApplyChanges = () => {
    const updatedOrders = orders.map(order => {
      if (selectedOrderIds.includes(order.id)) {
        const updatedOrder = { ...order };
        
        // Apply extra time
        if (extraTime > 0) {
          const currentExtraTime = updatedOrder.extraTime || 0;
          updatedOrder.extraTime = currentExtraTime + extraTime;
          updatedOrder.extraTimeReason = extraTimeReason;
          
          // Update estimated delivery time
          const newDeliveryTime = new Date(updatedOrder.estimatedDeliveryTime);
          newDeliveryTime.setMinutes(newDeliveryTime.getMinutes() + extraTime);
          updatedOrder.estimatedDeliveryTime = newDeliveryTime;
        }
        
        // Apply status change
        if (newStatus) {
          updatedOrder.status = newStatus;
          
          // Set actual delivery time if delivered
          if (newStatus === 'delivered') {
            updatedOrder.actualDeliveryTime = new Date();
          }
        }

        // Apply delivery person assignment
        if (assignedDeliveryPersonId) {
          updatedOrder.assignedDeliveryPersonId = assignedDeliveryPersonId;
        }

        // Apply payment status change
        if (newPaymentStatus) {
          updatedOrder.paymentStatus = newPaymentStatus;
        }
        
        return updatedOrder;
      }
      return order;
    });

    onUpdateOrders(updatedOrders);
    
    toast({
      title: "Cambios aplicados",
      description: `Se actualizaron ${selectedOrderIds.length} pedidos correctamente.`,
    });

    // Reset form and close
    setExtraTime(0);
    setExtraTimeReason('');
    setNewStatus('');
    setAssignedDeliveryPersonId('');
    setNewPaymentStatus('');
    onClearSelection();
    onClose();
  };

  const selectedOrders = orders.filter(order => selectedOrderIds.includes(order.id));
  const activeDeliveryPersonnel = deliveryPersonnel.filter(person => person.isActive);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Configurar Pedidos Seleccionados ({selectedOrderIds.length})
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Selected Orders Preview */}
          <div className="bg-muted p-3 rounded-lg">
            <h4 className="font-medium mb-2">Pedidos seleccionados:</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {selectedOrders.map(order => (
                <div key={order.id} className="text-sm flex justify-between">
                  <span>{order.customerName}</span>
                  <span className="font-mono">{order.id.slice(0, 8)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Extra Time Configuration */}
          <div className="space-y-3">
            <Label>Tiempo Extra de Entrega</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Minutos"
                value={extraTime}
                onChange={(e) => setExtraTime(Number(e.target.value))}
                min="0"
              />
              <span className="flex items-center text-sm text-muted-foreground">min</span>
            </div>
            
            {extraTime > 0 && (
              <div>
                <Label>Razón del tiempo extra</Label>
                <Textarea
                  placeholder="Explica por qué se necesita tiempo adicional..."
                  value={extraTimeReason}
                  onChange={(e) => setExtraTimeReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>

          {/* Status Change */}
          <div className="space-y-3">
            <Label>Cambiar Estado</Label>
            <Select value={newStatus} onValueChange={(value: OrderStatus) => setNewStatus(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar nuevo estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="received">Recibido</SelectItem>
                <SelectItem value="kitchen">En Cocina</SelectItem>
                <SelectItem value="delivery">En Camino</SelectItem>
                <SelectItem value="delivered">Entregado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Delivery Person Assignment */}
          <div className="space-y-3">
            <Label>Asignar Repartidor</Label>
            <Select value={assignedDeliveryPersonId} onValueChange={setAssignedDeliveryPersonId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar repartidor" />
              </SelectTrigger>
              <SelectContent>
                {activeDeliveryPersonnel.map(person => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name} ({person.activeOrders} activos)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Status Change */}
          <div className="space-y-3">
            <Label>Estado de Pago</Label>
            <Select value={newPaymentStatus} onValueChange={(value: PaymentStatus) => setNewPaymentStatus(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar estado de pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="paid">Pagado</SelectItem>
                <SelectItem value="failed">Fallido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={handleApplyChanges} 
              className="flex-1"
              disabled={extraTime === 0 && !newStatus && !assignedDeliveryPersonId && !newPaymentStatus}
            >
              Aplicar Cambios
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
