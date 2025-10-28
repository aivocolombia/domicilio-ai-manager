
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Clock,
  Package,
  Truck,
  CheckCircle,
  Phone,
  Bot,
  Settings,
  Power,
  PowerOff,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  User,
  RefreshCw,
  AlertCircle,
  Calendar,
  Filter,
  Download,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageCircle,
  Edit,
  Printer,
  Plus,
  Calculator,
  Repeat,
  ArrowLeftRight
} from 'lucide-react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { createDateRangeForQuery, formatDateTimeForDisplay, debugTodayFilter } from '@/utils/dateUtils';
import { Order, OrderStatus, OrderSource, DeliverySettings, DeliveryPerson, PaymentMethod } from '@/types/delivery';
import { OrderConfigModal } from './OrderConfigModal';
import { OrderDetailsModal } from './OrderDetailsModal';
import { ChangePaymentMethodModal } from './ChangePaymentMethodModal';
import { EditOrderModal } from './EditOrderModal';
import { MinutaModal } from './MinutaModal';
import { DiscountDialog } from './DiscountDialog';
import { ChangeOrderTypeDialog } from './ChangeOrderTypeDialog';
import { PaymentDetailsModal } from './PaymentDetailsModal';
import { cn } from '@/lib/utils';
import { useDashboard } from '@/hooks/useDashboard';
import { logDebug, logError, logWarn } from '@/utils/logger';
import { DashboardOrder } from '@/services/dashboardService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { sedeOrdersService } from '@/services/sedeOrdersService';
import { useSedeOrders } from '@/hooks/useSedeOrders';
import { CreateOrderData } from '@/services/sedeOrdersService';
import { useMenu } from '@/hooks/useMenu';
import { addressService } from '@/services/addressService';
import { sedeServiceSimple } from '@/services/sedeServiceSimple';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Pause, Store, Navigation, ShoppingCart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import { useAgentDebug } from '@/hooks/useAgentDebug';
import { ExportButton } from '@/components/ui/ExportButton';
import { formatters, TableColumn } from '@/utils/exportUtils';

interface DashboardProps {
  orders: Order[];
  settings: DeliverySettings;
  deliveryPersonnel: DeliveryPerson[];
  effectiveSedeId?: string;
  currentSedeName?: string;
  onUpdateOrders: (orders: Order[]) => void;
  onUpdateSettings: (settings: DeliverySettings) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  orders: legacyOrders,
  settings,
  effectiveSedeId,
  currentSedeName,
  deliveryPersonnel,
  onUpdateOrders,
  onUpdateSettings
}) => {
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos'); // Todos los pedidos por defecto
  
  // Estado para toggle entre delivery y pickup
  const [viewMode, setViewMode] = useState<'delivery' | 'pickup'>('delivery');
  
  // Estados para filtros de fecha
  const [dateFilter, setDateFilter] = useState<'today' | 'custom'>('today'); // Default: Solo hoy
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: new Date(), // Hoy por defecto
    to: new Date()    // Hoy por defecto
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [hasAppliedInitialFilter, setHasAppliedInitialFilter] = useState(false);
  const [lastAppliedFilters, setLastAppliedFilters] = useState<string>('');
  const [lastSedeId, setLastSedeId] = useState<string | undefined>(undefined);
  
  // Estados para transferir pedido
  const [transferOrderId, setTransferOrderId] = useState('');
  const [transferSedeId, setTransferSedeId] = useState('');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [sedes, setSedes] = useState<Array<{ id: string; name: string; address?: string }>>([]);

  // Estados para cancelar pedido
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Estados para ver motivo de cancelación
  const [viewCancelModalOpen, setViewCancelModalOpen] = useState(false);
  const [viewCancelData, setViewCancelData] = useState<{
    orderId: string;
    reason: string;
    canceledAt?: string;
  } | null>(null);

  // Estados para modal de pausar pedidos
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [pauseOption, setPauseOption] = useState<'global'>('global');
  const [pauseTimer, setPauseTimer] = useState<string>('');
  const [pauseTimerActive, setPauseTimerActive] = useState(false);

  // Estados para modal de detalles de pago
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false);
  const [selectedPaymentOrderId, setSelectedPaymentOrderId] = useState<number | null>(null);

  // Estados para modal de detalles del pedido
  const [orderDetailsModalOpen, setOrderDetailsModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  // Estados para modal de crear pedido
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [showZeroDeliveryConfirm, setShowZeroDeliveryConfirm] = useState(false);
  const [foundCustomer, setFoundCustomer] = useState<any>(null);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    address: ''
  });
  const [newOrder, setNewOrder] = useState({
    address: '',
    deliveryInstructions: '',
    items: [] as { productId: string; quantity: number; toppings: string[] }[],
    paymentMethod: 'cash' as PaymentMethod,
    specialInstructions: '',
    deliveryType: 'delivery' as 'delivery' | 'pickup',
    pickupSede: '',
    deliveryTimeMinutes: 90,
    deliveryCost: 0,
    cutleryCount: 0,
    cutleryManuallyAdjusted: false,
    // Multi-payment support
    hasMultiplePayments: false,
    paymentMethod2: 'cash' as PaymentMethod,
    paymentAmount1: 0,
    paymentAmount2: 0
  });
  const [searchingPrice, setSearchingPrice] = useState(false);
  const [sedeProducts, setSedeProducts] = useState({
    platos: [] as any[],
    bebidas: [] as any[],
    toppings: [] as any[]
  });
  const [loadingSedeProducts, setLoadingSedeProducts] = useState(false);

  // Helpers para manejar cantidades por producto dentro de la UI de selección
  const getItemCount = (productType: 'plato' | 'bebida' | 'topping', productId: string | number) => {
    const uniqueId = `${productType}_${productId}`;
    const item = newOrder.items.find(i => i.productId === uniqueId);
    return item?.quantity ?? 0;
  };

  const incrementItem = (productType: 'plato' | 'bebida', productId: string | number) => {
    // Reutiliza la función existente
    addItemToOrder(productId.toString(), productType);
  };

  const decrementItem = (productType: 'plato' | 'bebida', productId: string | number) => {
    const uniqueId = `${productType}_${productId}`;
    const existing = newOrder.items.find(i => i.productId === uniqueId);
    if (!existing) return;
    if (existing.quantity > 1) {
      setNewOrder({
        ...newOrder,
        items: newOrder.items.map(i => i.productId === uniqueId ? { ...i, quantity: i.quantity - 1 } : i)
      });
    } else {
      removeItemFromOrder(uniqueId);
    }
  };

  const incrementTopping = (toppingId: string | number) => {
    addToppingToOrder(toppingId.toString());
  };

  const decrementTopping = (toppingId: string | number) => {
    const uniqueId = `topping_${toppingId}`;
    const existing = newOrder.items.find(i => i.productId === uniqueId);
    if (!existing) return;
    if (existing.quantity > 1) {
      setNewOrder({
        ...newOrder,
        items: newOrder.items.map(i => i.productId === uniqueId ? { ...i, quantity: i.quantity - 1 } : i)
      });
    } else {
      removeItemFromOrder(uniqueId);
    }
  };

  // Multi-payment helper functions
  const handleMultiplePaymentsChange = (checked: boolean | string) => {
    const isChecked = checked === true || checked === 'true';
    setNewOrder({
      ...newOrder,
      hasMultiplePayments: isChecked,
      paymentAmount1: isChecked ? 0 : 0,
      paymentAmount2: isChecked ? 0 : 0
    });
  };

  const validatePaymentAmounts = (amount1: number, amount2: number, total: number): string | null => {
    if (amount2 <= 0) {
      return 'El monto del segundo pago debe ser mayor a 0';
    }
    if (amount2 > total) {
      return 'El monto del segundo pago no puede ser mayor al total';
    }
    if (amount1 < 0) {
      return 'El monto del primer pago no puede ser negativo';
    }
    return null;
  };

  // Estados para modal de impresión de minuta
  const [printMinutaModalOpen, setPrintMinutaModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [selectedOrderForMinuta, setSelectedOrderForMinuta] = useState<DashboardOrder | null>(null);

  // Estados para modal de cambiar método de pago
  const [changePaymentModalOpen, setChangePaymentModalOpen] = useState(false);
  const [selectedOrderForPaymentChange, setSelectedOrderForPaymentChange] = useState<{
    orderId: string;
    currentPaymentMethod: PaymentMethod;
  } | null>(null);

  // Estados para modal de descuento
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [selectedOrderForDiscount, setSelectedOrderForDiscount] = useState<DashboardOrder | null>(null);

  // Estados para modal de cambiar tipo de orden (delivery/pickup)
  const [isChangeOrderTypeDialogOpen, setIsChangeOrderTypeDialogOpen] = useState(false);
  const [selectedOrderForTypeChange, setSelectedOrderForTypeChange] = useState<DashboardOrder | null>(null);

  // Estados para ordenamiento
  const [sortField, setSortField] = useState<keyof DashboardOrder>('creado_fecha');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Obtener datos del usuario autenticado
  const { user, profile } = useAuth();

  // Hook para datos del menú
  const { platos, bebidas, toppings, loading: menuLoading, loadToppings } = useMenu();

  // Hook para datos reales del dashboard
  // Usar effectiveSedeId cuando esté disponible (admin) o sede_id del usuario (agente)
  const sedeIdToUse = useMemo(() => {
    const finalSedeId = effectiveSedeId || profile?.sede_id;
    return finalSedeId;
  }, [effectiveSedeId, profile?.sede_id]);

  // Hook para crear pedidos
  const {
    customer,
    loading: sedeOrdersLoading,
    searchCustomer,
    createOrder,
    refreshData: refreshSedeOrders,
  } = useSedeOrders(sedeIdToUse);

  // Debug para agentes
  const agentDebug = useAgentDebug();

  // Debug: Log user information (solo en desarrollo)
  if (process.env.NODE_ENV === 'development') {
    logDebug('Dashboard', 'Usuario autenticado', { user: user?.id, email: user?.email });
    logDebug('Dashboard', 'Perfil del usuario', { profile: profile?.id, role: profile?.role });
    logDebug('Dashboard', 'Sede ID del usuario', { sede_id: profile?.sede_id, type: typeof profile?.sede_id });
  }

  // Cargar sedes cuando se abra el modal de transferencia
  useEffect(() => {
    if (isTransferModalOpen) {
      loadSedes();
    }
  }, [isTransferModalOpen]);

  // Cargar sedes al montar el componente para tener las direcciones disponibles
  useEffect(() => {
    loadSedes();
  }, []);
  
  // Debug: Log sede information
  logDebug('Dashboard', 'IDs de sede calculados', { 
    effectiveSedeId, 
    userSedeId: profile?.sede_id, 
    finalSedeId: sedeIdToUse 
  });

  // Cargar sedes disponibles
  const loadSedes = async () => {
    try {
      const { data: sedesData, error } = await supabase
        .from('sedes')
        .select('id, name, address')
        .eq('is_active', true)
        .order('name');

      if (error) {
        logError('Dashboard', 'Error cargando sedes', error);
        return;
      }

      setSedes(sedesData || []);
    } catch (error) {
      logError('Dashboard', 'Error al cargar sedes', error);
    }
  };

  // Función para transferir pedido
  const handleTransferOrder = async () => {
    if (!transferOrderId || !transferSedeId) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const orderId = parseInt(transferOrderId);
      if (isNaN(orderId)) {
        toast({
          title: "Error",
          description: "ID de pedido inválido",
          variant: "destructive"
        });
        return;
      }

      await sedeOrdersService.transferOrder(orderId, transferSedeId);
      
      toast({
        title: "Pedido transferido",
        description: `Pedido #${orderId} transferido exitosamente`,
      });

      // Limpiar formulario y cerrar modal
      setTransferOrderId('');
      setTransferSedeId('');
      setIsTransferModalOpen(false);

      // Recargar datos del dashboard
      if (sedeIdToUse) {
        refreshDataWithCurrentFilters();
      }
    } catch (error) {
      logError('Dashboard', 'Error transfiriendo pedido', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo transferir el pedido",
        variant: "destructive"
      });
    }
  };

  // Función para ver el motivo de cancelación
  const handleViewCancelReason = async (orderId: string) => {
    try {
      logDebug('Dashboard', 'Obteniendo motivo de cancelación', { orderId });
      
      const { data, error } = await supabase
        .from('ordenes')
        .select('motivo_cancelacion, cancelado_at, id')
        .eq('id', parseInt(orderId))
        .single();

      if (error) {
        logError('Dashboard', 'Error obteniendo motivo de cancelación', error);
        toast({
          title: "Error",
          description: "No se pudo obtener el motivo de cancelación",
          variant: "destructive"
        });
        return;
      }

      if (data) {
        setViewCancelData({
          orderId: `ORD-${data.id.toString().padStart(4, '0')}`,
          reason: data.motivo_cancelacion || 'No se especificó motivo',
          canceledAt: data.cancelado_at || undefined
        });
        setViewCancelModalOpen(true);
      }
    } catch (error) {
      logError('Dashboard', 'Error inesperado', error);
      toast({
        title: "Error",
        description: "Error inesperado al obtener el motivo",
        variant: "destructive"
      });
    }
  };

  // Función para abrir modal de cancelación
  const handleCancelOrder = (orderId: string) => {
    setCancelOrderId(orderId);
    setCancelReason('');
    setIsCancelModalOpen(true);
  };

  const handleEditOrder = (orderId: string) => {
    setEditingOrderId(orderId);
    setIsEditModalOpen(true);
  };

  // Funciones para descuentos
  const handleDiscountOrder = (order: DashboardOrder) => {
    logDebug('Dashboard', 'Abriendo modal de descuento', { orderId: order.orden_id });
    setSelectedOrderForDiscount(order);
    setIsDiscountDialogOpen(true);
  };

  // Función para editar método de pago (disponible para todos los usuarios)
  const handleChangePaymentMethod = (order: DashboardOrder) => {
    console.log('🔄 Abriendo modal para cambiar método de pago', {
      orderId: order.orden_id,
      currentMethod: order.pago_metodo
    });

    setSelectedOrderForPaymentChange({
      orderId: order.orden_id.toString(),
      currentPaymentMethod: (order.pago_metodo || 'cash') as PaymentMethod
    });
    setChangePaymentModalOpen(true);
  };

  // Función para cambiar tipo de orden (delivery/pickup)
  const handleChangeOrderType = (order: DashboardOrder) => {
    logDebug('Dashboard', 'Abriendo modal para cambiar tipo de orden', {
      orderId: order.orden_id,
      currentType: order.type_order,
      currentStatus: order.estado
    });

    setSelectedOrderForTypeChange(order);
    setIsChangeOrderTypeDialogOpen(true);
  };

  const handleDiscountApplied = (orderId: number, discountAmount: number) => {
    logDebug('Dashboard', 'Descuento aplicado', { orderId, discountAmount });

    toast({
      title: "Descuento Aplicado",
      description: `Descuento de $${discountAmount.toLocaleString()} aplicado exitosamente`,
      variant: "default"
    });

    // Refrescar los datos del dashboard manteniendo los filtros actuales
    refreshDataWithCurrentFilters();
  };

  const canApplyDiscount = (order: DashboardOrder): boolean => {
    // Solo admin_punto y admin_global pueden aplicar descuentos
    if (!profile || !['admin_punto', 'admin_global'].includes(profile.role)) {
      logDebug('Dashboard', 'canApplyDiscount: No tiene permisos', { profile });
      return false;
    }

    // Estados permitidos para aplicar descuentos
    const allowedStatuses = ['Recibidos', 'Cocina', 'Camino', 'Entregados', 'received', 'kitchen', 'delivery', 'delivered'];

    // Verificar estado de la orden
    if (!allowedStatuses.includes(order.estado)) {
      logDebug('Dashboard', 'canApplyDiscount: Estado no permitido', { estado: order.estado });
      return false;
    }

    // admin_punto solo puede aplicar descuentos en su sede
    if (profile.role === 'admin_punto' && profile.sede_id !== order.sede_id) {
      logDebug('Dashboard', 'canApplyDiscount: Sede no coincide', {
        profileSedeId: profile.sede_id,
        orderSede: order.sede,
        orderSedeId: order.sede_id
      });
      return false;
    }

    // No permitir descuento si ya tiene uno aplicado
    if (order.descuento_valor && order.descuento_valor > 0) {
      logDebug('Dashboard', 'canApplyDiscount: Ya tiene descuento', { descuento: order.descuento_valor });
      return false;
    }

    logDebug('Dashboard', 'canApplyDiscount: ✅ Puede aplicar descuento', { orderId: order.id_display });
    return true;
  };

  // Función para confirmar cancelación de pedido
  const handleConfirmCancel = async () => {
    if (!cancelOrderId || !cancelReason.trim()) {
      toast({
        title: "Error",
        description: "Debe ingresar un motivo de cancelación",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsCancelling(true);
      
      logDebug('Dashboard', 'Cancelando pedido', {
        orderId: cancelOrderId,
        orderIdType: typeof cancelOrderId,
        reason: cancelReason.trim()
      });

      // Convertir orderId a número si es necesario
      const orderIdNumber = parseInt(cancelOrderId, 10);
      
      if (isNaN(orderIdNumber)) {
        throw new Error('ID de pedido inválido');
      }

      logDebug('Dashboard', 'Order ID convertido', { orderIdNumber });
      
      // Primero verificar si la orden existe y obtener su estructura
      logDebug('Dashboard', 'Verificando orden antes de actualizar');
      const { data: orderCheck, error: checkError } = await supabase
        .from('ordenes')
        .select('id, status, created_at')
        .eq('id', orderIdNumber)
        .single();

      if (checkError) {
        logError('Dashboard', 'Error verificando orden', checkError);
        throw new Error('No se pudo verificar la orden');
      }

      if (!orderCheck) {
        throw new Error('Orden no encontrada');
      }

      logDebug('Dashboard', 'Orden encontrada', { orderCheck });
      
      // Primero verificar qué valores válidos tiene el campo status
      logDebug('Dashboard', 'Verificando valores válidos para status');
      
      // Verificar valores existentes en la tabla
      const { data: existingOrders, error: existingError } = await supabase
        .from('ordenes')
        .select('status')
        .limit(10);
      
      if (existingError) {
        logError('Dashboard', 'Error obteniendo status existentes', existingError);
      } else {
        logDebug('Dashboard', 'Status existentes en la tabla', { statuses: existingOrders?.map(o => o.status) });
        
        // Verificar si hay algún status que contenga "Cancelado"
        const cancelStatuses = existingOrders?.filter(o => 
          o.status && o.status.includes('Cancelado')
        );
        logDebug('Dashboard', 'Status que contienen "Cancelado"', { cancelStatuses });
      }
      
      let statusUpdated = false;
      
      // Intentar actualizar el status a 'Cancelado'
      logDebug('Dashboard', 'Intentando actualizar status a Cancelado');
      
      const { error: statusError } = await supabase
        .from('ordenes')
        .update({ status: 'Cancelado' })
        .eq('id', orderIdNumber);
      
      if (statusError) {
        logError('Dashboard', 'Status Cancelado falló', { message: statusError.message, details: statusError });
        throw statusError;
      } else {
        logDebug('Dashboard', 'Status actualizado exitosamente a Cancelado');
        statusUpdated = true;
      }
      
      if (!statusUpdated) {
        logError('Dashboard', 'No se pudo actualizar el status con ningún valor válido');
        throw lastError || new Error('No se pudo actualizar el status');
      }

      logDebug('Dashboard', 'Status actualizado exitosamente');

      // Ahora intentar actualizar los campos adicionales
      logDebug('Dashboard', 'Intentando actualizar campos adicionales');
      
      const additionalData: any = {};
      
      // Verificar si el campo motivo_cancelacion existe
      try {
        const { error: motivoError } = await supabase
          .from('ordenes')
          .update({ motivo_cancelacion: cancelReason.trim() })
          .eq('id', orderIdNumber);
        
        if (motivoError) {
          console.warn('⚠️ Campo motivo_cancelacion no disponible:', motivoError.message);
        } else {
          logDebug('Dashboard', 'Motivo de cancelación guardado');
        }
      } catch (e) {
        console.warn('⚠️ No se pudo guardar motivo de cancelación:', e);
      }

      // Verificar si el campo cancelado_at existe
      try {
        const { error: canceladoError } = await supabase
          .from('ordenes')
          .update({ cancelado_at: new Date().toISOString() })
          .eq('id', orderIdNumber);
        
        if (canceladoError) {
          console.warn('⚠️ Campo cancelado_at no disponible:', canceladoError.message);
        } else {
          logDebug('Dashboard', 'Timestamp de cancelación guardado');
        }
      } catch (e) {
        console.warn('⚠️ No se pudo guardar timestamp de cancelación:', e);
      }

      // La actualización se completó exitosamente
      logDebug('Dashboard', 'Cancelación completada');

      toast({
        title: "Pedido cancelado",
        description: `Pedido #${cancelOrderId} cancelado exitosamente`,
      });

      // Limpiar formulario y cerrar modal
      setCancelOrderId(null);
      setCancelReason('');
      setIsCancelModalOpen(false);

      // Recargar datos del dashboard
      if (sedeIdToUse) {
        refreshDataWithCurrentFilters();
      }
    } catch (error) {
      logError('Dashboard', 'Error cancelando pedido', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo cancelar el pedido",
        variant: "destructive"
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Configuración de columnas para exportación
  const exportColumns: TableColumn[] = [
    { key: 'id_display', header: 'ID Pedido', width: 12 },
    { key: 'orden_id', header: 'ID Interno', width: 12 },
    { key: 'cliente_nombre', header: 'Cliente', width: 20 },
    { key: 'cliente_telefono', header: 'Teléfono', width: 15 },
    { key: 'address', header: 'Dirección', width: 30 },
    { key: 'sede', header: 'Sede', width: 15 },
    {
      key: 'estado',
      header: 'Estado',
      width: 15,
      format: (value) => getDisplayStatus(value || '', '')
    },
    {
      key: 'total',
      header: 'Total',
      width: 12,
      format: formatters.currency
    },
    { key: 'payment_display', header: 'Tipo Pago', width: 15 },
    { key: 'pago_estado', header: 'Estado Pago', width: 15 },
    { key: 'creado_fecha', header: 'Fecha Creación', width: 15 },
    { key: 'creado_hora', header: 'Hora Creación', width: 12 },
    { key: 'entrega_hora', header: 'Hora Entrega', width: 12 },
    { key: 'repartidor', header: 'Repartidor', width: 15 },
    { key: 'payment_id', header: 'Payment ID', width: 15 }
  ];

  const {
    orders: realOrders,
    stats,
    loading,
    error,
    loadDashboardOrders,
    filterOrdersByStatus,
    refreshData,
    deleteOrder,
    realtimeStatus,
    registerRefreshFunction
  } = useDashboard(sedeIdToUse, refreshSedeOrders);

  // Usar SOLO datos reales - NUNCA datos legacy para evitar mostrar datos dummy
  // Una sede nueva debe mostrar dashboard vacío, no datos dummy
  const orders = realOrders;

  // Preparar datos para exportación (mapeo para compatibilidad)
  const exportData = orders?.map(order => ({
    ...order,
    payment_display: order.payment_display || order.pago_tipo || ''
  })) || [];

  // Función debounced para aplicar filtros y evitar llamadas excesivas
  const debouncedLoadOrders = useDebouncedCallback(loadDashboardOrders, 500);

  // Función de ordenamiento
  // OPTIMIZACIÓN: useCallback para evitar re-renders de componentes hijos
  const handleSort = useCallback((field: keyof DashboardOrder) => {
    setSortField(prevField => {
      if (prevField === field) {
        // Cambiar dirección si es el mismo campo
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        return field;
      } else {
        // Nuevo campo, empezar con descendente
        setSortDirection('desc');
        return field;
      }
    });
    // Resetear a primera página cuando se cambia el ordenamiento
    setCurrentPage(1);
  }, []); // Sin dependencias - usa functional updates

  // OPTIMIZACIÓN: Memoización de función de iconos
  const getSortIcon = useCallback((field: keyof DashboardOrder) => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-4 w-4 inline ml-1 text-blue-600" />
    ) : (
      <ArrowDown className="h-4 w-4 inline ml-1 text-blue-600" />
    );
  }, [sortField, sortDirection]);

  // OPTIMIZACIÓN CRÍTICA: Memoización de filtrado y ordenamiento
  // Esto evita re-procesar las órdenes en cada render
  const filteredAndSortedOrders = useMemo(() => {
    // Paso 1: Filtrar (solo cuando cambian las dependencias)
    const searchLower = searchTerm.toLowerCase();
    const filtered = orders.filter(order => {
      const realOrder = order as DashboardOrder;
      
      // Optimizar búsqueda: solo buscar en campos necesarios si hay término de búsqueda
      const matchesSearch = !searchTerm || (
        realOrder.cliente_nombre.toLowerCase().includes(searchLower) ||
        realOrder.cliente_telefono.includes(searchTerm) ||
        realOrder.id_display.toLowerCase().includes(searchLower) ||
        realOrder.address.toLowerCase().includes(searchLower)
      );
      
      // Filtro de estado mejorado
      let matchesStatus = false;
      if (statusFilter === 'todos') {
        // CORREGIDO: "Todos" debe mostrar TODAS las órdenes sin filtro
        matchesStatus = true;
      } else if (statusFilter === 'activos') {
        // "Activos" excluye órdenes entregadas y canceladas (comportamiento anterior de "todos")
        matchesStatus = realOrder.estado !== 'Entregados' && 
                       realOrder.estado !== 'Cancelado' && 
                       realOrder.estado !== 'delivered' && 
                       realOrder.estado !== 'cancelled';
      } else {
        matchesStatus = realOrder.estado === statusFilter;
      }
      return matchesSearch && matchesStatus;
    });

    // Paso 2: Ordenar (usando spread operator optimizado)
    return filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal || '').localeCompare(String(bVal || ''));
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [orders, searchTerm, statusFilter, sortField, sortDirection]);

  // Alias para compatibilidad con código existente
  const sortedOrders = filteredAndSortedOrders;

  // Memoized pagination calculations
  const paginationData = useMemo(() => {
    const totalItems = sortedOrders.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedOrders = sortedOrders.slice(startIndex, endIndex);
    
    return {
      totalItems,
      totalPages,
      startIndex,
      endIndex,
      paginatedOrders
    };
  }, [sortedOrders, currentPage, itemsPerPage]);

  // Extract for compatibility
  const { totalItems, totalPages, startIndex, endIndex, paginatedOrders } = paginationData;

  // Función personalizada para recargar con filtros actuales
  // Función para aplicar filtros de fecha
  const applyDateFilter = useCallback(async (force = false) => {
    let filters: any = {};
    
    if (dateFilter === 'today') {
      logDebug('Dashboard', 'Aplicando filtro hoy');
      
      const today = new Date();
      logDebug('Dashboard', 'Fecha de hoy', { fecha: today.toLocaleDateString('es-CO') });
      
      // Crear rango simple: desde las 00:00 hasta las 23:59 del día actual
      // IMPORTANTE: usar zona horaria local sin conversiones UTC problemáticas
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      
      // Crear las fechas de consulta en formato ISO pero ajustadas a zona horaria local
      // Esto evita el problema de "+1 día" causado por conversiones UTC
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      
      // Corregir timezone para Colombia (UTC-5)
      // Un día en Colombia (00:00 - 23:59) = UTC (05:00 - 04:59 día siguiente)
      const fechaInicio = `${year}-${month}-${day}T05:00:00Z`; // 12:00 AM Colombia
      
      // Calcular día siguiente para el final del día
      const nextDay = new Date(today);
      nextDay.setDate(nextDay.getDate() + 1);
      const yearNext = nextDay.getFullYear();
      const monthNext = String(nextDay.getMonth() + 1).padStart(2, '0');
      const dayNext = String(nextDay.getDate()).padStart(2, '0');
      
      const fechaFin = `${yearNext}-${monthNext}-${dayNext}T04:59:59Z`; // 11:59 PM Colombia
      
      logDebug('Dashboard', 'Rango de consulta corregido', {
        fechaHoy: today.toLocaleDateString('es-CO'),
        fechaInicio,
        fechaFin
      });
      
      filters.fechaInicio = fechaInicio;
      filters.fechaFin = fechaFin;
      
      logDebug('Dashboard', 'Filtros finales aplicados', { 
        fechaInicio: filters.fechaInicio, 
        fechaFin: filters.fechaFin,
        fechaSistema: today.toLocaleDateString('es-CO')
      });
    } else if (dateFilter === 'custom' && dateRange.from && dateRange.to) {
      // Filtro personalizado con rango de fechas usando utilidades de fecha
      const customRange = createDateRangeForQuery(dateRange.from, dateRange.to);
      filters.fechaInicio = customRange.fechaInicio;
      filters.fechaFin = customRange.fechaFin;

      logDebug('Dashboard', 'Aplicando filtro personalizado', {
        desde: dateRange.from.toLocaleDateString('es-CO'),
        hasta: dateRange.to.toLocaleDateString('es-CO'),
        fechaInicio: filters.fechaInicio,
        fechaFin: filters.fechaFin
      });
    }
    
    // Aplicar también el filtro de estado actual si existe
    // No enviar 'todos' ni 'activos' al servidor, solo filtros específicos
    if (statusFilter && statusFilter !== 'todos' && statusFilter !== 'activos') {
      filters.estado = statusFilter;
    }
    
    // Aplicar filtro de tipo de orden
    filters.type_order = viewMode;
    
    // Crear una clave única para los filtros actuales (incluyendo sede_id)
    const currentFiltersKey = JSON.stringify({ ...filters, sede_id: sedeIdToUse });
    
    // Evitar cargas duplicadas si los filtros no han cambiado (a menos que sea forzado)
    if (!force && currentFiltersKey === lastAppliedFilters) {
      logDebug('Dashboard', 'Filtros no han cambiado, saltando carga', { 
        currentFiltersKey,
        lastAppliedFilters,
        filters,
        force 
      });
      return;
    }
    
    // Actualizar la clave de filtros aplicados
    setLastAppliedFilters(currentFiltersKey);
    logDebug('Dashboard', 'Filtros han cambiado, procediendo con carga', { 
      previousFilters: lastAppliedFilters,
      newFilters: currentFiltersKey 
    });
    
    // Llamar directamente a loadDashboardOrders sin timeout
    if (sedeIdToUse) {
      logDebug('Dashboard', 'Cargando datos con filtros nuevos', { filters, force });
      loadDashboardOrders(filters);
    }
  }, [dateFilter, dateRange, statusFilter, viewMode, sedeIdToUse, lastAppliedFilters, loadDashboardOrders]);

  const refreshDataWithCurrentFilters = useCallback(async (maybeOptions?: { force?: boolean } | boolean | React.SyntheticEvent) => {
    let force = false;

    if (typeof maybeOptions === 'boolean') {
      force = maybeOptions;
    } else if (maybeOptions && typeof maybeOptions === 'object') {
      const potentialEvent = maybeOptions as React.SyntheticEvent;
      if ('preventDefault' in potentialEvent && typeof potentialEvent.preventDefault === 'function') {
        force = false;
      } else if ('force' in (maybeOptions as { force?: boolean })) {
        const value = (maybeOptions as { force?: boolean }).force;
        force = typeof value === 'boolean' ? value : false;
      }
    }

    logDebug('Dashboard', 'Recargando con filtros actuales', { viewMode, dateFilter, statusFilter, force });
    await applyDateFilter(force);
  }, [viewMode, dateFilter, statusFilter, applyDateFilter]);

  // Aplicar filtro de fecha cuando cambie el tipo de filtro (con timeout para evitar bucles)
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    
    const applyFilters = () => {
      // Debounce reducido para carga más rápida
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        if (sedeIdToUse && isMounted) {
          try {
            logDebug('Dashboard', 'Aplicando filtros por cambio de dependencias usando refreshDataWithCurrentFilters', { 
              dateFilter, 
              viewMode, 
              statusFilter,
              sedeIdToUse 
            });
            // Usar la función personalizada que incluye los filtros actuales
            refreshDataWithCurrentFilters();
          } catch (error) {
            logError('Dashboard', 'Error aplicando filtros', error);
          }
        }
      }, 10); // Reducido a 10ms para cargas más rápidas
    };
    
    // Solo aplicar filtros si ya se aplicó el filtro inicial
    if (hasAppliedInitialFilter) {
      applyFilters();
    }
    
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [dateFilter, dateRange, sedeIdToUse, statusFilter, viewMode, hasAppliedInitialFilter, refreshDataWithCurrentFilters]);

  // Resetear filtros cuando cambie la sede
  useEffect(() => {
    if (sedeIdToUse !== lastSedeId) {
      logDebug('Dashboard', 'Sede cambió, reseteando filtros', { 
        previousSede: lastSedeId, 
        newSede: sedeIdToUse 
      });
      setLastSedeId(sedeIdToUse);
      setLastAppliedFilters('');
      setHasAppliedInitialFilter(false);
    }
  }, [sedeIdToUse, lastSedeId]);

  // Registrar función de refresh con filtros para uso en real-time
  useEffect(() => {
    registerRefreshFunction(refreshDataWithCurrentFilters);
  }, [registerRefreshFunction, refreshDataWithCurrentFilters]);

  // === FUNCIONES PARA CREAR PEDIDO ===

  // Función para normalizar número de teléfono
  const normalizePhone = (phone: string): string => {
    return phone.replace(/[\s\-\(\)\+]/g, '').trim();
  };

  // Función para buscar cliente por teléfono
  const searchCustomerByPhone = useCallback(async (phone: string) => {
    if (!phone.trim() || phone.length < 7) {
      return null;
    }

    const normalizedPhone = normalizePhone(phone);

    try {
      logDebug('Dashboard', 'Buscando cliente por teléfono:', normalizedPhone);

      const { data: clienteData, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('telefono', normalizedPhone)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') {
          logError('Dashboard', 'Error buscando cliente:', error);
        }
        return null;
      }

      if (clienteData) {
        logDebug('Dashboard', 'Cliente encontrado:', clienteData);

        // Buscar las últimas indicaciones de entrega del cliente
        let ultimasIndicaciones = '';
        try {
          const { data: ultimaOrden } = await supabase
            .from('ordenes')
            .select('delivery_instructions')
            .eq('cliente_id', clienteData.id)
            .not('delivery_instructions', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (ultimaOrden?.delivery_instructions) {
            ultimasIndicaciones = ultimaOrden.delivery_instructions;
          }
        } catch (err) {
          // Si no hay órdenes previas o error, continuar sin indicaciones
          logDebug('Dashboard', 'No se encontraron indicaciones previas');
        }

        return {
          nombre: clienteData.nombre,
          telefono: clienteData.telefono,
          direccion_reciente: clienteData.direccion || '',
          indicaciones_recientes: ultimasIndicaciones
        };
      }
    } catch (error) {
      logError('Dashboard', 'Error inesperado buscando cliente:', error);
    }

    return null;
  }, []);

  // Función para buscar precio de envío
  const searchDeliveryPrice = useCallback(async (address: string) => {
    if (!address.trim() || address.length < 5 || !sedeIdToUse) {
      setNewOrder(prev => ({ ...prev, deliveryCost: 0 }));
      return;
    }

    try {
      setSearchingPrice(true);
      setNewOrder(prev => ({ ...prev, deliveryCost: 0 }));

      const lastPrice = await addressService.getLastDeliveryPriceForAddress(address, sedeIdToUse);

      if (lastPrice && lastPrice > 0) {
        setNewOrder(prev => ({ ...prev, deliveryCost: lastPrice }));
        toast({
          title: "Precio encontrado",
          description: `Se estableció $${lastPrice.toLocaleString()} basado en entregas anteriores`,
        });
      } else {
        toast({
          title: "Precio no encontrado",
          description: "Ingrese manualmente el costo del domicilio",
          variant: "destructive"
        });
      }
    } catch (error) {
      logError('Dashboard', 'Error buscando precio:', error);
      setNewOrder(prev => ({ ...prev, deliveryCost: 0 }));
    } finally {
      setSearchingPrice(false);
    }
  }, [sedeIdToUse, toast]);

  // Función para cargar productos específicos de sede
  const loadSedeProducts = useCallback(async () => {
    if (!sedeIdToUse) return;

    setLoadingSedeProducts(true);
    try {
      const { platos, bebidas, toppings } = await sedeServiceSimple.getSedeCompleteInfo(sedeIdToUse, true);

      const availablePlatos = platos.filter(p => p.is_available);
      const availableBebidas = bebidas.filter(b => b.is_available);
      const availableToppings = toppings.filter(t => t.is_available);

      setSedeProducts({
        platos: availablePlatos,
        bebidas: availableBebidas,
        toppings: availableToppings
      });
    } catch (error) {
      logError('Dashboard', 'Error cargando productos de sede:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos disponibles para esta sede.",
        variant: "destructive"
      });
    } finally {
      setLoadingSedeProducts(false);
    }
  }, [sedeIdToUse, toast]);

  // === EFECTOS PARA CREAR PEDIDO ===

  // Cargar toppings al montar el componente
  useEffect(() => {
    loadToppings();
  }, [loadToppings]);

  // Cargar productos específicos de sede
  useEffect(() => {
    loadSedeProducts();
  }, [loadSedeProducts]);

  // Buscar cliente cuando cambia el teléfono (con debounce)
  useEffect(() => {
    if (customerData.phone && customerData.phone.length >= 7) {
      const timeout = setTimeout(async () => {
        setSearchingCustomer(true);
        const foundClient = await searchCustomerByPhone(customerData.phone);

        if (foundClient) {
          setFoundCustomer(foundClient);

          // Solo llenar campos vacíos
          setCustomerData(prev => ({
            name: prev.name.trim() ? prev.name : foundClient.nombre,
            phone: prev.phone,
            address: prev.address.trim() ? prev.address : foundClient.direccion_reciente
          }));

          // Auto-rellenar indicaciones si están vacías
          if (foundClient.indicaciones_recientes && !newOrder.deliveryInstructions.trim()) {
            setNewOrder(prev => ({
              ...prev,
              deliveryInstructions: foundClient.indicaciones_recientes
            }));
          }
        } else {
          setFoundCustomer(null);
        }
        setSearchingCustomer(false);
      }, 600);

      return () => clearTimeout(timeout);
    } else {
      setFoundCustomer(null);
    }
  }, [customerData.phone, searchCustomerByPhone]);

  // Buscar precio cuando cambia la dirección (con debounce)
  useEffect(() => {
    if (newOrder.deliveryType === 'delivery') {
      if (customerData.address && customerData.address.trim()) {
        const timeout = setTimeout(() => {
          searchDeliveryPrice(customerData.address);
        }, 800);

        return () => clearTimeout(timeout);
      } else {
        setNewOrder(prev => ({ ...prev, deliveryCost: 0 }));
      }
    }
  }, [customerData.address, newOrder.deliveryType, searchDeliveryPrice]);

  // Aplicar filtro inicial cuando el componente se monta (solo una vez)
  useEffect(() => {
    if (sedeIdToUse && !hasAppliedInitialFilter) {
      logDebug('Dashboard', 'Aplicando filtro inicial usando refreshDataWithCurrentFilters');
      setHasAppliedInitialFilter(true);
      // Usar la función personalizada que incluye los filtros actuales
      setTimeout(() => {
        refreshDataWithCurrentFilters();
      }, 100);
    }
  }, [sedeIdToUse, hasAppliedInitialFilter, refreshDataWithCurrentFilters]);

  // Limpiar selecciones de pedidos cancelados/entregados
  useEffect(() => {
    if (selectedOrders.length > 0) {
      const validSelections = selectedOrders.filter(selectedId => {
        const order = paginatedOrders.find(o => o.id_display === selectedId);
        return order && order.estado !== 'Cancelado' && order.estado !== 'Entregados';
      });
      
      if (validSelections.length !== selectedOrders.length) {
        setSelectedOrders(validSelections);
      }
    }
  }, [paginatedOrders, selectedOrders]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Recibidos': return <Clock className="h-4 w-4" />;
      case 'Cocina': return <Package className="h-4 w-4" />;
      case 'Camino': return <Truck className="h-4 w-4" />;
      case 'Entregados': return <CheckCircle className="h-4 w-4" />;
      case 'Cancelado': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Recibidos': return 'bg-yellow-500';
      case 'Cocina': return 'bg-blue-500';
      case 'Camino': return 'bg-orange-500';
      case 'Entregados': return 'bg-green-500';
      case 'Cancelado': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getSourceIcon = (source: OrderSource) => {
    switch (source) {
      case 'ai_agent': return <Bot className="h-4 w-4 text-purple-600" />;
      case 'call_center': return <Phone className="h-4 w-4 text-blue-600" />;
      default: return <Phone className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'card': return <CreditCard className="h-4 w-4" />;
      case 'cash': return <Banknote className="h-4 w-4" />;
      case 'nequi': return <Smartphone className="h-4 w-4" />;
      case 'transfer': return <Building2 className="h-4 w-4" />;
      default: return <CreditCard className="h-4 w-4" />;
    }
  };

  // Función para mostrar el estado correcto según el tipo de orden
  const getDisplayStatus = (status: string, orderType?: string) => {
    if (status === 'Camino' && orderType === 'pickup') {
      return 'En espera';
    }
    return status;
  };

  // Función para obtener el icono del tipo de orden
  const getOrderTypeIcon = (orderType?: string) => {
    if (orderType === 'pickup') {
      return <Package className="h-3 w-3 text-green-600" title="Recolección en sede" />;
    }
    return <Truck className="h-3 w-3 text-blue-600" title="Delivery" />;
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case 'card': return 'Tarjeta';
      case 'cash': return 'Efectivo';
      case 'nequi': return 'Nequi';
      case 'transfer': return 'Transferencia';
      default: return method;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getDeliveryPersonName = (personId?: string) => {
    if (!personId) return 'Sin asignar';
    const person = deliveryPersonnel.find(p => p.id === personId);
    return person ? person.name : 'No encontrado';
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Solo seleccionar pedidos que no estén cancelados o entregados
      const selectableOrders = paginatedOrders.filter(order => 
        order.estado !== 'Cancelado' && order.estado !== 'Entregados'
      );
      setSelectedOrders(selectableOrders.map(order => order.id_display));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders(prev => [...prev, orderId]);
    } else {
      setSelectedOrders(prev => prev.filter(id => id !== orderId));
    }
  };

  const toggleAcceptingOrders = () => {
    onUpdateSettings({
      ...settings,
      acceptingOrders: !settings.acceptingOrders
    });
  };

  // Handler para pausar pedidos con opciones y timer
  const handlePauseOrders = () => {
    const minutes = pauseTimer ? parseInt(pauseTimer) : 0;
    
    // Pause immediately
    toggleAcceptingOrders();
    
    // Show confirmation
    const pauseTypeText = 'todos los pedidos';
    const timerText = minutes > 0 ? ` por ${minutes} minutos` : '';

    toast({
      title: "Sistema Pausado",
      description: `Se ha pausado ${pauseTypeText}${timerText}`,
    });
    
    // Set up automatic reactivation if timer is set
    if (minutes > 0) {
      setPauseTimerActive(true);
      setTimeout(() => {
        toggleAcceptingOrders(); // Reactivate
        setPauseTimerActive(false);
        toast({
          title: "Sistema Reactivado",
          description: `El sistema se ha reactivado automáticamente después de ${minutes} minutos`,
        });
      }, minutes * 60 * 1000);
    }
    
    // Close modal and reset form
    setIsPauseModalOpen(false);
    setPauseOption('agent');
    setPauseTimer('');
  };

  // Handler para eliminar orden (solo admin)
  const handleDeleteOrder = async (orderId: number, orderDisplay: string) => {
    if (!profile || profile.role !== 'admin_global') {
      toast({
        title: "Acceso denegado",
        description: "Solo los administradores globales pueden eliminar órdenes",
        variant: "destructive"
      });
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar la orden ${orderDisplay}? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      await deleteOrder(orderId);
    } catch (error) {
      // El error ya se maneja en el hook useDashboard
      logError('Dashboard', 'Error eliminando orden', error);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Función para abrir modal de detalles del pedido
  const handleOrderClick = (orderId: number) => {
    setSelectedOrderId(orderId);
    setOrderDetailsModalOpen(true);
  };

  // Función para abrir Google Maps
  const openGoogleMaps = (orderAddress: string) => {
    // Buscar la sede actual para obtener su dirección real
    const currentSede = sedes.find(sede => sede.id === sedeIdToUse);

    // Usar la dirección real si está disponible, sino usar el nombre como fallback
    const sedeAddress = currentSede?.address && currentSede.address.trim()
      ? `${currentSede.address}, Bogotá, Colombia`
      : `${currentSedeName}, Bogotá, Colombia`;

    logDebug('Dashboard', 'Abriendo Google Maps', {
      sedeId: sedeIdToUse,
      sedeName: currentSedeName,
      sedeAddress: sedeAddress,
      orderAddress: orderAddress,
      sedeData: currentSede
    });

    const googleMapsUrl = `https://www.google.com/maps/dir/${encodeURIComponent(sedeAddress)}/${encodeURIComponent(orderAddress)}`;
    window.open(googleMapsUrl, '_blank');
  };

  // Función para agregar item al pedido
  const addItemToOrder = (productId: string, productType: 'plato' | 'bebida') => {
    const uniqueProductId = `${productType}_${productId}`;

    const existingItem = newOrder.items.find(item => item.productId === uniqueProductId);
    if (existingItem) {
      setNewOrder({
        ...newOrder,
        items: newOrder.items.map(item =>
          item.productId === uniqueProductId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      ,
        // Si no se ha ajustado manualmente, sincronizar cubiertos con platos principales
        ...(productType === 'plato' && !newOrder.cutleryManuallyAdjusted
          ? { cutleryCount: newOrder.cutleryCount + 1 }
          : {})
      });
    } else {
      setNewOrder({
        ...newOrder,
        items: [...newOrder.items, {
          productId: uniqueProductId,
          quantity: 1,
          toppings: []
        }]
      ,
        // Si no se ha ajustado manualmente, incrementar cubiertos al añadir primer plato
        ...(productType === 'plato' && !newOrder.cutleryManuallyAdjusted
          ? { cutleryCount: newOrder.cutleryCount + 1 }
          : {})
      });
    }
  };

  // Función para agregar topping al pedido
  const addToppingToOrder = (toppingId: string) => {
    const uniqueToppingId = `topping_${toppingId}`;

    const existingItem = newOrder.items.find(item => item.productId === uniqueToppingId);
    if (existingItem) {
      setNewOrder({
        ...newOrder,
        items: newOrder.items.map(item =>
          item.productId === uniqueToppingId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      });
    } else {
      setNewOrder({
        ...newOrder,
        items: [...newOrder.items, {
          productId: uniqueToppingId,
          quantity: 1,
          toppings: []
        }]
      });
    }
  };

  // Función para remover item del pedido
  const removeItemFromOrder = (productId: string) => {
    const [productType] = productId.split('_');
    const removedItem = newOrder.items.find(i => i.productId === productId);
    const removedQty = removedItem?.quantity || 0;

    setNewOrder({
      ...newOrder,
      items: newOrder.items.filter(item => item.productId !== productId),
      // Si se elimina un plato y no hubo ajuste manual, reducir cubiertos
      ...(productType === 'plato' && !newOrder.cutleryManuallyAdjusted
        ? { cutleryCount: Math.max(0, newOrder.cutleryCount - removedQty) }
        : {})
    });
  };

  // Función para calcular total del pedido
  const calculateTotal = () => {
    const itemsTotal = newOrder.items.reduce((total, item) => {
      const [productType, realProductId] = item.productId.split('_');

      let product = null;
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

      return total + (product ? product.pricing * item.quantity : 0);
    }, 0);

    const deliveryFee = newOrder.deliveryType === 'delivery' ? newOrder.deliveryCost : 0;
    return itemsTotal + deliveryFee;
  };

  // Función para crear pedido
  const handleCreateOrder = async () => {
    if (newOrder.deliveryType === 'delivery' && !customerData.address) return;
    if (newOrder.items.length === 0) return;
    if (!sedeIdToUse) return;
    if (!customerData.name || !customerData.phone) return;

    // Validar múltiples pagos si están habilitados
    if (newOrder.hasMultiplePayments) {
      const total = calculateTotal();
      if (newOrder.paymentAmount2 <= 0) {
        toast({
          title: "Error en los pagos",
          description: "Debes especificar el monto del segundo método de pago",
          variant: "destructive",
        });
        return;
      }
      if (newOrder.paymentAmount2 > total) {
        toast({
          title: "Error en los pagos",
          description: "El monto del segundo pago no puede ser mayor al total",
          variant: "destructive",
        });
        return;
      }
    }

    if (newOrder.deliveryType === 'delivery' && newOrder.deliveryCost === 0) {
      setShowZeroDeliveryConfirm(true);
      return;
    }

    await executeCreateOrder();
  };

  // Función para ejecutar creación de pedido
  const executeCreateOrder = async () => {
    try {
      // Validar productos
      for (const item of newOrder.items) {
        const [productType, realProductId] = item.productId.split('_');

        if (productType === 'plato') {
          const product = platos.find(p => p.id.toString() === realProductId);
          if (!product) {
            throw new Error(`Plato con ID ${realProductId} no encontrado`);
          }
        } else if (productType === 'bebida') {
          const bebida = bebidas.find(b => b.id.toString() === realProductId);
          if (!bebida) {
            throw new Error(`Bebida con ID ${realProductId} no encontrada`);
          }
        } else if (productType === 'topping') {
          const topping = toppings.find(t => t.id.toString() === realProductId);
          if (!topping) {
            throw new Error(`Topping con ID ${realProductId} no encontrado`);
          }
        }
      }

      const finalAddress = newOrder.deliveryType === 'pickup'
        ? `Recogida en ${currentSedeName} - Cliente: ${customerData.name} (${customerData.phone})`
        : customerData.address;

      const orderData: CreateOrderData = {
        cliente_nombre: customerData.name,
        cliente_telefono: customerData.phone,
        address: finalAddress, // Guardar la dirección específica de esta orden
        delivery_instructions: newOrder.deliveryType === 'delivery' ? newOrder.deliveryInstructions : undefined,
        tipo_entrega: newOrder.deliveryType,
        sede_recogida: newOrder.deliveryType === 'pickup' ? currentSedeName : undefined,
        pago_tipo: newOrder.paymentMethod === 'cash' ? 'efectivo' :
                   newOrder.paymentMethod === 'card' ? 'tarjeta' :
                   newOrder.paymentMethod === 'nequi' ? 'nequi' : 'transferencia',
        instrucciones: newOrder.specialInstructions || undefined,
        cubiertos: newOrder.cutleryCount,
        delivery_time_minutes: newOrder.deliveryTimeMinutes,
        delivery_cost: newOrder.deliveryType === 'delivery' ? newOrder.deliveryCost : undefined,
        items: newOrder.items.map(item => {
          const [productType, realProductId] = item.productId.split('_');

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

          throw new Error(`Producto no encontrado: ${item.productId}`);
        }),
        sede_id: sedeIdToUse,
        update_customer_data: {
          nombre: customerData.name,
          telefono: customerData.phone,
          direccion: newOrder.deliveryType === 'delivery' ? customerData.address : undefined
        },
        // Multi-payment support
        hasMultiplePayments: newOrder.hasMultiplePayments,
        pago_tipo2: newOrder.hasMultiplePayments ? (
          newOrder.paymentMethod2 === 'cash' ? 'efectivo' :
          newOrder.paymentMethod2 === 'card' ? 'tarjeta' :
          newOrder.paymentMethod2 === 'nequi' ? 'nequi' : 'transferencia'
        ) : undefined,
        pago_monto1: newOrder.hasMultiplePayments ? newOrder.paymentAmount1 : undefined,
        pago_monto2: newOrder.hasMultiplePayments ? newOrder.paymentAmount2 : undefined
      };

      await createOrder(orderData);

      // Reset form
      setNewOrder({
        address: '',
        deliveryInstructions: '',
        items: [],
        paymentMethod: 'cash',
        specialInstructions: '',
        deliveryType: 'delivery',
        pickupSede: '',
        deliveryTimeMinutes: 90,
        deliveryCost: 0,
        cutleryCount: 0,
        cutleryManuallyAdjusted: false,
        // Multi-payment support
        hasMultiplePayments: false,
        paymentMethod2: 'cash',
        paymentAmount1: 0,
        paymentAmount2: 0
      });
      setCustomerData({
        name: '',
        phone: '',
        address: ''
      });
      setShowCreateOrderModal(false);
      setShowZeroDeliveryConfirm(false);

      // Limpiar búsqueda para evitar mostrar pedidos antiguos
      setSearchTerm('');

      // Refresh dashboard data respetando filtros actuales
      refreshDataWithCurrentFilters();

    } catch (error) {
      logError('Dashboard', 'Error creando pedido:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo crear el pedido",
        variant: "destructive"
      });
    }
  };

  // Manejar error
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>Error: {error}</span>
        </div>
        <Button onClick={refreshDataWithCurrentFilters}>Reintentar</Button>
      </div>
    );
  }

  // Verificar si el usuario tiene sede asignada
  if (!profile?.sede_id) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-orange-600">
          <AlertCircle className="h-5 w-5" />
          <span>No tienes una sede asignada. Contacta al administrador.</span>
        </div>
        <div className="text-sm text-gray-600">
          <p>Debug: Usuario: {user?.email}</p>
          <p>Debug: Perfil cargado: {profile ? 'Sí' : 'No'}</p>
          <p>Debug: Sede ID: {profile?.sede_id || 'No asignada'}</p>
        </div>
      </div>
    );
  }

  const activeOrdersCount = stats.recibidos + stats.cocina + stats.camino;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Dashboard de Domicilios</h1>
              
              {/* Real-time connection indicator */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  realtimeStatus?.connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
                  realtimeStatus?.connectionStatus === 'connecting' ? 'bg-yellow-500 animate-spin' : 
                  realtimeStatus?.connectionStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
                }`}></div>
                <span className="text-xs text-muted-foreground">
                  {realtimeStatus?.connectionStatus === 'connected' ? 'En vivo' : 
                   realtimeStatus?.connectionStatus === 'connecting' ? 'Conectando...' : 
                   realtimeStatus?.connectionStatus === 'error' ? 'Error' : 'Desconectado'}
                </span>
                {(realtimeStatus?.connectionStatus === 'error' || realtimeStatus?.connectionStatus === 'connecting') && (
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (realtimeStatus.testConnection) {
                          const isConnected = await realtimeStatus.testConnection();
                          toast({
                            title: isConnected ? "✅ Conectividad OK" : "❌ Error de conectividad",
                            description: isConnected
                              ? "Supabase funciona, problema en Realtime"
                              : "Problema de conexión a Supabase",
                            duration: 4000,
                          });
                        }
                      }}
                      className="h-6 px-2 text-xs"
                    >
                      Test
                    </Button>
                    {realtimeStatus?.connectionStatus === 'error' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          realtimeStatus.reconnect();
                          toast({
                            title: "Reconectando...",
                            description: "Intentando restablecer conexión en tiempo real",
                            duration: 2000,
                          });
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        Reconectar
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Toggle Delivery/Pickup */}
            <div className="flex bg-muted rounded-lg p-1">
              <Button
                onClick={() => setViewMode('delivery')}
                variant={viewMode === 'delivery' ? 'default' : 'ghost'}
                size="sm"
                className="flex items-center gap-2"
              >
                <Truck className="h-4 w-4" />
                Delivery
              </Button>
              <Button
                onClick={() => setViewMode('pickup')}
                variant={viewMode === 'pickup' ? 'default' : 'ghost'}
                size="sm"
                className="flex items-center gap-2"
              >
                <Package className="h-4 w-4" />
                Recolección
              </Button>
            </div>
          </div>
          
          <p className="text-muted-foreground">
            {activeOrdersCount} pedidos activos • {stats.total} pedidos totales
          </p>
          <p className="text-sm text-blue-600 font-medium">
            Sede: {profile?.sede_name || profile?.sede_id || 'Sede actual'}
          </p>
        </div>
        
        <div className="flex gap-3">
          {/* Botón de Crear Nuevo Pedido - Solo para admin_punto y agentes */}
          {(profile?.role === 'admin_punto' || profile?.role === 'agent') && (
            <Button
              onClick={() => setShowCreateOrderModal(true)}
              disabled={!settings.acceptingOrders}
              className="bg-brand-primary hover:bg-brand-primary/90 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Crear Nuevo Pedido
            </Button>
          )}

          {/* Botón de exportación - Solo para administradores */}
          {profile?.role === 'admin' && (
            <ExportButton
              data={exportData}
              columns={exportColumns}
              formats={['excel', 'csv']}
              filename={`ordenes_${currentSedeName || 'sede'}_${format(new Date(), 'yyyy-MM-dd')}`}
              title={`Órdenes - ${currentSedeName || 'Sede'}`}
              subtitle={`Reporte generado el ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`}
              sheetName="Órdenes"
              variant="outline"
              size="sm"
            />
          )}
          
          <Button
            onClick={() => {
              if (settings.acceptingOrders) {
                setIsPauseModalOpen(true);
              } else {
                toggleAcceptingOrders();
              }
            }}
            variant={settings.acceptingOrders ? "destructive" : "default"}
            className="flex items-center gap-2"
          >
            {settings.acceptingOrders ? (
              <>
                <PowerOff className="h-4 w-4" />
                Pausar Pedidos
              </>
            ) : (
              <>
                <Power className="h-4 w-4" />
                Activar Pedidos
              </>
            )}
          </Button>
          
          {selectedOrders.length > 0 && (
            <Button onClick={() => setIsConfigModalOpen(true)} className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configurar ({selectedOrders.length})
            </Button>
          )}
          
        </div>
      </div>


      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { key: 'recibidos', label: 'Recibidos', count: stats.recibidos },
          { key: 'cocina', label: 'En Cocina', count: stats.cocina },
          { key: 'camino', label: 'En Camino', count: stats.camino },
          { key: 'entregados', label: 'Entregados', count: stats.entregados },
          { key: 'cancelados', label: 'Cancelados', count: stats.cancelados }
        ].map(({ key, label, count }) => (
          <Card key={key}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
              <div className={cn("p-2 rounded-full", getStatusColor(key === 'recibidos' ? 'Recibidos' : key === 'cocina' ? 'Cocina' : key === 'camino' ? 'Camino' : key === 'entregados' ? 'Entregados' : 'Cancelado'))}>
                {getStatusIcon(key === 'recibidos' ? 'Recibidos' : key === 'cocina' ? 'Cocina' : key === 'camino' ? 'Camino' : key === 'entregados' ? 'Entregados' : 'Cancelado')}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* Filtros de fecha */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtros de fecha:</span>
              </div>
              
              {/* Botón "Solo Hoy" (por defecto) */}
              <Button
                variant={dateFilter === 'today' ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilter('today')}
                className="flex items-center gap-2"
              >
                <Clock className="h-4 w-4" />
                Solo Hoy
              </Button>
              
              {/* Selector de rango personalizado */}
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={dateFilter === 'custom' ? "default" : "outline"}
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => {
                      if (dateFilter !== 'custom') {
                        setDateFilter('custom');
                      }
                    }}
                  >
                    <Filter className="h-4 w-4" />
                    {dateFilter === 'custom' && dateRange.from && dateRange.to
                      ? `${format(dateRange.from, 'dd/MM', { locale: es })} - ${format(dateRange.to, 'dd/MM', { locale: es })}`
                      : 'Rango Personalizado'
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3 space-y-3">
                    <h4 className="font-medium text-sm">Seleccionar fechas</h4>
                    <CalendarComponent
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange.from}
                      selected={{
                        from: dateRange.from,
                        to: dateRange.to
                      }}
                      onSelect={(range) => {
                        if (range?.from && range?.to) {
                          setDateRange({ from: range.from, to: range.to });
                          setDateFilter('custom');
                        } else if (range?.from) {
                          setDateRange({ from: range.from, to: range.from });
                          setDateFilter('custom');
                        }
                      }}
                      numberOfMonths={2}
                      locale={es}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => setIsDatePickerOpen(false)}
                      >
                        Aplicar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDateFilter('today');
                          setIsDatePickerOpen(false);
                        }}
                      >
                        Volver a Hoy
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Filtros existentes */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Buscar por nombre, teléfono, ID o dirección..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                {[
                  { value: 'todos', label: 'Todos' },
                  { value: 'activos', label: 'Activos' },
                  { value: 'Recibidos', label: 'Recibidos' },
                  { value: 'Cocina', label: 'Cocina' },
                  { value: 'Camino', label: 'Camino' },
                  { value: 'Entregados', label: 'Entregados' },
                  { value: 'Cancelado', label: 'Cancelados' }
                ].map(({ value, label }) => (
                  <Button
                    key={value}
                    variant={statusFilter === value ? "default" : "outline"}
                    size="sm"
                    onClick={async () => {
                      setStatusFilter(value);
                      // Aplicar filtro combinado (fecha + estado)
                      await applyDateFilter();
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Pedidos</CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={(() => {
                  const selectableOrders = paginatedOrders.filter(order => 
                    order.estado !== 'Cancelado' && order.estado !== 'Entregados'
                  );
                  return selectableOrders.length > 0 && selectedOrders.length === selectableOrders.length;
                })()}
                onCheckedChange={handleSelectAll}
                disabled={(() => {
                  const selectableOrders = paginatedOrders.filter(order => 
                    order.estado !== 'Cancelado' && order.estado !== 'Entregados'
                  );
                  return selectableOrders.length === 0;
                })()}
              />
              <span className="text-sm text-muted-foreground">
                {(() => {
                  const selectableOrders = paginatedOrders.filter(order => 
                    order.estado !== 'Cancelado' && order.estado !== 'Entregados'
                  );
                  const nonSelectableCount = paginatedOrders.length - selectableOrders.length;
                  
                  if (nonSelectableCount > 0) {
                    return `Seleccionar todos (${selectableOrders.length} disponibles)`;
                  }
                  return 'Seleccionar todos';
                })()}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 w-12"></th>
                  <th className="text-left p-2 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('id_display')}>
                    ID {getSortIcon('id_display')}
                  </th>
                  <th className="text-left p-2">
                    Minuta
                  </th>
                  <th className="text-left p-2 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('cliente_nombre')}>
                    Cliente {getSortIcon('cliente_nombre')}
                  </th>
                  <th className="text-left p-2 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('address')}>
                    Dirección {getSortIcon('address')}
                  </th>
                  <th className="text-left p-2 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('sede')}>
                    Sede {getSortIcon('sede')}
                  </th>
                  <th className="text-left p-2 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('estado')}>
                    Estado {getSortIcon('estado')}
                  </th>
                  <th className="text-left p-2 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('pago_tipo')}>
                    Pago {getSortIcon('pago_tipo')}
                  </th>
                  <th className="text-left p-2 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('repartidor')}>
                    Repartidor {getSortIcon('repartidor')}
                  </th>
                  <th className="text-left p-2 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('total')}>
                    Total {getSortIcon('total')}
                  </th>
                  <th className="text-left p-2 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('entrega_hora')}>
                    Entrega {getSortIcon('entrega_hora')}
                  </th>
                  <th className="text-left p-2 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('creado_fecha')}>
                    Creado {getSortIcon('creado_fecha')}
                  </th>
                  <th className="text-left p-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={14} className="p-8 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Cargando órdenes...
                      </div>
                    </td>
                  </tr>
                ) : paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="p-8 text-center text-muted-foreground">
                      No se encontraron órdenes
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => {
                    const realOrder = order as DashboardOrder;
                    return (
                      <tr 
                        key={realOrder.orden_id} 
                        className={`border-b cursor-pointer transition-colors ${
                          realOrder.estado === 'Cancelado' || realOrder.estado === 'Entregados' 
                            ? 'bg-gray-50 opacity-75 hover:bg-gray-100' 
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => handleOrderClick(realOrder.orden_id)}
                        title="Click para ver detalles del pedido"
                      >
                        <td className="p-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedOrders.includes(realOrder.id_display)}
                            onCheckedChange={(checked) => handleSelectOrder(realOrder.id_display, checked as boolean)}
                            disabled={realOrder.estado === 'Cancelado' || realOrder.estado === 'Entregados'}
                            className={realOrder.estado === 'Cancelado' || realOrder.estado === 'Entregados' ? 'opacity-50 cursor-not-allowed' : ''}
                          />
                        </td>
                        <td className="p-2 font-mono text-sm">{realOrder.id_display}</td>
                        <td className="p-2">
                          <div className="flex items-center justify-center">
                            {realOrder.minuta_id ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-mono">
                                #{realOrder.minuta_id}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 text-xs">Sin minuta</span>
                            )}
                          </div>
                        </td>
                        <td className="p-2">
                          <div>
                            <div className="font-medium">{realOrder.cliente_nombre}</div>
                            <div className="text-sm text-muted-foreground">{realOrder.cliente_telefono}</div>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-sm max-w-32 truncate" title={realOrder.address}>
                            {realOrder.address}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-blue-600" />
                            <span className="text-sm">{realOrder.sede}</span>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <Badge className={cn("text-white", getStatusColor(realOrder.estado))}>
                              <div className="flex items-center gap-1">
                                {getStatusIcon(realOrder.estado)}
                                {getDisplayStatus(realOrder.estado, realOrder.type_order)}
                              </div>
                            </Badge>
                            {getOrderTypeIcon(realOrder.type_order)}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="space-y-1">
                            <div
                              className={`flex items-center gap-1 ${
                                realOrder.has_multiple_payments ? 'cursor-pointer hover:bg-gray-50 p-1 rounded' : ''
                              }`}
                              onClick={() => {
                                if (realOrder.has_multiple_payments) {
                                  setSelectedPaymentOrderId(realOrder.id);
                                  setPaymentDetailsOpen(true);
                                }
                              }}
                              title={realOrder.has_multiple_payments ? 'Ver detalles de pagos múltiples' : undefined}
                            >
                              {getPaymentMethodIcon(realOrder.pago_tipo as PaymentMethod)}
                              <span className="text-xs">{realOrder.payment_display || realOrder.pago_tipo}</span>
                              {realOrder.has_multiple_payments && (
                                <span className="text-xs font-bold text-blue-600 bg-blue-100 px-1 rounded">+1</span>
                              )}
                            </div>
                            <Badge className={cn("text-white text-xs", 
                              realOrder.pago_estado === 'Pagado' ? 'bg-green-500' : 
                              realOrder.pago_estado === 'Pendiente' ? 'bg-yellow-500' : 'bg-red-500'
                            )}>
                              {realOrder.pago_estado}
                            </Badge>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{realOrder.repartidor}</span>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="space-y-1">
                            <div className="font-medium">${(realOrder.total ?? 0).toLocaleString()}</div>
                            {realOrder.descuento_valor && realOrder.descuento_valor > 0 && (
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                  Descuento: -${realOrder.descuento_valor.toLocaleString()}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-sm">
                            {realOrder.entrega_hora}
                          </div>
                        </td>
                        <td className="p-2 text-sm text-muted-foreground">
                          {realOrder.creado_hora}
                        </td>
                        <td className="p-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            {/* Botón de imprimir minuta - solo si tiene minuta_id */}
                            {realOrder.minuta_id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedOrderForMinuta(realOrder);
                                  setPrintMinutaModalOpen(true);
                                }}
                                className="h-8 w-8 p-0 border-blue-300 text-blue-600 hover:bg-blue-50"
                                title={`Imprimir minuta #${realOrder.minuta_id}`}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {/* Botón de editar - disponible para agentes hasta estado 'Cocina' */}
                            {(realOrder.estado === 'Recibidos' || realOrder.estado === 'recibidos' ||
                              realOrder.estado === 'Cocina' || realOrder.estado === 'cocina') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditOrder(realOrder.orden_id.toString())}
                                className="h-8 w-8 p-0 border-blue-300 text-blue-600 hover:bg-blue-50"
                                title={`Editar orden ${realOrder.id_display}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Botón de descuento - solo para admin_punto y admin_global en estados permitidos */}
                            {canApplyDiscount(realOrder) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDiscountOrder(realOrder)}
                                className="h-8 w-8 p-0 border-green-300 text-green-600 hover:bg-green-50"
                                title={`Aplicar descuento a ${realOrder.id_display}`}
                              >
                                <Calculator className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Botón de editar pago - disponible para todos los usuarios */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleChangePaymentMethod(realOrder)}
                              className="h-8 w-8 p-0 border-purple-300 text-purple-600 hover:bg-purple-50"
                              title={`Editar método de pago de ${realOrder.id_display}`}
                            >
                              <Repeat className="h-4 w-4" />
                            </Button>

                            {/* Botón para cambiar tipo de orden (delivery/pickup) - solo en Recibidos o Cocina */}
                            {(realOrder.estado === 'Recibidos' || realOrder.estado === 'Cocina') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleChangeOrderType(realOrder)}
                                className="h-8 w-8 p-0 border-amber-300 text-amber-600 hover:bg-amber-50"
                                title={`Cambiar tipo: ${realOrder.type_order === 'delivery' ? 'Cambiar a Recogida' : 'Cambiar a Domicilio'}`}
                              >
                                <ArrowLeftRight className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Botón de cancelar - solo para pedidos que no estén cancelados o entregados */}
                            {realOrder.estado !== 'Cancelado' && realOrder.estado !== 'Entregados' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelOrder(realOrder.orden_id.toString())}
                                className="h-8 w-8 p-0 border-red-300 text-red-600 hover:bg-red-50"
                                title={`Cancelar orden ${realOrder.id_display}`}
                              >
                                <AlertCircle className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {/* Botón para ver motivo de cancelación - solo para pedidos cancelados */}
                            {realOrder.estado === 'Cancelado' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewCancelReason(realOrder.orden_id.toString())}
                                className="h-8 w-8 p-0 border-orange-300 text-orange-600 hover:bg-orange-50"
                                title={`Ver motivo de cancelación de ${realOrder.id_display}`}
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {/* Botón de eliminar - solo para admin_global */}
                            {profile?.role === 'admin_global' && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteOrder(realOrder.orden_id, realOrder.id_display)}
                                className="h-8 w-8 p-0"
                                title={`Eliminar orden ${realOrder.id_display}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* Controles de paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Mostrando {startIndex + 1}-{Math.min(endIndex, totalItems)} de {totalItems} registros
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                
                {/* Números de página */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (currentPage <= 4) {
                      pageNum = i + 1;
                    } else if (currentPage > totalPages - 4) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = currentPage - 3 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <OrderConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        selectedOrderIds={selectedOrders}
        orders={orders}
        deliveryPersonnel={deliveryPersonnel}
        onUpdateOrders={onUpdateOrders}
        onClearSelection={() => setSelectedOrders([])}
        onRefreshData={refreshDataWithCurrentFilters}
        currentSedeId={profile?.sede_id}
      />

      {/* Modal para Transferir Pedido */}
      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Pedido</DialogTitle>
            <DialogDescription>
              Transfiere un pedido a otra sede del sistema
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transfer-order-id">ID del Pedido</Label>
              <Input
                id="transfer-order-id"
                type="text"
                placeholder="Ingresa el ID del pedido"
                value={transferOrderId}
                onChange={(e) => setTransferOrderId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-sede">Seleccionar Sede</Label>
              <Select value={transferSedeId} onValueChange={setTransferSedeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la sede destino" />
                </SelectTrigger>
                <SelectContent>
                  {sedes
                    .filter(sede => sede.id !== sedeIdToUse) // Excluir la sede actual
                    .map(sede => (
                      <SelectItem key={sede.id} value={sede.id}>
                        {sede.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setIsTransferModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleTransferOrder}
                className="flex items-center gap-2"
              >
                <Building2 className="h-4 w-4" />
                Transferir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Cancelar Pedido */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Pedido</DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea cancelar este pedido? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Motivo de Cancelación *</Label>
              <textarea
                id="cancel-reason"
                className="w-full min-h-[100px] p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Ingrese el motivo de la cancelación (obligatorio)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsCancelModalOpen(false);
                  setCancelReason('');
                  setCancelOrderId(null);
                }}
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive"
                onClick={handleConfirmCancel}
                disabled={!cancelReason.trim() || isCancelling}
                className="flex items-center gap-2"
              >
                {isCancelling ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    Confirmar Cancelación
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Ver Motivo de Cancelación */}
      <Dialog open={viewCancelModalOpen} onOpenChange={setViewCancelModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-orange-600" />
              Motivo de Cancelación
            </DialogTitle>
            <DialogDescription>
              Información sobre por qué fue cancelado este pedido
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {viewCancelData && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-900">Pedido:</Label>
                  <p className="text-sm text-gray-700 font-mono bg-gray-50 px-2 py-1 rounded">
                    {viewCancelData.orderId}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-900">Motivo de Cancelación:</Label>
                  <div className="min-h-[100px] p-3 border border-gray-300 rounded-md bg-gray-50">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {viewCancelData.reason}
                    </p>
                  </div>
                </div>

                {viewCancelData.canceledAt && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-900">Fecha de Cancelación:</Label>
                    <p className="text-sm text-gray-600">
                      {new Date(viewCancelData.canceledAt).toLocaleString('es-CO', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      })}
                    </p>
                  </div>
                )}
              </>
            )}
            
            <div className="flex justify-end">
              <Button 
                variant="outline"
                onClick={() => setViewCancelModalOpen(false)}
                className="flex items-center gap-2"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Pausar Pedidos */}
      <Dialog open={isPauseModalOpen} onOpenChange={setIsPauseModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PowerOff className="h-5 w-5 text-red-600" />
              Pausar Pedidos
            </DialogTitle>
            <DialogDescription>
              Pausa la recepción de todos los nuevos pedidos
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Información de pausa */}
            <div className="space-y-3">
              <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
                <div className="flex items-center gap-2 mb-2">
                  <PowerOff className="h-5 w-5 text-blue-600" />
                  <Label className="text-sm font-medium text-blue-900">Pausa Global</Label>
                </div>
                <p className="text-sm text-blue-700">
                  Se pausará la recepción de todos los nuevos pedidos en el sistema.
                </p>
              </div>
            </div>

            {/* Timer automático */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="pause-timer" className="text-sm font-medium text-gray-900">
                  Timer Automático (opcional):
                </Label>
                <span className="text-xs text-gray-500">en minutos</span>
              </div>
              <Input
                id="pause-timer"
                type="number"
                placeholder="Ej: 30"
                value={pauseTimer}
                onChange={(e) => setPauseTimer(e.target.value)}
                min="1"
                max="480"
                className="text-center"
              />
              <p className="text-xs text-gray-500">
                Déjalo vacío para pausar manualmente. Máximo 480 minutos (8 horas).
              </p>
            </div>

            {/* Resumen de la acción */}
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-red-800">
                <strong>Resumen:</strong>
                <br />
                • Se pausarán todos los pedidos
                {pauseTimer && parseInt(pauseTimer) > 0 && (
                  <>
                    <br />
                    • Se reactivarán automáticamente en {pauseTimer} minutos
                  </>
                )}
                {(!pauseTimer || parseInt(pauseTimer) === 0) && (
                  <>
                    <br />
                    • Deberás reactivar manualmente
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsPauseModalOpen(false);
                setPauseOption('global');
                setPauseTimer('');
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handlePauseOrders}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <PowerOff className="h-4 w-4" />
              Pausar Pedidos
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para ver detalles del pedido */}
      <OrderDetailsModal
        isOpen={orderDetailsModalOpen}
        onClose={() => {
          setOrderDetailsModalOpen(false);
          setSelectedOrderId(null);
        }}
        orderId={selectedOrderId}
      />

      {/* Modal para ver detalles de pagos múltiples */}
      <PaymentDetailsModal
        isOpen={paymentDetailsOpen}
        onClose={() => {
          setPaymentDetailsOpen(false);
          setSelectedPaymentOrderId(null);
        }}
        orderId={selectedPaymentOrderId}
      />

      {/* Modal para imprimir minuta */}
      <MinutaModal
        isOpen={printMinutaModalOpen}
        onClose={() => {
          setPrintMinutaModalOpen(false);
          setSelectedOrderForMinuta(null);
        }}
        orderId={selectedOrderForMinuta?.orden_id || 0}
      />

      {/* Modal para editar orden */}
      <EditOrderModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingOrderId(null);
        }}
        orderId={editingOrderId}
        order={editingOrderId ? orders.find(order => order.orden_id.toString() === editingOrderId) || null : null}
        onOrderUpdated={refreshDataWithCurrentFilters}
      />

      {/* Modal para aplicar descuento */}
      <DiscountDialog
        isOpen={isDiscountDialogOpen}
        onClose={() => {
          setIsDiscountDialogOpen(false);
          setSelectedOrderForDiscount(null);
        }}
        order={selectedOrderForDiscount ? {
          orden_id: selectedOrderForDiscount.orden_id,
          id_display: selectedOrderForDiscount.id_display,
          cliente_nombre: selectedOrderForDiscount.cliente_nombre,
          total: selectedOrderForDiscount.total,
          estado: selectedOrderForDiscount.estado,
          pago_estado: selectedOrderForDiscount.pago_estado,
          sede: selectedOrderForDiscount.sede
        } : null}
        onDiscountApplied={handleDiscountApplied}
      />

      {/* Modal para cambiar método de pago */}
      {selectedOrderForPaymentChange && (
        <ChangePaymentMethodModal
          isOpen={changePaymentModalOpen}
          onClose={() => {
            setChangePaymentModalOpen(false);
            setSelectedOrderForPaymentChange(null);
          }}
          orderId={selectedOrderForPaymentChange.orderId}
          currentPaymentMethod={selectedOrderForPaymentChange.currentPaymentMethod}
          onPaymentMethodChanged={() => {
            // Recargar datos después del cambio
            refreshDataWithCurrentFilters();
          }}
        />
      )}

      {/* Modal para cambiar tipo de orden (delivery/pickup) */}
      {selectedOrderForTypeChange && (
        <ChangeOrderTypeDialog
          open={isChangeOrderTypeDialogOpen}
          onOpenChange={setIsChangeOrderTypeDialogOpen}
          order={selectedOrderForTypeChange}
          onSuccess={() => {
            // Recargar datos después del cambio
            refreshDataWithCurrentFilters();
          }}
        />
      )}

      {/* Modal para crear nuevo pedido */}
      <Dialog open={showCreateOrderModal} onOpenChange={(open) => {
        setShowCreateOrderModal(open);
        if (!open) {
          setNewOrder({
            address: '',
            deliveryInstructions: '',
            items: [],
            paymentMethod: 'cash',
            specialInstructions: '',
            deliveryType: 'delivery',
            pickupSede: '',
            deliveryTimeMinutes: 90,
            deliveryCost: 0,
            cutleryCount: 0,
            cutleryManuallyAdjusted: false,
            hasMultiplePayments: false,
            paymentMethod2: 'cash',
            paymentAmount1: 0,
            paymentAmount2: 0
          });
          setCustomerData({
            name: '',
            phone: '',
            address: ''
          });
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Pedido - Sede {currentSedeName}</DialogTitle>
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
            {/* Datos del Cliente */}
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
                <div className="relative">
                  <Input
                    id="customerPhone"
                    type="tel"
                    value={customerData.phone}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Ingrese el teléfono del cliente"
                    className={searchingCustomer ? 'pr-8' : ''}
                  />
                  {searchingCustomer && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                      <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>

              {foundCustomer && (
                <div className="text-sm text-green-600 flex items-center gap-2 bg-green-50 p-2 rounded-md">
                  <User className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Cliente encontrado: {foundCustomer.nombre}</div>
                    <div className="text-xs">Datos completados automáticamente (solo campos vacíos)</div>
                  </div>
                </div>
              )}

              {!foundCustomer && customerData.phone.length >= 7 && !searchingCustomer && (
                <div className="text-sm text-blue-600 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Cliente nuevo - Se creará automáticamente
                </div>
              )}
            </div>

            <div>
              <Label>Tipo de Entrega</Label>
              <RadioGroup
                value={newOrder.deliveryType}
                onValueChange={(value: 'delivery' | 'pickup') => setNewOrder({
                  ...newOrder,
                  deliveryType: value,
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
                  <Label htmlFor="deliveryInstructions">Indicaciones</Label>
                  <Input
                    id="deliveryInstructions"
                    value={newOrder.deliveryInstructions}
                    onChange={(e) => setNewOrder({ ...newOrder, deliveryInstructions: e.target.value })}
                    placeholder="Ej: Torre 3 Apto 401"
                  />
                </div>

                <div>
                  <Label htmlFor="deliveryCost">Valor del Domicilio *</Label>
                  <div className="relative">
                    <Input
                      id="deliveryCost"
                      type="text"
                      value={newOrder.deliveryCost === 0 ? '' : newOrder.deliveryCost.toString()}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        const numericValue = value === '' ? 0 : parseInt(value, 10);
                        setNewOrder({ ...newOrder, deliveryCost: numericValue });
                      }}
                      placeholder="Ingrese el valor del domicilio (ej: 6000)"
                      disabled={searchingPrice}
                      className={searchingPrice ? 'pr-8' : ''}
                    />
                    {searchingPrice && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {searchingPrice ? 'Buscando precio basado en la dirección...' :
                     'Si es 0, se mostrará una confirmación antes de crear el pedido'}
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
              <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
                <div className="text-sm font-medium text-blue-700">
                  Segundo método de pago
                </div>

                <div className="space-y-3">
                  {/* Segundo método de pago */}
                  <div className="space-y-2">
                    <Label className="text-sm">Método adicional</Label>
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

                  <div className="space-y-2">
                    <Label className="text-sm">¿Cuánto paga con este método?</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newOrder.paymentAmount2 || ''}
                      onChange={(e) => {
                        const amount2 = parseFloat(e.target.value) || 0;
                        const total = calculateTotal();
                        const amount1 = Math.max(0, total - amount2);

                        setNewOrder({
                          ...newOrder,
                          paymentAmount2: amount2,
                          paymentAmount1: amount1
                        });
                      }}
                    />
                  </div>

                  {/* Mostrar cálculo automático */}
                  {newOrder.paymentAmount2 > 0 && (
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <div className="text-sm text-blue-800">
                        <div className="flex justify-between">
                          <span>Total del pedido:</span>
                          <span className="font-medium">${calculateTotal().toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pago con {newOrder.paymentMethod2 === 'cash' ? 'efectivo' :
                                          newOrder.paymentMethod2 === 'card' ? 'tarjeta' :
                                          newOrder.paymentMethod2 === 'nequi' ? 'Nequi' : 'transferencia'}:</span>
                          <span className="font-medium">-${newOrder.paymentAmount2.toLocaleString()}</span>
                        </div>
                        <hr className="my-1 border-blue-300" />
                        <div className="flex justify-between font-medium">
                          <span>Restante con {newOrder.paymentMethod === 'cash' ? 'efectivo' :
                                            newOrder.paymentMethod === 'card' ? 'tarjeta' :
                                            newOrder.paymentMethod === 'nequi' ? 'Nequi' : 'transferencia'}:</span>
                          <span>${Math.max(0, calculateTotal() - newOrder.paymentAmount2).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Validación */}
                  {newOrder.paymentAmount2 > calculateTotal() && (
                    <div className="text-red-600 flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      El monto no puede ser mayor al total del pedido
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <Label>Productos Disponibles en {currentSedeName}</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded p-2">
                {loadingSedeProducts ? (
                  <p className="text-center text-gray-500">Cargando productos de la sede...</p>
                ) : (
                  <>
                    {sedeProducts.platos.map((item) => (
                      <div key={`plato-${item.id}`} className="flex items-center justify-between p-2 border rounded bg-green-50">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-600">${(item.pricing ?? 0).toLocaleString()}</p>
                          <span className="text-xs bg-green-100 text-green-800 px-1 rounded">Disponible</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => decrementItem('plato', item.id)}
                          >
                            −
                          </Button>
                          <span className="w-8 text-center font-mono">{getItemCount('plato', item.id)}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => incrementItem('plato', item.id)}
                            className="bg-brand-primary text-white hover:bg-brand-primary/90"
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    ))}
                    {sedeProducts.bebidas.map((item) => (
                      <div key={`bebida-${item.id}`} className="flex items-center justify-between p-2 border rounded bg-blue-50">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-600">${(item.pricing ?? 0).toLocaleString()}</p>
                          <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">Disponible</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => decrementItem('bebida', item.id)}
                          >
                            −
                          </Button>
                          <span className="w-8 text-center font-mono">{getItemCount('bebida', item.id)}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => incrementItem('bebida', item.id)}
                            className="bg-brand-primary text-white hover:bg-brand-primary/90"
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    ))}
                    {sedeProducts.platos.length === 0 && sedeProducts.bebidas.length === 0 && (
                      <div className="col-span-2 text-center py-4">
                        <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                        <p className="text-sm text-gray-500">No hay productos disponibles en esta sede</p>
                        <p className="text-xs text-gray-400">Contacta al administrador para activar productos</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div>
              <Label>Toppings Extra Disponibles en {currentSedeName}</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                {loadingSedeProducts ? (
                  <p className="text-center text-gray-500">Cargando toppings de la sede...</p>
                ) : sedeProducts.toppings.length === 0 ? (
                  <div className="col-span-2 text-center py-4">
                    <AlertTriangle className="h-6 w-6 mx-auto text-amber-500 mb-2" />
                    <p className="text-sm text-gray-500">No hay toppings disponibles en esta sede</p>
                    <p className="text-xs text-gray-400">Contacta al administrador para activar toppings</p>
                  </div>
                ) : (
                  <>
                    {sedeProducts.toppings.map((item) => (
                      <div key={`topping-${item.id}`} className="flex items-center justify-between p-2 border rounded bg-orange-50">
                        <div>
                          <p className="font-medium text-orange-800">{item.name}</p>
                          <p className="text-sm text-orange-600">${(item.pricing ?? 0).toLocaleString()}</p>
                          <span className="text-xs bg-orange-100 text-orange-800 px-1 rounded">Disponible</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => decrementTopping(item.id)}
                          >
                            −
                          </Button>
                          <span className="w-8 text-center font-mono">{getItemCount('topping', item.id)}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => incrementTopping(item.id)}
                            className="bg-orange-500 text-white hover:bg-orange-600"
                          >
                            +
                          </Button>
                        </div>
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
                    const [productType, realProductId] = item.productId.split('_');

                    let product = null;
                    let itemBgColor = 'bg-gray-50';
                    let itemTextColor = 'text-gray-600';

                    if (productType === 'plato') {
                      product = sedeProducts.platos.find(p => p.id.toString() === realProductId) ||
                               platos.find(p => p.id.toString() === realProductId);
                    } else if (productType === 'bebida') {
                      product = sedeProducts.bebidas.find(b => b.id.toString() === realProductId) ||
                               bebidas.find(b => b.id.toString() === realProductId);
                    } else if (productType === 'topping') {
                      product = sedeProducts.toppings.find(t => t.id.toString() === realProductId) ||
                               toppings.find(t => t.id.toString() === realProductId);
                      itemBgColor = 'bg-orange-50';
                      itemTextColor = 'text-orange-600';
                    }

                    return (
                      <div key={item.productId} className={`flex items-center justify-between p-2 ${itemBgColor} rounded`}>
                        <div>
                          <p className="font-medium">{product?.name}
                            {productType === 'topping' && (
                              <span className="ml-2 px-2 py-1 text-xs bg-orange-200 text-orange-800 rounded">Extra</span>
                            )}
                          </p>
                          <p className={`text-sm ${itemTextColor}`}>
                            Cantidad: {item.quantity} × ${(product?.pricing ?? 0).toLocaleString()}
                          </p>
                          {productType === 'plato' && (
                            <p className="text-xs text-muted-foreground">Incluye cubiertos por defecto</p>
                          )}
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
                    {/* Cubiertos control */}
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">Cubiertos</p>
                        <p className="text-xs text-muted-foreground">1 por plato principal. Ajusta si es necesario.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => setNewOrder(prev => ({
                            ...prev,
                            cutleryCount: Math.max(0, prev.cutleryCount - 1),
                            cutleryManuallyAdjusted: true
                          }))}
                        >
                          −
                        </Button>
                        <span className="w-8 text-center font-mono">{newOrder.cutleryCount}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => setNewOrder(prev => ({
                            ...prev,
                            cutleryCount: prev.cutleryCount + 1,
                            cutleryManuallyAdjusted: true
                          }))}
                        >
                          +
                        </Button>
                      </div>
                    </div>
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
                newOrder.items.length === 0 ||
                sedeOrdersLoading
              }
              className="w-full bg-brand-primary hover:bg-brand-primary/90"
            >
              {sedeOrdersLoading ? 'Creando...' : 'Crear Pedido'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para domicilio con valor 0 */}
      <Dialog open={showZeroDeliveryConfirm} onOpenChange={setShowZeroDeliveryConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Domicilio Gratis</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>¿Está seguro que desea crear un pedido con domicilio gratis (valor $0)?</p>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowZeroDeliveryConfirm(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={executeCreateOrder}
                className="bg-brand-primary hover:bg-brand-primary/90"
              >
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
