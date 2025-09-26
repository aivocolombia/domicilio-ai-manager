import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Calculator,
  TrendingDown,
  Users,
  Calendar,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { discountService, type DiscountMetrics as IDiscountMetrics } from '@/services/discountService';

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
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Resumen de Descuentos
          </CardTitle>
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
            <div className="space-y-4">
              {metrics.recentDiscounts.map((discount, index) => (
                <div key={`${discount.orderId}-${index}`} className="border-l-4 border-blue-500 pl-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          ORD-{discount.orderId.toString().padStart(4, '0')}
                        </Badge>
                        <span className="font-semibold text-red-600">
                          -{formatCurrency(discount.discountAmount)}
                        </span>
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