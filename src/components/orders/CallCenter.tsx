
import React, { useState, useCallback, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Phone, Search, Plus, User, MapPin, Clock, CreditCard, Store, AlertTriangle, Pause, Loader2, RefreshCw } from 'lucide-react';
import { Order, PaymentMethod, DeliveryType, Sede, DeliverySettings } from '@/types/delivery';
import { useMenu } from '@/hooks/useMenu';
import { addressService } from '@/services/addressService';

interface CallCenterProps {
  orders: Order[];
  sedes: Sede[];
  settings: DeliverySettings;
  effectiveSedeId: string;
  currentSedeName: string;
  onCreateOrder: (order: Omit<Order, 'id' | 'createdAt' | 'estimatedDeliveryTime'>) => void;
}

interface CustomerData {
  name: string;
  phone: string;
  orderHistory: Order[];
}

const CallCenter: React.FC<CallCenterProps> = ({ 
  orders, 
  sedes, 
  settings, 
  effectiveSedeId, 
  currentSedeName, 
  onCreateOrder 
}) => {
  const { platos, bebidas, loading: menuLoading } = useMenu();
  const [searchPhone, setSearchPhone] = useState('');
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [loadingDeliveryPrice, setLoadingDeliveryPrice] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false); // Estado para prevenir clics duplicados
  const [newOrder, setNewOrder] = useState({
    address: '',
    deliveryInstructions: '',
    items: [] as { productId: string; quantity: number; toppings: string[] }[],
    paymentMethod: 'cash' as PaymentMethod,
    hasMultiplePayments: false,
    paymentMethod2: 'cash' as PaymentMethod,
    paymentAmount1: 0,
    paymentAmount2: 0,
    specialInstructions: '',
    deliveryType: 'delivery' as DeliveryType,
    pickupSede: '',
    deliveryPrice: 0
  });

  // Normalize phone number by removing spaces, dashes, and parentheses
  const normalizePhone = (phone: string) => {
    return phone.replace(/[\s\-()]/g, '');
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

  // Función para buscar precio de envío automáticamente
  const searchDeliveryPrice = useCallback(async (address: string) => {
    if (!address.trim() || address.length < 5) return;

    try {
      setLoadingDeliveryPrice(true);
      const lastPrice = await addressService.getLastDeliveryPriceForAddress(address, effectiveSedeId);
      
      if (lastPrice && lastPrice > 0) {
        setNewOrder(prev => ({
          ...prev,
          deliveryPrice: lastPrice
        }));
        console.log(`💰 Precio de envío encontrado: $${lastPrice.toLocaleString()} para "${address}"`);
      }
    } catch (error) {
      console.error('Error buscando precio de envío:', error);
    } finally {
      setLoadingDeliveryPrice(false);
    }
  }, [effectiveSedeId]);

  // Debounce para búsqueda de precio al escribir dirección
  useEffect(() => {
    if (newOrder.deliveryType === 'delivery' && newOrder.address) {
      const timer = setTimeout(() => {
        searchDeliveryPrice(newOrder.address);
      }, 800); // Esperar 800ms después de dejar de escribir

      return () => clearTimeout(timer);
    }
  }, [newOrder.address, newOrder.deliveryType, searchDeliveryPrice]);

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
    const itemsTotal = newOrder.items.reduce((total, item) => {
      const product = platos.find(p => p.id.toString() === item.productId) ||
                     bebidas.find(b => b.id.toString() === item.productId);
      return total + (product ? product.pricing * item.quantity : 0);
    }, 0);

    // Add dynamic delivery price for delivery orders
    const deliveryFee = newOrder.deliveryType === 'delivery' ? newOrder.deliveryPrice : 0;
    return itemsTotal + deliveryFee;
  };

  // Función para manejar el cambio del checkbox de múltiples pagos
  const handleMultiplePaymentsChange = (checked: boolean) => {
    const total = calculateTotal();
    setNewOrder(prev => ({
      ...prev,
      hasMultiplePayments: checked,
      paymentAmount1: checked ? Math.ceil(total / 2) : total,
      paymentAmount2: checked ? Math.floor(total / 2) : 0
    }));
  };

  // Función para validar que los montos sumen el total
  const validatePaymentAmounts = () => {
    if (!newOrder.hasMultiplePayments) return true;
    const total = calculateTotal();
    const sum = newOrder.paymentAmount1 + newOrder.paymentAmount2;
    return Math.abs(sum - total) < 1; // Tolerancia de 1 peso
  };

  const handleCreateOrder = () => {
    // Prevenir clics duplicados mientras se está creando el pedido
    if (isCreatingOrder) {
      console.log('⚠️ Ya se está creando un pedido, ignorando clic duplicado');
      return;
    }

    if (newOrder.deliveryType === 'delivery' && !newOrder.address) return;
    if (newOrder.deliveryType === 'pickup' && !newOrder.pickupSede) return;
    if (newOrder.items.length === 0) return;

    const customerName = customer?.name || newCustomerName;
    if (!customerName) return;

    setIsCreatingOrder(true);

    // Validar múltiples pagos si están habilitados
    if (newOrder.hasMultiplePayments && !validatePaymentAmounts()) {
      alert('Los montos de pago no suman el total de la orden');
      setIsCreatingOrder(false);
      return;
    }

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
      deliveryInstructions: newOrder.deliveryType === 'delivery' ? newOrder.deliveryInstructions : undefined,
      items: orderItems,
      status: 'received',
      totalAmount: calculateTotal(),
      source: 'call_center',
      specialInstructions: newOrder.specialInstructions || undefined,
      paymentMethod: newOrder.paymentMethod,
      paymentStatus: 'pending',
      deliveryType: newOrder.deliveryType,
      pickupSede: newOrder.deliveryType === 'pickup' ? newOrder.pickupSede : undefined,
      // Información de múltiples pagos
      hasMultiplePayments: newOrder.hasMultiplePayments,
      paymentMethod2: newOrder.hasMultiplePayments ? newOrder.paymentMethod2 : undefined,
      paymentAmount1: newOrder.hasMultiplePayments ? newOrder.paymentAmount1 : calculateTotal(),
      paymentAmount2: newOrder.hasMultiplePayments ? newOrder.paymentAmount2 : undefined
    });

    // Reset form
    setNewOrder({
      address: '',
      deliveryInstructions: '',
      items: [],
      paymentMethod: 'cash',
      hasMultiplePayments: false,
      paymentMethod2: 'cash',
      paymentAmount1: 0,
      paymentAmount2: 0,
      specialInstructions: '',
      deliveryType: 'delivery',
      pickupSede: '',
      deliveryPrice: 0
    });
    setNewCustomerName('');
    setShowNewOrderDialog(false);

    // Liberar el botón después de crear el pedido
    setIsCreatingOrder(false);

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
                        onValueChange={(value: DeliveryType) => setNewOrder({ ...newOrder, deliveryType: value, address: '', pickupSede: '', deliveryPrice: 0 })}
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
                      <>
                        <div>
                          <Label htmlFor="address">Dirección de Entrega *</Label>
                          <Input
                            id="address"
                            value={newOrder.address}
                            onChange={(e) => setNewOrder({ ...newOrder, address: e.target.value })}
                            placeholder="Ingrese la dirección completa"
                          />
                        </div>

                        <div>
                          <Label htmlFor="deliveryInstructions">Indicaciones</Label>
                          <Input
                            id="deliveryInstructions"
                            value={newOrder.deliveryInstructions}
                            onChange={(e) => setNewOrder({ ...newOrder, deliveryInstructions: e.target.value })}
                            placeholder="Ej: Torre 3 Apto 401"
                          />
                        </div>

                        <div>
                          <Label htmlFor="deliveryPrice" className="flex items-center gap-2">
                            Precio de Envío
                            {loadingDeliveryPrice && (
                              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            )}
                          </Label>
                          <div className="relative">
                            <Input
                              id="deliveryPrice"
                              type="number"
                              value={newOrder.deliveryPrice}
                              onChange={(e) => setNewOrder({ ...newOrder, deliveryPrice: Number(e.target.value) || 0 })}
                              placeholder="0"
                              className="pl-8"
                            />
                            <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                          </div>
                          {newOrder.deliveryPrice > 0 && (
                            <p className="text-xs text-green-600 mt-1">
                              💡 Precio sugerido basado en entregas anteriores a esta dirección
                            </p>
                          )}
                        </div>
                      </>
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

                    {/* Checkbox para múltiples métodos de pago */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="multiplePayments"
                        checked={newOrder.hasMultiplePayments}
                        onCheckedChange={handleMultiplePaymentsChange}
                      />
                      <Label
                        htmlFor="multiplePayments"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        El cliente paga con más de un método
                      </Label>
                    </div>

                    {/* Controles para múltiples pagos */}
                    {newOrder.hasMultiplePayments && (
                      <div className="space-y-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
                        <div className="text-sm font-medium text-blue-800">
                          💳 Configuración de Múltiples Pagos
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {/* Primer pago */}
                          <div>
                            <Label className="text-sm font-medium">Segundo Método de Pago</Label>
                            <Select
                              value={newOrder.paymentMethod2}
                              onValueChange={(value: PaymentMethod) => setNewOrder({ ...newOrder, paymentMethod2: value })}
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

                          {/* Montos */}
                          <div>
                            <Label className="text-sm font-medium">Montos (Total: ${calculateTotal().toLocaleString()})</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Pago 1 ({newOrder.paymentMethod})</Label>
                                <Input
                                  type="number"
                                  value={newOrder.paymentAmount1}
                                  onChange={(e) => setNewOrder({ ...newOrder, paymentAmount1: Number(e.target.value) })}
                                  className="text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Pago 2 ({newOrder.paymentMethod2})</Label>
                                <Input
                                  type="number"
                                  value={newOrder.paymentAmount2}
                                  onChange={(e) => setNewOrder({ ...newOrder, paymentAmount2: Number(e.target.value) })}
                                  className="text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Validación visual */}
                        {!validatePaymentAmounts() && (
                          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                            ⚠️ Los montos no suman el total de la orden (${calculateTotal().toLocaleString()})
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <Label>Productos Disponibles</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded p-2">
                        {menuLoading ? (
                          <p className="text-center text-gray-500">Cargando productos...</p>
                        ) : (
                          <>
                            {platos.filter(item => !('available' in item) || (item as any).available !== false).map((item) => (
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
                            {bebidas.filter(item => !('available' in item) || (item as any).available !== false).map((item) => (
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
                        isCreatingOrder ||
                        !settings.acceptingOrders ||
                        (newOrder.deliveryType === 'delivery' && !newOrder.address) ||
                        (newOrder.deliveryType === 'pickup' && !newOrder.pickupSede) ||
                        newOrder.items.length === 0 ||
                        (!customer && !newCustomerName)
                      }
                      className="w-full bg-brand-primary hover:bg-brand-primary/90"
                    >
                      {isCreatingOrder ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        'Crear Pedido'
                      )}
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
