import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExportButton } from '@/components/ui/ExportButton';
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
  AlertTriangle,
  Search,
  X,
  Table as TableIcon,
  Eye
} from 'lucide-react';
import {
  metricsService,
  MetricsFilters
} from '@/services/metricsService';
import { supabase } from '@/lib/supabase';
import { formatters, TableColumn, PDFSection } from '@/utils/exportUtils';

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

interface OrderDetailRow {
  id: number;
  status: string;
  sede_nombre: string;
  created_at: string;
  recibidos_at: string | null;
  cocina_at: string | null;
  camino_at: string | null;
  entregado_at: string | null;
  min_recibidos_a_cocina: number | null;
  min_cocina_a_camino: number | null;
  min_camino_a_fin: number | null;
  min_total_desde_recibidos: number | null;
  current_stage_duration: number;
  is_stuck: boolean;
}

export const OrderStatesStatsPanel: React.FC<OrderStatesStatsPanelProps> = ({
  filters,
  onRefresh
}) => {
  const [stateStats, setStateStats] = useState<StateStats[]>([]);
  const [transitionStats, setTransitionStats] = useState<TransitionStats[]>([]);
  const [orderDetails, setOrderDetails] = useState<OrderDetailRow[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderDetailRow[]>([]);
  const [searchOrderId, setSearchOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetailTable, setShowDetailTable] = useState(false);

  // Cargar estadísticas de estados
  const loadStateStats = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('📊 Cargando estadísticas por estado...');

      // Consulta directa a la base de datos para obtener estadísticas por estado
      let query = supabase
        .from('ordenes_duraciones_con_sede')
        .select('*')
        .gte('created_at', `${filters.fecha_inicio}T00:00:00.000Z`)
        .lte('created_at', `${filters.fecha_fin}T23:59:59.999Z`)
        .not('status', 'is', null);

      // Filtrar por sede si se especifica
      if (filters.sede_id) {
        query = query.eq('sede_id', filters.sede_id);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Error al obtener estadísticas: ${error.message}`);
      }

      // Procesar datos para cada estado
      const processedStats = processStateStatistics(data || []);
      setStateStats(processedStats);

      // Procesar estadísticas de transiciones
      const processedTransitions = processTransitionStatistics(data || []);
      setTransitionStats(processedTransitions);

      // Procesar detalles de órdenes para la tabla
      const processedOrderDetails = processOrderDetails(data || []);
      setOrderDetails(processedOrderDetails);
      setFilteredOrders(processedOrderDetails);

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

  // Procesar detalles de órdenes para la tabla de auditoría
  const processOrderDetails = (data: any[]): OrderDetailRow[] => {
    const now = new Date();

    return data.map(order => {
      const currentStatus = order.status;
      let currentStageDuration = 0;
      let isStuck = false;

      // Calcular duración en el estado actual
      switch (currentStatus) {
        case 'Recibidos':
          if (order.recibidos_at) {
            currentStageDuration = (now.getTime() - new Date(order.recibidos_at).getTime()) / (1000 * 60);
            isStuck = currentStageDuration > 15;
          }
          break;
        case 'Cocina':
          if (order.cocina_at) {
            currentStageDuration = (now.getTime() - new Date(order.cocina_at).getTime()) / (1000 * 60);
            isStuck = currentStageDuration > 45;
          }
          break;
        case 'Camino':
          if (order.camino_at) {
            currentStageDuration = (now.getTime() - new Date(order.camino_at).getTime()) / (1000 * 60);
            isStuck = currentStageDuration > 60;
          }
          break;
        case 'Entregados':
          currentStageDuration = 0; // Ya está entregado
          break;
      }

      return {
        id: order.id,
        status: order.status,
        sede_nombre: order.sede_nombre || 'Desconocida',
        created_at: order.created_at,
        recibidos_at: order.recibidos_at,
        cocina_at: order.cocina_at,
        camino_at: order.camino_at,
        entregado_at: order.entregado_at,
        min_recibidos_a_cocina: order.min_recibidos_a_cocina,
        min_cocina_a_camino: order.min_cocina_a_camino,
        min_camino_a_fin: order.min_camino_a_fin,
        min_total_desde_recibidos: order.min_total_desde_recibidos,
        current_stage_duration: currentStageDuration,
        is_stuck: isStuck
      };
    }).sort((a, b) => {
      // Ordenar por estado atascado primero, luego por duración descendente
      if (a.is_stuck && !b.is_stuck) return -1;
      if (!a.is_stuck && b.is_stuck) return 1;
      return b.current_stage_duration - a.current_stage_duration;
    });
  };

  // Filtrar órdenes por ID
  const handleSearchOrder = (searchTerm: string) => {
    setSearchOrderId(searchTerm);

    if (!searchTerm.trim()) {
      setFilteredOrders(orderDetails);
      return;
    }

    const filtered = orderDetails.filter(order =>
      order.id.toString().includes(searchTerm.trim())
    );

    setFilteredOrders(filtered);
  };

  // Limpiar búsqueda
  const clearSearch = () => {
    setSearchOrderId('');
    setFilteredOrders(orderDetails);
  };

  useEffect(() => {
    loadStateStats();
  }, [filters]);

  useEffect(() => {
    handleSearchOrder(searchOrderId);
  }, [orderDetails]);

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

  // Obtener color para el estado
  const getStatusBadgeVariant = (status: string, isStuck: boolean) => {
    if (isStuck) return 'destructive';

    switch (status) {
      case 'Recibidos': return 'secondary';
      case 'Cocina': return 'default';
      case 'Camino': return 'outline';
      case 'Entregados': return 'secondary';
      default: return 'outline';
    }
  };

  // Formatear fecha
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('es-CO', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Configuración de columnas para exportación de tabla de auditoría
  const auditColumns: TableColumn[] = [
    { key: 'id', header: 'ID Orden', width: 10 },
    { key: 'status', header: 'Estado', width: 15 },
    { key: 'sede_nombre', header: 'Sede', width: 20 },
    { key: 'created_at', header: 'Creado', width: 18, format: formatters.datetime },
    { key: 'recibidos_at', header: 'Recibido', width: 18, format: formatters.datetime },
    { key: 'cocina_at', header: 'Cocina', width: 18, format: formatters.datetime },
    { key: 'camino_at', header: 'Camino', width: 18, format: formatters.datetime },
    { key: 'entregado_at', header: 'Entregado', width: 18, format: formatters.datetime },
    { key: 'min_recibidos_a_cocina', header: 'R→C (min)', width: 12, format: formatters.minutes },
    { key: 'min_cocina_a_camino', header: 'C→Ca (min)', width: 12, format: formatters.minutes },
    { key: 'min_camino_a_fin', header: 'Ca→E (min)', width: 12, format: formatters.minutes },
    { key: 'min_total_desde_recibidos', header: 'Total (min)', width: 12, format: formatters.minutes },
    { key: 'current_stage_duration', header: 'En Estado (min)', width: 15, format: formatters.minutes },
    { key: 'is_stuck', header: 'Atascada', width: 10, format: (value) => value ? 'SÍ' : 'NO' }
  ];

  // Generar secciones para PDF
  const generatePDFSections = (): PDFSection[] => {
    const sections: PDFSection[] = [];

    // Resumen general
    if (stateStats.length > 0) {
      sections.push({
        title: 'Resumen por Estados',
        content: stateStats.map(stat =>
          `${stat.state_label}: ${stat.total_orders} órdenes, tiempo promedio: ${formatMinutes(stat.avg_time_in_state)}, eficiencia: ${Math.round(stat.efficiency_score)}%`
        )
      });
    }

    // Transiciones
    if (transitionStats.length > 0) {
      sections.push({
        title: 'Tiempos de Transición',
        content: transitionStats.map(transition =>
          `${transition.from_state} → ${transition.to_state}: ${formatMinutes(transition.avg_transition_time)} promedio (${transition.transition_count} transiciones)`
        )
      });
    }

    // Órdenes atascadas
    const stuckOrders = orderDetails.filter(order => order.is_stuck);
    if (stuckOrders.length > 0) {
      sections.push({
        title: 'Órdenes Atascadas (Atención Requerida)',
        content: stuckOrders.map(order =>
          `Orden #${order.id} - ${order.status} (${order.sede_nombre}) - ${formatMinutes(order.current_stage_duration)} en estado actual`
        )
      });
    }

    // Estadísticas generales
    sections.push({
      title: 'Estadísticas del Período',
      content: [
        `Período: ${filters.fecha_inicio} al ${filters.fecha_fin}`,
        `Total de órdenes analizadas: ${orderDetails.length}`,
        `Órdenes atascadas: ${stuckOrders.length}`,
        `Distribución por estado: ${stateStats.map(s => `${s.state_label}: ${s.total_orders}`).join(', ')}`
      ]
    });

    return sections;
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
        <div className="flex gap-2">
          <Button
            onClick={() => setShowDetailTable(!showDetailTable)}
            variant={showDetailTable ? "default" : "outline"}
            size="sm"
          >
            <TableIcon className="h-4 w-4 mr-2" />
            {showDetailTable ? 'Ocultar Tabla' : 'Ver Tabla Detallada'}
          </Button>

          {/* Botón de exportación PDF para resumen ejecutivo */}
          <ExportButton
            pdfSections={generatePDFSections()}
            formats={['pdf']}
            filename={`reporte_estados_${filters.fecha_inicio}_${filters.fecha_fin}`}
            title="Reporte de Estados de Órdenes"
            subtitle={`Análisis del ${filters.fecha_inicio} al ${filters.fecha_fin}`}
            variant="outline"
            size="sm"
          />

          {/* Botón de exportación para tabla de auditoría */}
          {showDetailTable && filteredOrders.length > 0 && (
            <ExportButton
              data={filteredOrders}
              columns={auditColumns}
              formats={['excel', 'csv']}
              filename={`auditoria_ordenes_${filters.fecha_inicio}_${filters.fecha_fin}`}
              title="Auditoría de Órdenes por Estado"
              subtitle={`Detalle individual de órdenes del ${filters.fecha_inicio} al ${filters.fecha_fin}`}
              sheetName="Auditoría"
              variant="outline"
              size="sm"
            />
          )}
        </div>
      </div>

      {/* Tabla de Auditoría Individual (mostrar/ocultar) */}
      {showDetailTable && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Auditoría Individual por Pedido
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Barra de búsqueda */}
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por ID de orden (ej: 123)"
                  value={searchOrderId}
                  onChange={(e) => handleSearchOrder(e.target.value)}
                  className="pl-10"
                />
              </div>
              {searchOrderId && (
                <Button variant="outline" onClick={clearSearch}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Información de resultados */}
            {searchOrderId && (
              <div className="mb-4">
                {filteredOrders.length > 0 ? (
                  <Alert>
                    <Search className="h-4 w-4" />
                    <AlertDescription>
                      Se encontraron {filteredOrders.length} órdenes que coinciden con "{searchOrderId}"
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      No se encontraron órdenes que coincidan con "{searchOrderId}"
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Tabla de órdenes */}
            <div className="rounded-md border max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">ID</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead>Recibido</TableHead>
                    <TableHead>Cocina</TableHead>
                    <TableHead>Camino</TableHead>
                    <TableHead>Entregado</TableHead>
                    <TableHead>R→C</TableHead>
                    <TableHead>C→Ca</TableHead>
                    <TableHead>Ca→E</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>En Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-4 text-muted-foreground">
                        {searchOrderId ? 'No se encontraron órdenes' : 'No hay órdenes para mostrar'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => (
                      <TableRow key={order.id} className={order.is_stuck ? 'bg-red-50' : ''}>
                        <TableCell className="font-medium">
                          #{order.id}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(order.status, order.is_stuck)}>
                            {order.status}
                            {order.is_stuck && ' ⚠️'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{order.sede_nombre}</TableCell>
                        <TableCell className="text-sm">{formatDateTime(order.created_at)}</TableCell>
                        <TableCell className="text-sm">{formatDateTime(order.recibidos_at)}</TableCell>
                        <TableCell className="text-sm">{formatDateTime(order.cocina_at)}</TableCell>
                        <TableCell className="text-sm">{formatDateTime(order.camino_at)}</TableCell>
                        <TableCell className="text-sm">{formatDateTime(order.entregado_at)}</TableCell>
                        <TableCell className="text-sm">
                          {order.min_recibidos_a_cocina ? formatMinutes(order.min_recibidos_a_cocina) : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {order.min_cocina_a_camino ? formatMinutes(order.min_cocina_a_camino) : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {order.min_camino_a_fin ? formatMinutes(order.min_camino_a_fin) : '-'}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {order.min_total_desde_recibidos ? formatMinutes(order.min_total_desde_recibidos) : '-'}
                        </TableCell>
                        <TableCell className={`text-sm font-medium ${
                          order.is_stuck ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {order.status !== 'Entregados' ? formatMinutes(order.current_stage_duration) : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Leyenda */}
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <h4 className="text-sm font-medium mb-2">Leyenda:</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                <div>• R→C: Recibido a Cocina</div>
                <div>• C→Ca: Cocina a Camino</div>
                <div>• Ca→E: Camino a Entregado</div>
                <div>• En Estado: Tiempo en estado actual</div>
                <div>• ⚠️: Orden atascada (tiempo excesivo)</div>
                <div>• Total: Tiempo total desde recibido</div>
                <div>• Fondo rojo: Órdenes atascadas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Resumen de órdenes atascadas */}
      {orderDetails.some(order => order.is_stuck) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Alerta: Órdenes Atascadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {orderDetails
                .filter(order => order.is_stuck)
                .slice(0, 8) // Mostrar máximo 8 órdenes atascadas
                .map(order => (
                  <div key={order.id} className="p-3 border border-red-200 bg-red-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-red-800">#{order.id}</span>
                      <Badge variant="destructive" className="text-xs">{order.status}</Badge>
                    </div>
                    <div className="text-sm text-red-600">
                      <div>{order.sede_nombre}</div>
                      <div className="font-semibold">
                        {formatMinutes(order.current_stage_duration)} en {order.status}
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
            {orderDetails.filter(order => order.is_stuck).length > 8 && (
              <div className="mt-3 text-center text-sm text-muted-foreground">
                ... y {orderDetails.filter(order => order.is_stuck).length - 8} órdenes más atascadas
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};