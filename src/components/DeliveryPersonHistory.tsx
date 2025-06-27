
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Order, DeliveryPerson } from '@/types/delivery';
import { MapPin, Clock, DollarSign } from 'lucide-react';

interface DeliveryPersonHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryPerson: DeliveryPerson | null;
  orders: Order[];
}

export const DeliveryPersonHistory: React.FC<DeliveryPersonHistoryProps> = ({
  isOpen,
  onClose,
  deliveryPerson,
  orders
}) => {
  if (!deliveryPerson) return null;

  const personOrders = orders.filter(order => order.assignedDeliveryPersonId === deliveryPerson.id);
  const activeOrders = personOrders.filter(order => !['delivered', 'cancelled'].includes(order.status));
  const completedOrders = personOrders.filter(order => order.status === 'delivered');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return 'bg-blue-100 text-blue-800';
      case 'kitchen': return 'bg-yellow-100 text-yellow-800';
      case 'delivery': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'received': return 'Recibido';
      case 'kitchen': return 'En Cocina';
      case 'delivery': return 'En Camino';
      case 'delivered': return 'Entregado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Historial de {deliveryPerson.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{activeOrders.length}</p>
              <p className="text-sm text-blue-700">Pedidos Activos</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{completedOrders.length}</p>
              <p className="text-sm text-green-700">Entregados</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{personOrders.length}</p>
              <p className="text-sm text-purple-700">Total Asignados</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(completedOrders.reduce((sum, order) => sum + order.totalAmount, 0))}
              </p>
              <p className="text-sm text-orange-700">Total Entregado</p>
            </div>
          </div>

          {/* Active Orders Section */}
          {activeOrders.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Pedidos Activos ({activeOrders.length})
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Dirección</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Entrega Estimada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-sm">
                          {order.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.customerName}</p>
                            <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{order.address}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.status)}>
                            {getStatusText(order.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(order.totalAmount)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {order.estimatedDeliveryTime.toLocaleTimeString('es-CO', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Order History Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Historial de Pedidos ({personOrders.length})
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personOrders.length > 0 ? (
                    personOrders
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">
                            {order.id.slice(0, 8)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{order.customerName}</p>
                              <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <span className="text-sm">{order.address}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(order.status)}>
                              {getStatusText(order.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(order.totalAmount)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {order.createdAt.toLocaleDateString('es-CO')}
                            <br />
                            {order.createdAt.toLocaleTimeString('es-CO', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No hay pedidos asignados a este repartidor
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
