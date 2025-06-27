
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
  PowerOff
} from 'lucide-react';
import { Order, OrderStatus, OrderSource, DeliverySettings } from '@/types/delivery';
import { OrderConfigModal } from './OrderConfigModal';
import { cn } from '@/lib/utils';

interface DashboardProps {
  orders: Order[];
  settings: DeliverySettings;
  onUpdateOrders: (orders: Order[]) => void;
  onUpdateSettings: (settings: DeliverySettings) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  orders,
  settings,
  onUpdateOrders,
  onUpdateSettings
}) => {
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customerPhone.includes(searchTerm) ||
                         order.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'received': return <Clock className="h-4 w-4" />;
      case 'kitchen': return <Package className="h-4 w-4" />;
      case 'delivery': return <Truck className="h-4 w-4" />;
      case 'delivered': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'received': return 'bg-yellow-500';
      case 'kitchen': return 'bg-blue-500';
      case 'delivery': return 'bg-orange-500';
      case 'delivered': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
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

  const activeOrdersCount = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Domicilios</h1>
          <p className="text-muted-foreground">
            {activeOrdersCount} pedidos activos • {orders.length} pedidos totales
          </p>
        </div>
        
        <div className="flex gap-3">
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(['received', 'kitchen', 'delivery', 'delivered'] as OrderStatus[]).map(status => {
          const count = orders.filter(o => o.status === status).length;
          const statusLabels = {
            received: 'Recibidos',
            kitchen: 'En Cocina',
            delivery: 'En Camino',
            delivered: 'Entregados'
          };
          
          return (
            <Card key={status}>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-sm text-muted-foreground">{statusLabels[status]}</p>
                </div>
                <div className={cn("p-2 rounded-full", getStatusColor(status))}>
                  {getStatusIcon(status)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nombre, teléfono o ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'received', 'kitchen', 'delivery', 'delivered'] as const).map(status => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status === 'all' ? 'Todos' : 
                   status === 'received' ? 'Recibidos' :
                   status === 'kitchen' ? 'Cocina' :
                   status === 'delivery' ? 'Camino' : 'Entregados'}
                </Button>
              ))}
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
                  <th className="text-left p-2">Origen</th>
                  <th className="text-left p-2">Estado</th>
                  <th className="text-left p-2">Total</th>
                  <th className="text-left p-2">Entrega</th>
                  <th className="text-left p-2">Creado</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b hover:bg-muted/50">
                    <td className="p-2">
                      <Checkbox
                        checked={selectedOrders.includes(order.id)}
                        onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                      />
                    </td>
                    <td className="p-2 font-mono text-sm">{order.id.slice(0, 8)}</td>
                    <td className="p-2">
                      <div>
                        <div className="font-medium">{order.customerName}</div>
                        <div className="text-sm text-muted-foreground">{order.customerPhone}</div>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        {getSourceIcon(order.source)}
                        <span className="text-sm">
                          {order.source === 'ai_agent' ? 'AI Agent' : 'Call Center'}
                        </span>
                      </div>
                    </td>
                    <td className="p-2">
                      <Badge className={cn("text-white", getStatusColor(order.status))}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(order.status)}
                          {order.status === 'received' ? 'Recibido' :
                           order.status === 'kitchen' ? 'Cocina' :
                           order.status === 'delivery' ? 'Camino' : 'Entregado'}
                        </div>
                      </Badge>
                    </td>
                    <td className="p-2 font-medium">${order.totalAmount.toLocaleString()}</td>
                    <td className="p-2">
                      <div className="text-sm">
                        {formatTime(order.estimatedDeliveryTime)}
                        {order.extraTime && (
                          <div className="text-xs text-orange-600">
                            +{order.extraTime}min
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-2 text-sm text-muted-foreground">
                      {formatTime(order.createdAt)}
                    </td>
                  </tr>
                ))}
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
        onUpdateOrders={onUpdateOrders}
        onClearSelection={() => setSelectedOrders([])}
      />
    </div>
  );
};
