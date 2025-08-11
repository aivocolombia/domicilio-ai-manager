
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Phone, Search, Plus, User, MapPin, Clock, CreditCard, Store, AlertTriangle, Pause } from 'lucide-react';
import { Order, PaymentMethod, DeliveryType, Sede, DeliverySettings } from '@/types/delivery';
import { useMenu } from '@/hooks/useMenu';

interface CallCenterProps {
  orders: Order[];
  sedes: Sede[];
  settings: DeliverySettings;
  onCreateOrder: (order: Omit<Order, 'id' | 'createdAt' | 'estimatedDeliveryTime'>) => void;
}

interface CustomerData {
  name: string;
  phone: string;
  orderHistory: Order[];
}

const CallCenter: React.FC<CallCenterProps> = ({ orders, sedes, settings, onCreateOrder }) => {
  const { platos, bebidas, loading: menuLoading } = useMenu();
  const [searchPhone, setSearchPhone] = useState('');
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newOrder, setNewOrder] = useState({
    address: '',
    items: [] as { productId: string; quantity: number; toppings: string[] }[],
    paymentMethod: 'cash' as PaymentMethod,
    specialInstructions: '',
    deliveryType: 'delivery' as DeliveryType,
    pickupSede: ''
  });

  // Normalize phone number by removing spaces, dashes, and parentheses
  const normalizePhone = (phone: string) => {
    return phone.replace(/[\s\-\(\)]/g, '');
  };

  const searchCustomer = () => {
    if (!searchPhone.trim()) return;
    
    const normalizedSearchPhone = normalizePhone(searchPhone.trim());
    console.log('Searching for normalized phone:', normalizedSearchPhone);
    
    // Find customer by normalized phone in existing orders
    const customerOrders = orders.filter(order => {
      const normalizedOrderPhone = normalizePhone(order.customerPhone);
      console.log('Comparing with order phone:', normalizedOrderPhone);
      return normalizedOrderPhone === normalizedSearchPhone;
    });
    
    console.log('Found orders:', customerOrders.length);
    
    if (customerOrders.length > 0) {
      const customerName = customerOrders[0].customerName;
      setCustomer({
        name: customerName,
        phone: searchPhone.trim(),
        orderHistory: customerOrders.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      });
    } else {
      setCustomer(null);
    }
  };

  const addItemToOrder = (productId: string) => {
    const existingItem = newOrder.items.find(item => item.productId === productId);
    if (existingItem) {
      setNewOrder({
        ...newOrder,
        items: newOrder.items.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      });
    } else {
      setNewOrder({
        ...newOrder,
        items: [...newOrder.items, { productId, quantity: 1, toppings: [] }]
      });
    }
  };

  const removeItemFromOrder = (productId: string) => {
    setNewOrder({
      ...newOrder,
      items: newOrder.items.filter(item => item.productId !== productId)
    });
  };

  const calculateTotal = () => {
    return newOrder.items.reduce((total, item) => {
      const product = platos.find(p => p.id.toString() === item.productId) || 
                     bebidas.find(b => b.id.toString() === item.productId);
      return total + (product ? product.pricing * item.quantity : 0);
    }, 0);
  };

  const handleCreateOrder = () => {
    if (newOrder.deliveryType === 'delivery' && !newOrder.address) return;
    if (newOrder.deliveryType === 'pickup' && !newOrder.pickupSede) return;
    if (newOrder.items.length === 0) return;
    
    const customerName = customer?.name || newCustomerName;
    if (!customerName) return;

    const orderItems = newOrder.items.map(item => {
      const product = platos.find(p => p.id.toString() === item.productId) || 
                     bebidas.find(b => b.id.toString() === item.productId);
      return {
        id: `item-${Date.now()}-${item.productId}`,
        productId: item.productId,
        productName: product?.name || '',
        quantity: item.quantity,
        price: product?.pricing || 0,
        toppings: []
      };
    });

    onCreateOrder({
      customerName,
      customerPhone: searchPhone,
      address: newOrder.deliveryType === 'pickup' ? `Recogida en ${newOrder.pickupSede}` : newOrder.address,
      items: orderItems,
      status: 'received',
      totalAmount: calculateTotal(),
      source: 'call_center',
      specialInstructions: newOrder.specialInstructions || undefined,
      paymentMethod: newOrder.paymentMethod,
      paymentStatus: 'pending',
      deliveryType: newOrder.deliveryType,
      pickupSede: newOrder.deliveryType === 'pickup' ? newOrder.pickupSede : undefined
    });

    // Reset form
    setNewOrder({
      address: '',
      items: [],
      paymentMethod: 'cash',
      specialInstructions: '',
      deliveryType: 'delivery',
      pickupSede: ''
    });
    setNewCustomerName('');
    setShowNewOrderDialog(false);
    
    // Refresh customer data
    setTimeout(() => searchCustomer(), 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return 'bg-blue-100 text-blue-800';
      case 'kitchen': return 'bg-yellow-100 text-yellow-800';
      case 'delivery': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'ready_pickup': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Orders Paused Alert */}
      {!settings.acceptingOrders && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <div className="flex items-center gap-2">
              <Pause className="h-4 w-4" />
              <span className="font-medium">Los pedidos están pausados momentáneamente.</span>
            </div>
            <p className="mt-1 text-sm">No se pueden crear nuevos pedidos hasta que se reactiven desde el Dashboard.</p>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Búsqueda de Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="phone">Número de Teléfono</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Ej: 300-123-4567"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchCustomer()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={searchCustomer} className="bg-brand-primary hover:bg-brand-primary/90">
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {searchPhone && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {customer ? `Cliente: ${customer.name}` : 'Cliente Nuevo'}
              </div>
              <Dialog open={showNewOrderDialog} onOpenChange={setShowNewOrderDialog}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-brand-primary hover:bg-brand-primary/90"
                    disabled={!settings.acceptingOrders}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Pedido
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Crear Nuevo Pedido</DialogTitle>
                  </DialogHeader>
                  
                  {!settings.acceptingOrders && (
                    <Alert className="border-amber-200 bg-amber-50 mb-4">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800">
                        <div className="flex items-center gap-2">
                          <Pause className="h-4 w-4" />
                          <span className="font-medium">Los pedidos están pausados.</span>
                        </div>
                        <p className="mt-1 text-sm">No se pueden crear nuevos pedidos en este momento.</p>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-4">
                    {!customer && (
                      <div>
                        <Label htmlFor="customerName">Nombre del Cliente</Label>
                        <Input
                          id="customerName"
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          placeholder="Ingrese el nombre del cliente"
                        />
                      </div>
                    )}
                    
                    <div>
                      <Label>Tipo de Entrega</Label>
                      <RadioGroup
                        value={newOrder.deliveryType}
                        onValueChange={(value: DeliveryType) => setNewOrder({ ...newOrder, deliveryType: value, address: '', pickupSede: '' })}
                        className="flex gap-6"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="delivery" id="delivery" />
                          <Label htmlFor="delivery">Domicilio</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="pickup" id="pickup" />
                          <Label htmlFor="pickup">Recogida en Tienda</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {newOrder.deliveryType === 'delivery' ? (
                      <div>
                        <Label htmlFor="address">Dirección de Entrega</Label>
                        <Input
                          id="address"
                          value={newOrder.address}
                          onChange={(e) => setNewOrder({ ...newOrder, address: e.target.value })}
                          placeholder="Ingrese la dirección completa"
                        />
                      </div>
                    ) : (
                      <div>
                        <Label>Sede de Recogida</Label>
                        <Select 
                          value={newOrder.pickupSede} 
                          onValueChange={(value) => setNewOrder({ ...newOrder, pickupSede: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar sede" />
                          </SelectTrigger>
                          <SelectContent>
                            {sedes.filter(sede => sede.isActive).map((sede) => (
                              <SelectItem key={sede.id} value={sede.name}>
                                <div className="flex items-center gap-2">
                                  <Store className="h-4 w-4" />
                                  {sede.name} - {sede.address}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <Label>Método de Pago</Label>
                      <Select 
                        value={newOrder.paymentMethod} 
                        onValueChange={(value: PaymentMethod) => setNewOrder({ ...newOrder, paymentMethod: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Efectivo</SelectItem>
                          <SelectItem value="card">Tarjeta</SelectItem>
                          <SelectItem value="nequi">Nequi</SelectItem>
                          <SelectItem value="transfer">Transferencia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Productos Disponibles</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded p-2">
                        {menuLoading ? (
                          <p className="text-center text-gray-500">Cargando productos...</p>
                        ) : (
                          <>
                            {platos.filter(item => item.available).map((item) => (
                              <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  <p className="text-sm text-gray-600">${item.pricing.toLocaleString()}</p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => addItemToOrder(item.id.toString())}
                                  className="bg-brand-primary hover:bg-brand-primary/90"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            {bebidas.filter(item => item.available).map((item) => (
                              <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  <p className="text-sm text-gray-600">${item.pricing.toLocaleString()}</p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => addItemToOrder(item.id.toString())}
                                  className="bg-brand-primary hover:bg-brand-primary/90"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>

                    {newOrder.items.length > 0 && (
                      <div>
                        <Label>Productos Seleccionados</Label>
                        <div className="space-y-2 border rounded p-2">
                          {newOrder.items.map((item) => {
                            const product = platos.find(p => p.id.toString() === item.productId) || 
                                           bebidas.find(b => b.id.toString() === item.productId);
                            return (
                              <div key={item.productId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <div>
                                  <p className="font-medium">{product?.name}</p>
                                  <p className="text-sm text-gray-600">
                                    Cantidad: {item.quantity} × ${product?.pricing.toLocaleString()}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => removeItemFromOrder(item.productId)}
                                >
                                  Eliminar
                                </Button>
                              </div>
                            );
                          })}
                          <div className="border-t pt-2">
                            <p className="font-bold text-lg">Total: ${calculateTotal().toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="instructions">Instrucciones Especiales</Label>
                      <Textarea
                        id="instructions"
                        value={newOrder.specialInstructions}
                        onChange={(e) => setNewOrder({ ...newOrder, specialInstructions: e.target.value })}
                        placeholder="Instrucciones adicionales para el pedido"
                      />
                    </div>

                    <Button
                      onClick={handleCreateOrder}
                      disabled={
                        !settings.acceptingOrders ||
                        (newOrder.deliveryType === 'delivery' && !newOrder.address) ||
                        (newOrder.deliveryType === 'pickup' && !newOrder.pickupSede) ||
                        newOrder.items.length === 0 || 
                        (!customer && !newCustomerName)
                      }
                      className="w-full bg-brand-primary hover:bg-brand-primary/90"
                    >
                      Crear Pedido
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customer ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-brand-primary">{customer.orderHistory.length}</p>
                        <p className="text-sm text-gray-600">Pedidos Total</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {customer.orderHistory.filter(o => o.status === 'delivered').length}
                        </p>
                        <p className="text-sm text-gray-600">Entregados</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          ${customer.orderHistory.reduce((sum, o) => sum + o.totalAmount, 0).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">Total Gastado</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Historial de Pedidos</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Dirección</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Pago</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Estado Pago</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customer.orderHistory.slice(0, 10).map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-500" />
                              {new Date(order.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-gray-500" />
                              <span className="truncate max-w-xs">{order.address}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            ${order.totalAmount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4 text-gray-500" />
                              <span className="capitalize">{order.paymentMethod}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(order.status)}>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getPaymentStatusColor(order.paymentStatus)}>
                              {order.paymentStatus}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <User className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">No se encontró ningún cliente con este número de teléfono.</p>
                <p className="text-sm text-gray-500 mt-2">
                  Haga clic en "Nuevo Pedido" para crear un pedido para un cliente nuevo.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CallCenter;
