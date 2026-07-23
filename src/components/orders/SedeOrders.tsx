import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
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
    deliveryInstructions: '',
    items: [] as { productId: string; quantity: number; toppings: string[] }[],
    paymentMethod: 'cash' as PaymentMethod,
    hasMultiplePayments: false,
    paymentMethod2: 'cash' as PaymentMethod,
    paymentAmount1: 0,
    paymentAmount2: 0,
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
  const [isCreatingOrder, setIsCreatingOrder] = useState(false); // Estado para prevenir clics duplicados
  const [searchPhone, setSearchPhone] = useState('');


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

  // Cargar productos específicos de sede
  useEffect(() => {
    loadSedeProducts();
  }, [loadSedeProducts]);

  // Debug productos de sede
  useEffect(() => {
    console.log('🔍 SedeOrders: Estado de toppings:', { 
      toppingsCount: sedeProducts.toppings.length, 
      toppings: sedeProducts.toppings.map(t => ({ id: t.id, name: t.name, pricing: t.pricing }))
    });
  }, [sedeProducts.toppings]);


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
    console.log('📋 Platos sede:', sedeProducts.platos.map(p => ({ id: p.id, name: p.name })));
    console.log('🥤 Bebidas sede:', sedeProducts.bebidas.map(b => ({ id: b.id, name: b.name })));
    
    // Buscar el producto en platos y bebidas para debug
    const plato = sedeProducts.platos.find(p => p.id.toString() === productId);
    const bebida = sedeProducts.bebidas.find(b => b.id.toString() === productId);
    
    console.log('🔍 DEBUG: Producto encontrado:', {
      productId,
      productType,
      plato: plato ? { id: plato.id, name: plato.name, type: 'plato' } : null,
      bebida: bebida ? { id: bebida.id, name: bebida.name, type: 'bebida' } : null,
      totalPlatos: sedeProducts.platos.length,
      totalBebidas: sedeProducts.bebidas.length
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
      // Operación activa: usar únicamente productos/precios de sede (override)
      if (productType === 'plato') {
        product = sedeProducts.platos.find(p => p.id.toString() === realProductId);
      } else if (productType === 'bebida') {
        product = sedeProducts.bebidas.find(b => b.id.toString() === realProductId);
      } else if (productType === 'topping') {
        product = sedeProducts.toppings.find(t => t.id.toString() === realProductId);
      }
      
      // Debug solo si no se encuentra el producto o el precio es 0
      if (!product || product.pricing === 0) {
        console.log('⚠️ DEBUG: Problema en calculateTotal:', {
          itemId: item.productId,
          productType,
          productFound: !!product,
          pricing: product?.pricing ?? 0
        });
      }
      
      return total + (product ? product.pricing * item.quantity : 0);
    }, 0);
    
    // Add delivery fee using custom value for delivery orders
    const deliveryFee = newOrder.deliveryType === 'delivery' ? newOrder.deliveryCost : 0;
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

  const handleCreateOrder = async () => {
    // Validaciones básicas
    if (newOrder.deliveryType === 'delivery' && !customerData.address) return;
    // Para pickup, ya no validamos pickupSede (se auto-asigna), ni datos de persona (usa cliente principal)
    if (newOrder.items.length === 0) return;
    if (!effectiveSedeId) return; // Validar que hay sede efectiva (seleccionada por admin o asignada al agente)
    if (!customerData.name || !customerData.phone) return;

    // Validar múltiples pagos si están habilitados
    if (newOrder.hasMultiplePayments && !validatePaymentAmounts()) {
      toast({
        title: "Error de validación",
        description: "Los montos de pago no suman el total de la orden",
        variant: "destructive"
      });
      return;
    }

    // Validar valor de domicilio si es delivery
    if (newOrder.deliveryType === 'delivery' && newOrder.deliveryCost === 0) {
      setShowZeroDeliveryConfirm(true);
      return;
    }

    await executeCreateOrder();
  };

  const executeCreateOrder = async () => {
    // Prevenir clics duplicados mientras se está creando el pedido
    if (isCreatingOrder) {
      console.log('⚠️ Ya se está creando un pedido, ignorando clic duplicado');
      return;
    }

    setIsCreatingOrder(true);
    try {
      // Validar que todos los productos existan antes de crear el pedido
      console.log('🔍 Validando existencia de productos antes de crear pedido...');
      for (const item of newOrder.items) {
        const [productType, realProductId] = item.productId.split('_');
        
        if (productType === 'plato') {
          const product = sedeProducts.platos.find(p => p.id.toString() === realProductId);
          if (!product) {
            throw new Error(`Plato con ID ${realProductId} no encontrado en el inventario`);
          }
        } else if (productType === 'bebida') {
          const bebida = sedeProducts.bebidas.find(b => b.id.toString() === realProductId);
          if (!bebida) {
            throw new Error(`Bebida con ID ${realProductId} no encontrada en el inventario`);
          }
        } else if (productType === 'topping') {
          const topping = sedeProducts.toppings.find(t => t.id.toString() === realProductId);
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
        address: finalAddress,
        delivery_instructions: newOrder.deliveryType === 'delivery' ? newOrder.deliveryInstructions : undefined,
        tipo_entrega: newOrder.deliveryType,
        sede_recogida: newOrder.deliveryType === 'pickup' ? currentSedeName : undefined,
        pago_tipo: newOrder.paymentMethod === 'cash' ? 'efectivo' :
                   newOrder.paymentMethod === 'card' ? 'tarjeta' :
                   newOrder.paymentMethod === 'nequi' ? 'nequi' : 'transferencia',
        // Información de múltiples pagos
        hasMultiplePayments: newOrder.hasMultiplePayments,
        pago_tipo2: newOrder.hasMultiplePayments ? (
          newOrder.paymentMethod2 === 'cash' ? 'efectivo' :
          newOrder.paymentMethod2 === 'card' ? 'tarjeta' :
          newOrder.paymentMethod2 === 'nequi' ? 'nequi' : 'transferencia'
        ) : undefined,
        pago_monto1: newOrder.hasMultiplePayments ? newOrder.paymentAmount1 : calculateTotal(),
        pago_monto2: newOrder.hasMultiplePayments ? newOrder.paymentAmount2 : undefined,
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
            const product = sedeProducts.platos.find(p => p.id.toString() === realProductId);
            if (product) {
              return {
                producto_tipo: 'plato' as const,
                producto_id: product.id,
                cantidad: item.quantity
              };
            }
          } else if (productType === 'bebida') {
            const bebida = sedeProducts.bebidas.find(b => b.id.toString() === realProductId);
            if (bebida) {
              return {
                producto_tipo: 'bebida' as const,
                producto_id: bebida.id,
                cantidad: item.quantity
              };
            }
          } else if (productType === 'topping') {
            const topping = sedeProducts.toppings.find(t => t.id.toString() === realProductId);
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
        deliveryInstructions: '',
        items: [],
        paymentMethod: 'cash',
        hasMultiplePayments: false,
        paymentMethod2: 'cash',
        paymentAmount1: 0,
        paymentAmount2: 0,
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
    } finally {
      // Siempre liberar el botón, incluso si hay error
      setIsCreatingOrder(false);
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
      {/* Header con información de la sede */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Órdenes de {currentSedeName}</CardTitle>
            </div>
            <Badge variant="secondary" className="text-sm">
              {sedeOrders.length} órdenes
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Botón para crear nueva orden */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogTrigger asChild>
          <Button className="w-full mb-4">
            <Plus className="h-4 w-4 mr-2" />
            Crear Nueva Orden
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Nueva Orden</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Búsqueda de cliente */}
            <div className="space-y-4">
              <Label htmlFor="customerSearch">Buscar Cliente</Label>
              <div className="flex gap-2">
                <Input
                  id="customerSearch"
                  type="tel"
                  placeholder="Número de teléfono del cliente"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                />
                <Button
                  onClick={() => searchCustomer(searchPhone)}
                  disabled={!searchPhone.trim()}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </Button>
              </div>
            </div>

            {/* Información del cliente */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customerName">Nombre del Cliente</Label>
                <Input
                  id="customerName"
                  value={customerData.name}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <Label htmlFor="customerPhone">Teléfono</Label>
                <Input
                  id="customerPhone"
                  type="tel"
                  value={customerData.phone}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Número de teléfono"
                />
              </div>
            </div>

            {/* Tipo de entrega */}
            <div className="space-y-3">
              <Label>Tipo de Entrega</Label>
              <RadioGroup
                value={newOrder.deliveryType}
                onValueChange={(value: DeliveryType) => setNewOrder(prev => ({ ...prev, deliveryType: value }))}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="delivery" id="delivery" />
                  <Label htmlFor="delivery">Domicilio</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pickup" id="pickup" />
                  <Label htmlFor="pickup">Recoger en Sede</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Dirección (solo para delivery) */}
            {newOrder.deliveryType === 'delivery' && (
              <>
                <div>
                  <Label htmlFor="address">Dirección de Entrega *</Label>
                  <Textarea
                    id="address"
                    value={customerData.address}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Dirección completa de entrega"
                    rows={3}
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
              </>
            )}

            {/* Productos */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Productos</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addNewItem}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Producto
                </Button>
              </div>

              {newOrder.items.map((item, index) => (
                <Card key={index} className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                      <Label>Tipo de Producto</Label>
                      <Select
                        value={item.productType}
                        onValueChange={(value: 'plato' | 'bebida') => updateItem(index, 'productType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="plato">Plato Fuerte</SelectItem>
                          <SelectItem value="bebida">Bebida</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Producto</Label>
                      <Select
                        value={item.productId}
                        onValueChange={(value) => updateItem(index, 'productId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar producto" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableProducts(item.productType).map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} - ${product.pricing?.toLocaleString() || 0}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      />
                    </div>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeItem(index)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Método de Pago */}
            <div className="space-y-4">
              <Label>Método de Pago</Label>
              <Select
                value={newOrder.paymentMethod}
                onValueChange={(value: PaymentMethod) => setNewOrder(prev => ({ ...prev, paymentMethod: value }))}
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

              {/* Checkbox para múltiples métodos de pago */}
              <div className="flex items-center space-x-2 mt-3">
                <Checkbox
                  id="multiplePayments"
                  checked={newOrder.hasMultiplePayments}
                  onCheckedChange={handleMultiplePaymentsChange}
                />
                <Label htmlFor="multiplePayments" className="text-sm">
                  El cliente paga con más de un método
                </Label>
              </div>

              {/* Controles de múltiples pagos */}
              {newOrder.hasMultiplePayments && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  <h4 className="font-medium text-sm text-gray-700">Configuración de Múltiples Pagos</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Primer pago */}
                    <div className="space-y-2">
                    <Label className="text-xs text-gray-600">Primer Método: {
                        newOrder.paymentMethod === 'cash' ? 'Efectivo' :
                        newOrder.paymentMethod === 'card' ? 'Tarjeta' :
                        newOrder.paymentMethod === 'nequi' ? 'Nequi' : 'Transferencia'
                      }</Label>
                      <Input
                        type="number"
                        placeholder="Monto del primer pago"
                        value={newOrder.paymentAmount1 || ''}
                        onChange={(e) => setNewOrder(prev => ({
                          ...prev,
                          paymentAmount1: parseFloat(e.target.value) || 0
                        }))}
                      />
                    </div>

                    {/* Segundo pago */}
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Segundo Método</Label>
                      <Select
                        value={newOrder.paymentMethod2}
                        onValueChange={(value: PaymentMethod) => setNewOrder(prev => ({ ...prev, paymentMethod2: value }))}
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
                      <Input
                        type="number"
                        placeholder="Monto del segundo pago"
                        value={newOrder.paymentAmount2 || ''}
                        onChange={(e) => setNewOrder(prev => ({
                          ...prev,
                          paymentAmount2: parseFloat(e.target.value) || 0
                        }))}
                      />
                    </div>
                  </div>

                  {/* Validación de montos */}
                  <div className="text-sm">
                    <span className="text-gray-600">Total de la orden: </span>
                    <span className="font-medium">${calculateTotal().toLocaleString()}</span>
                    {newOrder.hasMultiplePayments && (
                      <>
                        <br />
                        <span className="text-gray-600">Suma de pagos: </span>
                        <span className={`font-medium ${
                          validatePaymentAmounts() ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ${(newOrder.paymentAmount1 + newOrder.paymentAmount2).toLocaleString()}
                        </span>
                        {!validatePaymentAmounts() && (
                          <div className="text-red-600 text-xs mt-1">
                            ⚠️ La suma de los pagos debe coincidir con el total de la orden
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Instrucciones especiales */}
            <div>
              <Label htmlFor="instructions">Instrucciones Especiales</Label>
              <Textarea
                id="instructions"
                value={newOrder.specialInstructions}
                onChange={(e) => setNewOrder(prev => ({ ...prev, specialInstructions: e.target.value }))}
                placeholder="Instrucciones adicionales para la preparación o entrega"
                rows={3}
              />
            </div>

            {/* Resumen del pedido */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Total del Pedido:</span>
                <span className="font-bold text-lg">${calculateTotal().toLocaleString()}</span>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={executeCreateOrder}
                disabled={isCreatingOrder || newOrder.items.length === 0 || !customerData.name.trim() || !customerData.phone.trim()}
                className="flex-1"
              >
                {isCreatingOrder ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Crear Orden
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                disabled={isCreatingOrder}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación para costo de envío $0 */}
      <AlertDialog open={showZeroDeliveryConfirm} onOpenChange={setShowZeroDeliveryConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmar Envío Sin Costo
            </AlertDialogTitle>
            <AlertDialogDescription>
              El costo de envío es $0. Esto puede ocurrir cuando:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>La entrega es muy cercana y no se cobra al cliente</li>
                <li>Es una cortesía o promoción especial</li>
                <li>El cliente tiene un beneficio de envío gratis</li>
              </ul>
              <p className="mt-3 font-medium">
                ¿Desea continuar con la creación del pedido sin costo de envío?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowZeroDeliveryConfirm(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowZeroDeliveryConfirm(false);
                await executeCreateOrder();
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              Sí, Crear Pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lista de órdenes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Órdenes Activas</CardTitle>
        </CardHeader>
        <CardContent>
          {sedeOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay órdenes registradas para esta sede</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sedeOrders.map((order) => (
                <Card key={order.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">ORD-{order.id}</Badge>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleString('es-CO')}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">{order.customerName}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <Phone className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">{order.customerPhone}</span>
                        </div>
                        {order.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">{order.address}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="flex items-center justify-end gap-2 mb-1">
                          <CreditCard className="h-4 w-4 text-gray-500" />
                          <span className="font-bold">${order.totalAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">
                            {new Date(order.estimatedDeliveryTime).toLocaleTimeString('es-CO', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
