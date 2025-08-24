
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
  Filter
} from 'lucide-react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Order, OrderStatus, OrderSource, DeliverySettings, DeliveryPerson, PaymentMethod } from '@/types/delivery';
import { OrderConfigModal } from './OrderConfigModal';
import { cn } from '@/lib/utils';
import { useDashboard } from '@/hooks/useDashboard';
import { DashboardOrder } from '@/services/dashboardService';
import { useAuth } from '@/hooks/useAuth';

interface DashboardProps {
  orders: Order[];
  settings: DeliverySettings;
  deliveryPersonnel: DeliveryPerson[];
  onUpdateOrders: (orders: Order[]) => void;
  onUpdateSettings: (settings: DeliverySettings) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  orders: legacyOrders,
  settings,
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

  // Obtener datos del usuario autenticado
  const { user, profile } = useAuth();

  // Debug: Log user information
  console.log('🏠 Dashboard: Usuario autenticado:', user);
  console.log('👤 Dashboard: Perfil del usuario:', profile);
  console.log('🏢 Dashboard: Sede ID del usuario:', profile?.sede_id);
  console.log('🏷️ Dashboard: Tipo de sede_id:', typeof profile?.sede_id);

  // Hook para datos reales del dashboard
  const { 
    orders: realOrders, 
    stats, 
    loading, 
    error, 
    loadDashboardOrders,
    filterOrdersByStatus, 
    refreshData 
  } = useDashboard(profile?.sede_id);

  // Usar SOLO datos reales - NUNCA datos legacy para evitar mostrar datos dummy
  // Una sede nueva debe mostrar dashboard vacío, no datos dummy
  const orders = realOrders;

  // Función para aplicar filtros de fecha
  const applyDateFilter = async () => {
    let filters: any = {};
    
    if (dateFilter === 'today') {
      // Filtrar solo hoy (por defecto)
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      filters.fechaInicio = startOfDay.toISOString();
      filters.fechaFin = endOfDay.toISOString();
      
      console.log('📅 Aplicando filtro "Solo Hoy":', { fechaInicio: filters.fechaInicio, fechaFin: filters.fechaFin });
    } else if (dateFilter === 'custom' && dateRange.from && dateRange.to) {
      // Filtro personalizado con rango de fechas
      const startOfDay = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate());
      const endOfDay = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate() + 1);
      
      filters.fechaInicio = startOfDay.toISOString();
      filters.fechaFin = endOfDay.toISOString();
      
      console.log('📅 Aplicando filtro personalizado:', { fechaInicio: filters.fechaInicio, fechaFin: filters.fechaFin });
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
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Cargando órdenes...
                      </div>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-muted-foreground">
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
      />
    </div>
  );
};
