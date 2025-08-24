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
import { OrderStatesStatsPanel } from './OrderStatesStatsPanel';
import { useTimeMetricsState } from '@/hooks/useTimeMetricsState';
import { supabase } from '@/lib/supabase';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import {
  Line,
  LineChart as RechartsLineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';

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
  // Usar hook persistente para el estado
  const { viewMode, selectedSede, dateRange, updateState } = useTimeMetricsState();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  const [sedes, setSedes] = useState<Sede[]>([]);
  
  const [phaseStats, setPhaseStats] = useState<PhaseTimeStats | null>(null);
  const [phaseDistribution, setPhaseDistribution] = useState<PhaseDistribution[]>([]);
  const [chartData, setChartData] = useState<PhaseTimeTrend[]>([]);
  const [rawChartData, setRawChartData] = useState<any[]>([]); // Raw data from database
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Función para generar colores únicos y consistentes por sede
  const getSedeColor = (sedeId: string, sedeName: string): string => {
    // Crear hash más robusto combinando sedeId y sedeName
    let hash = 0;
    const str = `${sedeId}-${sedeName}`;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash; // Convertir a 32bit integer
    }
    
    // Asegurar que el hash sea positivo
    hash = Math.abs(hash);
    
    // Generar colores con mejor separación visual
    // Usar secuencia de colores predefinidos basado en el hash
    const predefinedColors = [
      { h: 0, s: 70, l: 50 },     // Rojo
      { h: 120, s: 70, l: 45 },   // Verde
      { h: 240, s: 70, l: 55 },   // Azul
      { h: 30, s: 75, l: 50 },    // Naranja
      { h: 270, s: 65, l: 55 },   // Púrpura
      { h: 180, s: 70, l: 45 },   // Cian
      { h: 60, s: 70, l: 50 },    // Amarillo verdoso
      { h: 300, s: 70, l: 55 },   // Magenta
      { h: 200, s: 65, l: 50 },   // Azul claro
      { h: 340, s: 70, l: 55 }    // Rosa
    ];
    
    // Seleccionar color basado en el hash
    const colorIndex = hash % predefinedColors.length;
    const baseColor = predefinedColors[colorIndex];
    
    // Aplicar ligeras variaciones basadas en el hash para evitar duplicados exactos
    const hueVariation = (hash % 40) - 20; // ±20 grados
    const satVariation = (hash % 20) - 10; // ±10%
    
    const finalHue = (baseColor.h + hueVariation + 360) % 360;
    const finalSaturation = Math.max(50, Math.min(80, baseColor.s + satVariation));
    const finalLightness = baseColor.l;
    
    return `hsl(${finalHue}, ${finalSaturation}%, ${finalLightness}%)`;
  };

  // Función para preparar datos para la gráfica de líneas por etapas
  const prepareChartData = () => {
    if (!rawChartData.length) {
      console.log('❌ No hay datos raw - usando datos de ejemplo');
      // Datos de ejemplo para probar la gráfica
      return [
        { stage: 'Recibido', stageKey: 'recibido', 'Sede Norte': 0, 'Sede Sur': 0 },
        { stage: 'En Cocina', stageKey: 'cocina', 'Sede Norte': 8, 'Sede Sur': 12 },
        { stage: 'En Camino', stageKey: 'camino', 'Sede Norte': 25, 'Sede Sur': 30 },
        { stage: 'Entregado', stageKey: 'entregado', 'Sede Norte': 45, 'Sede Sur': 55 }
      ];
    }

    console.log('📊 Datos RAW para gráfica por etapas:', rawChartData);
    console.log('🔍 Ejemplo de estructura de datos raw:', rawChartData[0]);

    // Definir las etapas del proceso
    const stages = [
      { key: 'recibido', label: 'Recibido', time: 0 }, // Punto inicial
      { key: 'cocina', label: 'En Cocina', field: 'min_recibidos_a_cocina' },
      { key: 'camino', label: 'En Camino', field: 'min_cocina_a_camino' },
      { key: 'entregado', label: 'Entregado', field: 'min_camino_a_fin' }
    ];

    // Obtener sedes únicas del raw data
    const sedes = Array.from(new Set(rawChartData.map(item => item.sede_id)));
    console.log('🏢 Sedes únicas:', sedes);

    // Calcular promedios por sede para cada transición usando raw data
    const sedeAverages = sedes.map(sedeId => {
      const sedeOrders = rawChartData.filter(item => item.sede_id === sedeId);
      const sedeName = sedeOrders[0]?.sede_nombre || sedeOrders[0]?.sede_name || 'Desconocida';
      
      console.log(`🏢 Procesando sede: ${sedeName} (${sedeId}) con ${sedeOrders.length} órdenes`);
      
      // Filtrar órdenes con datos válidos para cada transición
      const validRecibidosACocina = sedeOrders.filter(order => 
        order.min_recibidos_a_cocina !== null && 
        order.min_recibidos_a_cocina !== undefined && 
        order.min_recibidos_a_cocina > 0
      );
      
      const validCocinaACamino = sedeOrders.filter(order => 
        order.min_cocina_a_camino !== null && 
        order.min_cocina_a_camino !== undefined && 
        order.min_cocina_a_camino > 0
      );
      
      const validCaminoAFin = sedeOrders.filter(order => 
        order.min_camino_a_fin !== null && 
        order.min_camino_a_fin !== undefined && 
        order.min_camino_a_fin > 0
      );

      console.log(`📊 Órdenes válidas para ${sedeName}:`, {
        recibidosACocina: validRecibidosACocina.length,
        cocinaACamino: validCocinaACamino.length,
        caminoAFin: validCaminoAFin.length,
        ejemploTiempos: sedeOrders[0] ? {
          recibidos_a_cocina: sedeOrders[0].min_recibidos_a_cocina,
          cocina_a_camino: sedeOrders[0].min_cocina_a_camino,
          camino_a_fin: sedeOrders[0].min_camino_a_fin,
          total_desde_recibidos: sedeOrders[0].min_total_desde_recibidos
        } : 'Sin datos'
      });
      
      // Calcular promedios de tiempos para esta sede
      const avgTimes = {
        recibidos_a_cocina: validRecibidosACocina.length > 0 
          ? validRecibidosACocina.reduce((sum, order) => sum + order.min_recibidos_a_cocina!, 0) / validRecibidosACocina.length
          : 0,
        
        cocina_a_camino: validCocinaACamino.length > 0
          ? validCocinaACamino.reduce((sum, order) => sum + order.min_cocina_a_camino!, 0) / validCocinaACamino.length
          : 0,
        
        camino_a_fin: validCaminoAFin.length > 0
          ? validCaminoAFin.reduce((sum, order) => sum + order.min_camino_a_fin!, 0) / validCaminoAFin.length
          : 0
      };

      console.log(`⏱️ Tiempos promedio para ${sedeName}:`, avgTimes);

      return {
        sedeId,
        sedeName,
        orderCount: sedeOrders.length,
        avgTimes
      };
    }).filter(sede => sede.orderCount > 0); // Solo sedes con datos

    // Crear datos para la gráfica por etapas (tiempo acumulativo)
    const processedData = stages.map(stage => {
      const dataPoint: any = {
        stage: stage.label,
        stageKey: stage.key
      };

      // Para cada sede, calcular el tiempo acumulativo hasta esta etapa
      sedeAverages.forEach(sede => {
        let cumulativeTime = 0;
        
        switch (stage.key) {
          case 'recibido':
            cumulativeTime = 0; // Punto de partida
            break;
          case 'cocina':
            cumulativeTime = sede.avgTimes.recibidos_a_cocina;
            break;
          case 'camino':
            cumulativeTime = sede.avgTimes.recibidos_a_cocina + sede.avgTimes.cocina_a_camino;
            break;
          case 'entregado':
            cumulativeTime = sede.avgTimes.recibidos_a_cocina + sede.avgTimes.cocina_a_camino + sede.avgTimes.camino_a_fin;
            break;
        }

        // Solo agregar si es un valor válido
        if (cumulativeTime >= 0 && !isNaN(cumulativeTime)) {
          dataPoint[sede.sedeName] = Number(cumulativeTime.toFixed(1));
          console.log(`📍 ${sede.sedeName} en etapa ${stage.label}: ${cumulativeTime.toFixed(1)} min`);
        } else {
          console.log(`⚠️ ${sede.sedeName} en etapa ${stage.label}: tiempo inválido (${cumulativeTime})`);
        }
      });

      return dataPoint;
    });

    console.log('📈 Datos procesados para gráfica por etapas:', processedData);
    console.log('🏢 Promedios por sede:', sedeAverages);
    
    return processedData;
  };

  // Configuración de la gráfica
  const chartConfig = (() => {
    if (!rawChartData.length) {
      // Configuración para datos de ejemplo
      return {
        'Sede Norte': {
          label: 'Sede Norte',
          color: getSedeColor('sede-norte', 'Sede Norte')
        },
        'Sede Sur': {
          label: 'Sede Sur', 
          color: getSedeColor('sede-sur', 'Sede Sur')
        }
      };
    }
    
    // Configuración normal con datos reales usando rawChartData
    return Object.fromEntries(
      Array.from(new Set(rawChartData.map(item => item.sede_nombre || item.sede_name))).map(sedeName => [
        sedeName,
        {
          label: sedeName,
          color: getSedeColor(
            rawChartData.find(item => (item.sede_nombre || item.sede_name) === sedeName)?.sede_id || '',
            sedeName
          )
        }
      ])
    );
  })();

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

      console.log('🔍 Consultando tabla: ordenes_duraciones_con_sede');
      console.log('📅 Rango de fechas:', format(dateRange.from, 'yyyy-MM-dd'), 'a', format(dateRange.to, 'yyyy-MM-dd'));
      
      let query = supabase
        .from('ordenes_duraciones_con_sede')
        .select('*')
        .gte('created_at', `${format(dateRange.from, 'yyyy-MM-dd')}T00:00:00.000Z`)
        .lte('created_at', `${format(dateRange.to, 'yyyy-MM-dd')}T23:59:59.999Z`)
        .not('min_total_desde_recibidos', 'is', null);

      console.log('🔍 Query construida:', query);

      // Si no es global, filtrar por sede específica
      if (selectedSede !== 'global') {
        query = query.eq('sede_id', selectedSede);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Error al obtener datos de gráfica: ${error.message}`);
      }

      console.log('🗄️ Datos obtenidos de BD:', data);
      console.log('📊 Cantidad de registros:', data?.length || 0);

      // Guardar raw data para el chart de etapas
      setRawChartData(data || []);

      // Procesar datos para la gráfica de líneas (trend data)
      const processedData = processChartData(data || []);
      console.log('🔄 Datos procesados:', processedData);
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
    console.log('🔄 Procesando datos raw:', rawData);
    console.log('📊 Cantidad de registros raw:', rawData.length);

    const groupedData = new Map<string, Map<string, {
      times_recibidos_cocina: number[];
      times_cocina_camino: number[];
      times_camino_fin: number[];
      times_total: number[];
      sede_name: string;
    }>>();

    rawData.forEach((order, index) => {
      console.log(`📋 Procesando orden ${index + 1}:`, {
        id: order.id,
        created_at: order.created_at,
        sede_id: order.sede_id,
        sede_nombre: order.sede_nombre,
        min_total_desde_recibidos: order.min_total_desde_recibidos
      });

      const date = format(new Date(order.created_at), 'yyyy-MM-dd');
      const sedeId = order.sede_id;
      const sedeName = order.sede_nombre || 'Sede desconocida';

      console.log(`📅 Fecha procesada: ${date}, Sede: ${sedeName}`);

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
        console.log(`✅ Agregado tiempo total: ${order.min_total_desde_recibidos} min`);
      } else {
        console.log(`❌ Tiempo total es null para orden ${order.id}`);
      }
    });

    // Convertir a array de tendencias
    const trends: PhaseTimeTrend[] = [];

    console.log('📊 Datos agrupados:', groupedData);

    groupedData.forEach((sedeMap, date) => {
      console.log(`📅 Procesando fecha: ${date}`);
      sedeMap.forEach((data, sedeId) => {
        const calculateAvg = (times: number[]) => 
          times.length > 0 ? times.reduce((sum, val) => sum + val, 0) / times.length : 0;

        const avgTotal = calculateAvg(data.times_total);
        console.log(`🏢 Sede ${data.sede_name}: ${data.times_total.length} órdenes, promedio: ${avgTotal} min`);

        trends.push({
          date,
          sede_id: sedeId,
          sede_name: data.sede_name,
          avg_recibidos_a_cocina: calculateAvg(data.times_recibidos_cocina),
          avg_cocina_a_camino: calculateAvg(data.times_cocina_camino),
          avg_camino_a_fin: calculateAvg(data.times_camino_fin),
          avg_total_desde_recibidos: avgTotal,
          order_count: data.times_total.length
        });
      });
    });

    const sortedTrends = trends.sort((a, b) => a.date.localeCompare(b.date));
    console.log('📈 Tendencias finales:', sortedTrends);
    return sortedTrends;
  };

  // Cargar datos según el modo de vista
  const loadData = () => {
    if (viewMode === 'summary') {
      loadSummaryMetrics();
    } else if (viewMode === 'chart') {
      loadChartData();
    }
    // Para 'states', el componente OrderStatesStatsPanel maneja su propia carga de datos
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

  // Calcular el dominio dinámico del eje Y basado en los datos
  const calculateYAxisDomain = () => {
    const data = prepareChartData();
    if (!data || data.length === 0) {
      return [0, 60]; // Dominio por defecto para datos de ejemplo
    }

    let maxValue = 0;
    
    // Encontrar el valor máximo en todos los puntos de datos
    data.forEach(point => {
      // Excluir 'stage' y 'stageKey' del análisis
      Object.keys(point).forEach(key => {
        if (key !== 'stage' && key !== 'stageKey') {
          const value = point[key as keyof typeof point];
          if (typeof value === 'number' && value > maxValue) {
            maxValue = value;
          }
        }
      });
    });

    console.log('📊 Valor máximo encontrado en los datos:', maxValue);

    // Si no hay datos válidos, usar dominio por defecto
    if (maxValue === 0) {
      return [0, 60];
    }

    // Agregar un 20% de margen al valor máximo para mejor visualización
    const domainMax = Math.ceil(maxValue * 1.2);
    console.log('📊 Dominio Y calculado: [0, ' + domainMax + ']');
    
    return [0, domainMax];
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
                          updateState({ dateRange: { from: range.from, to: range.to } });
                        } else if (range?.from) {
                          updateState({ dateRange: { from: range.from, to: range.from } });
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
              <Select value={selectedSede} onValueChange={(sede) => updateState({ selectedSede: sede })}>
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
              <Select value={viewMode} onValueChange={(value: 'summary' | 'chart' | 'states') => updateState({ viewMode: value })}>
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
                  <SelectItem value="states">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Estados y Validación
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
      ) : viewMode === 'chart' ? (
        /* Vista de Gráfica de Líneas */
        <div className="space-y-6">
          {/* Indicador de colores por sede */}
          {selectedSede === 'global' && rawChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Leyenda de Sedes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {(() => {
                    if (!rawChartData.length) {
                      // Mostrar datos de ejemplo
                      return ['Sede Norte', 'Sede Sur'].map(sedeName => {
                        const color = getSedeColor(`sede-${sedeName.toLowerCase().replace(' ', '-')}`, sedeName);
                        return (
                          <div key={sedeName} className="flex items-center gap-3 p-2 rounded-lg border">
                            <div 
                              className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                              style={{ backgroundColor: color }}
                            />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{sedeName}</span>
                              <span className="text-xs text-muted-foreground">Datos de ejemplo</span>
                            </div>
                          </div>
                        );
                      });
                    }
                    
                    // Datos reales usando rawChartData
                    return Array.from(new Set(rawChartData.map(item => item.sede_id))).map(sedeId => {
                      const sedeName = rawChartData.find(item => item.sede_id === sedeId)?.sede_nombre || 
                                      rawChartData.find(item => item.sede_id === sedeId)?.sede_name || 'Desconocida';
                      const sedeOrderCount = rawChartData.filter(item => item.sede_id === sedeId).length;
                      const color = getSedeColor(sedeId, sedeName);
                      return (
                        <div key={sedeId} className="flex items-center gap-3 p-2 rounded-lg border">
                          <div 
                            className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: color }}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{sedeName}</span>
                            <span className="text-xs text-muted-foreground">{sedeOrderCount} órdenes</span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resumen del análisis */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>📅 Período: {format(dateRange.from, 'dd/MM/yyyy', { locale: es })} - {format(dateRange.to, 'dd/MM/yyyy', { locale: es })}</span>
                  <span>🏢 {selectedSede === 'global' ? 'Todas las sedes' : sedes.find(s => s.id === selectedSede)?.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span>📊 {rawChartData.length} órdenes analizadas</span>
                  <span>⏱️ Tiempos promedio por etapa</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gráfica de líneas real */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="h-5 w-5" />
                Progreso de Tiempo por Etapas del Proceso
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Tiempo acumulativo desde que se recibe la orden hasta la entrega final
              </p>
            </CardHeader>
            <CardContent>
              {rawChartData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay datos disponibles para el rango seleccionado
                </div>
              ) : (
                <div className="h-[400px]">
                  <ChartContainer config={chartConfig}>
                    <RechartsLineChart data={prepareChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="stage" 
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value} min`}
                        domain={calculateYAxisDomain()}
                      />
                      <ChartTooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="rounded-lg border bg-background p-3 shadow-sm min-w-[200px]">
                                <div className="space-y-2">
                                  <div className="border-b pb-2">
                                    <span className="text-sm font-medium">
                                      Etapa: {label}
                                    </span>
                                  </div>
                                  {payload
                                    .filter((entry: any) => entry.value !== null && entry.value > 0)
                                    .map((entry: any, index: number) => (
                                    <div key={index} className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div 
                                          className="w-3 h-3 rounded-full"
                                          style={{ backgroundColor: entry.color }}
                                        />
                                        <span className="text-sm text-muted-foreground">
                                          {entry.dataKey}
                                        </span>
                                      </div>
                                      <span className="font-bold text-sm">
                                        {entry.value} min
                                      </span>
                                    </div>
                                  ))}
                                  <div className="text-xs text-muted-foreground pt-1 border-t">
                                    Tiempo acumulativo desde el inicio
                                  </div>
                                </div>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <ChartLegend />
                      {(() => {
                        if (!rawChartData.length) {
                          // Usar datos de ejemplo cuando no hay datos reales
                          return ['Sede Norte', 'Sede Sur'].map((sedeName, index) => {
                            const color = getSedeColor(`sede-${sedeName.toLowerCase().replace(' ', '-')}`, sedeName);
                            
                            return (
                              <Line
                                key={sedeName}
                                type="monotone"
                                dataKey={sedeName}
                                stroke={color}
                                strokeWidth={3}
                                dot={{ 
                                  fill: color, 
                                  strokeWidth: 2, 
                                  r: 5,
                                  stroke: color
                                }}
                                activeDot={{ 
                                  r: 8, 
                                  strokeWidth: 3,
                                  fill: color,
                                  stroke: '#fff'
                                }}
                                connectNulls={false}
                              />
                            );
                          });
                        }
                        
                        // Datos reales usando rawChartData
                        return Array.from(new Set(rawChartData.map(item => item.sede_nombre || item.sede_name))).map((sedeName, index) => {
                          const sedeId = rawChartData.find(item => (item.sede_nombre || item.sede_name) === sedeName)?.sede_id || '';
                          const color = getSedeColor(sedeId, sedeName);
                        
                          return (
                            <Line
                              key={sedeName}
                              type="monotone"
                              dataKey={sedeName}
                              stroke={color}
                              strokeWidth={3}
                              dot={{ 
                                fill: color, 
                                strokeWidth: 2, 
                                r: 5,
                                stroke: color
                              }}
                              activeDot={{ 
                                r: 8, 
                                strokeWidth: 3,
                                fill: color,
                                stroke: '#fff'
                              }}
                              connectNulls={false}
                            />
                          );
                        });
                      })()}
                    </RechartsLineChart>
                  </ChartContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : viewMode === 'states' ? (
        /* Vista de Estados y Validación */
        <OrderStatesStatsPanel 
          filters={{
            fecha_inicio: format(dateRange.from, 'yyyy-MM-dd'),
            fecha_fin: format(dateRange.to, 'yyyy-MM-dd'),
            sede_id: selectedSede === 'global' ? undefined : selectedSede
          }}
          onRefresh={loadData}
        />
      ) : null}
    </div>
  );
};