import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Search, 
  Eye, 
  Calendar,
  Phone,
  MapPin,
  Package,
  Coffee,
  Clock,
  Star,
  User
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/utils/format';
import { crmService, CRMCustomer, CRMOrder, CRMStats } from '@/services/crmService';
import { useAuth } from '@/hooks/useAuth';

interface CRMProps {
  effectiveSedeId?: string;
}

export const CRM: React.FC<CRMProps> = ({ effectiveSedeId }) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [stats, setStats] = useState<CRMStats | null>(null);
  const [customers, setCustomers] = useState<CRMCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CRMCustomer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<CRMOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('customers');

  // Determinar qué sede usar - CRM debería mostrar datos globales para admin_global
  const sedeToUse = profile?.role === 'admin_global'
    ? effectiveSedeId // Admin global puede ver todos (undefined) o filtrar por sede específica
    : (effectiveSedeId || profile?.sede_id);



  // Cargar datos de CRM
  const loadCRMData = async () => {
    // Solo retornar early si no es admin_global y no tiene sede
    if (!sedeToUse && profile?.role !== 'admin_global') {
      return;
    }

    try {
      setLoading(true);
      
      const [statsData, customersData] = await Promise.all([
        crmService.getCRMStats(sedeToUse),
        crmService.getCRMCustomers(sedeToUse)
      ]);

      setStats(statsData);
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading CRM data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de CRM",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Cargar órdenes de un cliente
  const loadCustomerOrders = async (customerId: string) => {
    try {
      setLoadingOrders(true);
      const orders = await crmService.getCustomerOrders(customerId, 20);
      setCustomerOrders(orders);
    } catch (error) {
      console.error('Error loading customer orders:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las órdenes del cliente",
        variant: "destructive"
      });
    } finally {
      setLoadingOrders(false);
    }
  };

  // Abrir modal de cliente
  const openCustomerModal = async (customer: CRMCustomer) => {
    setSelectedCustomer(customer);
    await loadCustomerOrders(customer.id);
  };

  // Filtrar clientes por término de búsqueda
  const filteredCustomers = customers.filter(customer =>
    customer.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.telefono.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.direccion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Formatear fecha
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Obtener color del badge según el estado
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'default';
      case 'delivery': return 'secondary';
      case 'kitchen': return 'destructive';
      case 'received': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  // Obtener texto del estado
  const getStatusText = (status: string) => {
    switch (status) {
      case 'delivered': return 'Entregado';
      case 'delivery': return 'En entrega';
      case 'kitchen': return 'En cocina';
      case 'received': return 'Recibido';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  useEffect(() => {
    loadCRMData();
  }, [sedeToUse]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas generales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Clientes</p>
                <p className="text-2xl font-bold">{stats?.total_customers || 0}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Clientes Activos</p>
                <p className="text-2xl font-bold">{stats?.active_customers || 0}</p>
              </div>
              <User className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Órdenes</p>
                <p className="text-2xl font-bold">{stats?.total_orders || 0}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ingresos Totales</p>
                <p className="text-2xl font-bold">{formatCurrency(stats?.total_revenue || 0)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de contenido */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Clientes
          </TabsTrigger>
        </TabsList>

        {/* Tab: Resumen */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top clientes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Top Clientes
                </CardTitle>
                <CardDescription>
                  Clientes con mayor gasto en esta sede
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.top_customers.map((customer, index) => (
                    <div key={customer.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{customer.nombre}</p>
                          <p className="text-sm text-muted-foreground">{customer.telefono}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(customer.total_spent)}</p>
                        <p className="text-sm text-muted-foreground">{customer.total_orders} órdenes</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Estadísticas adicionales */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Estadísticas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Valor promedio por orden</span>
                  <span className="font-bold">{formatCurrency(stats?.average_order_value || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tasa de clientes activos</span>
                  <span className="font-bold">
                    {stats?.total_customers ? Math.round((stats.active_customers / stats.total_customers) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Órdenes por cliente</span>
                  <span className="font-bold">
                    {stats?.total_customers ? Math.round((stats.total_orders / stats.total_customers) * 10) / 10 : 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Clientes */}
        <TabsContent value="customers" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Lista de Clientes</CardTitle>
                  <CardDescription>
                    Clientes que han realizado órdenes en esta sede
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar clientes..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Órdenes</TableHead>
                    <TableHead>Total Gastado</TableHead>
                    <TableHead>Última Orden</TableHead>
                    <TableHead>Promedio</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{customer.nombre}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-xs">{customer.direccion}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-mono">{customer.telefono}</p>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          <p className="font-bold">{customer.total_orders}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-bold">{formatCurrency(customer.total_spent)}</p>
                      </TableCell>
                      <TableCell>
                        {customer.last_order_date ? (
                          <p className="text-sm">{formatDate(customer.last_order_date)}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Sin órdenes</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="font-bold">{formatCurrency(customer.average_order_value)}</p>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCustomerModal(customer)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalles
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Detalles del Cliente</DialogTitle>
                              <DialogDescription>
                                Información completa y historial de órdenes de {selectedCustomer?.nombre}
                              </DialogDescription>
                            </DialogHeader>
                            
                            {selectedCustomer && (
                              <div className="space-y-6">
                                {/* Información del cliente */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-lg">Información Personal</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                      <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">{selectedCustomer.nombre}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-mono">{selectedCustomer.telefono}</span>
                                      </div>
                                      <div className="flex items-start gap-2">
                                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                                        <span className="text-sm">{selectedCustomer.direccion}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm">
                                          Cliente desde: {formatDate(selectedCustomer.created_at)}
                                        </span>
                                      </div>
                                    </CardContent>
                                  </Card>

                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-lg">Estadísticas</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                      <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">Total de órdenes:</span>
                                        <span className="font-bold">{selectedCustomer.total_orders}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">Total gastado:</span>
                                        <span className="font-bold">{formatCurrency(selectedCustomer.total_spent)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">Valor promedio:</span>
                                        <span className="font-bold">{formatCurrency(selectedCustomer.average_order_value)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">Última orden:</span>
                                        <span className="text-sm">
                                          {selectedCustomer.last_order_date ? formatDate(selectedCustomer.last_order_date) : 'Sin órdenes'}
                                        </span>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>

                                {/* Historial de órdenes */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-lg">Historial de Órdenes</CardTitle>
                                    <CardDescription>
                                      Últimas 20 órdenes del cliente
                                    </CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                    {loadingOrders ? (
                                      <div className="text-center py-4">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                        <p className="text-sm text-muted-foreground mt-2">Cargando órdenes...</p>
                                      </div>
                                    ) : customerOrders.length > 0 ? (
                                      <div className="space-y-3">
                                        {customerOrders.map((order) => (
                                          <div key={order.id} className="border rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="flex items-center gap-2">
                                                <span className="font-medium">Orden #{order.id}</span>
                                                <Badge variant={getStatusBadgeColor(order.status)}>
                                                  {getStatusText(order.status)}
                                                </Badge>
                                              </div>
                                              <div className="text-right">
                                                <p className="font-bold">{formatCurrency(order.total_amount)}</p>
                                                <p className="text-sm text-muted-foreground">
                                                  {formatDate(order.order_at)}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                              <div className="flex items-center gap-2">
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                <span>{order.cliente_telefono}</span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                                <span className="truncate">{order.cliente_direccion}</span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <Package className="h-4 w-4 text-muted-foreground" />
                                                <span>{order.platos_count} platos, {order.bebidas_count} bebidas</span>
                                              </div>
                                            </div>
                                            {order.repartidor_name && (
                                              <div className="mt-2 text-sm text-muted-foreground">
                                                Repartidor: {order.repartidor_name}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-center py-8">
                                        <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                        <p className="text-muted-foreground">Este cliente no tiene órdenes registradas</p>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
