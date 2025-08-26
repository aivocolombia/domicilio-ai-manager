
import React, { useState, useEffect } from 'react';
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
  MessageCircle
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
import { cn } from '@/lib/utils';
import { useDashboard } from '@/hooks/useDashboard';
import { DashboardOrder } from '@/services/dashboardService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { sedeOrdersService } from '@/services/sedeOrdersService';
import { supabase } from '@/lib/supabase';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import { useAgentDebug } from '@/hooks/useAgentDebug';

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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Estados para filtros de fecha
  const [dateFilter, setDateFilter] = useState<'today' | 'custom'>('today'); // Default: Solo hoy
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: new Date(), // Hoy por defecto
    to: new Date()    // Hoy por defecto
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  // Estados para transferir pedido
  const [transferOrderId, setTransferOrderId] = useState('');
  const [transferSedeId, setTransferSedeId] = useState('');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [sedes, setSedes] = useState<Array<{ id: string; name: string }>>([]);

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
  const [pauseOption, setPauseOption] = useState<'agent' | 'global'>('agent');
  const [pauseTimer, setPauseTimer] = useState<string>('');
  const [pauseTimerActive, setPauseTimerActive] = useState(false);

  // Estados para ordenamiento
  const [sortField, setSortField] = useState<keyof DashboardOrder>('creado_fecha');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Obtener datos del usuario autenticado
  const { user, profile } = useAuth();
  
  // Debug para agentes
  const agentDebug = useAgentDebug();
  
  // Debug: Log user information (solo en desarrollo)
  if (process.env.NODE_ENV === 'development') {
    console.log('🏠 Dashboard: Usuario autenticado:', user);
    console.log('👤 Dashboard: Perfil del usuario:', profile);
    console.log('🏢 Dashboard: Sede ID del usuario:', profile?.sede_id);
    console.log('🏷️ Dashboard: Tipo de sede_id:', typeof profile?.sede_id);
  }

  // Hook para datos reales del dashboard
  // Usar effectiveSedeId cuando esté disponible (admin) o sede_id del usuario (agente)
  const sedeIdToUse = effectiveSedeId || profile?.sede_id;

  // Cargar sedes cuando se abra el modal de transferencia
  useEffect(() => {
    if (isTransferModalOpen) {
      loadSedes();
    }
  }, [isTransferModalOpen]);
  
  // Debug: Log sede information
  console.log('🏢 Dashboard: Effective Sede ID (Admin):', effectiveSedeId);
  console.log('🏢 Dashboard: Sede ID del usuario:', profile?.sede_id);
  console.log('🎯 Dashboard: Sede ID a usar:', sedeIdToUse);

  // Cargar sedes disponibles
  const loadSedes = async () => {
    try {
      const { data: sedesData, error } = await supabase
        .from('sedes')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('❌ Error cargando sedes:', error);
        return;
      }

      setSedes(sedesData || []);
    } catch (error) {
      console.error('❌ Error al cargar sedes:', error);
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
        loadDashboardOrders();
      }
    } catch (error) {
      console.error('Error transfiriendo pedido:', error);
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
      console.log('🔍 Obteniendo motivo de cancelación para pedido:', orderId);
      
      const { data, error } = await supabase
        .from('ordenes')
        .select('motivo_cancelacion, cancelado_at, id')
        .eq('id', parseInt(orderId))
        .single();

      if (error) {
        console.error('❌ Error obteniendo motivo de cancelación:', error);
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
      console.error('❌ Error inesperado:', error);
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
      
      console.log('🔍 DEBUG: Cancelando pedido:', {
        orderId: cancelOrderId,
        orderIdType: typeof cancelOrderId,
        reason: cancelReason.trim()
      });

      // Convertir orderId a número si es necesario
      const orderIdNumber = parseInt(cancelOrderId, 10);
      
      if (isNaN(orderIdNumber)) {
        throw new Error('ID de pedido inválido');
      }

      console.log('🔍 DEBUG: Order ID convertido:', orderIdNumber);
      
      // Primero verificar si la orden existe y obtener su estructura
      console.log('🔍 DEBUG: Verificando orden antes de actualizar...');
      const { data: orderCheck, error: checkError } = await supabase
        .from('ordenes')
        .select('id, status, created_at')
        .eq('id', orderIdNumber)
        .single();

      if (checkError) {
        console.error('❌ Error verificando orden:', checkError);
        throw new Error('No se pudo verificar la orden');
      }

      if (!orderCheck) {
        throw new Error('Orden no encontrada');
      }

      console.log('✅ Orden encontrada:', orderCheck);
      
      // Primero verificar qué valores válidos tiene el campo status
      console.log('🔍 DEBUG: Verificando valores válidos para status...');
      
      // Verificar valores existentes en la tabla
      const { data: existingOrders, error: existingError } = await supabase
        .from('ordenes')
        .select('status')
        .limit(10);
      
      if (existingError) {
        console.log('❌ Error obteniendo status existentes:', existingError);
      } else {
        console.log('✅ Status existentes en la tabla:', existingOrders?.map(o => o.status));
        
        // Verificar si hay algún status que contenga "Cancelado"
        const cancelStatuses = existingOrders?.filter(o => 
          o.status && o.status.includes('Cancelado')
        );
        console.log('🔍 Status que contienen "Cancelado":', cancelStatuses);
      }
      
      let statusUpdated = false;
      
      // Intentar actualizar el status a 'Cancelado'
      console.log(`🔍 Intentando actualizar status a: "Cancelado"`);
      
      const { error: statusError } = await supabase
        .from('ordenes')
        .update({ status: 'Cancelado' })
        .eq('id', orderIdNumber);
      
      if (statusError) {
        console.log(`❌ Status "Cancelado" falló:`, statusError.message);
        console.log(`🔍 Detalles del error:`, statusError);
        throw statusError;
      } else {
        console.log(`✅ Status actualizado exitosamente a: "Cancelado"`);
        statusUpdated = true;
      }
      
      if (!statusUpdated) {
        console.error('❌ No se pudo actualizar el status con ningún valor válido');
        throw lastError || new Error('No se pudo actualizar el status');
      }

      console.log('✅ Status actualizado exitosamente');

      // Ahora intentar actualizar los campos adicionales
      console.log('🔍 DEBUG: Intentando actualizar campos adicionales...');
      
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
          console.log('✅ Motivo de cancelación guardado');
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
          console.log('✅ Timestamp de cancelación guardado');
        }
      } catch (e) {
        console.warn('⚠️ No se pudo guardar timestamp de cancelación:', e);
      }

      // La actualización se completó exitosamente
      console.log('✅ Cancelación completada');

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
        loadDashboardOrders();
      }
    } catch (error) {
      console.error('Error cancelando pedido:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo cancelar el pedido",
        variant: "destructive"
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Función para descargar órdenes como CSV (solo admins)
  const downloadOrdersAsCSV = () => {
    if (!orders || orders.length === 0) {
      toast({
        title: "No hay datos",
        description: "No hay órdenes disponibles para descargar",
        variant: "destructive"
      });
      return;
    }

    // Preparar datos para CSV usando los campos correctos de la interfaz DashboardOrder
    const csvData = orders.map(order => ({
      'ID Pedido': order.id_display || '',
      'ID Interno': order.orden_id || '',
      'Cliente': order.cliente_nombre || '',
      'Teléfono': order.cliente_telefono || '',
      'Dirección': order.direccion || '',
      'Sede': order.sede || '',
      'Estado': order.estado || '',
      'Total': order.total ? `$${order.total.toLocaleString()}` : '$0',
      'Tipo Pago': order.pago_tipo || '',
      'Estado Pago': order.pago_estado || '',
      'Fecha Creación': order.creado_fecha || '',
      'Hora Creación': order.creado_hora || '',
      'Hora Entrega': order.entrega_hora || '',
      'Repartidor': order.repartidor || '',
      'Payment ID': order.payment_id || ''
    }));

    // Convertir a CSV
    const csvHeaders = Object.keys(csvData[0]).join(',');
    const csvRows = csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','));
    const csvContent = [csvHeaders, ...csvRows].join('\n');

    // Descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ordenes_${currentSedeName || 'sede'}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Descarga completada",
      description: `Se descargaron ${orders.length} órdenes en formato CSV`,
    });
  };
  const { 
    orders: realOrders, 
    stats, 
    loading, 
    error, 
    loadDashboardOrders,
    filterOrdersByStatus, 
    refreshData,
    deleteOrder
  } = useDashboard(sedeIdToUse);

  // Usar SOLO datos reales - NUNCA datos legacy para evitar mostrar datos dummy
  // Una sede nueva debe mostrar dashboard vacío, no datos dummy
  const orders = realOrders;

  // Función debounced para aplicar filtros y evitar llamadas excesivas
  const debouncedLoadOrders = useDebouncedCallback(loadDashboardOrders, 500);

  // Función de ordenamiento
  const handleSort = (field: keyof DashboardOrder) => {
    if (sortField === field) {
      // Cambiar dirección si es el mismo campo
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Nuevo campo, empezar con descendente
      setSortField(field);
      setSortDirection('desc');
    }
    // Resetear a primera página cuando se cambia el ordenamiento
    setCurrentPage(1);
  };

  // Función para obtener icono de ordenamiento
  const getSortIcon = (field: keyof DashboardOrder) => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-4 w-4 inline ml-1 text-blue-600" />
    ) : (
      <ArrowDown className="h-4 w-4 inline ml-1 text-blue-600" />
    );
  };

  // Aplicar filtros primero
  const filteredOrders = orders.filter(order => {
    // Solo datos reales - no más datos legacy/dummy
    const realOrder = order as DashboardOrder;
    const matchesSearch = realOrder.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         realOrder.cliente_telefono.includes(searchTerm) ||
                         realOrder.id_display.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         realOrder.direccion.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || realOrder.estado === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Aplicar ordenamiento a las órdenes filtradas
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    // Manejar diferentes tipos de datos
    let comparison = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else {
      // Convertir a string para comparar
      comparison = String(aVal || '').localeCompare(String(bVal || ''));
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Aplicar paginación
  const totalItems = sortedOrders.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = sortedOrders.slice(startIndex, endIndex);

  // Función para aplicar filtros de fecha
  const applyDateFilter = async () => {
    let filters: any = {};
    
    if (dateFilter === 'today') {
      console.log('🔍 DASHBOARD: Aplicando filtro "hoy"');
      
      const today = new Date();
      console.log('🕐 Fecha de hoy:', today.toLocaleDateString('es-CO'));
      
      // Crear rango simple: desde las 00:00 hasta las 23:59 del día actual
      // IMPORTANTE: usar zona horaria local sin conversiones UTC problemáticas
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      
      // Crear las fechas de consulta en formato ISO pero ajustadas a zona horaria local
      // Esto evita el problema de "+1 día" causado por conversiones UTC
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      
      const fechaInicio = `${year}-${month}-${day}T00:00:00Z`;
      const fechaFin = `${year}-${month}-${day}T23:59:59Z`;
      
      console.log('🗺 Rango de consulta (corregido):', {
        fechaHoy: today.toLocaleDateString('es-CO'),
        fechaInicio,
        fechaFin
      });
      
      filters.fechaInicio = fechaInicio;
      filters.fechaFin = fechaFin;
      
      console.log('📅 DASHBOARD: Filtros finales aplicados:', { 
        fechaInicio: filters.fechaInicio, 
        fechaFin: filters.fechaFin,
        fechaSistema: today.toLocaleDateString('es-CO')
      });
    } else if (dateFilter === 'custom' && dateRange.from && dateRange.to) {
      // Filtro personalizado con rango de fechas
      const fromYear = dateRange.from.getFullYear();
      const fromMonth = String(dateRange.from.getMonth() + 1).padStart(2, '0');
      const fromDay = String(dateRange.from.getDate()).padStart(2, '0');
      
      const toYear = dateRange.to.getFullYear();
      const toMonth = String(dateRange.to.getMonth() + 1).padStart(2, '0');
      const toDay = String(dateRange.to.getDate()).padStart(2, '0');
      
      filters.fechaInicio = `${fromYear}-${fromMonth}-${fromDay}T00:00:00Z`;
      filters.fechaFin = `${toYear}-${toMonth}-${toDay}T23:59:59Z`;
      
      console.log('📅 Aplicando filtro personalizado:', { 
        desde: dateRange.from.toLocaleDateString('es-CO'),
        hasta: dateRange.to.toLocaleDateString('es-CO'),
        fechaInicio: filters.fechaInicio, 
        fechaFin: filters.fechaFin 
      });
    }
    
    // Aplicar también el filtro de estado actual si existe
    if (statusFilter && statusFilter !== 'all') {
      filters.estado = statusFilter;
    }
    
    // Llamar directamente a loadDashboardOrders con timeout
    setTimeout(() => {
      if (sedeIdToUse) {
        loadDashboardOrders(filters);
      }
    }, 0);
  };

  // Aplicar filtro de fecha cuando cambie el tipo de filtro (con timeout para evitar bucles)
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    
    const applyFilters = () => {
      // Debounce de 300ms para evitar llamadas excesivas
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        if (profile?.sede_id && isMounted) {
          try {
            await applyDateFilter();
          } catch (error) {
            console.error('❌ Error aplicando filtros:', error);
          }
        }
      }, 300);
    };
    
    applyFilters();
    
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [dateFilter, dateRange, profile?.sede_id, statusFilter]);

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
    const pauseTypeText = pauseOption === 'agent' ? 'para este agente' : 'globalmente';
    const timerText = minutes > 0 ? ` por ${minutes} minutos` : '';
    
    toast({
      title: "Pedidos Pausados",
      description: `Los pedidos han sido pausados ${pauseTypeText}${timerText}`,
    });
    
    // Set up automatic reactivation if timer is set
    if (minutes > 0) {
      setPauseTimerActive(true);
      setTimeout(() => {
        toggleAcceptingOrders(); // Reactivate
        setPauseTimerActive(false);
        toast({
          title: "Pedidos Reactivados",
          description: `Los pedidos se han reactivado automáticamente después de ${minutes} minutos`,
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
    if (!profile || profile.role !== 'admin') {
      toast({
        title: "Acceso denegado",
        description: "Solo los administradores pueden eliminar órdenes",
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
      console.error('Error eliminando orden:', error);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Manejar error
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>Error: {error}</span>
        </div>
        <Button onClick={refreshData}>Reintentar</Button>
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
          <h1 className="text-3xl font-bold">Dashboard de Domicilios</h1>
          <p className="text-muted-foreground">
            {activeOrdersCount} pedidos activos • {stats.total} pedidos totales
          </p>
          <p className="text-sm text-blue-600 font-medium">
            Sede: {profile?.sede_name || profile?.sede_id || 'Sede actual'}
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button
            onClick={refreshData}
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Cargando...' : 'Recargar'}
          </Button>
          
          {/* Botón de descarga CSV - Solo para administradores */}
          {profile?.role === 'admin' && (
            <Button
              onClick={downloadOrdersAsCSV}
              disabled={loading || !orders || orders.length === 0}
              variant="outline"
              className="flex items-center gap-2"
              title={`Descargar ${orders?.length || 0} órdenes como CSV`}
            >
              <Download className="h-4 w-4" />
              Descargar CSV ({orders?.length || 0})
            </Button>
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
          
          <Button
            onClick={() => setIsTransferModalOpen(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Building2 className="h-4 w-4" />
            Transferir Pedido
          </Button>
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
                  { value: 'all', label: 'Todos' },
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
                  <th className="text-left p-2 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('cliente_nombre')}>
                    Cliente {getSortIcon('cliente_nombre')}
                  </th>
                  <th className="text-left p-2 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('direccion')}>
                    Dirección {getSortIcon('direccion')}
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
                    <td colSpan={13} className="p-8 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Cargando órdenes...
                      </div>
                    </td>
                  </tr>
                ) : paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-muted-foreground">
                      No se encontraron órdenes
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => {
                    const realOrder = order as DashboardOrder;
                    return (
                      <tr key={realOrder.orden_id} className={`border-b ${
                        realOrder.estado === 'Cancelado' || realOrder.estado === 'Entregados' 
                          ? 'bg-gray-50 opacity-75' 
                          : 'hover:bg-muted/50'
                      }`}>
                        <td className="p-2">
                          <Checkbox
                            checked={selectedOrders.includes(realOrder.id_display)}
                            onCheckedChange={(checked) => handleSelectOrder(realOrder.id_display, checked as boolean)}
                            disabled={realOrder.estado === 'Cancelado' || realOrder.estado === 'Entregados'}
                            className={realOrder.estado === 'Cancelado' || realOrder.estado === 'Entregados' ? 'opacity-50 cursor-not-allowed' : ''}
                          />
                        </td>
                        <td className="p-2 font-mono text-sm">{realOrder.id_display}</td>
                        <td className="p-2">
                          <div>
                            <div className="font-medium">{realOrder.cliente_nombre}</div>
                            <div className="text-sm text-muted-foreground">{realOrder.cliente_telefono}</div>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-sm max-w-32 truncate" title={realOrder.direccion}>
                            {realOrder.direccion}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-blue-600" />
                            <span className="text-sm">{realOrder.sede}</span>
                          </div>
                        </td>
                        <td className="p-2">
                          <Badge className={cn("text-white", getStatusColor(realOrder.estado))}>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(realOrder.estado)}
                              {realOrder.estado}
                            </div>
                          </Badge>
                        </td>
                        <td className="p-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <CreditCard className="h-4 w-4" />
                              <span className="text-xs">{realOrder.pago_tipo}</span>
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
                        <td className="p-2 font-medium">${realOrder.total.toLocaleString()}</td>
                        <td className="p-2">
                          <div className="text-sm">
                            {realOrder.entrega_hora}
                          </div>
                        </td>
                        <td className="p-2 text-sm text-muted-foreground">
                          {realOrder.creado_hora}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
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
                            
                            {/* Botón de eliminar - solo para admins */}
                            {profile?.role === 'admin' && (
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
        onRefreshData={refreshData}
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
              Configura como pausar la recepción de nuevos pedidos
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Opciones de pausa */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-900">Tipo de Pausa:</Label>
              <RadioGroup 
                value={pauseOption} 
                onValueChange={(value: 'agent' | 'global') => setPauseOption(value)}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="agent" id="pause-agent" />
                  <div className="flex-1">
                    <Label htmlFor="pause-agent" className="font-medium cursor-pointer">
                      Pausar para este Agente
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">
                      Solo este agente dejará de recibir pedidos
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="global" id="pause-global" />
                  <div className="flex-1">
                    <Label htmlFor="pause-global" className="font-medium cursor-pointer">
                      Pausar Globalmente
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">
                      Se pausarán los pedidos para toda la sede
                    </p>
                  </div>
                </div>
              </RadioGroup>
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
                • Se pausarán los pedidos {pauseOption === 'agent' ? 'para este agente' : 'globalmente'}
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
                setPauseOption('agent');
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
    </div>
  );
};
