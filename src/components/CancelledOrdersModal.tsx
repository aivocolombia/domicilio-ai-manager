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
import { ChevronLeft, ChevronRight, XCircle, Calendar, DollarSign, MessageCircle } from 'lucide-react';

interface CancelledOrder {
  id: number;
  created_at: string;
  motivo_cancelacion: string;
  pagos?: {
    total_pago: number;
  } | null;
  clientes?: {
    nombre: string;
    telefono: string;
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

export const CancelledOrdersModal: React.FC<CancelledOrdersModalProps> = ({
  isOpen,
  onClose,
  sedeId,
  sedeNombre,
  dateFilters
}) => {
  const [orders, setOrders] = useState<CancelledOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE - 1;

  const loadCancelledOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      // Construir consulta base
      let query = supabase
        .from('ordenes')
        .select(`
          id,
          created_at,
          motivo_cancelacion,
          pagos!left(total_pago),
          clientes!left(nombre, telefono)
        `)
        .eq('status', 'Cancelado')
        .eq('sede_id', sedeId)
        .order('created_at', { ascending: false });

      // Aplicar filtros de fecha si están definidos
      if (dateFilters.fecha_inicio && dateFilters.fecha_fin) {
        // Convertir fechas a rangos UTC correctos para Colombia
        const startDate = new Date(`${dateFilters.fecha_inicio}T00:00:00`);
        const endDate = new Date(`${dateFilters.fecha_fin}T23:59:59`);
        
        const startQuery = formatDateForQuery(startDate, false);
        const endQuery = formatDateForQuery(endDate, true);
        
        query = query
          .gte('created_at', startQuery)
          .lte('created_at', endQuery);
      }

      // Obtener count total primero
      const { count, error: countError } = await query
        .select('*', { count: 'exact', head: true });

      if (countError) {
        throw new Error(`Error obteniendo conteo: ${countError.message}`);
      }

      setTotalCount(count || 0);

      // Ahora obtener los datos paginados
      const { data, error } = await query
        .range(startIndex, endIndex);

      if (error) {
        throw new Error(`Error obteniendo órdenes canceladas: ${error.message}`);
      }

      setOrders(data || []);
      console.log('✅ Órdenes canceladas cargadas:', data?.length || 0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error('❌ Error cargando órdenes canceladas:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos cuando se abre el modal o cambia la página
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1); // Reset a la primera página
      loadCancelledOrders();
    }
  }, [isOpen, sedeId, dateFilters.fecha_inicio, dateFilters.fecha_fin]);

  // Recargar cuando cambia la página
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-6 w-6 text-red-500" />
            Órdenes Canceladas - {sedeNombre}
          </DialogTitle>
          <DialogDescription>
            Detalles de las órdenes canceladas con motivos de cancelación
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Cargando órdenes canceladas...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-500 mb-2">Error al cargar las órdenes</div>
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
              <h3 className="text-lg font-semibold mb-2">No hay órdenes canceladas</h3>
              <p className="text-sm text-muted-foreground">
                No se encontraron órdenes canceladas para esta sede en el período seleccionado.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Información del resumen */}
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="font-semibold text-red-700">
                    {totalCount} órdenes canceladas encontradas
                  </span>
                </div>
                <Badge variant="destructive">
                  Página {currentPage} de {totalPages}
                </Badge>
              </div>

              {/* Lista de órdenes */}
              <div className="space-y-3">
                {orders.map((order, index) => (
                  <Card key={order.id} className="border-red-200 bg-red-50/30">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <span className="text-red-600">Orden #{order.id}</span>
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
                        {/* Información del cliente */}
                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                            <span>Cliente:</span>
                          </h4>
                          {order.clientes ? (
                            <div className="text-sm space-y-1">
                              <div><strong>Nombre:</strong> {order.clientes.nombre}</div>
                              <div><strong>Teléfono:</strong> {order.clientes.telefono}</div>
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">Sin información del cliente</div>
                          )}
                        </div>

                        {/* Monto de la orden */}
                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            <span>Monto:</span>
                          </h4>
                          <div className="text-lg font-bold text-red-600">
                            {order.pagos?.total_pago ? 
                              formatCurrency(order.pagos.total_pago) : 
                              'Sin información de pago'
                            }
                          </div>
                        </div>
                      </div>

                      {/* Motivo de cancelación */}
                      <div className="mt-4 p-3 bg-red-100 rounded-lg border border-red-200">
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-1 text-red-700">
                          <MessageCircle className="h-4 w-4" />
                          Motivo de cancelación:
                        </h4>
                        <p className="text-sm text-red-800 leading-relaxed">
                          {order.motivo_cancelacion || 'Sin motivo especificado'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Paginación y controles */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Mostrando {startIndex + 1} a {Math.min(endIndex + 1, totalCount)} de {totalCount} órdenes
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