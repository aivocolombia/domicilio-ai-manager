import React, { useState, useEffect, useCallback } from 'react';
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
import { addressService } from '@/services/addressService';
import { sedeServiceSimple } from '@/services/sedeServiceSimple';
import { supabase } from '@/lib/supabase';

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
  const { platos, bebidas, toppings, loading: menuLoading, loadToppings } = useMenu();
  
  // Estado para productos específicos de sede con disponibilidad
  const [sedeProducts, setSedeProducts] = useState({
    platos: [] as any[],
    bebidas: [] as any[],
    toppings: [] as any[]
  });
  const [loadingSedeProducts, setLoadingSedeProducts] = useState(false);
  
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
    transferOrder: transferRealOrder
  } = useSedeOrders(effectiveSedeId);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showZeroDeliveryConfirm, setShowZeroDeliveryConfirm] = useState(false);
  const [foundCustomer, setFoundCustomer] = useState<any>(null);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    address: ''
  });
  // Función para cargar productos específicos de sede
  const loadSedeProducts = useCallback(async () => {
    if (!effectiveSedeId) return;
    
    setLoadingSedeProducts(true);
    try {
      console.log('🏢 Cargando productos para sede:', effectiveSedeId);
      
      const { platos, bebidas, toppings } = await sedeServiceSimple.getSedeCompleteInfo(effectiveSedeId, true);
      
      // Filtrar solo productos disponibles en la sede
      const availablePlatos = platos.filter(p => p.is_available);
      const availableBebidas = bebidas.filter(b => b.is_available);
      const availableToppings = toppings.filter(t => t.is_available);
      
      setSedeProducts({
        platos: availablePlatos,
        bebidas: availableBebidas,
        toppings: availableToppings
      });
      
      console.log('✅ Productos de sede cargados:', {
        platos: availablePlatos.length,
        bebidas: availableBebidas.length,
        toppings: availableToppings.length
      });
    } catch (error) {
      console.error('❌ Error cargando productos de sede:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos disponibles para esta sede.",
        variant: "destructive"
      });
    } finally {
      setLoadingSedeProducts(false);
    }
  }, [effectiveSedeId]);

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
  const [searchingPrice, setSearchingPrice] = useState(false);
  const [priceSearchTimeout, setPriceSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [customerSearchTimeout, setCustomerSearchTimeout] = useState<NodeJS.Timeout | null>(null);


  // Usar SOLO pedidos reales - NUNCA legacy/dummy
  const orders = realOrders;

  // Función para abrir Google Maps con navegación
  const openGoogleMaps = (orderAddress: string) => {
    // Debug: mostrar todas las sedes disponibles
    console.log('🏢 Todas las sedes disponibles:', sedes);
    console.log('📍 Buscando sede con ID:', effectiveSedeId);
    
    // Obtener la dirección real de la sede actual
    const currentSede = sedes.find(sede => sede.id === effectiveSedeId);
    console.log('🎯 Sede encontrada:', currentSede);
    
    // Verificar si tenemos la dirección
    let sedeAddress;
    if (currentSede && currentSede.address && currentSede.address.trim()) {
      sedeAddress = currentSede.address;
      console.log('✅ Usando dirección de BD:', sedeAddress);
    } else {
      sedeAddress = `${currentSedeName}, Bogotá, Colombia`;
      console.log('⚠️ Usando fallback porque no hay dirección en BD:', sedeAddress);
      console.log('❓ Motivo: currentSede =', currentSede, 'address =', currentSede?.address);
    }
    
    console.log('🗺️ Generando ruta desde sede:', {
      sedeId: effectiveSedeId,
      sedeName: currentSedeName,
      sedeAddressUsed: sedeAddress,
      orderAddress: orderAddress,
      sedeData: currentSede
    });
    
    // URL de Google Maps para navegación desde sede hasta dirección del pedido
    const googleMapsUrl = `https://www.google.com/maps/dir/${encodeURIComponent(sedeAddress)}/${encodeURIComponent(orderAddress)}`;
    
    // Abrir en nueva pestaña
    window.open(googleMapsUrl, '_blank');
  };

  // Función para normalizar número de teléfono (remover espacios, guiones, etc.)
  const normalizePhone = (phone: string): string => {
    return phone.replace(/[\s\-\(\)\+]/g, '').trim();
  };

  // Función para buscar cliente por teléfono
  const searchCustomerByPhone = useCallback(async (phone: string) => {
    if (!phone.trim() || phone.length < 7) {
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    
    try {
      console.log('📞 Buscando cliente por teléfono:', normalizedPhone);
      
      const { data: clienteData, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('telefono', normalizedPhone)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // No encontrado es normal, otros errores no
          console.error('❌ Error buscando cliente:', error);
        }
        return null;
      }

      if (clienteData) {
        console.log('✅ Cliente encontrado:', clienteData);
        return {
          nombre: clienteData.nombre,
          telefono: clienteData.telefono,
          direccion_reciente: clienteData.direccion || ''
        };
      }
    } catch (error) {
      console.error('❌ Error inesperado buscando cliente:', error);
    }
    
    return null;
  }, []);

  // Función para buscar precio de envío basado en dirección
  const searchDeliveryPrice = useCallback(async (address: string) => {
    if (!address.trim() || address.length < 5 || !effectiveSedeId) {
      // Si no hay dirección válida, resetear precio
      setNewOrder(prev => ({ ...prev, deliveryCost: 0 }));
      console.log('🔄 SedeOrders: Precio reseteado a 0 (dirección inválida)');
      return;
    }

    try {
      setSearchingPrice(true);
      console.log('🔍 SedeOrders: Buscando precio para dirección:', address);
      
      // IMPORTANTE: Resetear precio antes de buscar
      setNewOrder(prev => ({ ...prev, deliveryCost: 0 }));
      console.log('🔄 SedeOrders: Precio reseteado a 0 antes de buscar');
      
      const lastPrice = await addressService.getLastDeliveryPriceForAddress(address, effectiveSedeId);
      
      if (lastPrice && lastPrice > 0) {
        console.log('✅ SedeOrders: Precio encontrado:', lastPrice);
        setNewOrder(prev => ({ ...prev, deliveryCost: lastPrice }));
        toast({
          title: "Precio encontrado",
          description: `Se estableció $${lastPrice.toLocaleString()} basado en entregas anteriores`,
        });
      } else {
        console.log('❌ SedeOrders: No se encontró precio, mantiene en 0');
        // El precio ya está en 0, así que no hay que hacer nada más
        toast({
          title: "Precio no encontrado",
          description: "Ingrese manualmente el costo del domicilio",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ SedeOrders: Error buscando precio:', error);
      // En caso de error, también resetear precio
      setNewOrder(prev => ({ ...prev, deliveryCost: 0 }));
      console.log('🔄 SedeOrders: Precio reseteado a 0 por error');
    } finally {
      setSearchingPrice(false);
    }
  }, [effectiveSedeId, toast]);

  // Efecto para buscar precio cuando cambia la dirección (con debounce)
  useEffect(() => {
    if (newOrder.deliveryType === 'delivery') {
      // Limpiar timeout anterior
      if (priceSearchTimeout) {
        clearTimeout(priceSearchTimeout);
      }

      // Si hay dirección, buscar precio. Si no hay, resetear
      if (customerData.address && customerData.address.trim()) {
        // Configurar timeout para buscar precio
        const timeout = setTimeout(() => {
          searchDeliveryPrice(customerData.address);
        }, 800); // Buscar después de 800ms de inactividad

        setPriceSearchTimeout(timeout);

        return () => {
          if (timeout) {
            clearTimeout(timeout);
          }
        };
      } else {
        // Si no hay dirección o está vacía, resetear inmediatamente
        setNewOrder(prev => ({ ...prev, deliveryCost: 0 }));
        console.log('🔄 SedeOrders: Precio reseteado a 0 (dirección vacía)');
      }
    }
  }, [customerData.address, newOrder.deliveryType, searchDeliveryPrice]);

  // Efecto para buscar cliente cuando cambia el teléfono (con debounce)
  useEffect(() => {
    if (customerData.phone && customerData.phone.length >= 7) {
      // Limpiar timeout anterior
      if (customerSearchTimeout) {
        clearTimeout(customerSearchTimeout);
      }

      // Configurar nuevo timeout
      const timeout = setTimeout(async () => {
        setSearchingCustomer(true);
        const foundClient = await searchCustomerByPhone(customerData.phone);
        
        if (foundClient) {
          setFoundCustomer(foundClient);
          
          // Solo llenar campos vacíos (lógica inteligente)
          setCustomerData(prev => ({
            name: prev.name.trim() ? prev.name : foundClient.nombre,
            phone: prev.phone, // Mantener el teléfono actual
            address: prev.address.trim() ? prev.address : foundClient.direccion_reciente
          }));
          
          console.log('🎯 Cliente encontrado y datos actualizados inteligentemente');
        } else {
          setFoundCustomer(null);
        }
        setSearchingCustomer(false);
      }, 600); // Buscar después de 600ms de inactividad

      setCustomerSearchTimeout(timeout);

      return () => {
        if (timeout) {
          clearTimeout(timeout);
        }
      };
    } else {
      // Si el teléfono es muy corto, limpiar cliente encontrado
      setFoundCustomer(null);
    }
  }, [customerData.phone, searchCustomerByPhone]);

  // Cargar pedidos al montar el componente usando effectiveSedeId
  useEffect(() => {
    if (effectiveSedeId) {
      console.log('📅 SedeOrders: Cargando pedidos para sede efectiva:', effectiveSedeId);
      loadSedeOrders();
    }
  }, [effectiveSedeId, loadSedeOrders]);

  // Cargar toppings al montar el componente
  useEffect(() => {
    console.log('🔍 SedeOrders: Cargando toppings...');
    loadToppings();
  }, [loadToppings]);

  // Cargar productos específicos de sede
  useEffect(() => {
    loadSedeProducts();
  }, [loadSedeProducts]);

  // Debug toppings
  useEffect(() => {
    console.log('🔍 SedeOrders: Estado de toppings:', { 
      toppingsCount: toppings.length, 
      toppings: toppings.map(t => ({ id: t.id, name: t.name, pricing: t.pricing })),
      menuLoading 
    });
  }, [toppings, menuLoading]);


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

  // Función para agregar toppings directamente a la orden
  const addToppingToOrder = (toppingId: string) => {
    console.log('🔍 DEBUG: addToppingToOrder llamado con toppingId:', toppingId);
    
    // Crear un ID único para el topping
    const uniqueToppingId = `topping_${toppingId}`;
    
    const existingItem = newOrder.items.find(item => item.productId === uniqueToppingId);
    if (existingItem) {
      console.log('🔍 DEBUG: Incrementando cantidad de topping existente:', existingItem);
      setNewOrder({
        ...newOrder,
        items: newOrder.items.map(item =>
          item.productId === uniqueToppingId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      });
    } else {
      console.log('🔍 DEBUG: Agregando nuevo topping:', { uniqueToppingId, quantity: 1 });
      setNewOrder({
        ...newOrder,
        items: [...newOrder.items, { 
          productId: uniqueToppingId, 
          quantity: 1, 
          toppings: [],
          productType: 'topping'
        }]
      });
    }
  };

  const calculateTotal = () => {
    const itemsTotal = newOrder.items.reduce((total, item) => {
      // Extraer el ID real y tipo del productId único
      const [productType, realProductId] = item.productId.split('_');
      
      let product = null;
      // Buscar en productos específicos de sede primero, luego en menú general
      if (productType === 'plato') {
        product = sedeProducts.platos.find(p => p.id.toString() === realProductId) ||
                 platos.find(p => p.id.toString() === realProductId);
      } else if (productType === 'bebida') {
        product = sedeProducts.bebidas.find(b => b.id.toString() === realProductId) ||
                 bebidas.find(b => b.id.toString() === realProductId);
      } else if (productType === 'topping') {
        product = sedeProducts.toppings.find(t => t.id.toString() === realProductId) ||
                 toppings.find(t => t.id.toString() === realProductId);
      }
      
      // Debug solo si no se encuentra el producto o el precio es 0
      if (!product || product.pricing === 0) {
        console.log('⚠️ DEBUG: Problema en calculateTotal:', {
          itemId: item.productId,
          productType,
          productFound: !!product,
          pricing: product?.pricing || 0
        });
      }
      
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
        } else if (productType === 'topping') {
          const topping = toppings.find(t => t.id.toString() === realProductId);
          if (!topping) {
            throw new Error(`Topping con ID ${realProductId} no encontrado en el inventario`);
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
          // DEBUG: Log del delivery_cost que se está enviando
          if (newOrder.deliveryType === 'delivery') {
            console.log('🚚 DEBUG - Enviando delivery_cost al servicio:', {
              deliveryType: newOrder.deliveryType,
              deliveryCost: newOrder.deliveryCost,
              deliveryCostType: typeof newOrder.deliveryCost,
              finalValue: newOrder.deliveryType === 'delivery' ? newOrder.deliveryCost : undefined
            });
          }
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
          } else if (productType === 'topping') {
            const topping = toppings.find(t => t.id.toString() === realProductId);
            if (topping) {
              return {
                producto_tipo: 'topping' as const,
                producto_id: topping.id,
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

  return null;
};
