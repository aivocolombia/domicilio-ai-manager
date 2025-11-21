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
  User,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/utils/format';
import { crmService, CRMCustomer, CRMOrder, CRMStats } from '@/services/crmService';
import { getOrderItemsSummary, CRMOrderItemSummary, CRMCustomerFavoriteProductSummary } from '@/services/crmOrderItemsService';
import { useAuth } from '@/hooks/useAuth';

interface CRMProps {
  effectiveSedeId?: string;
}

type CustomerOrderWithItems = CRMOrder & { items?: CRMOrderItemSummary[] };

export const CRM: React.FC<CRMProps> = ({ effectiveSedeId }) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [stats, setStats] = useState<CRMStats | null>(null);
  const [customers, setCustomers] = useState<CRMCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CRMCustomer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrderWithItems[]>([]);
  const [customerFavoriteProduct, setCustomerFavoriteProduct] = useState<CRMCustomerFavoriteProductSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [activeTab, setActiveTab] = useState('customers');

  const getOrderItemIcon = (type: CRMOrderItemSummary['type']) => {
    const baseClasses = 'h-3.5 w-3.5';
    switch (type) {
      case 'bebida':
        return <Coffee className={`${baseClasses} text-sky-600`} />;
      case 'topping':
        return <Star className={`${baseClasses} text-amber-500`} />;
      default:
        return <Package className={`${baseClasses} text-emerald-600`} />;
    }
  };

  // Estados para ordenamiento
  const [sortColumn, setSortColumn] = useState<keyof CRMCustomer>('total_spent');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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
      setCustomerFavoriteProduct(null);
      const orders = await crmService.getCustomerOrders(customerId, 20, sedeToUse || undefined);

      if (!orders || orders.length === 0) {
        setCustomerOrders([]);
        return;
      }

      const summary = await getOrderItemsSummary(orders.map((order) => order.id));

      const enrichedOrders: CustomerOrderWithItems[] = orders.map((order) => {
        const key = String(order.id);
        const counts = summary.countsByOrder[key];

        return {
          ...order,
          platos_count: counts ? counts.platos : order.platos_count,
          bebidas_count: counts ? counts.bebidas : order.bebidas_count,
          items: summary.itemsByOrder[key] || []
        };
      });

      setCustomerOrders(enrichedOrders);
      setCustomerFavoriteProduct(summary.favoriteProduct ?? null);
    } catch (error) {
      console.error('Error loading customer orders:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las órdenes del cliente",
        variant: "destructive"
      });
      setCustomerOrders([]);
      setCustomerFavoriteProduct(null);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Abrir modal de cliente
  const openCustomerModal = async (customer: CRMCustomer) => {
    setSelectedCustomer(customer);
    setCustomerOrders([]);
    setCustomerFavoriteProduct(null);
    await loadCustomerOrders(customer.id);
  };

  // Función para manejar el ordenamiento
  const handleSort = (column: keyof CRMCustomer) => {
    if (sortColumn === column) {
      // Si ya está ordenado por esta columna, invertir la dirección
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Si es una columna nueva, ordenar descendente por defecto
      setSortColumn(column);
      setSortDirection('desc');
    }
    setCurrentPage(1); // Resetear a la primera página
  };

  // Filtrar clientes por término de búsqueda
  const filteredCustomers = customers.filter(customer =>
    customer.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.telefono.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.direccion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Ordenar clientes filtrados
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];

    // Manejar valores null/undefined
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    // Comparación según el tipo de dato
    let comparison = 0;
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      comparison = aValue.localeCompare(bValue);
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue;
    } else {
      // Para fechas en string o cualquier otro tipo
      const aStr = String(aValue);
      const bStr = String(bValue);
      const aDate = new Date(aStr);
      const bDate = new Date(bStr);

      // Verificar si son fechas válidas
      if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
        comparison = aDate.getTime() - bDate.getTime();
      } else {
        comparison = aStr.localeCompare(bStr);
      }
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Lógica de paginación usando los datos ordenados
  const totalPages = Math.ceil(sortedCustomers.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCustomers = sortedCustomers.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (pageNumber: number) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };
  // Definir columnas para exportación
  const customerColumns = [
    { key: 'nombre', header: 'Nombre' },
    { key: 'telefono', header: 'Teléfono' },
    { key: 'direccion', header: 'Dirección' },
    { key: 'total_orders', header: 'Órdenes' },
    { key: 'total_spent', header: 'Total Gastado', format: (value: number) => formatCurrency(value) },
    { key: 'average_order_value', header: 'Promedio por Orden', format: (value: number) => formatCurrency(value) },
    { key: 'last_order_date', header: 'Última Orden', format: (value: string) => value ? formatDate(value) : 'N/A' },
  ];

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
                  <ExportButton
                    data={sortedCustomers}
                    columns={customerColumns}
                    filename={`reporte_clientes_${sedeToUse || 'global'}`}
                    title="Reporte de Clientes"
                    subtitle={`Sede: ${sedeToUse ? customers.find(c => c.id === sedeToUse)?.nombre : 'Todas'}`}
                    formats={['excel', 'csv']}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 hover:bg-muted"
                        onClick={() => handleSort('nombre')}
                      >
                        Cliente
                        {sortColumn === 'nombre' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="ml-2 h-4 w-4" />
                          ) : (
                            <ArrowDown className="ml-2 h-4 w-4" />
                          )
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 hover:bg-muted"
                        onClick={() => handleSort('total_orders')}
                      >
                        Órdenes
                        {sortColumn === 'total_orders' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="ml-2 h-4 w-4" />
                          ) : (
                            <ArrowDown className="ml-2 h-4 w-4" />
                          )
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 hover:bg-muted"
                        onClick={() => handleSort('total_spent')}
                      >
                        Total Gastado
                        {sortColumn === 'total_spent' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="ml-2 h-4 w-4" />
                          ) : (
                            <ArrowDown className="ml-2 h-4 w-4" />
                          )
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 hover:bg-muted"
                        onClick={() => handleSort('last_order_date')}
                      >
                        Última Orden
                        {sortColumn === 'last_order_date' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="ml-2 h-4 w-4" />
                          ) : (
                            <ArrowDown className="ml-2 h-4 w-4" />
                          )
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 hover:bg-muted"
                        onClick={() => handleSort('average_order_value')}
                      >
                        Promedio
                        {sortColumn === 'average_order_value' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="ml-2 h-4 w-4" />
                          ) : (
                            <ArrowDown className="ml-2 h-4 w-4" />
                          )
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentCustomers.map((customer) => (
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
                                Información completa e historial de órdenes de {selectedCustomer?.nombre}
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
                                      <div className="pt-3 border-t border-border space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                          <Star className="h-4 w-4 text-amber-500" />
                                          <span>Producto favorito</span>
                                        </div>
                                        {selectedCustomer.total_orders > 0 ? (
                                          customerFavoriteProduct ? (
                                            <div className="flex items-center justify-between gap-3">
                                              <div className="flex items-center gap-2">
                                                {getOrderItemIcon(customerFavoriteProduct.type)}
                                                <span className="font-medium">{customerFavoriteProduct.name}</span>
                                              </div>
                                              <Badge variant="outline" className="text-xs">
                                                {customerFavoriteProduct.count} pedidos
                                              </Badge>
                                            </div>
                                          ) : (
                                            <span className="text-xs text-muted-foreground">Sin datos suficientes para calcular el favorito</span>
                                          )
                                        ) : (
                                          <span className="text-xs text-muted-foreground">El cliente aún no tiene órdenes registradas</span>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>

                                {/* Historial de órdenes */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-lg">Historial de Órdenes</CardTitle>
                                    <CardDescription>Últimas 20 órdenes del cliente</CardDescription>
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
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium">Orden #{order.id}</span>
                                                <Badge variant={getStatusBadgeColor(order.status)}>
                                                  {getStatusText(order.status)}
                                                </Badge>
                                                {order.sede_nombre && (
                                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                                    📍 {order.sede_nombre}
                                                  </Badge>
                                                )}
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
                                            {(order.items?.length ?? 0) > 0 ? (
                                              <div className="mt-3 border-t border-dashed pt-3">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                                  Detalle del pedido
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                  {order.items.map((item) => (
                                                    <Badge
                                                      key={`${order.id}-${item.type}-${item.id}`}
                                                      variant="secondary"
                                                      className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
                                                    >
                                                      {getOrderItemIcon(item.type)}
                                                      <span>{item.name}</span>
                                                      {item.quantity > 1 && (
                                                        <span className="text-muted-foreground font-semibold">×{item.quantity}</span>
                                                      )}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="mt-3 border-t border-dashed pt-3 text-xs text-muted-foreground">
                                                Sin detalle disponible para esta orden
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
              {/* Controles de paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages} ({sortedCustomers.length} clientes)
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      // Lógica para mostrar solo un rango de páginas
                      const shouldShow =
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1);

                      const isEllipsis =
                        (page === currentPage - 2 && page > 1) ||
                        (page === currentPage + 2 && page < totalPages);

                      if (isEllipsis) {
                        return <span key={`ellipsis-${page}`} className="px-2 text-muted-foreground">...</span>;
                      }

                      if (shouldShow) {
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? 'default' : 'outline'}
                            size="sm"
                            className="w-9 h-9 p-0"
                            onClick={() => handlePageChange(page)}
                          >
                            {page}
                          </Button>
                        );
                      }
                      return null;
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
