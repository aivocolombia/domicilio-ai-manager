import React, { useState, useEffect } from 'react';
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
  ShoppingCart,
  RefreshCw
} from 'lucide-react';
import { Order, Sede, User as UserType, PaymentMethod, DeliveryType, DeliverySettings } from '@/types/delivery';
import { useMenu } from '@/hooks/useMenu';
import { useSedeOrders } from '@/hooks/useSedeOrders';
import { useAuth } from '@/hooks/useAuth';
import { CreateOrderData } from '@/services/sedeOrdersService';

interface SedeOrdersProps {
  orders: Order[];
  sedes: Sede[];
  currentUser: UserType;
  settings: DeliverySettings;
  onCreateOrder: (order: Omit<Order, 'id' | 'createdAt' | 'estimatedDeliveryTime'>) => void;
  onTransferOrder: (orderId: string, targetSedeId: string) => void;
}

export const SedeOrders: React.FC<SedeOrdersProps> = ({ 
  orders: legacyOrders, 
  sedes, 
  currentUser, 
  settings,
  onCreateOrder, 
  onTransferOrder 
}) => {
  const { profile } = useAuth();
  const { platos, bebidas, loading: menuLoading } = useMenu();
  
  // Hook para manejar pedidos de sede con datos reales
  const {
    orders: realOrders,
    customer,
    loading,
    error,
    searchCustomer,
    loadSedeOrders,
    createOrder,
    transferOrder: transferRealOrder,
    clearCustomer
  } = useSedeOrders(profile?.sede_id);

  const [searchPhone, setSearchPhone] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    address: ''
  });
  const [newOrder, setNewOrder] = useState({
    address: '',
    items: [] as { productId: string; quantity: number; toppings: string[] }[],
    paymentMethod: 'cash' as PaymentMethod,
    specialInstructions: '',
    deliveryType: 'delivery' as DeliveryType,
    pickupSede: '',
    // Campos adicionales para recogida en tienda
    pickupCustomerName: '',
    pickupCustomerPhone: ''
  });
  const [transferOrderId, setTransferOrderId] = useState('');
  const [transferSedeId, setTransferSedeId] = useState('');

  // Usar SOLO pedidos reales - NUNCA legacy/dummy
  const orders = realOrders;

  // Cargar pedidos al montar el componente
  useEffect(() => {
    if (profile?.sede_id) {
      loadSedeOrders();
    }
  }, [profile?.sede_id, loadSedeOrders]);

  const normalizePhone = (phone: string) => {
    return phone.replace(/[\s\-()]/g, '');
  };

  const handleSearchCustomer = async () => {
    if (!searchPhone.trim()) return;
    const foundCustomer = await searchCustomer(searchPhone.trim());
    
    // Si se encuentra un cliente, precargar sus datos
    if (foundCustomer) {
      setCustomerData({
        name: foundCustomer.nombre,
        phone: foundCustomer.telefono,
        address: foundCustomer.direccion_reciente || ''
      });
    } else {
      // Si no se encuentra, mantener el teléfono buscado
      setCustomerData({
        name: '',
        phone: searchPhone.trim(),
        address: ''
      });
    }
  };

  // Función para abrir el modal de crear pedido con datos precargados
  const handleOpenCreateDialog = () => {
    // Precargar datos del cliente si están disponibles
    if (customer) {
      setCustomerData({
        name: customer.nombre,
        phone: customer.telefono,
        address: customer.direccion_reciente || ''
      });
    } else if (searchPhone.trim()) {
      setCustomerData({
        name: '',
        phone: searchPhone.trim(),
        address: ''
      });
    }
    
    setShowCreateDialog(true);
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

  const handleCreateOrder = async () => {
    // Validaciones básicas
    if (newOrder.deliveryType === 'delivery' && !customerData.address) return;
    if (newOrder.deliveryType === 'pickup' && (!newOrder.pickupSede || !newOrder.pickupCustomerName || !newOrder.pickupCustomerPhone)) return;
    if (newOrder.items.length === 0) return;
    if (!profile?.sede_id) return;
    if (!customerData.name || !customerData.phone) return;

    try {
      // Determinar los datos finales del cliente y la dirección
      const finalCustomerName = customerData.name;
      const finalCustomerPhone = customerData.phone;
      const finalAddress = newOrder.deliveryType === 'pickup' 
        ? `Recogida en ${newOrder.pickupSede} - Cliente: ${newOrder.pickupCustomerName} (${newOrder.pickupCustomerPhone})`
        : customerData.address;

      // Preparar datos para el servicio con actualización de cliente
      const orderData: CreateOrderData = {
        cliente_nombre: finalCustomerName,
        cliente_telefono: finalCustomerPhone,
        direccion: finalAddress,
        tipo_entrega: newOrder.deliveryType,
        sede_recogida: newOrder.deliveryType === 'pickup' ? newOrder.pickupSede : undefined,
        pago_tipo: newOrder.paymentMethod === 'cash' ? 'efectivo' : 
                   newOrder.paymentMethod === 'card' ? 'tarjeta' :
                   newOrder.paymentMethod === 'nequi' ? 'nequi' : 'transferencia',
        instrucciones: newOrder.specialInstructions || undefined,
        items: newOrder.items.map(item => {
          const product = platos.find(p => p.id.toString() === item.productId);
          if (product) {
            return {
              producto_tipo: 'plato' as const,
              producto_id: product.id,
              cantidad: item.quantity
            };
          }
          
          const bebida = bebidas.find(b => b.id.toString() === item.productId);
          if (bebida) {
            return {
              producto_tipo: 'bebida' as const,
              producto_id: bebida.id,
              cantidad: item.quantity
            };
          }
          
          throw new Error(`Producto no encontrado: ${item.productId}`);
        }),
        sede_id: profile.sede_id,
        // Datos para actualización de cliente
        update_customer_data: {
          nombre: finalCustomerName,
          telefono: finalCustomerPhone,
          direccion: newOrder.deliveryType === 'delivery' ? customerData.address : undefined
        }
      };

      // Crear pedido usando el servicio real
      await createOrder(orderData);

      // Reset form
      setNewOrder({
        address: '',
        items: [],
        paymentMethod: 'cash',
        specialInstructions: '',
        deliveryType: 'delivery',
        pickupSede: '',
        pickupCustomerName: '',
        pickupCustomerPhone: ''
      });
      setCustomerData({
        name: '',
        phone: '',
        address: ''
      });
      setShowCreateDialog(false);
      
      // Refresh customer data si existe
      if (customer) {
        setTimeout(() => searchCustomer(customer.telefono), 500);
      }

    } catch (error) {
      console.error('Error creando pedido:', error);
      // El error ya se maneja en el hook useSedeOrders
    }
  };

  const handleTransferOrder = async () => {
    if (!transferOrderId || !transferSedeId) return;
    
    try {
      // Intentar usar el servicio real primero
      const orderId = parseInt(transferOrderId);
      if (!isNaN(orderId)) {
        await transferRealOrder(orderId, transferSedeId);
      } else {
        // Fallback a la función legacy
        onTransferOrder(transferOrderId, transferSedeId);
      }
      
      setTransferOrderId('');
      setTransferSedeId('');
    } catch (error) {
      console.error('Error transfiriendo pedido:', error);
      // El error ya se maneja en el hook useSedeOrders
    }
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

  // Filtrar pedidos: usar datos reales si están disponibles
  const sedeOrders = realOrders.length > 0 
    ? realOrders 
    : orders.filter((order: any) => order.assignedSede === currentUser.sede);

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
                onKeyPress={(e) => e.key === 'Enter' && handleSearchCustomer()}
                disabled={loading}
              />
              <Button onClick={handleSearchCustomer} variant="outline" disabled={loading}>
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {customer ? (
              <div className="space-y-2">
                <p>
                  <span className="font-semibold">Nombre:</span> {customer.nombre}
                </p>
                <p>
                  <span className="font-semibold">Teléfono:</span> {customer.telefono}
                </p>
                <p>
                  <span className="font-semibold">Pedidos anteriores:</span> {customer.historial_pedidos.length}
                </p>
                {customer.direccion_reciente && (
                  <p>
                    <span className="font-semibold">Última dirección:</span> {customer.direccion_reciente}
                  </p>
                )}
                <Button variant="link" onClick={clearCustomer}>
                  Limpiar Cliente
                </Button>
              </div>
            ) : searchPhone && !loading ? (
              <p className="text-muted-foreground">
                No se encontró ningún cliente con este número de teléfono.
              </p>
            ) : null}
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
            <Dialog open={showCreateDialog} onOpenChange={(open) => {
              setShowCreateDialog(open);
              if (!open) {
                // Limpiar form cuando se cierra el modal
                setNewOrder({
                  address: '',
                  items: [],
                  paymentMethod: 'cash',
                  specialInstructions: '',
                  deliveryType: 'delivery',
                  pickupSede: '',
                  pickupCustomerName: '',
                  pickupCustomerPhone: ''
                });
                setCustomerData({
                  name: '',
                  phone: '',
                  address: ''
                });
              }
            }}>
              <DialogTrigger asChild>
                <Button 
                  className="w-full bg-brand-primary hover:bg-brand-primary/90"
                  disabled={!settings.acceptingOrders || loading}
                  onClick={handleOpenCreateDialog}
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
                  {/* Datos del Cliente - Siempre visibles y editables */}
                  <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-medium text-gray-900">Datos del Cliente</h4>
                    
                    <div>
                      <Label htmlFor="customerName">Nombre del Cliente *</Label>
                      <Input
                        id="customerName"
                        value={customerData.name}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Ingrese el nombre del cliente"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="customerPhone">Teléfono *</Label>
                      <Input
                        id="customerPhone"
                        type="tel"
                        value={customerData.phone}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="Ingrese el teléfono del cliente"
                      />
                    </div>
                    
                    {customer && (
                      <div className="text-sm text-green-600 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Cliente encontrado - Datos precargados (puedes editarlos)
                      </div>
                    )}
                  </div>
                  
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
                      <Label htmlFor="address">Dirección de Entrega *</Label>
                      <Input
                        id="address"
                        value={customerData.address}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Ingrese la dirección completa"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label>Sede de Recogida *</Label>
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
                      
                      {/* Datos adicionales para recogida en tienda */}
                      <div className="p-3 border rounded-lg bg-blue-50">
                        <h5 className="font-medium text-blue-900 mb-2">Datos de la Persona que Recoge</h5>
                        <div className="space-y-2">
                          <div>
                            <Label htmlFor="pickupName">Nombre *</Label>
                            <Input
                              id="pickupName"
                              value={newOrder.pickupCustomerName}
                              onChange={(e) => setNewOrder({ ...newOrder, pickupCustomerName: e.target.value })}
                              placeholder="Nombre de quien recoge el pedido"
                            />
                          </div>
                          <div>
                            <Label htmlFor="pickupPhone">Teléfono *</Label>
                            <Input
                              id="pickupPhone"
                              type="tel"
                              value={newOrder.pickupCustomerPhone}
                              onChange={(e) => setNewOrder({ ...newOrder, pickupCustomerPhone: e.target.value })}
                              placeholder="Teléfono de quien recoge el pedido"
                            />
                          </div>
                        </div>
                      </div>
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
                      !settings.acceptingOrders ||
                      !customerData.name ||
                      !customerData.phone ||
                      (newOrder.deliveryType === 'delivery' && !customerData.address) ||
                      (newOrder.deliveryType === 'pickup' && (!newOrder.pickupSede || !newOrder.pickupCustomerName || !newOrder.pickupCustomerPhone)) ||
                      newOrder.items.length === 0 ||
                      loading
                    }
                    className="w-full bg-brand-primary hover:bg-brand-primary/90"
                  >
                    {loading ? 'Creando...' : 'Crear Pedido'}
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
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Pedidos de la Sede - {profile?.sede_name || currentUser.sede}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => loadSedeOrders()}
              disabled={loading}
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Recargar
            </Button>
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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Cargando pedidos...
                    </div>
                  </TableCell>
                </TableRow>
              ) : sedeOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay pedidos para mostrar
                  </TableCell>
                </TableRow>
              ) : (
                sedeOrders.map((order) => {
                  // Solo datos reales - simplificado
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          {new Date(order.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          {order.cliente_nombre}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="truncate max-w-xs">
                            {order.direccion}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        ${order.total.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(order.estado)}>
                          {order.estado}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPaymentStatusColor(order.pago_estado)}>
                          {order.pago_estado}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
