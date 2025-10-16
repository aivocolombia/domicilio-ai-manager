import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  DollarSign,
  ShoppingBag,
  Store,
  Truck,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  TrendingUp,
  Clock,
  CheckCircle,
  LayoutGrid,
  Receipt,
  Package
} from 'lucide-react';
import { UserProfile } from '@/components/UserProfile';
import { Order, OrderStatus, PaymentMethod } from '@/types/delivery';
import { TableManagement, Table } from '@/components/TableManagement';
import { POSInventory } from '@/components/POSInventory';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface POSViewProps {
  onBack: () => void;
}

// Utilidad para formatear moneda
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// Generar datos mock para el día
const generateMockPOSOrders = (): Order[] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const orders: Order[] = [];

  // 15 órdenes locales
  for (let i = 0; i < 15; i++) {
    const createdTime = new Date(today);
    createdTime.setHours(8 + Math.floor(Math.random() * 10));
    createdTime.setMinutes(Math.floor(Math.random() * 60));

    const statuses: OrderStatus[] = ['delivered', 'ready_pickup', 'kitchen', 'received'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    const paymentMethods: PaymentMethod[] = ['cash', 'card', 'nequi', 'transfer'];
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

    orders.push({
      id: `LOCAL-${1000 + i}`,
      customerName: `Cliente Local ${i + 1}`,
      customerPhone: `300-${Math.floor(Math.random() * 9000000) + 1000000}`,
      address: 'Consumo en local',
      items: [{
        id: `item-${i}`,
        productId: 'prod-1',
        productName: Math.random() > 0.5 ? 'Ajiaco Santafereño' : 'Bandeja Paisa',
        quantity: Math.floor(Math.random() * 3) + 1,
        price: Math.random() > 0.5 ? 18000 : 25000,
        toppings: []
      }],
      status,
      totalAmount: Math.floor(Math.random() * 50000) + 15000,
      estimatedDeliveryTime: new Date(createdTime.getTime() + 30 * 60000),
      createdAt: createdTime,
      source: 'sede',
      paymentMethod,
      paymentStatus: status === 'delivered' ? 'paid' : 'pending',
      deliveryType: 'pickup',
      pickupSede: 'Niza',
      originSede: 'Niza'
    });
  }

  // 5 órdenes de domicilio
  for (let i = 0; i < 5; i++) {
    const createdTime = new Date(today);
    createdTime.setHours(9 + Math.floor(Math.random() * 8));
    createdTime.setMinutes(Math.floor(Math.random() * 60));

    const statuses: OrderStatus[] = ['delivered', 'delivery', 'kitchen'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    const paymentMethods: PaymentMethod[] = ['cash', 'card', 'nequi'];
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

    orders.push({
      id: `DOM-${2000 + i}`,
      customerName: `Cliente Domicilio ${i + 1}`,
      customerPhone: `301-${Math.floor(Math.random() * 9000000) + 1000000}`,
      address: `Calle ${Math.floor(Math.random() * 100)} #${Math.floor(Math.random() * 50)}-${Math.floor(Math.random() * 99)}`,
      items: [{
        id: `item-dom-${i}`,
        productId: 'prod-2',
        productName: 'Ajiaco Completo',
        quantity: Math.floor(Math.random() * 2) + 1,
        price: 22000,
        toppings: []
      }],
      status,
      totalAmount: Math.floor(Math.random() * 60000) + 20000,
      estimatedDeliveryTime: new Date(createdTime.getTime() + 45 * 60000),
      createdAt: createdTime,
      source: 'call_center',
      paymentMethod,
      paymentStatus: status === 'delivered' ? 'paid' : 'pending',
      deliveryType: 'delivery',
      assignedSede: 'Niza',
      originSede: 'Niza'
    });
  }

  return orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

const getStatusBadge = (status: OrderStatus) => {
  const statusConfig = {
    'received': { label: 'Recibido', color: 'bg-blue-100 text-blue-800' },
    'kitchen': { label: 'En Cocina', color: 'bg-yellow-100 text-yellow-800' },
    'ready_pickup': { label: 'Listo', color: 'bg-green-100 text-green-800' },
    'delivery': { label: 'En Camino', color: 'bg-purple-100 text-purple-800' },
    'delivered': { label: 'Entregado', color: 'bg-gray-100 text-gray-800' }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.received;
  return <Badge className={cn(config.color, 'font-medium')}>{config.label}</Badge>;
};

const getPaymentIcon = (method: PaymentMethod) => {
  switch (method) {
    case 'card': return <CreditCard className="h-4 w-4" />;
    case 'cash': return <Banknote className="h-4 w-4" />;
    case 'nequi': return <Smartphone className="h-4 w-4" />;
    case 'transfer': return <Building2 className="h-4 w-4" />;
    default: return <CreditCard className="h-4 w-4" />;
  }
};

const getPaymentLabel = (method: PaymentMethod) => {
  const labels = {
    'card': 'Tarjeta',
    'cash': 'Efectivo',
    'nequi': 'Nequi',
    'transfer': 'Transferencia'
  };
  return labels[method] || method;
};

export const POSView: React.FC<POSViewProps> = ({ onBack }) => {
  const [orders] = useState<Order[]>(generateMockPOSOrders());
  const [activeTab, setActiveTab] = useState<'all' | 'local' | 'delivery'>('all');
  const [mainView, setMainView] = useState<'tables' | 'cashier' | 'inventory'>('tables');

  // Calcular métricas
  const metrics = useMemo(() => {
    const localOrders = orders.filter(o => o.deliveryType === 'pickup');
    const deliveryOrders = orders.filter(o => o.deliveryType === 'delivery');
    const paidOrders = orders.filter(o => o.paymentStatus === 'paid');
    const pendingOrders = orders.filter(o => o.paymentStatus === 'pending');

    const totalSales = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const localSales = localOrders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.totalAmount, 0);
    const deliverySales = deliveryOrders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.totalAmount, 0);

    const paymentBreakdown = {
      cash: paidOrders.filter(o => o.paymentMethod === 'cash').reduce((sum, o) => sum + o.totalAmount, 0),
      card: paidOrders.filter(o => o.paymentMethod === 'card').reduce((sum, o) => sum + o.totalAmount, 0),
      nequi: paidOrders.filter(o => o.paymentMethod === 'nequi').reduce((sum, o) => sum + o.totalAmount, 0),
      transfer: paidOrders.filter(o => o.paymentMethod === 'transfer').reduce((sum, o) => sum + o.totalAmount, 0)
    };

    return {
      totalOrders: orders.length,
      localOrders: localOrders.length,
      deliveryOrders: deliveryOrders.length,
      totalSales,
      localSales,
      deliverySales,
      paidOrders: paidOrders.length,
      pendingOrders: pendingOrders.length,
      paymentBreakdown
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    switch (activeTab) {
      case 'local':
        return orders.filter(o => o.deliveryType === 'pickup');
      case 'delivery':
        return orders.filter(o => o.deliveryType === 'delivery');
      default:
        return orders;
    }
  }, [orders, activeTab]);

  // Handler para seleccionar una mesa
  const handleSelectTable = (table: Table) => {
    if (table.isOccupied) {
      toast({
        title: 'Mesa Ocupada',
        description: `Mesa ${table.number} - ${table.customerName}`,
      });
      // TODO: Abrir vista de pedido existente
    } else {
      toast({
        title: 'Mesa Disponible',
        description: `Iniciar nuevo pedido en Mesa ${table.number}`,
      });
      // TODO: Abrir vista de nuevo pedido
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Brand Header */}
      <div className="bg-brand-primary text-white shadow-lg">
        <div className="container mx-auto p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/lovable-uploads/96fc454f-e0fb-40ad-9214-85dcb21960e5.png"
                alt="Ajiaco & Frijoles Logo"
                className="h-12 w-12 rounded-full bg-brand-secondary p-1"
              />
              <div>
                <h1 className="text-2xl font-bold">Ajiaco & Frijoles</h1>
                <p className="text-brand-secondary text-sm">Sistema de Gestión de Pedidos - POS</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Back Button */}
              <Button
                variant="outline"
                onClick={onBack}
                className="flex items-center gap-2 bg-brand-secondary text-red-500 border-brand-secondary hover:bg-brand-primary hover:text-yellow-400"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>

              {/* User Profile Button */}
              <UserProfile />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-6 space-y-6">
        {/* Tabs principales: Mesas vs Caja vs Inventario */}
        <Tabs value={mainView} onValueChange={(v) => setMainView(v as 'tables' | 'cashier' | 'inventory')}>
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3">
            <TabsTrigger value="tables" className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Mesas
            </TabsTrigger>
            <TabsTrigger value="cashier" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Caja
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Inventario
            </TabsTrigger>
          </TabsList>

          {/* Vista de Mesas */}
          <TabsContent value="tables" className="mt-6">
            <TableManagement onSelectTable={handleSelectTable} />
          </TabsContent>

          {/* Vista de Caja */}
          <TabsContent value="cashier" className="mt-6 space-y-6">
        {/* Métricas del Día */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Ventas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Ventas</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(metrics.totalSales)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.paidOrders} órdenes pagadas
              </p>
            </CardContent>
          </Card>

          {/* Órdenes Locales */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Órdenes Locales</CardTitle>
              <Store className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.localOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(metrics.localSales)} en ventas
              </p>
            </CardContent>
          </Card>

          {/* Domicilios */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Domicilios</CardTitle>
              <Truck className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.deliveryOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(metrics.deliverySales)} en ventas
              </p>
            </CardContent>
          </Card>

          {/* Órdenes Pendientes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Por Cobrar</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{metrics.pendingOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Órdenes pendientes de pago
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Desglose de Pagos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Desglose por Método de Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Banknote className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Efectivo</p>
                  <p className="text-lg font-bold">{formatCurrency(metrics.paymentBreakdown.cash)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CreditCard className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tarjeta</p>
                  <p className="text-lg font-bold">{formatCurrency(metrics.paymentBreakdown.card)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Smartphone className="h-5 w-5 text-purple-700" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nequi</p>
                  <p className="text-lg font-bold">{formatCurrency(metrics.paymentBreakdown.nequi)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Building2 className="h-5 w-5 text-orange-700" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transferencia</p>
                  <p className="text-lg font-bold">{formatCurrency(metrics.paymentBreakdown.transfer)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de Órdenes */}
        <Card>
          <CardHeader>
            <CardTitle>Órdenes del Día</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="all">
                  Todas ({orders.length})
                </TabsTrigger>
                <TabsTrigger value="local">
                  <Store className="h-4 w-4 mr-2" />
                  Locales ({metrics.localOrders})
                </TabsTrigger>
                <TabsTrigger value="delivery">
                  <Truck className="h-4 w-4 mr-2" />
                  Domicilios ({metrics.deliveryOrders})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-0">
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            ID
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Cliente
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Tipo
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Pago
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Total
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Hora
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-background divide-y divide-border">
                        {filteredOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-muted/50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                              {order.id}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {order.customerName}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-2">
                                {order.deliveryType === 'pickup' ? (
                                  <>
                                    <Store className="h-4 w-4 text-blue-600" />
                                    <span>Local</span>
                                  </>
                                ) : (
                                  <>
                                    <Truck className="h-4 w-4 text-purple-600" />
                                    <span>Domicilio</span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {getStatusBadge(order.status)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-2">
                                {getPaymentIcon(order.paymentMethod)}
                                <span>{getPaymentLabel(order.paymentMethod)}</span>
                                {order.paymentStatus === 'paid' && (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold">
                              {formatCurrency(order.totalAmount)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-muted-foreground">
                              {order.createdAt.toLocaleTimeString('es-CO', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
          </TabsContent>

          {/* Vista de Inventario */}
          <TabsContent value="inventory" className="mt-6">
            <POSInventory />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
