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
import { toast } from '@/hooks/use-toast';
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
  RefreshCw,
  Building2,
  Navigation
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
  effectiveSedeId: string;
  currentSedeName: string;
  onCreateOrder: (order: Omit<Order, 'id' | 'createdAt' | 'estimatedDeliveryTime'>) => void;
  onTransferOrder: (orderId: string, targetSedeId: string) => void;
  onNavigateToDashboard?: () => void;
}

export const SedeOrders: React.FC<SedeOrdersProps> = ({ 
  orders: legacyOrders, 
  sedes, 
  currentUser, 
  settings,
  effectiveSedeId,
  currentSedeName,
  onCreateOrder, 
  onTransferOrder,
  onNavigateToDashboard
}) => {
  const { profile } = useAuth();
  const { platos, bebidas, loading: menuLoading } = useMenu();
  
  // Hook para manejar pedidos de sede con datos reales
  const {
    orders: realOrders,
    todayOrders,
    customer,
    loading,
    error,
    searchCustomer,
    loadSedeOrders,
    createOrder,
    transferOrder: transferRealOrder,
    clearCustomer
  } = useSedeOrders(effectiveSedeId);

  const [searchPhone, setSearchPhone] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showZeroDeliveryConfirm, setShowZeroDeliveryConfirm] = useState(false);
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
    pickupSede: '', // Se auto-asignará con la sede del agente
    // Tiempo de entrega en minutos (por defecto 90)
    deliveryTimeMinutes: 90,
    // Valor del domicilio
    deliveryCost: 0
  });


  // Usar SOLO pedidos reales - NUNCA legacy/dummy
  const orders = realOrders;

  // Función para abrir Google Maps con navegación
  const openGoogleMaps = (orderAddress: string) => {
    // Dirección de la sede (se puede obtener del perfil o configurar por defecto)
    const sedeAddress = profile?.sede_name || currentUser.sede || 'Restaurante Ajiaco, Bogotá, Colombia';
    
    // URL de Google Maps para navegación desde sede hasta dirección del pedido
    const googleMapsUrl = `https://www.google.com/maps/dir/${encodeURIComponent(sedeAddress)}/${encodeURIComponent(orderAddress)}`;
    
    // Abrir en nueva pestaña
    window.open(googleMapsUrl, '_blank');
  };

  // Cargar pedidos al montar el componente usando effectiveSedeId
  useEffect(() => {
    if (effectiveSedeId) {
      console.log('📅 SedeOrders: Cargando pedidos para sede efectiva:', effectiveSedeId);
      loadSedeOrders();
    }
  }, [effectiveSedeId, loadSedeOrders]);

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
    // Resetear completamente el formulario
    setNewOrder({
      address: '',
      items: [],
      paymentMethod: 'cash',
      specialInstructions: '',
      deliveryType: 'delivery',
      pickupSede: '', // Se auto-asignará
      deliveryTimeMinutes: 90,
      deliveryCost: 0
    });
    
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
    } else {
      setCustomerData({
        name: '',
        phone: '',
        address: ''
      });
    }
    
    setShowCreateDialog(true);
  };

  const addItemToOrder = (productId: string, productType: 'plato' | 'bebida') => {
    console.log('🔍 DEBUG: addItemToOrder llamado con productId:', productId, 'tipo:', productType);
    
    // Debug completo de los arrays
    console.log('🔍 DEBUG: Arrays completos:');
    console.log('📋 Platos:', platos.map(p => ({ id: p.id, name: p.name })));
    console.log('🥤 Bebidas:', bebidas.map(b => ({ id: b.id, name: b.name })));
    
    // Buscar el producto en platos y bebidas para debug
    const plato = platos.find(p => p.id.toString() === productId);
    const bebida = bebidas.find(b => b.id.toString() === productId);
    
    console.log('🔍 DEBUG: Producto encontrado:', {
      productId,
      productType,
      plato: plato ? { id: plato.id, name: plato.name, type: 'plato' } : null,
      bebida: bebida ? { id: bebida.id, name: bebida.name, type: 'bebida' } : null,
      totalPlatos: platos.length,
      totalBebidas: bebidas.length
    });
    
    // Crear un ID único que incluya el tipo
    const uniqueProductId = `${productType}_${productId}`;
    
    const existingItem = newOrder.items.find(item => item.productId === uniqueProductId);
    if (existingItem) {
      console.log('🔍 DEBUG: Incrementando cantidad de item existente:', existingItem);
      setNewOrder({
        ...newOrder,
        items: newOrder.items.map(item =>
          item.productId === uniqueProductId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      });
    } else {
      console.log('🔍 DEBUG: Agregando nuevo item:', { uniqueProductId, quantity: 1, productType });
      setNewOrder({
        ...newOrder,
        items: [...newOrder.items, { 
          productId: uniqueProductId, 
          quantity: 1, 
          toppings: [],
          productType: productType // Agregar tipo al item
        }]
      });
    }
    
    // Debug del estado después del cambio
    setTimeout(() => {
      console.log('🔍 DEBUG: Estado actual de items:', newOrder.items);
    }, 0);
  };

  const removeItemFromOrder = (productId: string) => {
    console.log('🔍 DEBUG: Removiendo item:', productId);
    setNewOrder({
      ...newOrder,
      items: newOrder.items.filter(item => item.productId !== productId)
    });
  };

  const calculateTotal = () => {
    const itemsTotal = newOrder.items.reduce((total, item) => {
      // Extraer el ID real y tipo del productId único
      const [productType, realProductId] = item.productId.split('_');
      
      let product = null;
      if (productType === 'plato') {
        product = platos.find(p => p.id.toString() === realProductId);
      } else if (productType === 'bebida') {
        product = bebidas.find(b => b.id.toString() === realProductId);
      }
      
      console.log('🔍 DEBUG: calculateTotal - item:', {
        itemId: item.productId,
        realProductId,
        productType,
        quantity: item.quantity,
        productFound: product ? { id: product.id, name: product.name, pricing: product.pricing } : null
      });
      
      return total + (product ? product.pricing * item.quantity : 0);
    }, 0);
    
    // Add delivery fee using custom value for delivery orders
    const deliveryFee = newOrder.deliveryType === 'delivery' ? newOrder.deliveryCost : 0;
    return itemsTotal + deliveryFee;
  };

  const handleCreateOrder = async () => {
    // Validaciones básicas
    if (newOrder.deliveryType === 'delivery' && !customerData.address) return;
    // Para pickup, ya no validamos pickupSede (se auto-asigna), ni datos de persona (usa cliente principal)
    if (newOrder.items.length === 0) return;
    if (!effectiveSedeId) return; // Validar que hay sede efectiva (seleccionada por admin o asignada al agente)
    if (!customerData.name || !customerData.phone) return;

    // Validar valor de domicilio si es delivery
    if (newOrder.deliveryType === 'delivery' && newOrder.deliveryCost === 0) {
      setShowZeroDeliveryConfirm(true);
      return;
    }

    await executeCreateOrder();
  };

  const executeCreateOrder = async () => {
    try {
      // Validar que todos los productos existan antes de crear el pedido
      console.log('🔍 Validando existencia de productos antes de crear pedido...');
      for (const item of newOrder.items) {
        const [productType, realProductId] = item.productId.split('_');
        
        if (productType === 'plato') {
          const product = platos.find(p => p.id.toString() === realProductId);
          if (!product) {
            throw new Error(`Plato con ID ${realProductId} no encontrado en el inventario`);
          }
        } else if (productType === 'bebida') {
          const bebida = bebidas.find(b => b.id.toString() === realProductId);
          if (!bebida) {
            throw new Error(`Bebida con ID ${realProductId} no encontrada en el inventario`);
          }
        } else {
          throw new Error(`Tipo de producto inválido: ${productType}`);
        }
      }
      console.log('✅ Todos los productos existen en el inventario');

      // Determinar los datos finales del cliente y la dirección
      const finalCustomerName = customerData.name;
      const finalCustomerPhone = customerData.phone;
      const finalAddress = newOrder.deliveryType === 'pickup' 
        ? `Recogida en ${currentSedeName} - Cliente: ${customerData.name} (${customerData.phone})`
        : customerData.address;

      // Preparar datos para el servicio con actualización de cliente
      const orderData: CreateOrderData = {
        cliente_nombre: finalCustomerName,
        cliente_telefono: finalCustomerPhone,
        direccion: finalAddress,
        tipo_entrega: newOrder.deliveryType,
        sede_recogida: newOrder.deliveryType === 'pickup' ? currentSedeName : undefined,
        pago_tipo: newOrder.paymentMethod === 'cash' ? 'efectivo' : 
                   newOrder.paymentMethod === 'card' ? 'tarjeta' :
                   newOrder.paymentMethod === 'nequi' ? 'nequi' : 'transferencia',
        instrucciones: newOrder.specialInstructions || undefined,
        delivery_time_minutes: newOrder.deliveryTimeMinutes,
        delivery_cost: newOrder.deliveryType === 'delivery' ? newOrder.deliveryCost : undefined,
        items: newOrder.items.map(item => {
          // Extraer el ID real y tipo del productId único (formato: "tipo_id")
          const [productType, realProductId] = item.productId.split('_');
          
          console.log('🔍 DEBUG: Procesando item para creación:', {
            originalProductId: item.productId,
            productType,
            realProductId,
            quantity: item.quantity
          });
          
          if (productType === 'plato') {
            const product = platos.find(p => p.id.toString() === realProductId);
            if (product) {
              return {
                producto_tipo: 'plato' as const,
                producto_id: product.id,
                cantidad: item.quantity
              };
            }
          } else if (productType === 'bebida') {
            const bebida = bebidas.find(b => b.id.toString() === realProductId);
            if (bebida) {
              return {
                producto_tipo: 'bebida' as const,
                producto_id: bebida.id,
                cantidad: item.quantity
              };
            }
          }
          
          throw new Error(`Producto no encontrado: ${item.productId} (tipo: ${productType}, ID: ${realProductId})`);
        }),
        sede_id: effectiveSedeId, // Usar sede seleccionada por admin o asignada al agente
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
        pickupSede: '', // Se auto-asignará
        deliveryTimeMinutes: 90,
        deliveryCost: 0
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
      console.error('❌ Error creando pedido:', error);
      
      // Mostrar mensaje de error específico al usuario
      let errorMessage = "Error desconocido al crear pedido";
      
      if (error instanceof Error) {
        // Mensajes de error más amigables
        if (error.message.includes('no encontrado en el inventario')) {
          errorMessage = "Uno de los productos seleccionados ya no está disponible. Por favor, actualiza el inventario y vuelve a intentar.";
        } else if (error.message.includes('Tipo de producto inválido')) {
          errorMessage = "Error interno: tipo de producto inválido. Contacta al administrador.";
        } else if (error.message.includes('Producto no encontrado')) {
          errorMessage = "Uno de los productos no se encuentra disponible. Por favor refresca la página e inténtalo de nuevo.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error al crear pedido",
        description: errorMessage,
        variant: "destructive"
      });
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
                  pickupSede: '', // Se auto-asignará
                  deliveryTimeMinutes: 90,
                  deliveryCost: 0
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
                      onValueChange={(value: DeliveryType) => setNewOrder({ 
                        ...newOrder, 
                        deliveryType: value, 
                        address: '', 
                        pickupSede: '',
                        deliveryCost: value === 'delivery' ? newOrder.deliveryCost : 0
                      })}
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
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="address">Dirección de Entrega *</Label>
                        <div className="flex gap-2">
                          <Input
                            id="address"
                            value={customerData.address}
                            onChange={(e) => setCustomerData(prev => ({ ...prev, address: e.target.value }))}
                            placeholder="Ingrese la dirección completa"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (customerData.address.trim()) {
                                openGoogleMaps(customerData.address);
                              } else {
                                toast({
                                  title: "Dirección requerida",
                                  description: "Por favor ingrese una dirección antes de abrir el mapa",
                                  variant: "destructive"
                                });
                              }
                            }}
                            disabled={!customerData.address.trim()}
                            className="px-3"
                            title="Ver ubicación en Google Maps"
                          >
                            <Navigation className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="deliveryCost">Valor del Domicilio *</Label>
                        <Input
                          id="deliveryCost"
                          type="text"
                          value={newOrder.deliveryCost === 0 ? '' : newOrder.deliveryCost.toString()}
                          onChange={(e) => {
                            console.log('🔍 DEBUG: deliveryCost onChange:', e.target.value);
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            const numericValue = value === '' ? 0 : parseInt(value, 10);
                            console.log('🔍 DEBUG: deliveryCost set to:', numericValue);
                            setNewOrder({ ...newOrder, deliveryCost: numericValue });
                          }}
                          onFocus={() => console.log('🔍 DEBUG: deliveryCost focused')}
                          onBlur={() => console.log('🔍 DEBUG: deliveryCost blurred')}
                          placeholder="Ingrese el valor del domicilio (ej: 6000)"
                          disabled={false}
                          readOnly={false}
                        />
                        <p className="text-xs text-gray-600 mt-1">
                          Si es 0, se mostrará una confirmación antes de crear el pedido
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 border rounded-lg bg-green-50">
                        <div className="flex items-center gap-2 mb-2">
                          <Store className="h-4 w-4 text-green-600" />
                          <h5 className="font-medium text-green-900">Recogida en Sede</h5>
                        </div>
                        <p className="text-green-800 text-sm">
                          El pedido se recogerá en: <span className="font-medium">{currentSedeName}</span>
                        </p>
                        <p className="text-green-700 text-xs mt-1">
                          La persona que recoge será: <span className="font-medium">{customerData.name || 'Cliente'}</span>
                          {customerData.phone && ` - ${customerData.phone}`}
                        </p>
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
                                onClick={() => {
                                  console.log('🔍 DEBUG: Clic en plato:', { id: item.id, name: item.name });
                                  addItemToOrder(item.id.toString(), 'plato');
                                }}
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
                                onClick={() => {
                                  console.log('🔍 DEBUG: Clic en bebida:', { id: item.id, name: item.name });
                                  addItemToOrder(item.id.toString(), 'bebida');
                                }}
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
                          // Extraer el ID real y tipo del productId único
                          const [productType, realProductId] = item.productId.split('_');
                          
                          let product = null;
                          if (productType === 'plato') {
                            product = platos.find(p => p.id.toString() === realProductId);
                          } else if (productType === 'bebida') {
                            product = bebidas.find(b => b.id.toString() === realProductId);
                          }
                          
                          console.log('🔍 DEBUG: Mostrando item seleccionado:', {
                            itemId: item.productId,
                            realProductId,
                            productType,
                            productFound: product ? { id: product.id, name: product.name } : null
                          });
                          
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
                          {newOrder.deliveryType === 'delivery' && newOrder.deliveryCost > 0 && (
                            <div className="text-sm text-gray-600 mb-1">
                              Subtotal productos: ${(calculateTotal() - newOrder.deliveryCost).toLocaleString()}
                              <br />
                              Domicilio: ${newOrder.deliveryCost.toLocaleString()}
                            </div>
                          )}
                          <p className="font-bold text-lg">Total: ${calculateTotal().toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="deliveryTime">Tiempo de Entrega</Label>
                    <Select 
                      value={newOrder.deliveryTimeMinutes.toString()} 
                      onValueChange={(value) => setNewOrder({ ...newOrder, deliveryTimeMinutes: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tiempo de entrega" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="60">🚀 Rápido - 60 minutos</SelectItem>
                        <SelectItem value="75">⏰ Estándar - 75 minutos</SelectItem>
                        <SelectItem value="90">🕒 Normal - 90 minutos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

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
                      // Para pickup ya no se validan campos adicionales
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

            {/* Mini contador de pedidos por fase */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900">Estado de Pedidos (Hoy)</span>
              </div>
              
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Recibidos */}
                <div className="bg-white rounded-md p-3 shadow-sm border border-blue-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-xs font-medium text-blue-700">Recibidos</span>
                  </div>
                  <div className="text-lg font-bold text-blue-900 mt-1">
                    {todayOrders.filter(order => order.estado === 'Recibidos').length}
                  </div>
                </div>

                {/* En Cocina */}
                <div className="bg-white rounded-md p-3 shadow-sm border border-yellow-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-xs font-medium text-yellow-700">En Cocina</span>
                  </div>
                  <div className="text-lg font-bold text-yellow-900 mt-1">
                    {todayOrders.filter(order => order.estado === 'Cocina').length}
                  </div>
                </div>

                {/* En Domicilio */}
                <div className="bg-white rounded-md p-3 shadow-sm border border-purple-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-xs font-medium text-purple-700">Camino</span>
                  </div>
                  <div className="text-lg font-bold text-purple-900 mt-1">
                    {todayOrders.filter(order => order.estado === 'Camino').length}
                  </div>
                </div>

                {/* Listo para Pickup */}
                <div className="bg-white rounded-md p-3 shadow-sm border border-orange-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-xs font-medium text-orange-700">Pickup</span>
                  </div>
                  <div className="text-lg font-bold text-orange-900 mt-1">
                    {todayOrders.filter(order => order.estado === 'Listos para Recogida').length}
                  </div>
                </div>
              </div>

              {/* Total activos */}
              <div className="mt-3 pt-3 border-t border-blue-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Total pedidos activos:</span>
                  <span className="font-bold text-blue-900">
                    {todayOrders.filter(order => 
                      order.estado !== 'Entregados' && 
                      order.estado !== 'delivered' &&
                      order.estado !== 'Cancelado' && 
                      order.estado !== 'cancelled'
                    ).length}
                  </span>
                </div>
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
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Cargando pedidos...
                    </div>
                  </TableCell>
                </TableRow>
              ) : sedeOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                      <TableCell>
                        <div className="flex gap-2">
                          {/* Botón de Google Maps solo para domicilios */}
                          {order.direccion && !order.direccion.includes('Recogida en') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openGoogleMaps(order.direccion)}
                              className="h-8 w-8 p-0"
                              title="Abrir en Google Maps"
                            >
                              <Navigation className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de confirmación para domicilio con valor 0 */}
      <Dialog open={showZeroDeliveryConfirm} onOpenChange={setShowZeroDeliveryConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Domicilio Sin Costo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-700">
              Has ingresado <strong>$0</strong> como valor de domicilio para este pedido.
            </p>
            <p className="text-sm text-gray-600">
              ¿Estás seguro de que deseas crear el pedido sin costo de domicilio?
            </p>
            <div className="flex gap-3 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowZeroDeliveryConfirm(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={async () => {
                  setShowZeroDeliveryConfirm(false);
                  await executeCreateOrder();
                }}
                className="bg-amber-600 hover:bg-amber-700"
              >
                Sí, Crear Pedido
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
