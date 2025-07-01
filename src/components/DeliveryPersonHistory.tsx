
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Order, DeliveryPerson } from '@/types/delivery';
import { MapPin, Clock, DollarSign, Calendar, CalendarDays } from 'lucide-react';

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
  const [showTodayOnly, setShowTodayOnly] = useState(false);

  if (!deliveryPerson) return null;

  const personOrders = orders.filter(order => order.assignedDeliveryPersonId === deliveryPerson.id);
  
  // Filter by today if toggle is active
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const filteredOrders = showTodayOnly 
    ? personOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= today && orderDate < tomorrow;
      })
    : personOrders;

  const activeOrders = filteredOrders.filter(order => !['delivered', 'cancelled'].includes(order.status));
  const completedOrders = filteredOrders.filter(order => order.status === 'delivered');

  // Calculate today's metrics
  const todayOrders = personOrders.filter(order => {
    const orderDate = new Date(order.createdAt);
    return orderDate >= today && orderDate < tomorrow;
  });
  const todayCompleted = todayOrders.filter(order => order.status === 'delivered');
  const todayEarnings = todayCompleted.reduce((sum, order) => sum + order.totalAmount, 0);

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
          {/* Filter Toggle */}
          <div className="flex items-center gap-4">
            <Button
              variant={showTodayOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowTodayOnly(!showTodayOnly)}
              className="flex items-center gap-2"
            >
              {showTodayOnly ? <Calendar className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
              {showTodayOnly ? 'Solo Hoy' : 'Todo el Historial'}
            </Button>
            <div className="text-sm text-muted-foreground">
              Mostrando {showTodayOnly ? 'pedidos de hoy' : 'todos los pedidos'}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{activeOrders.length}</p>
              <p className="text-sm text-blue-700">Pedidos Activos</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{completedOrders.length}</p>
              <p className="text-sm text-green-700">
                {showTodayOnly ? 'Entregados Hoy' : 'Entregados'}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{filteredOrders.length}</p>
              <p className="text-sm text-purple-700">
                {showTodayOnly ? 'Total Hoy' : 'Total Asignados'}
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(completedOrders.reduce((sum, order) => sum + order.totalAmount, 0))}
              </p>
              <p className="text-sm text-orange-700">
                {showTodayOnly ? 'Ganado Hoy' : 'Total Entregado'}
              </p>
            </div>
          </div>

          {/* Today's Metrics (always visible for reference) */}
          {!showTodayOnly && (
            <div className="bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 p-4 rounded-lg">
              <h3 className="font-semibold text-brand-primary mb-2">Métricas de Hoy</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="font-bold text-lg">{todayCompleted.length}</p>
                  <p className="text-muted-foreground">Entregados</p>
                </div>
                <div>
                  <p className="font-bold text-lg">{todayOrders.length}</p>
                  <p className="text-muted-foreground">Total Asignados</p>
                </div>
                <div>
                  <p className="font-bold text-lg">{formatCurrency(todayEarnings)}</p>
                  <p className="text-muted-foreground">Ganado</p>
                </div>
              </div>
            </div>
          )}

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
              Historial de Pedidos ({filteredOrders.length})
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
                  {filteredOrders.length > 0 ? (
                    filteredOrders
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
                        {showTodayOnly 
                          ? 'No hay pedidos de hoy para este repartidor'
                          : 'No hay pedidos asignados a este repartidor'
                        }
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
