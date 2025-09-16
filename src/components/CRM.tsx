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
import { crmService, CRMUser, CRMOrder, CRMStats } from '@/services/crmService';
import { useAuth } from '@/hooks/useAuth';

interface CRMProps {
  effectiveSedeId?: string;
}

export const CRM: React.FC<CRMProps> = ({ effectiveSedeId }) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [stats, setStats] = useState<CRMStats | null>(null);
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<CRMUser | null>(null);
  const [userOrders, setUserOrders] = useState<CRMOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Determinar qué sede usar
  const sedeToUse = effectiveSedeId || profile?.sede_id;

  // Cargar datos de CRM
  const loadCRMData = async () => {
    if (!sedeToUse) return;

    try {
      setLoading(true);
      
      const [statsData, usersData] = await Promise.all([
        crmService.getCRMStats(sedeToUse),
        crmService.getCRMUsers(sedeToUse)
      ]);

      setStats(statsData);
      setUsers(usersData);
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

  // Cargar órdenes de un usuario
  const loadUserOrders = async (userId: string) => {
    try {
      setLoadingOrders(true);
      const orders = await crmService.getUserOrders(userId, 20);
      setUserOrders(orders);
    } catch (error) {
      console.error('Error loading user orders:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las órdenes del usuario",
        variant: "destructive"
      });
    } finally {
      setLoadingOrders(false);
    }
  };

  // Abrir modal de usuario
  const openUserModal = async (user: CRMUser) => {
    setSelectedUser(user);
    await loadUserOrders(user.id);
  };

  // Filtrar usuarios por término de búsqueda
  const filteredUsers = users.filter(user =>
    user.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.sede_name.toLowerCase().includes(searchTerm.toLowerCase())
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
                <p className="text-sm font-medium text-muted-foreground">Total Usuarios</p>
                <p className="text-2xl font-bold">{stats?.total_users || 0}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Usuarios Activos</p>
                <p className="text-2xl font-bold">{stats?.active_users || 0}</p>
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
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuarios
          </TabsTrigger>
        </TabsList>

        {/* Tab: Resumen */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top usuarios */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Top Usuarios
                </CardTitle>
                <CardDescription>
                  Usuarios con más órdenes en esta sede
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.top_users.map((user, index) => (
                    <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{user.display_name}</p>
                          <p className="text-sm text-muted-foreground">@{user.nickname}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{user.total_orders}</p>
                        <p className="text-sm text-muted-foreground">órdenes</p>
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
                  <span className="text-sm text-muted-foreground">Tasa de usuarios activos</span>
                  <span className="font-bold">
                    {stats?.total_users ? Math.round((stats.active_users / stats.total_users) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Órdenes por usuario</span>
                  <span className="font-bold">
                    {stats?.total_users ? Math.round((stats.total_orders / stats.total_users) * 10) / 10 : 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Usuarios */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Lista de Usuarios</CardTitle>
                  <CardDescription>
                    Usuarios registrados en esta sede con sus estadísticas
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar usuarios..."
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
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Órdenes</TableHead>
                    <TableHead>Total Gastado</TableHead>
                    <TableHead>Última Orden</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.display_name}</p>
                          <p className="text-sm text-muted-foreground">@{user.nickname}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          <p className="font-bold">{user.total_orders}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(user.average_order_value)} promedio
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-bold">{formatCurrency(user.total_spent)}</p>
                      </TableCell>
                      <TableCell>
                        {user.last_order_date ? (
                          <p className="text-sm">{formatDate(user.last_order_date)}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Sin órdenes</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? "default" : "destructive"}>
                          {user.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openUserModal(user)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalles
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Detalles del Usuario</DialogTitle>
                              <DialogDescription>
                                Información completa y historial de órdenes de {selectedUser?.display_name}
                              </DialogDescription>
                            </DialogHeader>
                            
                            {selectedUser && (
                              <div className="space-y-6">
                                {/* Información del usuario */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-lg">Información Personal</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                      <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">{selectedUser.display_name}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">Nickname:</span>
                                        <span>@{selectedUser.nickname}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">Rol:</span>
                                        <Badge variant="outline">{selectedUser.role}</Badge>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">Sede:</span>
                                        <span>{selectedUser.sede_name}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm">
                                          Registrado: {formatDate(selectedUser.created_at)}
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
                                        <span className="font-bold">{selectedUser.total_orders}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">Total gastado:</span>
                                        <span className="font-bold">{formatCurrency(selectedUser.total_spent)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">Valor promedio:</span>
                                        <span className="font-bold">{formatCurrency(selectedUser.average_order_value)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">Última orden:</span>
                                        <span className="text-sm">
                                          {selectedUser.last_order_date ? formatDate(selectedUser.last_order_date) : 'Sin órdenes'}
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
                                      Últimas 20 órdenes del usuario
                                    </CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                    {loadingOrders ? (
                                      <div className="text-center py-4">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                        <p className="text-sm text-muted-foreground mt-2">Cargando órdenes...</p>
                                      </div>
                                    ) : userOrders.length > 0 ? (
                                      <div className="space-y-3">
                                        {userOrders.map((order) => (
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
                                        <p className="text-muted-foreground">Este usuario no tiene órdenes registradas</p>
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
