import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Truck, Clock, Calendar, TrendingUp, Award, Users, Package } from 'lucide-react';
import { metricsService, DeliveryPersonPerformance, MetricsFilters } from '@/services/metricsService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DeliveryPersonMetricsProps {
  filters: MetricsFilters;
  onNavigateToTimeMetrics?: () => void;
}

type MetricType = 'performance' | 'time';
type PerformanceView = 'orders' | 'success' | 'days' | 'amount';

export const DeliveryPersonMetrics: React.FC<DeliveryPersonMetricsProps> = ({
  filters,
  onNavigateToTimeMetrics
}) => {
  const [metricType, setMetricType] = useState<MetricType>('performance');
  const [performanceView, setPerformanceView] = useState<PerformanceView>('orders');
  const [performanceData, setPerformanceData] = useState<DeliveryPersonPerformance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (metricType === 'performance') {
      loadPerformanceData();
    }
  }, [filters, metricType]);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await metricsService.getDeliveryPersonPerformance(filters);
      setPerformanceData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getChartData = () => {
    if (!performanceData) return [];

    return performanceData.repartidores.map(repartidor => {
      const baseData = {
        nombre: repartidor.repartidor_nombre.length > 12 
          ? `${repartidor.repartidor_nombre.substring(0, 12)}...` 
          : repartidor.repartidor_nombre,
        fullName: repartidor.repartidor_nombre,
        id: repartidor.repartidor_id
      };

      switch (performanceView) {
        case 'orders':
          return {
            ...baseData,
            value: repartidor.total_entregados,
            secondary: repartidor.total_asignados,
            label: 'Entregados',
            secondaryLabel: 'Asignados'
          };
        case 'success':
          return {
            ...baseData,
            value: Math.round(repartidor.porcentaje_exito * 100) / 100,
            label: 'Tasa de Éxito (%)'
          };
        case 'days':
          return {
            ...baseData,
            value: repartidor.dias_trabajados,
            label: 'Días Trabajados'
          };
        case 'amount':
          return {
            ...baseData,
            value: Math.round(repartidor.monto_total_entregado / 1000),
            label: 'Monto Entregado (miles)'
          };
        default:
          return baseData;
      }
    });
  };

  const getViewTitle = () => {
    switch (performanceView) {
      case 'orders': return 'Pedidos Entregados vs Asignados';
      case 'success': return 'Tasa de Éxito por Repartidor';
      case 'days': return 'Días Trabajados por Repartidor';
      case 'amount': return 'Monto Total Entregado por Repartidor';
      default: return 'Rendimiento de Repartidores';
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold">{data.fullName}</p>
          <p className="text-blue-600">
            {payload[0].name}: <span className="font-bold">{payload[0].value}</span>
          </p>
          {payload[1] && (
            <p className="text-orange-600">
              {payload[1].name}: <span className="font-bold">{payload[1].value}</span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const formatDateRange = () => {
    if (!filters.fecha_inicio || !filters.fecha_fin) return '';
    const start = format(new Date(filters.fecha_inicio), 'dd/MM/yyyy', { locale: es });
    const end = format(new Date(filters.fecha_fin), 'dd/MM/yyyy', { locale: es });
    return `${start} - ${end}`;
  };

  return (
    <div className="space-y-6">
      {/* Header with Metric Type Selector */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Métricas Avanzadas</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {formatDateRange() || 'Sin filtros de fecha'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select
            value={metricType}
            onValueChange={(value: MetricType) => setMetricType(value)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tipo de métrica" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="performance">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Rendimiento de Repartidores
                </div>
              </SelectItem>
              <SelectItem value="time">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Tiempo por Etapas
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          
          {metricType === 'time' && onNavigateToTimeMetrics && (
            <Button onClick={onNavigateToTimeMetrics} variant="outline">
              Ver Métricas de Tiempo
            </Button>
          )}
        </div>
      </div>

      {metricType === 'performance' && (
        <>
          {/* Performance Summary Cards */}
          {performanceData && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="flex items-center justify-between p-6">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">
                      {performanceData.resumen.total_repartidores}
                    </p>
                    <p className="text-sm text-muted-foreground">Repartidores Activos</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center justify-between p-6">
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {performanceData.resumen.promedio_entregas}
                    </p>
                    <p className="text-sm text-muted-foreground">Promedio de Entregas</p>
                  </div>
                  <Package className="h-8 w-8 text-green-600" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center justify-between p-6">
                  <div>
                    <p className="text-2xl font-bold text-orange-600">
                      {performanceData.resumen.promedio_exito.toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground">Tasa de Éxito Promedio</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-orange-600" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center justify-between p-6">
                  <div>
                    <p className="text-lg font-bold text-purple-600">
                      {performanceData.resumen.mejor_repartidor}
                    </p>
                    <p className="text-sm text-muted-foreground">Mejor Repartidor</p>
                  </div>
                  <Award className="h-8 w-8 text-purple-600" />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Performance View Selector */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart className="h-5 w-5" />
                    {getViewTitle()}
                  </CardTitle>
                  <CardDescription>
                    Comparación de rendimiento entre repartidores
                  </CardDescription>
                </div>
                <Select
                  value={performanceView}
                  onValueChange={(value: PerformanceView) => setPerformanceView(value)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="orders">Pedidos Entregados</SelectItem>
                    <SelectItem value="success">Tasa de Éxito</SelectItem>
                    <SelectItem value="days">Días Trabajados</SelectItem>
                    <SelectItem value="amount">Monto Entregado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Cargando métricas de repartidores...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <div className="text-red-500 mb-2">Error al cargar las métricas</div>
                  <div className="text-sm text-muted-foreground mb-4">{error}</div>
                  <Button variant="outline" size="sm" onClick={loadPerformanceData}>
                    Reintentar
                  </Button>
                </div>
              ) : performanceData && performanceData.repartidores.length > 0 ? (
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getChartData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="nombre" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        fontSize={12}
                      />
                      <YAxis fontSize={12} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      
                      {performanceView === 'orders' ? (
                        <>
                          <Bar dataKey="value" name="Entregados" fill="#3B82F6" />
                          <Bar dataKey="secondary" name="Asignados" fill="#F59E0B" />
                        </>
                      ) : performanceView === 'success' ? (
                        <Bar dataKey="value" name="Tasa de Éxito (%)" fill="#10B981" />
                      ) : performanceView === 'days' ? (
                        <Bar dataKey="value" name="Días Trabajados" fill="#8B5CF6" />
                      ) : (
                        <Bar dataKey="value" name="Monto (miles)" fill="#EF4444" />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No hay datos de repartidores</h3>
                  <p className="text-sm text-muted-foreground">
                    No se encontraron repartidores con órdenes en el período seleccionado.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detailed Performance Table */}
          {performanceData && performanceData.repartidores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Detalle de Rendimiento</CardTitle>
                <CardDescription>
                  Métricas detalladas de cada repartidor
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Repartidor</th>
                        <th className="text-center py-2">Asignados</th>
                        <th className="text-center py-2">Entregados</th>
                        <th className="text-center py-2">Cancelados</th>
                        <th className="text-center py-2">Tasa de Éxito</th>
                        <th className="text-center py-2">Días Trabajados</th>
                        <th className="text-right py-2">Monto Entregado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performanceData.repartidores.map((repartidor, index) => (
                        <tr key={repartidor.repartidor_id} className="border-b">
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${
                                index === 0 ? 'bg-green-500' : 
                                index === 1 ? 'bg-blue-500' : 
                                index === 2 ? 'bg-orange-500' : 'bg-gray-400'
                              }`} />
                              <span className="font-medium">{repartidor.repartidor_nombre}</span>
                            </div>
                          </td>
                          <td className="text-center py-2">{repartidor.total_asignados}</td>
                          <td className="text-center py-2">
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              {repartidor.total_entregados}
                            </Badge>
                          </td>
                          <td className="text-center py-2">{repartidor.total_cancelados}</td>
                          <td className="text-center py-2">
                            <span className={`font-medium ${
                              repartidor.porcentaje_exito >= 90 ? 'text-green-600' :
                              repartidor.porcentaje_exito >= 75 ? 'text-orange-600' : 'text-red-600'
                            }`}>
                              {repartidor.porcentaje_exito.toFixed(1)}%
                            </span>
                          </td>
                          <td className="text-center py-2">{repartidor.dias_trabajados}</td>
                          <td className="text-right py-2">
                            ${repartidor.monto_total_entregado.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {metricType === 'time' && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center mb-6">
              <Clock className="h-16 w-16 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Análisis de Tiempo por Etapas</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Accede al análisis detallado de tiempos de procesamiento con gráficos de líneas interactivos que muestran 
                el flujo temporal completo desde la recepción hasta la entrega de pedidos.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 mb-1">📈</div>
                <div className="font-semibold text-blue-800 mb-1">Gráficos de Líneas</div>
                <div className="text-sm text-blue-600">Tendencias temporales por fase</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600 mb-1">⏱️</div>
                <div className="font-semibold text-green-800 mb-1">Tiempos Acumulativos</div>
                <div className="text-sm text-green-600">Progreso desde inicio hasta entrega</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 mb-1">🎯</div>
                <div className="font-semibold text-purple-800 mb-1">Análisis por Estado</div>
                <div className="text-sm text-purple-600">Recibido, Cocina, Camino, Entregado</div>
              </div>
            </div>

            <div className="text-center">
              {onNavigateToTimeMetrics ? (
                <Button onClick={onNavigateToTimeMetrics} size="lg" className="px-8">
                  <Clock className="h-5 w-5 mr-2" />
                  Abrir Análisis de Tiempo por Etapas
                </Button>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Función de navegación no disponible
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};