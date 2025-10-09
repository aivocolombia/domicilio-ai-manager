﻿import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Calculator,
  TrendingDown,
  Users,
  Calendar,
  AlertTriangle,
  Loader2,
  Search,
  X,
  Receipt
} from 'lucide-react';
import { discountService, type DiscountMetrics as IDiscountMetrics } from '@/services/discountService';
import { supabase } from '@/lib/supabase';
import { ExportButton } from '@/components/ui/ExportButton';
import { formatters, TableColumn, PDFSection } from '@/utils/exportUtils';

interface DiscountMetricsProps {
  sedeId?: string;
  startDate?: string;
  endDate?: string;
  className?: string;
}

export function DiscountMetrics({
  sedeId,
  startDate,
  endDate,
  className = ''
}: DiscountMetricsProps) {
  const [metrics, setMetrics] = useState<IDiscountMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchOrderId, setSearchOrderId] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Cargar métricas
  useEffect(() => {
    loadMetrics();
  }, [sedeId, startDate, endDate]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const metricsData = await discountService.getDiscountMetrics(sedeId, startDate, endDate);
      setMetrics(metricsData);
    } catch (error) {
      console.error('❌ Error cargando métricas de descuentos:', error);
      setError(error instanceof Error ? error.message : 'Error cargando métricas');
    } finally {
      setLoading(false);
    }
  };

  // Formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

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

  // Buscar descuento por ID de orden
  const handleSearchOrder = async (orderIdToSearch?: string) => {
    const finalOrderId = orderIdToSearch || searchOrderId;

    if (!finalOrderId.trim()) {
      setSearchError('Ingresa un ID de orden válido');
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      // Limpiar la entrada para aceptar formatos como "ORD-0605", "0605" o "605"
      const cleanedOrderId = finalOrderId.trim().replace(/[^0-9]/g, '');
      const orderId = parseInt(cleanedOrderId, 10);

      if (isNaN(orderId)) {
        setSearchError('El ID de orden debe ser un número válido');
        return;
      }

      // Buscar el descuento de la orden específica
      const discountHistory = await discountService.getOrderDiscountHistory(orderId);

      if (!discountHistory) {
        setSearchError(`No se encontró descuento aplicado para la orden #${orderId}`);
        return;
      }

      // Obtener información adicional de la orden y pago
      const { data: orderData, error: orderError } = await supabase
        .from('ordenes')
        .select(`
          id,
          payment_id,
          status,
          created_at,
          sede_id,
          pagos!payment_id(total_pago),
          sedes!sede_id(name)
        `)
        .eq('id', orderId)
        .single();

      if (orderError || !orderData) {
        setSearchError(`Error obteniendo información de la orden #${orderId}`);
        return;
      }

      // Restringir visibilidad a la sede asignada cuando corresponda
      if (sedeId && orderData.sede_id !== sedeId) {
        setSearchError('No tienes permisos para ver informaciÃ³n de esta orden.');
        return;
      }

      const orderTotal = orderData.pagos?.total_pago || 0;
      const originalTotal = orderTotal + discountHistory.discountAmount;

      setSearchResult({
        ...discountHistory,
        orderTotal,
        originalTotal,
        orderStatus: orderData.status,
        orderDate: orderData.created_at,
        sedeName: orderData.sedes?.name || 'Sin sede'
      });
    } catch (error) {
      console.error('❌ Error buscando descuento:', error);
      setSearchError('Error buscando el descuento');
    } finally {
      setSearchLoading(false);
    }
  };

  // Limpiar búsqueda
  const clearSearch = () => {
    setSearchOrderId('');
    setSearchResult(null);
    setSearchError(null);
  };

  const sedeLabel = useMemo(() => (sedeId ? `Sede ${sedeId}` : 'Todas las sedes'), [sedeId]);

  const exportRangeInfo = useMemo(() => {
    const startISO = startDate || null;
    const endISO = endDate || null;
    const displayStart = startDate ? new Date(startDate).toLocaleDateString('es-CO') : 'Inicio';
    const displayEnd = endDate ? new Date(endDate).toLocaleDateString('es-CO') : 'Actual';
    return {
      startISO,
      endISO,
      displayStart,
      displayEnd,
      label: `${displayStart} - ${displayEnd}`
    };
  }, [startDate, endDate]);

  const discountSubtitle = useMemo(
    () => `Rango: ${exportRangeInfo.label} | ${sedeLabel}`,
    [exportRangeInfo.label, sedeLabel]
  );

  // Configuración de columnas para exportación de descuentos
  const discountColumns: TableColumn[] = [
    { key: 'fecha_inicio', header: 'Fecha Inicio', width: 14, format: formatters.date },
    { key: 'fecha_fin', header: 'Fecha Fin', width: 14, format: formatters.date },
    { key: 'sede', header: 'Sede', width: 24 },
    { key: 'orderId', header: 'ID Orden', width: 12 },
    { key: 'discountAmount', header: 'Descuento', width: 15, format: formatters.currency },
    { key: 'discountComment', header: 'Motivo del Descuento', width: 40 },
    { key: 'appliedBy', header: 'Aplicado Por', width: 25 },
    { key: 'appliedDate', header: 'Fecha de Aplicación', width: 20, format: formatters.datetime }
  ];

  const recentDiscountsExportData = useMemo(() => {
    if (!metrics?.recentDiscounts) return [];
    return metrics.recentDiscounts.map((discount) => ({
      fecha_inicio: exportRangeInfo.startISO,
      fecha_fin: exportRangeInfo.endISO,
      sede: sedeLabel,
      orderId: discount.orderId,
      discountAmount: discount.discountAmount,
      discountComment: discount.discountComment,
      appliedBy: discount.appliedBy,
      appliedDate: discount.appliedDate
    }));
  }, [metrics, exportRangeInfo, sedeLabel]);

// Generar secciones para PDF de descuentos
  const generateDiscountPDFSections = (): PDFSection[] => {
    const sections: PDFSection[] = [];

    if (!metrics || metrics.totalDiscounts === 0) {
      sections.push({
        title: 'Resumen',
        content: ['No hay descuentos aplicados en el período seleccionado']
      });
      return sections;
    }

    // Resumen ejecutivo
    sections.push({
      title: 'Resumen Ejecutivo de Descuentos',
      content: [
        `Total de descuentos aplicados: ${metrics.totalDiscounts}`,
        `Monto total de descuentos: ${formatCurrency(metrics.totalDiscountAmount)}`,
        `Descuento promedio: ${formatCurrency(metrics.averageDiscount)}`,
        `Período analizado: ${startDate || 'No especificado'} al ${endDate || 'No especificado'}`
      ]
    });

    // Distribución por estado si está disponible
    if (Object.keys(metrics.discountsByStatus).length > 0) {
      sections.push({
        title: 'Distribución por Estado de Orden',
        content: Object.entries(metrics.discountsByStatus).map(([status, count]) =>
          `${status}: ${count} descuento${count !== 1 ? 's' : ''}`
        )
      });
    }

    // Descuentos recientes
    if (metrics.recentDiscounts.length > 0) {
      sections.push({
        title: 'Descuentos Recientes',
        content: metrics.recentDiscounts.map(discount =>
          `Orden #${discount.orderId}: ${formatCurrency(discount.discountAmount)} - ${discount.discountComment} (por ${discount.appliedBy})`
        )
      });
    }

    return sections;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Cargando métricas de descuentos...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.totalDiscounts === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Métricas de Descuentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Calculator className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500">No hay descuentos aplicados en el período seleccionado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Resumen general */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Resumen de Descuentos
            </CardTitle>
            <div className="flex gap-2">
              {/* Botón de exportación PDF para resumen */}
              <ExportButton
                pdfSections={generateDiscountPDFSections()}
                formats={['pdf']}
                filename={`reporte_descuentos_${sedeId || 'global'}_${startDate || 'inicio'}_${endDate || 'fin'}`}
                title="Reporte de Descuentos"
                subtitle={discountSubtitle}
                variant="outline"
                size="sm"
              />

              {/* Botón de exportación Excel/CSV para tabla de descuentos */}
              {metrics?.recentDiscounts && metrics.recentDiscounts.length > 0 && (
                <ExportButton
                  data={recentDiscountsExportData}
                  columns={discountColumns}
                  formats={['excel', 'csv']}
                  filename={`descuentos_detalle_${sedeId || 'global'}_${startDate || 'inicio'}_${endDate || 'fin'}`}
                  title="Detalle de Descuentos"
                  subtitle={discountSubtitle}
                  sheetName="Descuentos"
                  variant="outline"
                  size="sm"
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full mx-auto mb-2">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {metrics.totalDiscounts}
              </div>
              <div className="text-sm text-gray-600">
                Total Descuentos
              </div>
            </div>

            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-full mx-auto mb-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(metrics.totalDiscountAmount)}
              </div>
              <div className="text-sm text-gray-600">
                Monto Total
              </div>
            </div>

            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full mx-auto mb-2">
                <Calculator className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(metrics.averageDiscount)}
              </div>
              <div className="text-sm text-gray-600">
                Promedio
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Descuentos por estado */}
      {Object.keys(metrics.discountsByStatus).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge className="w-5 h-5" />
              Descuentos por Estado de Orden
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(metrics.discountsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{status}</Badge>
                  </div>
                  <div className="font-semibold">
                    {count} {count === 1 ? 'descuento' : 'descuentos'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* BÃºsqueda de descuento por orden */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Buscar Descuento por Orden
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ingresa el ID de la orden (ej: 123)"
                value={searchOrderId}
                onChange={(e) => setSearchOrderId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchOrder()}
                className="flex-1"
              />
              <Button onClick={handleSearchOrder} disabled={searchLoading}>
                {searchLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
              {(searchResult || searchError) && (
                <Button variant="outline" onClick={clearSearch}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {searchError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{searchError}</AlertDescription>
              </Alert>
            )}

            {searchResult && (
              <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Receipt className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-blue-800">
                    Descuento en Orden #{searchResult.orderId}
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Original:</span>
                      <span className="font-semibold">{formatCurrency(searchResult.originalTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Descuento Aplicado:</span>
                      <span className="font-semibold text-red-600">-{formatCurrency(searchResult.discountAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-sm text-gray-600">Total Final:</span>
                      <span className="font-bold text-green-600">{formatCurrency(searchResult.orderTotal)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Sede:</span>
                      <span className="text-sm font-medium">📍 {searchResult.sedeName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Estado:</span>
                      <Badge variant="outline">{searchResult.orderStatus}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Aplicado por:</span>
                      <span className="text-sm">{searchResult.appliedBy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Fecha:</span>
                      <span className="text-sm">{formatDate(searchResult.appliedDate)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-gray-700">
                    <strong>Motivo:</strong> {searchResult.discountComment}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Descuentos recientes */}
      {metrics.recentDiscounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Descuentos Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {metrics.recentDiscounts.map((discount, index) => (
                <div key={`${discount.orderId}-${index}`} className="border-l-4 border-blue-500 pl-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <Badge variant="outline">
                          ORD-{discount.orderId.toString().padStart(4, '0')}
                        </Badge>
                        <span className="font-semibold text-red-600">
                          -{formatCurrency(discount.discountAmount)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSearchOrderId(discount.orderId.toString());
                            handleSearchOrder(discount.orderId.toString());
                          }}
                          className="h-6 px-2 text-xs"
                        >
                          Ver detalles
                        </Button>
                      </div>
                      <p className="text-sm text-gray-600 max-w-md">
                        {discount.discountComment}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Por: {discount.appliedBy}</span>
                        <span>{formatDate(discount.appliedDate)}</span>
                      </div>
                    </div>
                  </div>
                  {index < metrics.recentDiscounts.length - 1 && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
