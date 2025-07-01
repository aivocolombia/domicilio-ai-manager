import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Order, InventoryItem, Sede, PaymentMethod, User as UserType, DeliveryType } from '@/types/delivery';
import { Plus, Minus, Store, Send, MapPin, Search, User, Phone } from 'lucide-react';

interface SedeOrdersProps {
  orders: Order[];
  inventory: InventoryItem[];
  sedes: Sede[];
  currentUser: UserType;
  onCreateOrder: (orderData: Omit<Order, 'id' | 'createdAt' | 'estimatedDeliveryTime'>) => void;
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
  onCreateOrder,
  onTransferOrder
}) => {
  const [newOrder, setNewOrder] = useState({
    customerName: '',
    customerPhone: '',
    address: '',
    items: [] as Array<{
      productId: string;
      productName: string;
      quantity: number;
      price: number;
      toppings: Array<{id: string; name: string; price: number}>
    }>,
    paymentMethod: 'cash' as PaymentMethod,
    specialInstructions: '',
    deliveryType: 'delivery' as DeliveryType,
    pickupSede: ''
  });

  const [selectedProduct, setSelectedProduct] = useState('');
  const [transferOrderId, setTransferOrderId] = useState('');
  const [targetSede, setTargetSede] = useState('');
  
  // Customer search state
  const [searchPhone, setSearchPhone] = useState('');
  const [customer, setCustomer] = useState<CustomerData | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Customer search functionality
  const normalizePhone = (phone: string) => {
    return phone.replace(/[\s\-\(\)]/g, '');
  };

  const searchCustomer = () => {
    if (!searchPhone.trim()) return;
    
    const normalizedSearchPhone = normalizePhone(searchPhone.trim());
    const customerOrders = orders.filter(order => {
      const normalizedOrderPhone = normalizePhone(order.customerPhone);
      return normalizedOrderPhone === normalizedSearchPhone;
    });
    
    if (customerOrders.length > 0) {
      const customerName = customerOrders[0].customerName;
      setCustomer({
        name: customerName,
        phone: searchPhone.trim(),
        orderHistory: customerOrders.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      });
      
      // Auto-fill customer data
      setNewOrder(prev => ({
        ...prev,
        customerName: customerName,
        customerPhone: searchPhone.trim()
      }));
    } else {
      setCustomer(null);
      setNewOrder(prev => ({
        ...prev,
        customerPhone: searchPhone.trim()
      }));
    }
  };

  const addProductToOrder = () => {
    if (!selectedProduct) return;
    
    const product = inventory.find(item => item.id === selectedProduct);
    if (!product) return;

    const newItem = {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      price: product.price,
      toppings: []
    };

    setNewOrder(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
    setSelectedProduct('');
  };

  const removeProductFromOrder = (index: number) => {
    setNewOrder(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return;
    
    setNewOrder(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, quantity } : item
      )
    }));
  };

  const calculateTotal = () => {
    return newOrder.items.reduce((total, item) => {
      const itemTotal = item.price * item.quantity;
      const toppingsTotal = item.toppings.reduce((sum, topping) => sum + topping.price, 0) * item.quantity;
      return total + itemTotal + toppingsTotal;
    }, 0);
  };

  const handleCreateOrder = () => {
    if (!newOrder.customerName || !newOrder.customerPhone || newOrder.items.length === 0) {
      return;
    }

    if (newOrder.deliveryType === 'delivery' && !newOrder.address) {
      return;
    }

    if (newOrder.deliveryType === 'pickup' && !newOrder.pickupSede) {
      return;
    }

    const orderData = {
      customerName: newOrder.customerName,
      customerPhone: newOrder.customerPhone,
      address: newOrder.deliveryType === 'pickup' ? `Recogida en ${newOrder.pickupSede}` : newOrder.address,
      items: newOrder.items.map((item, index) => ({
        id: `item-${Date.now()}-${index}`,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        toppings: item.toppings
      })),
      status: 'received' as const,
      totalAmount: calculateTotal(),
      source: 'sede' as const,
      specialInstructions: newOrder.specialInstructions || undefined,
      paymentMethod: newOrder.paymentMethod,
      paymentStatus: 'pending' as const,
      originSede: currentUser.sede,
      assignedSede: currentUser.sede,
      deliveryType: newOrder.deliveryType,
      pickupSede: newOrder.deliveryType === 'pickup' ? newOrder.pickupSede : undefined
    };

    onCreateOrder(orderData);
    
    // Reset form
    setNewOrder({
      customerName: '',
      customerPhone: '',
      address: '',
      items: [],
      paymentMethod: 'cash',
      specialInstructions: '',
      deliveryType: 'delivery',
      pickupSede: ''
    });
    setSearchPhone('');
    setCustomer(null);
  };

  const handleTransferOrder = () => {
    if (!transferOrderId || !targetSede) return;
    
    onTransferOrder(transferOrderId, targetSede);
    setTransferOrderId('');
    setTargetSede('');
  };

  const mySedeOrders = orders.filter(order => 
    order.assignedSede === currentUser.sede || 
    order.originSede === currentUser.sede
  );

  const availableForTransfer = mySedeOrders.filter(order => 
    !['delivered', 'cancelled'].includes(order.status)
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return 'bg-blue-100 text-blue-800';
      case 'kitchen': return 'bg-yellow-100 text-yellow-800';
      case 'delivery': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'ready_pickup': return 'bg-orange-100 text-orange-800';
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
      case 'ready_pickup': return 'Listo para Recoger';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create">Crear Pedido</TabsTrigger>
          <TabsTrigger value="orders">Pedidos Sede</TabsTrigger>
          <TabsTrigger value="transfer">Transferir Pedidos</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Crear Pedido desde Sede - {currentUser.sede}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Search */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Buscar Cliente</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label htmlFor="phone-search">Número de Teléfono</Label>
                      <Input
                        id="phone-search"
                        type="tel"
                        placeholder="Ej: 300-123-4567"
                        value={searchPhone}
                        onChange={(e) => setSearchPhone(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && searchCustomer()}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={searchCustomer}>
                        <Search className="h-4 w-4 mr-2" />
                        Buscar
                      </Button>
                    </div>
                  </div>
                  
                  {customer && (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-800">Cliente encontrado: {customer.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-700">{customer.orderHistory.length} pedidos anteriores</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customerName">Nombre del Cliente</Label>
                  <Input
                    id="customerName"
                    value={newOrder.customerName}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, customerName: e.target.value }))}
                    placeholder="Nombre completo"
                  />
                </div>
                <div>
                  <Label htmlFor="customerPhone">Teléfono</Label>
                  <Input
                    id="customerPhone"
                    value={newOrder.customerPhone}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, customerPhone: e.target.value }))}
                    placeholder="Ej: 300-123-4567"
                  />
                </div>
              </div>

              <div>
                <Label>Tipo de Entrega</Label>
                <RadioGroup
                  value={newOrder.deliveryType}
                  onValueChange={(value: DeliveryType) => setNewOrder(prev => ({ 
                    ...prev, 
                    deliveryType: value, 
                    address: '', 
                    pickupSede: '' 
                  }))}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="delivery" id="delivery-sede" />
                    <Label htmlFor="delivery-sede">Domicilio</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pickup" id="pickup-sede" />
                    <Label htmlFor="pickup-sede">Recogida en Tienda</Label>
                  </div>
                </RadioGroup>
              </div>

              {newOrder.deliveryType === 'delivery' ? (
                <div>
                  <Label htmlFor="address">Dirección de Entrega</Label>
                  <Input
                    id="address"
                    value={newOrder.address}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Dirección completa"
                  />
                </div>
              ) : (
                <div>
                  <Label>Sede de Recogida</Label>
                  <Select 
                    value={newOrder.pickupSede} 
                    onValueChange={(value) => setNewOrder(prev => ({ ...prev, pickupSede: value }))}
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
                <Label>Agregar Productos</Label>
                <div className="flex gap-2">
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleccionar producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventory.filter(item => item.isAvailable).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} - {formatCurrency(item.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={addProductToOrder} disabled={!selectedProduct}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {newOrder.items.length > 0 && (
                <div>
                  <Label>Productos en el Pedido</Label>
                  <div className="space-y-2 border rounded-lg p-4">
                    {newOrder.items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(item.price)} x {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(index, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(index, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeProductFromOrder(index)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2">
                      <p className="font-bold text-right">
                        Total: {formatCurrency(calculateTotal())}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="paymentMethod">Método de Pago</Label>
                  <Select value={newOrder.paymentMethod} onValueChange={(value: PaymentMethod) => 
                    setNewOrder(prev => ({ ...prev, paymentMethod: value }))
                  }>
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
              </div>

              <div>
                <Label htmlFor="instructions">Instrucciones Especiales</Label>
                <Textarea
                  id="instructions"
                  value={newOrder.specialInstructions}
                  onChange={(e) => setNewOrder(prev => ({ ...prev, specialInstructions: e.target.value }))}
                  placeholder="Instrucciones adicionales..."
                />
              </div>

              <Button 
                onClick={handleCreateOrder}
                className="w-full"
                disabled={
                  !newOrder.customerName || 
                  !newOrder.customerPhone || 
                  (newOrder.deliveryType === 'delivery' && !newOrder.address) ||
                  (newOrder.deliveryType === 'pickup' && !newOrder.pickupSede) ||
                  newOrder.items.length === 0
                }
              >
                Crear Pedido
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Pedidos de la Sede - {currentUser.sede}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mySedeOrders.map((order) => (
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
                      <TableCell>
                        <Badge variant={order.deliveryType === 'pickup' ? 'secondary' : 'outline'}>
                          {order.deliveryType === 'pickup' ? 'Recogida' : 'Domicilio'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(order.status)}>
                          {getStatusText(order.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(order.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {order.source === 'sede' ? `Sede: ${order.originSede}` : order.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.createdAt.toLocaleDateString('es-CO')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfer">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Transferir Pedidos a Otra Sede
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Lista de pedidos disponibles para transferir */}
              <div>
                <Label>Pedidos Disponibles para Transferir</Label>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                  {availableForTransfer.length > 0 ? (
                    <div className="space-y-2">
                      {availableForTransfer.map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex-1">
                            <p className="font-medium">{order.customerName}</p>
                            <p className="text-sm text-muted-foreground">
                              {order.id.slice(0, 8)} - {formatCurrency(order.totalAmount)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {order.deliveryType === 'pickup' ? 'Recogida' : 'Domicilio'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(order.status)}>
                              {getStatusText(order.status)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      No hay pedidos disponibles para transferir
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Seleccionar Pedido</Label>
                  <Select value={transferOrderId} onValueChange={setTransferOrderId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pedido a transferir" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableForTransfer.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.id.slice(0, 8)} - {order.customerName} - {formatCurrency(order.totalAmount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sede Destino</Label>
                  <Select value={targetSede} onValueChange={setTargetSede}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar sede" />
                    </SelectTrigger>
                    <SelectContent>
                      {sedes.filter(sede => sede.name !== currentUser.sede && sede.isActive).map((sede) => (
                        <SelectItem key={sede.id} value={sede.name}>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {sede.name} - Capacidad: {sede.currentCapacity}/{sede.maxCapacity}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={handleTransferOrder}
                disabled={!transferOrderId || !targetSede}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                Transferir Pedido
              </Button>

              <div className="mt-6">
                <h3 className="font-semibold mb-3">Estado de las Sedes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sedes.filter(sede => sede.isActive).map((sede) => (
                    <Card key={sede.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{sede.name}</p>
                            <p className="text-sm text-muted-foreground">{sede.address}</p>
                          </div>
                          <Badge variant={sede.currentCapacity >= sede.maxCapacity ? "destructive" : "default"}>
                            {sede.currentCapacity}/{sede.maxCapacity}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
