import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { formatDateForQuery } from '@/utils/dateUtils';
import { ChevronLeft, ChevronRight, XCircle, Calendar, DollarSign, MessageCircle, BarChart3 } from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';
import { TableColumn, PDFSection } from '@/utils/exportUtils';

interface CancelledOrder {
  id: number;
  id_display?: string;
  created_at: string;
  motivo_cancelacion: string;
  payment_id: number;
  clientes?: {
    nombre: string;
    telefono: string;
  } | null;
  pagos?: {
    total_pago: number;
  } | null;
}

interface CancelledOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  sedeId: string;
  sedeNombre: string;
  dateFilters: {
    fecha_inicio: string;
    fecha_fin: string;
  };
}

const ITEMS_PER_PAGE = 10;

// Definir columnas para exportaci├│n
const cancelledOrdersColumns: TableColumn[] = [
  { key: 'id_display', header: 'Orden' },
  { key: 'created_at', header: 'Fecha', format: (value) => new Date(value).toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) },
  { key: 'cliente_nombre', header: 'Cliente' },
  { key: 'cliente_telefono', header: 'Tel├®fono' },
  { key: 'total_pago', header: 'Monto', format: (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value || 0);
  }},
  { key: 'motivo_cancelacion', header: 'Motivo de Cancelaci├│n', format: (value) => value?.trim() || 'Sin motivo especificado' }
];

// Funci├│n para aplanar los datos para exportaci├│n
const flattenOrderData = (order: CancelledOrder) => ({
  id_display: order.id_display || `ORD-${order.id.toString().padStart(4, '0')}`,
  created_at: order.created_at,
  cliente_nombre: order.clientes?.nombre || 'Sin nombre',
  cliente_telefono: order.clientes?.telefono || 'Sin tel├®fono',
  total_pago: order.pagos?.total_pago || 0,
  motivo_cancelacion: order.motivo_cancelacion
});

export const CancelledOrdersModal: React.FC<CancelledOrdersModalProps> = ({
  isOpen,
  onClose,
  sedeId,
  sedeNombre,
  dateFilters
}) => {
  // Calcular secciones PDF din├ímicamente basadas en los datos
  const getPDFSections = (): PDFSection[] => {
    const totalMonto = allOrders.reduce((sum, order) => sum + (order.pagos?.total_pago || 0), 0);

    return [
      {
        title: 'Resumen General',
        type: 'summary',
        calculate: (data: any[]) => ({
          'Sede': sedeNombre,
          'Total ├ôrdenes Canceladas': data.length,
          'Monto Total Cancelado': new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
          }).format(totalMonto),
          'Per├¡odo': dateFilters.fecha_inicio && dateFilters.fecha_fin
            ? `${dateFilters.fecha_inicio} a ${dateFilters.fecha_fin}`
            : 'Todos los registros'
        })
      },
      {
        title: `Detalles de Cancelaciones - ${sedeNombre}`,
        type: 'table',
        columns: cancelledOrdersColumns
      }
    ];
  };

  const [orders, setOrders] = useState<CancelledOrder[]>([]);
  const [allOrders, setAllOrders] = useState<CancelledOrder[]>([]); // Para exportar todos los datos
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasLoadedAllOrders, setHasLoadedAllOrders] = useState(false);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE - 1;

  const loadCancelledOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('­ƒöì Iniciando carga de cancelaciones para sede:', sedeId);

      // Construir query base - misma estructura que Dashboard
      let countQuery = supabase
        .from('ordenes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Cancelado')
        .eq('sede_id', sedeId);

      // Aplicar filtros de fecha si est├ín definidos
      if (dateFilters.fecha_inicio && dateFilters.fecha_fin) {
        const startDate = new Date(`${dateFilters.fecha_inicio}T00:00:00`);
        const endDate = new Date(`${dateFilters.fecha_fin}T23:59:59`);

        const startQuery = formatDateForQuery(startDate, false);
        const endQuery = formatDateForQuery(endDate, true);

        countQuery = countQuery
          .gte('created_at', startQuery)
          .lte('created_at', endQuery);
      }

      // Obtener count total
      const { count, error: countError } = await countQuery;

      if (countError) {
        throw new Error(`Error obteniendo conteo: ${countError.message}`);
      }

      setTotalCount(count || 0);
      console.log('­ƒôè Count total de cancelaciones:', count);

      // Construir query para datos
      let dataQuery = supabase
        .from('ordenes')
        .select(`
          id,
          created_at,
          motivo_cancelacion,
          payment_id,
          clientes!left(nombre, telefono),
          pagos!payment_id(total_pago)
        `)
        .eq('status', 'Cancelado')
        .eq('sede_id', sedeId)
        .order('created_at', { ascending: false })
        .range(startIndex, endIndex);

      // Aplicar los mismos filtros de fecha
      if (dateFilters.fecha_inicio && dateFilters.fecha_fin) {
        const startDate = new Date(`${dateFilters.fecha_inicio}T00:00:00`);
        const endDate = new Date(`${dateFilters.fecha_fin}T23:59:59`);

        const startQuery = formatDateForQuery(startDate, false);
        const endQuery = formatDateForQuery(endDate, true);

        dataQuery = dataQuery
          .gte('created_at', startQuery)
          .lte('created_at', endQuery);
      }

      // Obtener los datos
      const { data, error } = await dataQuery;

      if (error) {
        throw new Error(`Error obteniendo ├│rdenes canceladas: ${error.message}`);
      }

      // Generar id_display para las ├│rdenes
      const ordersWithDisplay = (data || []).map(order => ({
        ...order,
        id_display: `ORD-${order.id.toString().padStart(4, '0')}`
      }));

      setOrders(ordersWithDisplay);

      // NUEVO: Cargar TODOS los datos sin paginaci├│n para exportar
      let allDataQuery = supabase
        .from('ordenes')
        .select(`
          id,
          created_at,
          motivo_cancelacion,
          payment_id,
          clientes!left(nombre, telefono),
          pagos!payment_id(total_pago)
        `)
        .eq('status', 'Cancelado')
        .eq('sede_id', sedeId)
        .order('created_at', { ascending: false });

      // Aplicar los mismos filtros de fecha
      if (dateFilters.fecha_inicio && dateFilters.fecha_fin) {
        const startDate = new Date(`${dateFilters.fecha_inicio}T00:00:00`);
        const endDate = new Date(`${dateFilters.fecha_fin}T23:59:59`);

        const startQuery = formatDateForQuery(startDate, false);
        const endQuery = formatDateForQuery(endDate, true);

        allDataQuery = allDataQuery
          .gte('created_at', startQuery)
          .lte('created_at', endQuery);
      }

      const { data: allData, error: allError } = await allDataQuery;

      if (!allError && allData) {
        const allOrdersWithDisplay = allData.map(order => ({
          ...order,
          id_display: `ORD-${order.id.toString().padStart(4, '0')}`
        }));
        setAllOrders(allOrdersWithDisplay);
        console.log('Ô£à Todos los datos cargados para exportar:', allOrdersWithDisplay.length);
      }

      console.log('Ô£à ├ôrdenes canceladas cargadas:', {
        count: ordersWithDisplay.length,
        totalCountFromQuery: count,
        sampleOrder: ordersWithDisplay[0],
        rawDataSample: data?.[0],
        sedeId: sedeId,
        dateFilters: dateFilters
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error('ÔØî Error cargando ├│rdenes canceladas:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos cuando se abre el modal o cambia la p├ígina
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1); // Reset a la primera p├ígina
      loadCancelledOrders();
    }
  }, [isOpen, sedeId, dateFilters.fecha_inicio, dateFilters.fecha_fin]);

  // Recargar cuando cambia la p├ígina
  useEffect(() => {
    if (isOpen) {
      loadCancelledOrders();
    }
  }, [currentPage]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Calcular conteo de motivos de cancelaci├│n
  const getCancellationReasonCounts = () => {
    // Definir los motivos v├ílidos del dropdown
    const motivosValidos = [
      'Sobrepasa tiempo estimado de entrega',
      'Agotado de productos',
      'Cliente lo prefiere recoger',
      'Causales de cliente',
      'Sin motivo especificado'
    ];

    const counts: { [key: string]: number } = {};

    allOrders.forEach(order => {
      let motivo = order.motivo_cancelacion?.trim() || 'Sin motivo especificado';

      // Si el motivo no est├í en la lista de v├ílidos, clasificarlo como "Otros"
      if (!motivosValidos.includes(motivo)) {
        motivo = 'Otros';
      }

      counts[motivo] = (counts[motivo] || 0) + 1;
    });

    // Convertir a array y ordenar por cantidad (descendente)
    return Object.entries(counts)
      .map(([motivo, count]) => ({ motivo, count }))
      .sort((a, b) => b.count - a.count);
  };

  const motivoCounts = getCancellationReasonCounts();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-6 w-6 text-red-500" />
                ├ôrdenes Canceladas - {sedeNombre}
              </DialogTitle>
              <DialogDescription>
                Detalles de las ├│rdenes canceladas con motivos de cancelaci├│n
              </DialogDescription>
            </div>
            {allOrders.length > 0 && (
              <ExportButton
                data={allOrders.map(flattenOrderData)}
                columns={cancelledOrdersColumns}
                pdfSections={getPDFSections()}
                filename={`cancelaciones_${sedeNombre.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`}
                title={`Reporte de ├ôrdenes Canceladas - ${sedeNombre}`}
                subtitle={`Per├¡odo: ${dateFilters.fecha_inicio && dateFilters.fecha_fin ? `${dateFilters.fecha_inicio} a ${dateFilters.fecha_fin}` : 'Todos los registros'} | Total: ${allOrders.length} ├│rdenes`}
              />
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Cargando ├│rdenes canceladas...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-500 mb-2">Error al cargar las ├│rdenes</div>
              <div className="text-sm text-muted-foreground">{error}</div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadCancelledOrders}
                className="mt-4"
              >
                Reintentar
              </Button>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No hay ├│rdenes canceladas</h3>
              <p className="text-sm text-muted-foreground">
                No se encontraron ├│rdenes canceladas para esta sede en el per├¡odo seleccionado.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Informaci├│n del resumen */}
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="font-semibold text-red-700">
                    {totalCount} ├│rdenes canceladas encontradas
                  </span>
                </div>
                <Badge variant="destructive">
                  P├ígina {currentPage} de {totalPages}
                </Badge>
              </div>

              {/* Contador de motivos de cancelaci├│n */}
              {motivoCounts.length > 0 && (
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      Resumen de Motivos de Cancelaci├│n
                    </CardTitle>
                    <CardDescription>
                      Distribuci├│n de los {allOrders.length} motivos registrados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {motivoCounts.map(({ motivo, count }) => {
                        const percentage = ((count / allOrders.length) * 100).toFixed(1);
                        return (
                          <div key={motivo} className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-100">
                            <div className="flex-1">
                              <div className="font-medium text-sm text-gray-700">{motivo}</div>
                              <div className="flex items-center gap-3 mt-1">
                                <div className="flex-1 bg-blue-100 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-blue-500 h-full rounded-full transition-all duration-300"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground min-w-[50px] text-right">
                                  {percentage}%
                                </span>
                              </div>
                            </div>
                            <Badge variant="secondary" className="ml-3">
                              {count} {count === 1 ? 'orden' : '├│rdenes'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Lista de ├│rdenes */}
              <div className="space-y-3">
                {orders.map((order, index) => (
                  <Card key={order.id} className="border-red-200 bg-red-50/30">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <span className="text-red-600">Orden {order.id_display || `#${order.id}`}</span>
                          <Badge variant="destructive" className="text-xs">
                            Cancelada
                          </Badge>
                        </CardTitle>
                        <div className="text-right text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(order.created_at)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Informaci├│n del cliente */}
                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                            <span>Cliente:</span>
                          </h4>
                          {order.clientes && (order.clientes.nombre || order.clientes.telefono) ? (
                            <div className="text-sm space-y-1">
                              {order.clientes.nombre ? (
                                <div><strong>Nombre:</strong> {order.clientes.nombre}</div>
                              ) : (
                                <div className="text-sm text-muted-foreground">Sin nombre</div>
                              )}
                              {order.clientes.telefono ? (
                                <div><strong>Tel├®fono:</strong> {order.clientes.telefono}</div>
                              ) : (
                                <div className="text-sm text-muted-foreground">Sin tel├®fono</div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">Sin informaci├│n del cliente</div>
                          )}
                        </div>

                        {/* Monto de la orden */}
                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            <span>Monto:</span>
                          </h4>
                          <div className="text-lg font-bold text-red-600">
                            {order.pagos?.total_pago && order.pagos.total_pago > 0 ?
                              formatCurrency(order.pagos.total_pago) :
                              <span className="text-sm text-muted-foreground font-normal">Sin informaci├│n de pago</span>
                            }
                          </div>
                        </div>
                      </div>

                      {/* Motivo de cancelaci├│n */}
                      <div className="mt-4 p-3 bg-red-100 rounded-lg border border-red-200">
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-1 text-red-700">
                          <MessageCircle className="h-4 w-4" />
                          Motivo de cancelaci├│n:
                        </h4>
                        <p className="text-sm text-red-800 leading-relaxed">
                          {order.motivo_cancelacion?.trim() ?
                            order.motivo_cancelacion.trim() :
                            <span className="text-muted-foreground">Sin motivo especificado</span>
                          }
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Paginaci├│n y controles */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Mostrando {startIndex + 1} a {Math.min(endIndex + 1, totalCount)} de {totalCount} ├│rdenes
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNumber = currentPage <= 3 
                    ? i + 1 
                    : currentPage >= totalPages - 2 
                    ? totalPages - 4 + i 
                    : currentPage - 2 + i;
                  
                  return (
                    <Button
                      key={pageNumber}
                      variant={pageNumber === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNumber)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNumber}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
