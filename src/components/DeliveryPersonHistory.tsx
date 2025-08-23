
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { deliveryService } from '@/services/deliveryService';
import { MapPin, Clock, DollarSign, Calendar, CalendarDays, Loader2 } from 'lucide-react';

interface DeliveryPersonHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryPerson: any;
  orders: any[];
}

export const DeliveryPersonHistory: React.FC<DeliveryPersonHistoryProps> = ({
  isOpen,
  onClose,
  deliveryPerson,
  orders
}) => {
  const [showTodayOnly, setShowTodayOnly] = useState(false);
  const [historialPedidos, setHistorialPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Cargar historial cuando se abre el modal
  useEffect(() => {
    if (isOpen && deliveryPerson?.id) {
      loadHistorial();
    }
  }, [isOpen, deliveryPerson?.id]);

  const loadHistorial = async () => {
    if (!deliveryPerson?.id) return;
    
    try {
      setLoading(true);
      console.log('🔄 Cargando historial para repartidor:', deliveryPerson.id);
      
      const data = await deliveryService.getHistorialRepartidor(deliveryPerson.id);
      setHistorialPedidos(data);
      
      console.log('✅ Historial cargado:', data.length, 'pedidos');
    } catch (error) {
      console.error('❌ Error al cargar historial:', error);
      setHistorialPedidos([]);
    } finally {
      setLoading(false);
    }
  };

  if (!deliveryPerson) return null;

  // Validar que los datos del repartidor tengan las propiedades necesarias
  const repartidorStats = {
    pedidos_activos: deliveryPerson.pedidos_activos || 0,
    entregados: deliveryPerson.entregados || 0,
    total_asignados: deliveryPerson.total_asignados || 0,
    total_entregado: deliveryPerson.total_entregado || 0
  };
  
  // Filter by today if toggle is active
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const filteredOrders = showTodayOnly 
    ? historialPedidos.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= today && orderDate < tomorrow;
      })
    : historialPedidos;

  // Calcular métricas según la lógica de negocio
  const activeOrders = filteredOrders.filter(order => order.status !== 'Entregados'); // Todos los que no están entregados
  const completedOrders = filteredOrders.filter(order => order.status === 'Entregados');
  const totalAssigned = filteredOrders.length; // Todos los pedidos asignados
  const totalDelivered = completedOrders.reduce((sum, order) => sum + (order.pagos?.total_pago || 0), 0);
  const totalEarnings = completedOrders.length * 4000; // $4000 por domicilio entregado

  // Calculate today's metrics
  const todayOrders = historialPedidos.filter(order => {
    const orderDate = new Date(order.created_at);
    return orderDate >= today && orderDate < tomorrow;
  });
  const todayCompleted = todayOrders.filter(order => order.status === 'Entregados');
  const todayEarnings = todayCompleted.length * 4000; // $4000 por domicilio entregado hoy

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Recibidos': return 'bg-blue-100 text-blue-800';
      case 'Cocina': return 'bg-yellow-100 text-yellow-800';
      case 'Camino': return 'bg-purple-100 text-purple-800';
      case 'Entregados': return 'bg-green-100 text-green-800';
      case 'Cancelado': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'Recibidos': return 'Recibido';
      case 'Cocina': return 'En Cocina';
      case 'Camino': return 'En Camino';
      case 'Entregados': return 'Entregado';
      case 'Cancelado': return 'Cancelado';
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
            Historial de {deliveryPerson.nombre || 'Repartidor'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Cargando historial...</span>
            </div>
          )}

          {/* Filter Toggle */}
          {!loading && (
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
          )}

          {/* Summary Cards */}
          {!loading && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
              <p className="text-2xl font-bold text-purple-600">{totalAssigned}</p>
              <p className="text-sm text-purple-700">
                {showTodayOnly ? 'Total Hoy' : 'Total Asignados'}
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(totalDelivered)}
              </p>
              <p className="text-sm text-orange-700">
                {showTodayOnly ? 'Total Entregado Hoy' : 'Total Entregado'}
              </p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(totalEarnings)}
              </p>
              <p className="text-sm text-emerald-700">
                {showTodayOnly ? 'Ganado Hoy' : 'Ganado ($4000/domicilio)'}
              </p>
            </div>
          </div>
          )}

          {/* Today's Metrics (always visible for reference) */}
          {!loading && !showTodayOnly && (
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
                  <p className="text-muted-foreground">Ganado ($4000/domicilio)</p>
                </div>
              </div>
            </div>
          )}

          {/* Active Orders Section */}
          {!loading && activeOrders.length > 0 && (
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
                      <TableHead>Hora Entrega</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-sm">
                          #{order.id}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.clientes?.nombre || 'Sin nombre'}</p>
                            <p className="text-sm text-muted-foreground">{order.clientes?.telefono || 'Sin teléfono'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{order.clientes?.direccion || 'Sin dirección'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.status)}>
                            {getStatusText(order.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(order.pagos?.total_pago || 0)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {order.hora_entrega ? new Date(order.hora_entrega).toLocaleTimeString('es-CO', {
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'No definida'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Order History Section */}
          {!loading && (
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
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((order) => (
                        <TableRow key={order.id}>
                                                  <TableCell className="font-mono text-sm">
                          #{order.id}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.clientes?.nombre || 'Sin nombre'}</p>
                            <p className="text-sm text-muted-foreground">{order.clientes?.telefono || 'Sin teléfono'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{order.clientes?.direccion || 'Sin dirección'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.status)}>
                            {getStatusText(order.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(order.pagos?.total_pago || 0)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(order.created_at).toLocaleDateString('es-CO')}
                          <br />
                          {new Date(order.created_at).toLocaleTimeString('es-CO', {
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
