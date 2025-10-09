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
import { useAuth } from '@/hooks/useAuth';

interface OrderConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrderIds: string[];
  orders: (Order | DashboardOrder)[];
  deliveryPersonnel?: DeliveryPerson[];
  onUpdateOrders?: (orders: Order[]) => void;
  onClearSelection: () => void;
  onRefreshData?: () => void;
  currentSedeId?: string; // Nueva prop para filtrar repartidores por sede
}

export const OrderConfigModal: React.FC<OrderConfigModalProps> = ({
  isOpen,
  onClose,
  selectedOrderIds,
  orders,
  deliveryPersonnel,
  onUpdateOrders,
  onClearSelection,
  onRefreshData,
  currentSedeId
}) => {
  const [extraTime, setExtraTime] = useState<number>(0);
  const [extraTimeReason, setExtraTimeReason] = useState('');
  const [newStatus, setNewStatus] = useState<string>('');
  const [assignedDeliveryPersonId, setAssignedDeliveryPersonId] = useState<string>('');
  const [newPaymentStatus, setNewPaymentStatus] = useState<string>('');
  const [newPaymentStatus2, setNewPaymentStatus2] = useState<string>('');
  const [hasMultiplePayments, setHasMultiplePayments] = useState<boolean>(false);
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
  const [hasMixedStates, setHasMixedStates] = useState(false);
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin_global' || profile?.role === 'admin_punto';

  // Cargar datos cuando se abre el modal o cambia la sede
  useEffect(() => {
    if (isOpen) {
      loadModalData();
    }
  }, [isOpen, currentSedeId, selectedOrderIds]);

  const loadModalData = async () => {
    try {
      setIsLoading(true);
      
      // Cargar repartidores disponibles (filtrado por sede)
      console.log('🔧 [DEBUG OrderConfigModal] Cargando repartidores para sede:', currentSedeId);
      const personnel = await orderStatusService.getAvailableDeliveryPersonnel(currentSedeId);
      console.log('🔧 [DEBUG OrderConfigModal] Repartidores recibidos:', personnel.length);
      console.log('🔧 [DEBUG OrderConfigModal] Lista de repartidores:', personnel.map(p => ({ id: p.id, nombre: p.nombre })));
      setAvailableDeliveryPersonnel(personnel);
      
      // Obtener estados actuales y tipos de los pedidos seleccionados
      const selectedOrders = orders.filter(order => 
        selectedOrderIds.includes('id' in order ? order.id : order.id_display)
      );
      const currentStatuses = selectedOrders.map(order => 
        'status' in order ? order.status : order.estado
      ).filter((status): status is string => Boolean(status));
      
      // Detectar si hay estados mixtos (diferentes estados entre las órdenes seleccionadas)
      const uniqueStatuses = [...new Set(currentStatuses)];
      const hasMixedStates = uniqueStatuses.length > 1;
      setHasMixedStates(hasMixedStates);
      
      console.log('🔍 Estados detectados:', currentStatuses);
      console.log('📊 Estados únicos:', uniqueStatuses);
      console.log('⚠️ Estados mixtos:', hasMixedStates);
      
      const orderTypes = selectedOrders.map(order => 
        'type_order' in order ? order.type_order : (order as any).tipo_orden || 'delivery'
      ).filter((type): type is string => Boolean(type));
      
      // Cargar estados válidos basado en estados actuales y tipos de orden
      const statuses = orderStatusService.getValidOrderStatuses(currentStatuses, orderTypes);
      setValidStatuses(statuses);
      
      // Cargar estados de pago válidos
      const paymentStatuses = orderStatusService.getValidPaymentStatuses();
      setValidPaymentStatuses(paymentStatuses);

      // Detectar si hay órdenes con múltiples métodos de pago
      const ordersWithMultiplePayments = selectedOrders.some(order => {
        return (order as any).payment_id_2 || (order as any).has_multiple_payments;
      });
      setHasMultiplePayments(ordersWithMultiplePayments);
      console.log('💳 Múltiples métodos de pago detectados:', ordersWithMultiplePayments);

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
      
      // Verificar si hay órdenes de pickup en espera (estado "Camino" para pickup)
      const pickupOrdersInWaiting = selectedOrders.filter(order => {
        const currentStatus = isRealOrder(order) ? order.estado : order.status;
        const orderType = ('type_order' in order && order.type_order) || 
                         ('tipo_orden' in order && (order as any).tipo_orden) || 
                         'delivery';
        return currentStatus === 'Camino' && orderType === 'pickup';
      });

      // Si se intenta asignar repartidor a órdenes de pickup en espera, bloquear
      if (assignedDeliveryPersonId && pickupOrdersInWaiting.length > 0) {
        toast({
          title: "Operación no válida",
          description: `No se puede asignar repartidor a ${pickupOrdersInWaiting.length} pedido(s) de recolección. El cliente recoge directamente en la sede.`,
          variant: "destructive"
        });
        setIsUpdating(false);
        return;
      }

      // Verificar si hay órdenes de delivery en camino que impiden cambiar repartidores  
      const deliveryOrdersInTransit = selectedOrders.filter(order => {
        const currentStatus = isRealOrder(order) ? order.estado : order.status;
        const orderType = ('type_order' in order && order.type_order) || 
                         ('tipo_orden' in order && (order as any).tipo_orden) || 
                         'delivery';
        return (currentStatus === 'Camino' || currentStatus === 'En Camino') && orderType === 'delivery';
      });

      // Si se intenta asignar repartidor a órdenes de delivery en camino, bloquear (excepto administradores)
      if (!isAdmin && assignedDeliveryPersonId && deliveryOrdersInTransit.length > 0) {
        toast({
          title: "Operación bloqueada",
          description: `No se puede cambiar el repartidor de ${deliveryOrdersInTransit.length} pedido(s) que están "En Camino".`,
          variant: "destructive"
        });
        setIsUpdating(false);
        return;
      }
      
      // Validación: Si se cambia a "Camino" debe tener repartidor asignado (solo para delivery)
      if (newStatus === 'Camino' && !assignedDeliveryPersonId) {
        // Verificar si alguna orden seleccionada es de tipo delivery
        const hasDeliveryOrders = selectedOrderIds.some(orderId => {
          const order = orders.find(o => ('id' in o ? o.id : o.id_display) === orderId) as DashboardOrder | Order | undefined;
          const orderType = ('type_order' in order && order.type_order) || 
                           ('tipo_orden' in order && (order as any).tipo_orden) || 
                           'delivery';
          return orderType === 'delivery';
        });
        
        if (hasDeliveryOrders) {
          toast({
            title: "Repartidor requerido",
            description: "Para cambiar el estado a 'En Camino', debe asignar un repartidor primero.",
            variant: "destructive"
          });
          setIsUpdating(false);
          return;
        }
      }

      // También validar órdenes existentes que ya están seleccionadas
      const ordersNeedingDeliveryPerson = selectedOrderIds.filter(orderId => {
        const order = orders.find(o => ('id' in o ? o.id : o.id_display) === orderId) as DashboardOrder | Order | undefined;
        if (!order) return false;
        
        // Si se va a cambiar a Camino y la orden no tiene repartidor asignado y no se está asignando uno ahora
        if (newStatus === 'Camino') {
          // Solo requerir repartidor para órdenes de delivery
          const orderType = ('type_order' in order && order.type_order) || 
                           ('tipo_orden' in order && (order as any).tipo_orden) || 
                           'delivery';
          
          if (orderType === 'delivery') {
            const hasCurrentDeliveryPerson = ('assignedDeliveryPersonId' in order && order.assignedDeliveryPersonId) ||
                                            ('repartidor' in order && order.repartidor && order.repartidor !== 'Sin asignar');
            return !hasCurrentDeliveryPerson && !assignedDeliveryPersonId;
          }
        }
        
        return false;
      });

      if (ordersNeedingDeliveryPerson.length > 0) {
        toast({
          title: "Repartidor requerido",
          description: `${ordersNeedingDeliveryPerson.length} pedido(s) necesitan un repartidor asignado para cambiar a 'En Camino'.`,
          variant: "destructive"
        });
        setIsUpdating(false);
        return;
      }
      
      // Preparar actualizaciones para órdenes reales
      const updates: OrderStatusUpdate[] = selectedOrderIds.map(orderId => ({
        orderId: parseInt(orderId.replace('ORD-', '')),
        // Si hay estados mixtos, solo aplicar tiempo extra
        newStatus: hasMixedStates ? undefined : (newStatus || undefined),
        extraTime: extraTime > 0 ? extraTime : undefined,
        extraTimeReason: extraTimeReason || undefined,
        assignedDeliveryPersonId: hasMixedStates ? undefined : (assignedDeliveryPersonId || undefined),
        paymentStatus: hasMixedStates ? undefined : (newPaymentStatus || undefined),
        paymentStatus2: hasMixedStates ? undefined : (newPaymentStatus2 || undefined)
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
        description: hasMixedStates 
          ? `Se agregó tiempo extra a ${selectedOrderIds.length} pedidos con estados mixtos.`
          : `Se actualizaron ${selectedOrderIds.length} pedidos correctamente.`,
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

          {/* Mixed States Warning */}
          {hasMixedStates && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-800 mb-2">
                <span className="text-lg">⚠️</span>
                <span className="font-medium">Estados mixtos detectados</span>
              </div>
              <p className="text-sm text-amber-700">
                Has seleccionado pedidos con diferentes estados. Por seguridad, solo puedes <strong>agregar tiempo extra</strong> cuando hay estados mixtos. 
                Esto evita conflictos y errores en las validaciones del sistema.
              </p>
              <div className="mt-2 text-xs text-amber-600">
                <span className="font-medium">Estados encontrados:</span> {
                  [...new Set(selectedOrders.map(order => 
                    isRealOrder(order) ? order.estado : order.status
                  ))].join(', ')
                }
              </div>
              <p className="text-xs text-amber-600 mt-1">
                💡 <strong>Sugerencia:</strong> Selecciona pedidos con el mismo estado para acceder a todas las opciones.
              </p>
            </div>
          )}

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
            <Label className={hasMixedStates ? 'text-muted-foreground' : ''}>
              Cambiar Estado
              {hasMixedStates && <span className="text-xs ml-2">(Bloqueado por estados mixtos)</span>}
            </Label>
            {hasMixedStates ? (
              <div className="p-3 bg-muted border border-dashed rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-sm">🔒 Campo deshabilitado</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  No se puede cambiar el estado cuando hay múltiples estados seleccionados.
                </p>
              </div>
            ) : isLoading ? (
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
            <Label className={hasMixedStates ? 'text-muted-foreground' : ''}>
              Asignar Repartidor
              {hasMixedStates && <span className="text-xs ml-2">(Bloqueado por estados mixtos)</span>}
            </Label>
            {(() => {
              // Verificar si hay estados mixtos primero
              if (hasMixedStates) {
                return (
                  <div className="p-3 bg-muted border border-dashed rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-sm">🔒 Campo deshabilitado</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      No se puede asignar repartidor cuando hay múltiples estados seleccionados.
                    </p>
                  </div>
                );
              }

              // Verificar si hay pedidos de pickup "en espera" (estado "Camino" para pickup)
              const hasPickupOrdersInWaiting = selectedOrders.some(order => {
                const currentStatus = isRealOrder(order) ? order.estado : order.status;
                const orderType = ('type_order' in order && order.type_order) || 
                                 ('tipo_orden' in order && (order as any).tipo_orden) || 
                                 'delivery';
                return currentStatus === 'Camino' && orderType === 'pickup';
              });

              if (hasPickupOrdersInWaiting) {
                return (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-800">
                      <span className="text-sm font-medium">🚫 Pedidos de recolección</span>
                    </div>
                    <p className="text-sm text-blue-700 mt-1">
                      Los pedidos de recolección "En Espera" no necesitan repartidor porque el cliente los recoge directamente en la sede.
                    </p>
                    <div className="mt-2 text-xs text-blue-600">
                      {selectedOrders
                        .filter(order => {
                          const currentStatus = isRealOrder(order) ? order.estado : order.status;
                          const orderType = ('type_order' in order && order.type_order) || 
                                           ('tipo_orden' in order && (order as any).tipo_orden) || 
                                           'delivery';
                          return currentStatus === 'Camino' && orderType === 'pickup';
                        })
                        .map(order => {
                          const orderId = isRealOrder(order) ? order.id_display : order.id;
                          return (
                            <div key={orderId} className="flex justify-between">
                              <span>{orderId}:</span>
                              <span className="font-medium">Pickup - En Espera</span>
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
                );
              }

              // Verificar si alguna orden seleccionada está "en camino" (delivery)
              const hasDeliveryOrdersInTransit = selectedOrders.some(order => {
                const currentStatus = isRealOrder(order) ? order.estado : order.status;
                const orderType = ('type_order' in order && order.type_order) || 
                                 ('tipo_orden' in order && (order as any).tipo_orden) || 
                                 'delivery';
                return (currentStatus === 'Camino' || currentStatus === 'En Camino') && orderType === 'delivery';
              });

              if (hasDeliveryOrdersInTransit && !isAdmin) {
                return (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-800">
                      <span className="text-sm font-medium">🔒 Campo bloqueado</span>
                    </div>
                    <p className="text-sm text-amber-700 mt-1">
                      No se puede cambiar el repartidor de pedidos que están "En Camino". 
                      El repartidor se fija cuando el pedido sale en camino por seguridad.
                    </p>
                    {/* Mostrar repartidor actual de las órdenes en camino */}
                    <div className="mt-2 text-xs text-amber-600">
                      {selectedOrders
                        .filter(order => {
                          const currentStatus = isRealOrder(order) ? order.estado : order.status;
                          const orderType = ('type_order' in order && order.type_order) || 
                                           ('tipo_orden' in order && (order as any).tipo_orden) || 
                                           'delivery';
                          return (currentStatus === 'Camino' || currentStatus === 'En Camino') && orderType === 'delivery';
                        })
                        .map(order => {
                          const orderId = isRealOrder(order) ? order.id_display : order.id;
                          const repartidor = isRealOrder(order) ? order.repartidor : 'Sin asignar';
                          return (
                            <div key={orderId} className="flex justify-between">
                              <span>{orderId}:</span>
                              <span className="font-medium">{repartidor}</span>
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
                );
              }

              return isLoading ? (
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
              );
            })()}
          </div>

          {/* Payment Status Change */}
          <div className="space-y-3">
            <Label className={hasMixedStates ? 'text-muted-foreground' : ''}>
              {hasMultiplePayments ? 'Estados de Pago (Múltiples Métodos)' : 'Estado de Pago'}
              {hasMixedStates && <span className="text-xs ml-2">(Bloqueado por estados mixtos)</span>}
            </Label>
            {hasMixedStates ? (
              <div className="p-3 bg-muted border border-dashed rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-sm">🔒 Campo deshabilitado</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  No se puede cambiar el estado de pago cuando hay múltiples estados seleccionados.
                </p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center gap-2 p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Cargando estados de pago...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Pago Principal */}
                <div>
                  <Label className="text-sm font-medium">
                    {hasMultiplePayments ? 'Pago Principal' : 'Estado de Pago'}
                  </Label>
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
                </div>

                {/* Pago Secundario - Solo mostrar si hay múltiples pagos */}
                {hasMultiplePayments && (
                  <div>
                    <Label className="text-sm font-medium">Pago Secundario</Label>
                    <Select value={newPaymentStatus2} onValueChange={setNewPaymentStatus2} disabled={isUpdating}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar estado del segundo pago" />
                      </SelectTrigger>
                      <SelectContent>
                        {validPaymentStatuses.map(status => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {hasMultiplePayments && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-xs text-blue-700">
                      💳 Estas órdenes tienen múltiples métodos de pago. Puedes actualizar el estado de cada pago por separado.
                    </p>
                  </div>
                )}
              </div>
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
              disabled={
                isUpdating || 
                isLoading || 
                (hasMixedStates ? extraTime === 0 : (extraTime === 0 && !newStatus && !assignedDeliveryPersonId && !newPaymentStatus && !newPaymentStatus2))
              }
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