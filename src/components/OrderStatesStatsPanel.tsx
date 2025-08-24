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
  Activity,
  Inbox,
  ChefHat,
  AlertTriangle
} from 'lucide-react';
import { 
  metricsService, 
  MetricsFilters 
} from '@/services/metricsService';
import { supabase } from '@/lib/supabase';

interface OrderStatesStatsPanelProps {
  filters: MetricsFilters;
  onRefresh?: () => void;
}

interface StateStats {
  state: string;
  state_label: string;
  icon: React.ReactNode;
  color: string;
  total_orders: number;
  avg_time_in_state: number; // tiempo promedio que las órdenes permanecen en este estado
  min_time_in_state: number;
  max_time_in_state: number;
  orders_stuck: number; // órdenes que llevan mucho tiempo en este estado
  efficiency_score: number; // puntuación de eficiencia (0-100)
}

interface TransitionStats {
  from_state: string;
  to_state: string;
  avg_transition_time: number;
  transition_count: number;
  fastest_transition: number;
  slowest_transition: number;
}

export const OrderStatesStatsPanel: React.FC<OrderStatesStatsPanelProps> = ({ 
  filters, 
  onRefresh 
}) => {
  const [stateStats, setStateStats] = useState<StateStats[]>([]);
  const [transitionStats, setTransitionStats] = useState<TransitionStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar estadísticas de estados
  const loadStateStats = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('📊 Cargando estadísticas por estado...');

      // Consulta directa a la base de datos para obtener estadísticas por estado
      const { data, error } = await supabase
        .from('ordenes_duraciones_con_sede')
        .select('*')
        .gte('created_at', `${filters.fecha_inicio}T00:00:00.000Z`)
        .lte('created_at', `${filters.fecha_fin}T23:59:59.999Z`)
        .not('status', 'is', null);

      if (error) {
        throw new Error(`Error al obtener estadísticas: ${error.message}`);
      }

      // Procesar datos para cada estado
      const processedStats = processStateStatistics(data || []);
      setStateStats(processedStats);

      // Procesar estadísticas de transiciones
      const processedTransitions = processTransitionStatistics(data || []);
      setTransitionStats(processedTransitions);

      console.log('✅ Estadísticas por estado cargadas exitosamente');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error('❌ Error cargando estadísticas por estado:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Procesar estadísticas por estado
  const processStateStatistics = (data: any[]): StateStats[] => {
    const states = [
      { key: 'Recibidos', label: 'Recibidos', icon: <Inbox className="h-4 w-4" />, color: 'bg-blue-500' },
      { key: 'Cocina', label: 'En Cocina', icon: <ChefHat className="h-4 w-4" />, color: 'bg-orange-500' },
      { key: 'Camino', label: 'En Camino', icon: <Truck className="h-4 w-4" />, color: 'bg-yellow-500' },
      { key: 'Entregados', label: 'Entregados', icon: <CheckCircle className="h-4 w-4" />, color: 'bg-green-500' }
    ];

    return states.map(state => {
      const stateOrders = data.filter(order => order.status === state.key);
      const totalOrders = stateOrders.length;
      
      // Calcular tiempo promedio que las órdenes permanecen en este estado
      let avgTimeInState = 0;
      let minTime = Infinity;
      let maxTime = 0;
      let ordersStuck = 0;

      if (totalOrders > 0) {
        const times: number[] = [];
        
        stateOrders.forEach(order => {
          let timeInState = 0;
          const now = new Date();
          
          // Calcular tiempo en el estado actual
          switch (state.key) {
            case 'Recibidos':
              if (order.recibidos_at) {
                const endTime = order.cocina_at ? new Date(order.cocina_at) : now;
                timeInState = (endTime.getTime() - new Date(order.recibidos_at).getTime()) / (1000 * 60);
              }
              break;
            case 'Cocina':
              if (order.cocina_at) {
                const endTime = order.camino_at ? new Date(order.camino_at) : now;
                timeInState = (endTime.getTime() - new Date(order.cocina_at).getTime()) / (1000 * 60);
              }
              break;
            case 'Camino':
              if (order.camino_at) {
                const endTime = order.entregado_at ? new Date(order.entregado_at) : now;
                timeInState = (endTime.getTime() - new Date(order.camino_at).getTime()) / (1000 * 60);
              }
              break;
            case 'Entregados':
              if (order.entregado_at && order.camino_at) {
                timeInState = (new Date(order.entregado_at).getTime() - new Date(order.camino_at).getTime()) / (1000 * 60);
              }
              break;
          }

          if (timeInState > 0) {
            times.push(timeInState);
            minTime = Math.min(minTime, timeInState);
            maxTime = Math.max(maxTime, timeInState);
            
            // Determinar si la orden está "atascada" (tiempo excesivo)
            const thresholds = { 
              'Recibidos': 15, 
              'Cocina': 45, 
              'Camino': 60, 
              'Entregados': 5 
            };
            
            if (timeInState > thresholds[state.key as keyof typeof thresholds]) {
              ordersStuck++;
            }
          }
        });

        avgTimeInState = times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0;
        minTime = minTime === Infinity ? 0 : minTime;
      } else {
        minTime = 0;
      }

      // Calcular puntuación de eficiencia (0-100)
      const idealTimes = { 
        'Recibidos': 5, 
        'Cocina': 30, 
        'Camino': 40, 
        'Entregados': 2 
      };
      const idealTime = idealTimes[state.key as keyof typeof idealTimes];
      const efficiencyScore = avgTimeInState > 0 
        ? Math.max(0, Math.min(100, 100 - ((avgTimeInState - idealTime) / idealTime) * 50))
        : 100;

      return {
        state: state.key,
        state_label: state.label,
        icon: state.icon,
        color: state.color,
        total_orders: totalOrders,
        avg_time_in_state: avgTimeInState,
        min_time_in_state: minTime,
        max_time_in_state: maxTime,
        orders_stuck: ordersStuck,
        efficiency_score: efficiencyScore
      };
    });
  };

  // Procesar estadísticas de transiciones entre estados
  const processTransitionStatistics = (data: any[]): TransitionStats[] => {
    const transitions = [
      { from: 'Recibidos', to: 'Cocina', field: 'min_recibidos_a_cocina' },
      { from: 'Cocina', to: 'Camino', field: 'min_cocina_a_camino' },
      { from: 'Camino', to: 'Entregados', field: 'min_camino_a_fin' }
    ];

    return transitions.map(transition => {
      const validTransitions = data
        .filter(order => order[transition.field] !== null && order[transition.field] > 0)
        .map(order => order[transition.field]);

      if (validTransitions.length === 0) {
        return {
          from_state: transition.from,
          to_state: transition.to,
          avg_transition_time: 0,
          transition_count: 0,
          fastest_transition: 0,
          slowest_transition: 0
        };
      }

      const avgTime = validTransitions.reduce((sum, time) => sum + time, 0) / validTransitions.length;
      const fastestTime = Math.min(...validTransitions);
      const slowestTime = Math.max(...validTransitions);

      return {
        from_state: transition.from,
        to_state: transition.to,
        avg_transition_time: avgTime,
        transition_count: validTransitions.length,
        fastest_transition: fastestTime,
        slowest_transition: slowestTime
      };
    });
  };

  useEffect(() => {
    loadStateStats();
  }, [filters]);

  // Formatear minutos a texto legible
  const formatMinutes = (minutes: number) => {
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

  // Obtener color de eficiencia
  const getEfficiencyColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>Error: {error}</span>
          </div>
          <Button onClick={loadStateStats} className="mt-4" variant="outline">
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
          <h2 className="text-2xl font-bold">Estadísticas por Estado de Órdenes</h2>
          <p className="text-muted-foreground">
            Análisis detallado del tiempo en cada estado y transiciones
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              loadStateStats();
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

      {/* Estadísticas por Estado */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stateStats.map((stat) => (
          <Card key={stat.state}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-full ${stat.color}`}>
                    <div className="text-white">
                      {stat.icon}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.state_label}</p>
                    <p className="text-2xl font-bold">{stat.total_orders}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Tiempo Promedio:</span>
                  <span className="text-sm font-medium">{formatMinutes(stat.avg_time_in_state)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Rango:</span>
                  <span className="text-sm font-medium">
                    {formatMinutes(stat.min_time_in_state)} - {formatMinutes(stat.max_time_in_state)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Atascadas:</span>
                  <Badge variant={stat.orders_stuck > 0 ? "destructive" : "secondary"}>
                    {stat.orders_stuck}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Eficiencia:</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getEfficiencyColor(stat.efficiency_score)}`} />
                    <span className="text-sm font-medium">{Math.round(stat.efficiency_score)}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Estadísticas de Transiciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Tiempos de Transición entre Estados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {transitionStats.map((transition, index) => (
              <div key={index} className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">
                    {transition.from_state} → {transition.to_state}
                  </h3>
                  <Badge variant="outline">{transition.transition_count} transiciones</Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Promedio:</span>
                    <span className="font-medium">{formatMinutes(transition.avg_transition_time)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Más Rápida:</span>
                    <span className="font-medium text-green-600">{formatMinutes(transition.fastest_transition)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Más Lenta:</span>
                    <span className="font-medium text-red-600">{formatMinutes(transition.slowest_transition)}</span>
                  </div>
                </div>
                
                {/* Barra de progreso visual */}
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="h-3 rounded-full transition-all bg-blue-500"
                    style={{
                      width: `${Math.min((transition.avg_transition_time / 60) * 100, 100)}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};