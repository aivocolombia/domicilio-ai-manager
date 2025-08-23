import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Order, OrderStatus, PaymentStatus, DeliveryPerson } from '@/types/delivery';
import { DashboardOrder } from '@/services/dashboardService';
import { orderStatusService, OrderStatusUpdate } from '@/services/orderStatusService';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface OrderConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrderIds: string[];
  orders: (Order | DashboardOrder)[];
  deliveryPersonnel?: DeliveryPerson[];
  onUpdateOrders?: (orders: Order[]) => void;
  onClearSelection: () => void;
  onRefreshData?: () => void;
}

export const OrderConfigModal: React.FC<OrderConfigModalProps> = ({
  isOpen,
  onClose,
  selectedOrderIds,
  orders,
  deliveryPersonnel,
  onUpdateOrders,
  onClearSelection,
  onRefreshData
}) => {
  const [extraTime, setExtraTime] = useState<number>(0);
  const [extraTimeReason, setExtraTimeReason] = useState('');
  const [newStatus, setNewStatus] = useState<string>('');
  const [assignedDeliveryPersonId, setAssignedDeliveryPersonId] = useState<string>('');
  const [newPaymentStatus, setNewPaymentStatus] = useState<string>('');
  const [availableDeliveryPersonnel, setAvailableDeliveryPersonnel] = useState<Array<{
    id: string;
    nombre: string;
    telefono: string;
    disponible: boolean;
    ordenes_activas: number;
  }>>([]);
  const [validStatuses, setValidStatuses] = useState<Array<{ value: string; label: string }>>([]);
  const [validPaymentStatuses, setValidPaymentStatuses] = useState<Array<{ value: string; label: string }>>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Cargar datos cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      loadModalData();
    }
  }, [isOpen]);

  const loadModalData = async () => {
    try {
      setIsLoading(true);
      
      // Cargar repartidores disponibles
      const personnel = await orderStatusService.getAvailableDeliveryPersonnel();
      setAvailableDeliveryPersonnel(personnel);
      
      // Cargar estados válidos
      const statuses = orderStatusService.getValidOrderStatuses();
      setValidStatuses(statuses);
      
      // Cargar estados de pago válidos
      const paymentStatuses = orderStatusService.getValidPaymentStatuses();
      setValidPaymentStatuses(paymentStatuses);
      
    } catch (error) {
      console.error('❌ Error cargando datos del modal:', error);
      toast({
        title: "Error",
        description: "Error cargando datos del modal",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyChanges = async () => {
    try {
      setIsUpdating(true);
      
      // Preparar actualizaciones para órdenes reales
      const updates: OrderStatusUpdate[] = selectedOrderIds.map(orderId => ({
        orderId: orderId,
        newStatus: newStatus || undefined,
        extraTime: extraTime > 0 ? extraTime : undefined,
        extraTimeReason: extraTimeReason || undefined,
        assignedDeliveryPersonId: assignedDeliveryPersonId || undefined,
        paymentStatus: newPaymentStatus || undefined
      }));
      
      // Aplicar actualizaciones a la base de datos
      await orderStatusService.updateMultipleOrderStatus(updates);
      
      // Si hay función legacy de actualización, llamarla también
      if (onUpdateOrders) {
        const updatedOrders = orders.map(order => {
          if (selectedOrderIds.includes('id' in order ? order.id : order.id_display)) {
            const updatedOrder = { ...order } as Order;
            
            // Apply changes for legacy orders
            if (extraTime > 0 && 'extraTime' in updatedOrder) {
              const currentExtraTime = updatedOrder.extraTime || 0;
              updatedOrder.extraTime = currentExtraTime + extraTime;
              updatedOrder.extraTimeReason = extraTimeReason;
              
              if ('estimatedDeliveryTime' in updatedOrder) {
                const newDeliveryTime = new Date(updatedOrder.estimatedDeliveryTime);
                newDeliveryTime.setMinutes(newDeliveryTime.getMinutes() + extraTime);
                updatedOrder.estimatedDeliveryTime = newDeliveryTime;
              }
            }
            
            if (newStatus && 'status' in updatedOrder) {
              updatedOrder.status = newStatus as OrderStatus;
              
              if (newStatus === 'delivered' || newStatus === 'Entregados') {
                updatedOrder.actualDeliveryTime = new Date();
              }
            }

            if (assignedDeliveryPersonId && 'assignedDeliveryPersonId' in updatedOrder) {
              updatedOrder.assignedDeliveryPersonId = assignedDeliveryPersonId;
            }

            if (newPaymentStatus && 'paymentStatus' in updatedOrder) {
              updatedOrder.paymentStatus = newPaymentStatus as PaymentStatus;
            }
            
            return updatedOrder;
          }
          return order;
        }) as Order[];

        onUpdateOrders(updatedOrders);
      }
      
      toast({
        title: "Cambios aplicados",
        description: `Se actualizaron ${selectedOrderIds.length} pedidos correctamente.`,
      });
      
      // Refrescar datos si hay función disponible
      if (onRefreshData) {
        onRefreshData();
      }

      // Reset form and close
      resetForm();
      onClearSelection();
      onClose();
      
    } catch (error) {
      console.error('❌ Error aplicando cambios:', error);
      toast({
        title: "Error",
        description: "Error aplicando cambios a los pedidos",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const resetForm = () => {
    setExtraTime(0);
    setExtraTimeReason('');
    setNewStatus('');
    setAssignedDeliveryPersonId('');
    setNewPaymentStatus('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const selectedOrders = orders.filter(order => {
    const orderId = 'id' in order ? order.id : order.id_display;
    return selectedOrderIds.includes(orderId);
  });
  
  // Determinar si las órdenes son reales o legacy
  const isRealOrder = (order: Order | DashboardOrder): order is DashboardOrder => {
    return 'cliente_nombre' in order;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
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
              {selectedOrders.map(order => {
                const orderId = 'id' in order ? order.id : order.id_display;
                const customerName = isRealOrder(order) ? order.cliente_nombre : order.customerName;
                const displayId = isRealOrder(order) ? order.id_display : order.id.slice(0, 8);
                
                return (
                  <div key={orderId} className="text-sm flex justify-between">
                    <span>{customerName}</span>
                    <span className="font-mono">{displayId}</span>
                  </div>
                );
              })}
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
                disabled={isUpdating}
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
                  disabled={isUpdating}
                />
              </div>
            )}
          </div>

          {/* Status Change */}
          <div className="space-y-3">
            <Label>Cambiar Estado</Label>
            {isLoading ? (
              <div className="flex items-center gap-2 p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Cargando estados...</span>
              </div>
            ) : (
              <Select value={newStatus} onValueChange={setNewStatus} disabled={isUpdating}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar nuevo estado" />
                </SelectTrigger>
                <SelectContent>
                  {validStatuses.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Delivery Person Assignment */}
          <div className="space-y-3">
            <Label>Asignar Repartidor</Label>
            {isLoading ? (
              <div className="flex items-center gap-2 p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Cargando repartidores...</span>
              </div>
            ) : (
              <Select value={assignedDeliveryPersonId} onValueChange={setAssignedDeliveryPersonId} disabled={isUpdating}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar repartidor" />
                </SelectTrigger>
                <SelectContent>
                  {availableDeliveryPersonnel.map(person => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.nombre} ({person.ordenes_activas} activos)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Payment Status Change */}
          <div className="space-y-3">
            <Label>Estado de Pago</Label>
            {isLoading ? (
              <div className="flex items-center gap-2 p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Cargando estados de pago...</span>
              </div>
            ) : (
              <Select value={newPaymentStatus} onValueChange={setNewPaymentStatus} disabled={isUpdating}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado de pago" />
                </SelectTrigger>
                <SelectContent>
                  {validPaymentStatuses.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={handleClose} className="flex-1" disabled={isUpdating}>
              Cancelar
            </Button>
            <Button 
              onClick={handleApplyChanges} 
              className="flex-1"
              disabled={isUpdating || isLoading || (extraTime === 0 && !newStatus && !assignedDeliveryPersonId && !newPaymentStatus)}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Aplicando...
                </>
              ) : (
                'Aplicar Cambios'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};