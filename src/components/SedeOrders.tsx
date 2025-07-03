import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Store, 
  Plus, 
  ArrowUpDown, 
  Clock, 
  User, 
  MapPin, 
  Phone, 
  CreditCard,
  Search,
  AlertTriangle,
  Pause,
  Package,
  ShoppingCart
} from 'lucide-react';
import { Order, InventoryItem, Sede, User as UserType, PaymentMethod, DeliveryType, DeliverySettings } from '@/types/delivery';

interface SedeOrdersProps {
  orders: Order[];
  inventory: InventoryItem[];
  sedes: Sede[];
  currentUser: UserType;
  settings: DeliverySettings;
  onCreateOrder: (order: Omit<Order, 'id' | 'createdAt' | 'estimatedDeliveryTime'>) => void;
  onTransferOrder: (orderId: string, targetSedeId: string) => void;
}

interface CustomerData {
  name: string;
  phone: string;
  orderHistory: Order[];
}

export const SedeOrders: React.FC<SedeOrdersProps> = ({ 
  orders, 
  inventory, 
  sedes, 
  currentUser, 
  settings,
  onCreateOrder, 
  onTransferOrder 
}) => {
  const [searchPhone, setSearchPhone] = useState('');
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newOrder, setNewOrder] = useState({
    address: '',
    items: [] as { productId: string; quantity: number; toppings: string[] }[],
    paymentMethod: 'cash' as PaymentMethod,
    specialInstructions: '',
    deliveryType: 'delivery' as DeliveryType,
    pickupSede: ''
  });
  const [transferOrderId, setTransferOrderId] = useState('');
  const [transferSedeId, setTransferSedeId] = useState('');

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
      const product = inventory.find(p => p.id === item.productId);
      return total + (product ? product.price * item.quantity : 0);
    }, 0);
  };

  const handleCreateOrder = () => {
    if (newOrder.deliveryType === 'delivery' && !newOrder.address) return;
    if (newOrder.deliveryType === 'pickup' && !newOrder.pickupSede) return;
    if (newOrder.items.length === 0) return;
    
    const customerName = customer?.name || newCustomerName;
    if (!customerName) return;

    const orderItems = newOrder.items.map(item => {
      const product = inventory.find(p => p.id === item.productId);
      return {
        id: `item-${Date.now()}-${item.productId}`,
        productId: item.productId,
        productName: product?.name || '',
        quantity: item.quantity,
        price: product?.price || 0,
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
      source: 'sede',
      specialInstructions: newOrder.specialInstructions || undefined,
      paymentMethod: newOrder.paymentMethod,
      paymentStatus: 'pending',
      originSede: currentUser.sede,
      assignedSede: currentUser.sede,
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
    setShowCreateDialog(false);
    
    // Refresh customer data
    setTimeout(() => searchCustomer(), 100);
  };

  const handleTransferOrder = () => {
    if (!transferOrderId || !transferSedeId) return;
    onTransferOrder(transferOrderId, transferSedeId);
    setTransferOrderId('');
    setTransferSedeId('');
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

  const sedeOrders = orders.filter(order => order.assignedSede === currentUser.sede);

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Search Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Búsqueda de Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="tel"
                placeholder="Número de teléfono"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchCustomer()}
              />
              <Button onClick={searchCustomer} variant="outline">
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {customer ? (
              <div className="space-y-2">
                <p>
                  <span className="font-semibold">Nombre:</span> {customer.name}
                </p>
                <p>
                  <span className="font-semibold">Teléfono:</span> {customer.phone}
                </p>
                <Button variant="link" onClick={() => setCustomer(null)}>
                  Limpiar Cliente
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground">
                No se encontró ningún cliente con este número de teléfono.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Acciones Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button 
                  className="w-full bg-brand-primary hover:bg-brand-primary/90"
                  disabled={!settings.acceptingOrders}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Nuevo Pedido
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Pedido - Sede {currentUser.sede}</DialogTitle>
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
                      {inventory.filter(item => item.isAvailable).map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-gray-600">${item.price.toLocaleString()}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => addItemToOrder(item.id)}
                            className="bg-brand-primary hover:bg-brand-primary/90"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {newOrder.items.length > 0 && (
                    <div>
                      <Label>Productos Seleccionados</Label>
                      <div className="space-y-2 border rounded p-2">
                        {newOrder.items.map((item) => {
                          const product = inventory.find(p => p.id === item.productId);
                          return (
                            <div key={item.productId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div>
                                <p className="font-medium">{product?.name}</p>
                                <p className="text-sm text-gray-600">
                                  Cantidad: {item.quantity} × ${product?.price.toLocaleString()}
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

            <Separator />

            <div>
              <Label htmlFor="transferOrder">Transferir Pedido</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="ID del pedido"
                  value={transferOrderId}
                  onChange={(e) => setTransferOrderId(e.target.value)}
                />
                <Select value={transferSedeId} onValueChange={setTransferSedeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar Sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {sedes
                      .filter((sede) => sede.id !== currentUser.sede)
                      .map((sede) => (
                        <SelectItem key={sede.id} value={sede.id}>
                          {sede.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleTransferOrder} variant="outline">
                  Transferir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sede Orders Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Pedidos de la Sede - {currentUser.sede}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <div className="flex items-center gap-2">
                    Fecha
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Pago</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sedeOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      {new Date(order.createdAt).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      {order.customerName}
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
        </CardContent>
      </Card>
    </div>
  );
};
