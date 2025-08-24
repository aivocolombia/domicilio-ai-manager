import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  TrendingUp, 
  BarChart3, 
  Timer, 
  Package,
  Truck,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  Activity
} from 'lucide-react';
import { 
  metricsService, 
  PhaseTimeStats, 
  PhaseDistribution, 
  OrderTimeMetrics, 
  MetricsFilters 
} from '@/services/metricsService';

interface TimeMetricsPanelProps {
  filters: MetricsFilters;
  onRefresh?: () => void;
}

export const TimeMetricsPanel: React.FC<TimeMetricsPanelProps> = ({ 
  filters, 
  onRefresh 
}) => {
  const [phaseStats, setPhaseStats] = useState<PhaseTimeStats | null>(null);
  const [phaseDistribution, setPhaseDistribution] = useState<PhaseDistribution[]>([]);
  const [timeTrends, setTimeTrends] = useState<{ date: string; avg_total_time: number; order_count: number }[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderTimeMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar todas las métricas de tiempo
  const loadTimeMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('⏱️ Cargando métricas de tiempo...');

      const [stats, distribution, trends, orders] = await Promise.all([
        metricsService.getPhaseTimeStats(filters),
        metricsService.getPhaseDistribution(filters),
        metricsService.getPhaseTimeTrends(filters),
        metricsService.getOrderTimeMetrics({ ...filters })
      ]);

      setPhaseStats(stats);
      setPhaseDistribution(distribution);
      setTimeTrends(trends.slice(-7)); // Últimos 7 días
      setRecentOrders(orders.slice(0, 10)); // Últimas 10 órdenes

      console.log('✅ Métricas de tiempo cargadas exitosamente');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error('❌ Error cargando métricas de tiempo:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimeMetrics();
  }, [filters]);

  // Formatear minutos a texto legible
  const formatMinutes = (minutes: number | null) => {
    if (minutes === null || isNaN(minutes)) return 'N/A';
    
    if (minutes < 1) {
      return `${Math.round(minutes * 60)}s`;
    } else if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = Math.round(minutes % 60);
      return `${hours}h ${remainingMinutes}m`;
    } else {
      return `${Math.round(minutes * 10) / 10}m`;
    }
  };

  // Obtener ícono de fase
  const getPhaseIcon = (phaseName: string) => {
    if (phaseName.includes('Cocina')) return <Package className="h-4 w-4" />;
    if (phaseName.includes('Camino')) return <Truck className="h-4 w-4" />;
    if (phaseName.includes('Entregado')) return <CheckCircle className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  // Obtener color de estado basado en tiempo
  const getTimeColor = (minutes: number, type: 'phase' | 'total' = 'phase') => {
    if (type === 'total') {
      if (minutes <= 30) return 'bg-green-500';
      if (minutes <= 45) return 'bg-yellow-500';
      if (minutes <= 60) return 'bg-orange-500';
      return 'bg-red-500';
    } else {
      if (minutes <= 5) return 'bg-green-500';
      if (minutes <= 10) return 'bg-yellow-500';
      if (minutes <= 15) return 'bg-orange-500';
      return 'bg-red-500';
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>Error: {error}</span>
          </div>
          <Button onClick={loadTimeMetrics} className="mt-4" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Métricas de Tiempo por Fases</h2>
          <p className="text-muted-foreground">
            Análisis de tiempos de procesamiento de pedidos
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              loadTimeMetrics();
              onRefresh?.();
            }}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Cargando...' : 'Actualizar'}
          </Button>
        </div>
      </div>

      {/* Estadísticas generales */}
      {phaseStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tiempo Total Promedio</p>
                  <p className="text-2xl font-bold">{formatMinutes(phaseStats.avg_total_desde_recibidos)}</p>
                  <p className="text-xs text-muted-foreground">desde recibido</p>
                </div>
                <div className={`p-2 rounded-full ${getTimeColor(phaseStats.avg_total_desde_recibidos, 'total')}`}>
                  <Timer className="h-4 w-4 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Recibido → Cocina</p>
                  <p className="text-2xl font-bold">{formatMinutes(phaseStats.avg_recibidos_a_cocina)}</p>
                  <p className="text-xs text-muted-foreground">promedio</p>
                </div>
                <div className={`p-2 rounded-full ${getTimeColor(phaseStats.avg_recibidos_a_cocina)}`}>
                  <Package className="h-4 w-4 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cocina → Camino</p>
                  <p className="text-2xl font-bold">{formatMinutes(phaseStats.avg_cocina_a_camino)}</p>
                  <p className="text-xs text-muted-foreground">promedio</p>
                </div>
                <div className={`p-2 rounded-full ${getTimeColor(phaseStats.avg_cocina_a_camino)}`}>
                  <Truck className="h-4 w-4 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Órdenes Analizadas</p>
                  <p className="text-2xl font-bold">{phaseStats.total_orders}</p>
                  <p className="text-xs text-muted-foreground">{phaseStats.completed_orders} completadas</p>
                </div>
                <div className="p-2 rounded-full bg-blue-500">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Distribución por fases y tendencias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución por fases */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Distribución por Fases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {phaseDistribution.map((phase, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getPhaseIcon(phase.phase)}
                      <span className="font-medium">{phase.phase}</span>
                    </div>
                    <Badge variant="outline">
                      {phase.count} órdenes
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Promedio</p>
                      <p className="font-medium">{formatMinutes(phase.avg_minutes)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Mínimo</p>
                      <p className="font-medium">{formatMinutes(phase.min_minutes)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Máximo</p>
                      <p className="font-medium">{formatMinutes(phase.max_minutes)}</p>
                    </div>
                  </div>
                  
                  {/* Barra de progreso visual */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min((phase.avg_minutes / 20) * 100, 100)}%`,
                        backgroundColor: phase.color
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tendencias de tiempo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tendencia Semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {timeTrends.map((trend, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">
                      {new Date(trend.date).toLocaleDateString('es-ES', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {trend.order_count} órdenes
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">
                      {formatMinutes(trend.avg_total_time)}
                    </p>
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      getTimeColor(trend.avg_total_time, 'total')
                    } text-white`}>
                      Promedio
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Órdenes recientes con métricas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Órdenes Recientes con Tiempos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">ID</th>
                  <th className="text-left p-2">Estado</th>
                  <th className="text-left p-2">Sede</th>
                  <th className="text-left p-2">Rec → Coc</th>
                  <th className="text-left p-2">Coc → Cam</th>
                  <th className="text-left p-2">Cam → Ent</th>
                  <th className="text-left p-2">Total</th>
                  <th className="text-left p-2">Creado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Cargando métricas...
                      </div>
                    </td>
                  </tr>
                ) : recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No hay datos de métricas disponibles
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-mono text-sm">#{order.id}</td>
                      <td className="p-2">
                        <Badge variant={order.status === 'Entregados' ? 'default' : 'secondary'}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="p-2 text-sm">{order.sede_nombre || 'N/A'}</td>
                      <td className="p-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs text-white ${
                          order.min_recibidos_a_cocina ? getTimeColor(order.min_recibidos_a_cocina) : 'bg-gray-400'
                        }`}>
                          {formatMinutes(order.min_recibidos_a_cocina)}
                        </span>
                      </td>
                      <td className="p-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs text-white ${
                          order.min_cocina_a_camino ? getTimeColor(order.min_cocina_a_camino) : 'bg-gray-400'
                        }`}>
                          {formatMinutes(order.min_cocina_a_camino)}
                        </span>
                      </td>
                      <td className="p-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs text-white ${
                          order.min_camino_a_fin ? getTimeColor(order.min_camino_a_fin) : 'bg-gray-400'
                        }`}>
                          {formatMinutes(order.min_camino_a_fin)}
                        </span>
                      </td>
                      <td className="p-2 font-medium">
                        <span className={`px-2 py-1 rounded text-xs text-white ${
                          order.min_total_desde_recibidos ? getTimeColor(order.min_total_desde_recibidos, 'total') : 'bg-gray-400'
                        }`}>
                          {formatMinutes(order.min_total_desde_recibidos)}
                        </span>
                      </td>
                      <td className="p-2 text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString('es-ES')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};