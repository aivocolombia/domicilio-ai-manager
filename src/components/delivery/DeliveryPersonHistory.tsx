
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
  sedeId?: string;
}

export const DeliveryPersonHistory: React.FC<DeliveryPersonHistoryProps> = ({
  isOpen,
  onClose,
  deliveryPerson,
  orders,
  sedeId
}) => {
  const [showTodayOnly, setShowTodayOnly] = useState(true);
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
      
      const data = await deliveryService.getHistorialRepartidor(deliveryPerson.id, sedeId);
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
    total_entregado: deliveryPerson.total_entregado || 0,
    entregado_efectivo: deliveryPerson.entregado_efectivo || 0,
    entregado_otros: deliveryPerson.entregado_otros || 0
  };
  
  // Filter by today if toggle is active (Colombia timezone)
  const today = new Date();
  // Convertir a zona horaria de Colombia (UTC-5)
  const colombiaOffset = -5 * 60; // -5 horas en minutos
  const colombiaToday = new Date(today.getTime() + (colombiaOffset - today.getTimezoneOffset()) * 60000);
  colombiaToday.setHours(0, 0, 0, 0);
  const colombiaTomorrow = new Date(colombiaToday);
  colombiaTomorrow.setDate(colombiaTomorrow.getDate() + 1);

  console.log('🕐 [DEBUG] Fecha filters para historial:', {
    original: today.toISOString(),
    colombiaToday: colombiaToday.toISOString(),
    colombiaTomorrow: colombiaTomorrow.toISOString()
  });
  
  const filteredOrders = showTodayOnly
    ? historialPedidos.filter(order => {
        const orderDate = new Date(order.created_at);
        console.log(`🔍 [DEBUG] Comparando orden ${order.id}:`, {
          orderDate: orderDate.toISOString(),
          colombiaToday: colombiaToday.toISOString(),
          colombiaTomorrow: colombiaTomorrow.toISOString(),
          isInRange: orderDate >= colombiaToday && orderDate < colombiaTomorrow
        });
        return orderDate >= colombiaToday && orderDate < colombiaTomorrow;
      })
    : historialPedidos;

  // Calcular métricas según la lógica de negocio
  const activeOrders = filteredOrders.filter(order => order.status !== 'Entregados'); // Todos los que no están entregados
  const completedOrders = filteredOrders.filter(order => order.status === 'Entregados');
  const totalAssigned = filteredOrders.length; // Todos los pedidos asignados
  const totalDelivered = completedOrders.reduce((sum, order) => sum + (order.pagos?.total_pago || 0), 0);

  // Calculate today's metrics (using Colombia timezone)
  const todayOrders = historialPedidos.filter(order => {
    const orderDate = new Date(order.created_at);
    return orderDate >= colombiaToday && orderDate < colombiaTomorrow;
  });
  const todayCompleted = todayOrders.filter(order => order.status === 'Entregados');
  
  // Debug: Log payment methods para verificar valores reales
  if (process.env.NODE_ENV === 'development' && todayCompleted.length > 0) {
    console.log('🔍 Debug - Pedidos entregados hoy:', todayCompleted.map(order => ({
      id: order.id,
      pagoType: order.pagos?.type,
      paymentMethod: order.payment_method,
      pagos: order.pagos
    })));
  }

  // Calcular efectivo de pedidos entregados hoy
  // Buscar en pago_tipo (que está en la orden directamente) y en pagos.type como fallback
  const todayCashOrders = todayCompleted.filter(order => {
    // Debug: Log para ver qué campos tiene cada orden
    console.log('🔍 Verificando pago para orden:', order.id, {
      pago_tipo: order.pago_tipo,
      pagos_type: order.pagos?.type,
      payment_method: order.payment_method
    });
    
    return (
      order.pago_tipo === 'efectivo' ||
      order.pago_tipo === 'cash' ||
      order.pagos?.type === 'efectivo' ||
      order.pagos?.type === 'cash' ||
      (order.payment_method && (order.payment_method === 'cash' || order.payment_method === 'efectivo'))
    );
  });
  
  const todayTotalCash = todayCashOrders.reduce((sum, order) => {
    return sum + (order.pagos?.total_pago || order.totalAmount || 0);
  }, 0);
  
  const todayOtherPayments = todayCompleted.filter(order => 
    !(order.pago_tipo === 'efectivo' ||
      order.pago_tipo === 'cash' ||
      order.pagos?.type === 'efectivo' ||
      order.pagos?.type === 'cash' ||
      (order.payment_method && (order.payment_method === 'cash' || order.payment_method === 'efectivo')))
  );
  
  const todayTotalOthers = todayOtherPayments.reduce((sum, order) => {
    return sum + (order.pagos?.total_pago || order.totalAmount || 0);
  }, 0);

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
              {showTodayOnly ? 'Pedidos de Hoy' : 'Historial Completo'}
            </Button>
            <div className="text-sm text-muted-foreground">
              Mostrando {showTodayOnly ? 'pedidos de hoy' : 'todos los pedidos'}
            </div>
          </div>
          )}

          {/* Summary Cards */}
          {!loading && (
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
          </div>
          )}

          {/* Today's Metrics (always visible for reference) */}
          {!loading && !showTodayOnly && (
            <div className="bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 p-4 rounded-lg">
              <h3 className="font-semibold text-brand-primary mb-2">Métricas de Hoy</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-bold text-lg">{todayCompleted.length}</p>
                  <p className="text-muted-foreground">Entregados</p>
                </div>
                <div>
                  <p className="font-bold text-lg">{todayOrders.length}</p>
                  <p className="text-muted-foreground">Total Asignados</p>
                </div>
              </div>
            </div>
          )}

          {/* Control de Efectivo - Siempre visible para pedidos del día */}
          {!loading && (todayTotalCash > 0 || todayCompleted.length > 0) && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                💰 Control de Efectivo - Día de Hoy
              </h3>
              
              {/* Resumen de pedidos por método de pago */}
              <div className="mb-4 p-3 bg-white rounded-lg border border-green-100">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">Pedidos en efectivo:</span>
                    <span className="font-bold text-green-800">{todayCashOrders.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Otros métodos:</span>
                    <span className="font-bold text-blue-800">{todayOtherPayments.length}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Efectivo Recaudado */}
                <div className="bg-white p-4 rounded-lg border border-green-300 shadow-sm">
                  <p className="text-3xl font-bold text-green-700">
                    {formatCurrency(todayTotalCash)}
                  </p>
                  <p className="text-sm text-green-800 font-semibold">💵 Efectivo Recaudado</p>
                  <p className="text-xs text-green-600 mt-1">Debe entregar al supervisor</p>
                  <div className="mt-2 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                    {todayCashOrders.length} pedidos en efectivo
                  </div>
                </div>
                
                {/* Otros Métodos */}
                <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                  <p className="text-3xl font-bold text-blue-600">
                    {formatCurrency(todayTotalOthers)}
                  </p>
                  <p className="text-sm text-blue-700 font-semibold">💳 Otros Métodos</p>
                  <p className="text-xs text-blue-600 mt-1">Tarjeta, transferencia, etc.</p>
                  <div className="mt-2 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
                    {todayOtherPayments.length} pedidos digitales
                  </div>
                </div>
                
                {/* Total del Día */}
                <div className="bg-white p-4 rounded-lg border border-purple-200 shadow-sm">
                  <p className="text-3xl font-bold text-purple-600">
                    {formatCurrency(todayTotalCash + todayTotalOthers)}
                  </p>
                  <p className="text-sm text-purple-700 font-semibold">📊 Total del Día</p>
                  <p className="text-xs text-purple-600 mt-1">Efectivo + Otros métodos</p>
                  <div className="mt-2 text-xs text-purple-700 bg-purple-50 px-2 py-1 rounded">
                    {todayCompleted.length} pedidos entregados
                  </div>
                </div>
              </div>
              
              {/* Instrucciones para el supervisor */}
              <div className="mt-4 p-4 bg-amber-50 border border-amber-300 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="text-amber-600 text-lg">📋</div>
                  <div>
                    <p className="text-sm text-amber-800 font-semibold mb-2">
                      Instrucciones para Supervisión:
                    </p>
                    {todayTotalCash > 0 ? (
                      <p className="text-sm text-amber-800">
                        • El repartidor debe entregar <strong className="text-lg">{formatCurrency(todayTotalCash)}</strong> en efectivo al final del turno
                        <br />
                        • Los otros métodos ({formatCurrency(todayTotalOthers)}) ya están registrados digitalmente
                        <br />
                        • Total de pedidos entregados hoy: <strong>{todayCompleted.length}</strong>
                      </p>
                    ) : (
                      <p className="text-sm text-amber-800">
                        • No hay dinero en efectivo para entregar hoy
                        <br />
                        • Todos los pedidos fueron pagados con métodos digitales ({formatCurrency(todayTotalOthers)})
                      </p>
                    )}
                  </div>
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
                      <TableHead>Método Pago</TableHead>
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
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {(order.pago_tipo === 'efectivo' || 
                              order.pago_tipo === 'cash' ||
                              order.pagos?.type === 'efectivo' || 
                              order.pagos?.type === 'cash' ||
                              (order.payment_method && (order.payment_method === 'cash' || order.payment_method === 'efectivo'))) ? (
                              <>
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-sm font-medium text-green-700">💵 Efectivo</span>
                              </>
                            ) : (
                              <>
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span className="text-sm text-blue-700">
                                  💳 {order.pagos?.type || order.payment_method || 'Digital'}
                                </span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(order.pagos?.total_pago || order.totalAmount || 0)}
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
                    <TableHead>Método Pago</TableHead>
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
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {(order.pago_tipo === 'efectivo' || 
                              order.pago_tipo === 'cash' ||
                              order.pagos?.type === 'efectivo' || 
                              order.pagos?.type === 'cash' ||
                              (order.payment_method && (order.payment_method === 'cash' || order.payment_method === 'efectivo'))) ? (
                              <>
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-sm font-medium text-green-700">💵 Efectivo</span>
                              </>
                            ) : (
                              <>
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span className="text-sm text-blue-700">
                                  💳 {order.pagos?.type || order.payment_method || 'Digital'}
                                </span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(order.pagos?.total_pago || order.totalAmount || 0)}
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
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
