import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Clock, 
  Calendar as CalendarIcon,
  TrendingUp, 
  BarChart3, 
  Timer, 
  Package,
  Truck,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  Activity,
  Filter,
  ArrowLeft,
  LineChart
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  metricsService, 
  PhaseTimeStats, 
  PhaseDistribution, 
  OrderTimeMetrics, 
  MetricsFilters 
} from '@/services/metricsService';
import { supabase } from '@/lib/supabase';

interface TimeMetricsPageProps {
  onBack?: () => void;
}

interface Sede {
  id: string;
  name: string;
}

interface PhaseTimeTrend {
  date: string;
  sede_id: string;
  sede_name: string;
  avg_recibidos_a_cocina: number;
  avg_cocina_a_camino: number;
  avg_camino_a_fin: number;
  avg_total_desde_recibidos: number;
  order_count: number;
}

export const TimeMetricsPage: React.FC<TimeMetricsPageProps> = ({ onBack }) => {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date()
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  const [selectedSede, setSelectedSede] = useState<string>('global');
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [viewMode, setViewMode] = useState<'summary' | 'chart'>('summary');
  
  const [phaseStats, setPhaseStats] = useState<PhaseTimeStats | null>(null);
  const [phaseDistribution, setPhaseDistribution] = useState<PhaseDistribution[]>([]);
  const [chartData, setChartData] = useState<PhaseTimeTrend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Función para generar colores únicos y consistentes por sede
  const getSedeColor = (sedeId: string, sedeName: string): string => {
    // Crear hash simple basado en el ID de la sede para consistencia
    let hash = 0;
    const str = sedeId + sedeName;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convertir hash a color HSL para mejor distribución de colores
    const hue = Math.abs(hash) % 360;
    const saturation = 65 + (Math.abs(hash) % 20); // 65-85%
    const lightness = 45 + (Math.abs(hash) % 15); // 45-60%
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  // Cargar sedes disponibles
  const loadSedes = async () => {
    try {
      const { data, error } = await supabase
        .from('sedes')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('❌ Error cargando sedes:', error);
        return;
      }

      setSedes(data || []);
    } catch (err) {
      console.error('❌ Error en loadSedes:', err);
    }
  };

  // Cargar métricas de resumen
  const loadSummaryMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: MetricsFilters = {
        fecha_inicio: format(dateRange.from, 'yyyy-MM-dd'),
        fecha_fin: format(dateRange.to, 'yyyy-MM-dd'),
        sede_id: selectedSede === 'global' ? undefined : selectedSede
      };

      const [stats, distribution] = await Promise.all([
        metricsService.getPhaseTimeStats(filters),
        metricsService.getPhaseDistribution(filters)
      ]);

      setPhaseStats(stats);
      setPhaseDistribution(distribution);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error('❌ Error cargando métricas de resumen:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos para gráfica de líneas
  const loadChartData = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('ordenes_duraciones_con_sede')
        .select('*')
        .gte('created_at', `${format(dateRange.from, 'yyyy-MM-dd')}T00:00:00.000Z`)
        .lte('created_at', `${format(dateRange.to, 'yyyy-MM-dd')}T23:59:59.999Z`)
        .not('min_total_desde_recibidos', 'is', null);

      // Si no es global, filtrar por sede específica
      if (selectedSede !== 'global') {
        query = query.eq('sede_id', selectedSede);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Error al obtener datos de gráfica: ${error.message}`);
      }

      // Procesar datos para la gráfica de líneas
      const processedData = processChartData(data || []);
      setChartData(processedData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error('❌ Error cargando datos de gráfica:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Procesar datos para la gráfica agrupados por fecha y sede
  const processChartData = (rawData: OrderTimeMetrics[]): PhaseTimeTrend[] => {
    const groupedData = new Map<string, Map<string, {
      times_recibidos_cocina: number[];
      times_cocina_camino: number[];
      times_camino_fin: number[];
      times_total: number[];
      sede_name: string;
    }>>();

    rawData.forEach(order => {
      const date = format(new Date(order.created_at), 'yyyy-MM-dd');
      const sedeId = order.sede_id;
      const sedeName = order.sede_nombre || 'Sede desconocida';

      if (!groupedData.has(date)) {
        groupedData.set(date, new Map());
      }

      const dateGroup = groupedData.get(date)!;
      if (!dateGroup.has(sedeId)) {
        dateGroup.set(sedeId, {
          times_recibidos_cocina: [],
          times_cocina_camino: [],
          times_camino_fin: [],
          times_total: [],
          sede_name: sedeName
        });
      }

      const sedeGroup = dateGroup.get(sedeId)!;

      if (order.min_recibidos_a_cocina !== null) {
        sedeGroup.times_recibidos_cocina.push(order.min_recibidos_a_cocina);
      }
      if (order.min_cocina_a_camino !== null) {
        sedeGroup.times_cocina_camino.push(order.min_cocina_a_camino);
      }
      if (order.min_camino_a_fin !== null) {
        sedeGroup.times_camino_fin.push(order.min_camino_a_fin);
      }
      if (order.min_total_desde_recibidos !== null) {
        sedeGroup.times_total.push(order.min_total_desde_recibidos);
      }
    });

    // Convertir a array de tendencias
    const trends: PhaseTimeTrend[] = [];

    groupedData.forEach((sedeMap, date) => {
      sedeMap.forEach((data, sedeId) => {
        const calculateAvg = (times: number[]) => 
          times.length > 0 ? times.reduce((sum, val) => sum + val, 0) / times.length : 0;

        trends.push({
          date,
          sede_id: sedeId,
          sede_name: data.sede_name,
          avg_recibidos_a_cocina: calculateAvg(data.times_recibidos_cocina),
          avg_cocina_a_camino: calculateAvg(data.times_cocina_camino),
          avg_camino_a_fin: calculateAvg(data.times_camino_fin),
          avg_total_desde_recibidos: calculateAvg(data.times_total),
          order_count: data.times_total.length
        });
      });
    });

    return trends.sort((a, b) => a.date.localeCompare(b.date));
  };

  // Cargar datos según el modo de vista
  const loadData = () => {
    if (viewMode === 'summary') {
      loadSummaryMetrics();
    } else {
      loadChartData();
    }
  };

  useEffect(() => {
    loadSedes();
  }, []);

  useEffect(() => {
    loadData();
  }, [dateRange, selectedSede, viewMode]);

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

  // Obtener colores únicos para cada sede en la gráfica
  const getUniqueSedeColors = (): { [key: string]: string } => {
    const colors: { [key: string]: string } = {};
    const uniqueSedes = Array.from(new Set(chartData.map(item => item.sede_id)));
    
    uniqueSedes.forEach(sedeId => {
      const sedeName = chartData.find(item => item.sede_id === sedeId)?.sede_name || '';
      colors[sedeId] = getSedeColor(sedeId, sedeName);
    });
    
    return colors;
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>Error: {error}</span>
            </div>
            <Button onClick={loadData} className="mt-4" variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button onClick={onBack} variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-bold">Métricas de Tiempo por Fases</h1>
            <p className="text-muted-foreground">
              Análisis detallado de tiempos de procesamiento de pedidos
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={loadData}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Cargando...' : 'Actualizar'}
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Selector de rango de fechas */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Rango de fechas</label>
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[300px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from && dateRange.to ? (
                      `${format(dateRange.from, 'dd/MM/yyyy', { locale: es })} - ${format(dateRange.to, 'dd/MM/yyyy', { locale: es })}`
                    ) : (
                      'Seleccionar rango'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3 space-y-3">
                    <h4 className="font-medium text-sm">Seleccionar rango de fechas</h4>
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange.from}
                      selected={{ from: dateRange.from, to: dateRange.to }}
                      onSelect={(range) => {
                        if (range?.from && range?.to) {
                          setDateRange({ from: range.from, to: range.to });
                        } else if (range?.from) {
                          setDateRange({ from: range.from, to: range.from });
                        }
                      }}
                      numberOfMonths={2}
                      locale={es}
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => setIsDatePickerOpen(false)}
                    >
                      Aplicar
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Selector de sede */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Sede</label>
              <Select value={selectedSede} onValueChange={setSelectedSede}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Seleccionar sede" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">🌍 Global (Todas las sedes)</SelectItem>
                  {sedes.map((sede) => (
                    <SelectItem key={sede.id} value={sede.id}>
                      🏢 {sede.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selector de modo de vista */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Vista</label>
              <Select value={viewMode} onValueChange={(value: 'summary' | 'chart') => setViewMode(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Resumen por Fase
                    </div>
                  </SelectItem>
                  <SelectItem value="chart">
                    <div className="flex items-center gap-2">
                      <LineChart className="h-4 w-4" />
                      Gráfica de Líneas
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Cargando métricas de tiempo...
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'summary' ? (
        /* Vista de Resumen */
        <div className="space-y-6">
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
                    <Timer className="h-8 w-8 text-blue-500" />
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
                    <Package className="h-8 w-8 text-yellow-500" />
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
                    <Truck className="h-8 w-8 text-orange-500" />
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
                    <BarChart3 className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Distribución detallada por fases */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Distribución Detallada por Fases
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {phaseDistribution.map((phase, index) => (
                  <div key={index} className="space-y-4 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{phase.phase}</h3>
                      <Badge variant="outline">{phase.count} órdenes</Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Promedio:</span>
                        <span className="font-medium">{formatMinutes(phase.avg_minutes)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mínimo:</span>
                        <span className="font-medium">{formatMinutes(phase.min_minutes)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Máximo:</span>
                        <span className="font-medium">{formatMinutes(phase.max_minutes)}</span>
                      </div>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="h-3 rounded-full transition-all"
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
        </div>
      ) : (
        /* Vista de Gráfica de Líneas */
        <div className="space-y-6">
          {/* Indicador de colores por sede */}
          {selectedSede === 'global' && chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Indicador de Colores por Sede
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {Array.from(new Set(chartData.map(item => item.sede_id))).map(sedeId => {
                    const sedeName = chartData.find(item => item.sede_id === sedeId)?.sede_name || 'Desconocida';
                    const color = getSedeColor(sedeId, sedeName);
                    return (
                      <div key={sedeId} className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-sm font-medium">{sedeName}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Gráfica de tendencias (simulada con barras por ahora) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="h-5 w-5" />
                Tendencia de Tiempos por {selectedSede === 'global' ? 'Sede' : 'Día'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {chartData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay datos disponibles para el rango seleccionado
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Agrupamos por fecha para mostrar tendencias */}
                    {Array.from(new Set(chartData.map(item => item.date))).map(date => (
                      <div key={date} className="space-y-2">
                        <h4 className="font-medium">
                          {format(new Date(date), 'EEEE, dd/MM/yyyy', { locale: es })}
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {chartData
                            .filter(item => item.date === date)
                            .map(item => {
                              const color = getSedeColor(item.sede_id, item.sede_name);
                              return (
                                <div 
                                  key={`${item.date}-${item.sede_id}`}
                                  className="flex items-center justify-between p-3 rounded-lg border"
                                  style={{ borderLeft: `4px solid ${color}` }}
                                >
                                  <div className="flex items-center gap-3">
                                    <div 
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: color }}
                                    />
                                    <span className="font-medium">{item.sede_name}</span>
                                  </div>
                                  <div className="flex gap-4 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Total: </span>
                                      <span className="font-medium">
                                        {formatMinutes(item.avg_total_desde_recibidos)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Órdenes: </span>
                                      <span className="font-medium">{item.order_count}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};