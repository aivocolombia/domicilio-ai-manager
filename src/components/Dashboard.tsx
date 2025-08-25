
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
  Trash2
} from 'lucide-react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

  // Obtener datos del usuario autenticado
  const { user, profile } = useAuth();

  // Debug: Log user information
  console.log('🏠 Dashboard: Usuario autenticado:', user);
  console.log('👤 Dashboard: Perfil del usuario:', profile);
  console.log('🏢 Dashboard: Sede ID del usuario:', profile?.sede_id);
  console.log('🏷️ Dashboard: Tipo de sede_id:', typeof profile?.sede_id);

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

    // Preparar datos para CSV
    const csvData = orders.map(order => ({
      'ID': order.id,
      'Cliente': order.nombre_cliente || '',
      'Teléfono': order.telefono_cliente || '',
      'Dirección': order.direccion || '',
      'Estado': order.status || '',
      'Total': order.total || 0,
      'Método de Pago': order.metodo_pago || '',
      'Fuente': order.fuente || '',
      'Sede': currentSedeName || '',
      'Fecha Creación': order.created_at ? new Date(order.created_at).toLocaleDateString('es-ES') : '',
      'Fecha Entrega': order.entregado_at ? new Date(order.entregado_at).toLocaleDateString('es-ES') : '',
      'Tiempo Total (min)': order.min_total_desde_recibidos || '',
      'Repartidor': order.repartidor_nombre || ''
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

  // Función para aplicar filtros de fecha
  const applyDateFilter = async () => {
    let filters: any = {};
    
    if (dateFilter === 'today') {
      // Ejecutar diagnóstico completo
      console.log('🔍 DASHBOARD: Iniciando diagnóstico de filtro "hoy"');
      debugTodayFilter();
      
      // Filtrar solo hoy usando zona horaria local
      const today = new Date();
      console.log('🕐 Fecha actual del sistema:', {
        fecha: today.toLocaleDateString('es-CO'),
        hora: today.toLocaleTimeString('es-CO'),
        timestamp: today.toISOString(),
        timezone: today.getTimezoneOffset()
      });
      
      const dateRange = createDateRangeForQuery(today, today);
      
      filters.fechaInicio = dateRange.fechaInicio;
      filters.fechaFin = dateRange.fechaFin;
      
      console.log('📅 DASHBOARD: Filtros finales aplicados:', { 
        fechaInicio: filters.fechaInicio, 
        fechaFin: filters.fechaFin,
        fechaSistema: today.toLocaleDateString('es-CO')
      });
    } else if (dateFilter === 'custom' && dateRange.from && dateRange.to) {
      // Filtro personalizado con rango de fechas usando zona horaria local
      const rangeQuery = createDateRangeForQuery(dateRange.from, dateRange.to);
      
      filters.fechaInicio = rangeQuery.fechaInicio;
      filters.fechaFin = rangeQuery.fechaFin;
      
      console.log('📅 Aplicando filtro personalizado (Colombia):', { fechaInicio: filters.fechaInicio, fechaFin: filters.fechaFin });
    }
    
    // Aplicar también el filtro de estado actual si existe
    if (statusFilter && statusFilter !== 'all') {
      filters.estado = statusFilter;
    }
    
    await loadDashboardOrders(filters);
  };

  // Aplicar filtro de fecha cuando cambie el tipo de filtro
  useEffect(() => {
    if (profile?.sede_id) {
      applyDateFilter();
    }
  }, [dateFilter, dateRange, profile?.sede_id, statusFilter, loadDashboardOrders]);

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
      setSelectedOrders(filteredOrders.map(order => order.id));
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
            onClick={toggleAcceptingOrders}
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
                checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-muted-foreground">Seleccionar todos</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 w-12"></th>
                  <th className="text-left p-2">ID</th>
                  <th className="text-left p-2">Cliente</th>
                  <th className="text-left p-2">Dirección</th>
                  <th className="text-left p-2">Sede</th>
                  <th className="text-left p-2">Estado</th>
                  <th className="text-left p-2">Pago</th>
                  <th className="text-left p-2">Repartidor</th>
                  <th className="text-left p-2">Total</th>
                  <th className="text-left p-2">Entrega</th>
                  <th className="text-left p-2">Creado</th>
                  {profile?.role === 'admin' && (
                    <th className="text-left p-2">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={profile?.role === 'admin' ? 13 : 12} className="p-8 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Cargando órdenes...
                      </div>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={profile?.role === 'admin' ? 13 : 12} className="p-8 text-center text-muted-foreground">
                      No se encontraron órdenes
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const realOrder = order as DashboardOrder;
                    return (
                      <tr key={realOrder.orden_id} className="border-b hover:bg-muted/50">
                        <td className="p-2">
                          <Checkbox
                            checked={selectedOrders.includes(realOrder.id_display)}
                            onCheckedChange={(checked) => handleSelectOrder(realOrder.id_display, checked as boolean)}
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
                        {profile?.role === 'admin' && (
                          <td className="p-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteOrder(realOrder.orden_id, realOrder.id_display)}
                              className="h-8 w-8 p-0"
                              title={`Eliminar orden ${realOrder.id_display}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
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
    </div>
  );
};
