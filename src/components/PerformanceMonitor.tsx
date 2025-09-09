import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Database, 
  Zap, 
  RefreshCw, 
  Trash2,
  Eye,
  EyeOff 
} from 'lucide-react';
import { sedeServiceSimple } from '@/services/sedeServiceSimple';
import { useCache } from '@/hooks/useCache';

interface PerformanceMonitorProps {
  className?: string;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ 
  className = "" 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [performanceData, setPerformanceData] = useState<any>({});
  const cache = useCache();

  // Solo mostrar en desarrollo
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (!isDevelopment) return null;

  const updatePerformanceData = () => {
    const sedeStats = sedeServiceSimple.getCacheStats();
    const cacheStats = cache.stats();
    
    setPerformanceData({
      timestamp: new Date().toLocaleTimeString(),
      memory: {
        used: Math.round(performance.memory?.usedJSHeapSize / 1024 / 1024) || 0,
        total: Math.round(performance.memory?.totalJSHeapSize / 1024 / 1024) || 0,
        limit: Math.round(performance.memory?.jsHeapSizeLimit / 1024 / 1024) || 0,
      },
      cache: {
        sede: sedeStats,
        global: cacheStats
      },
      navigation: performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    });
  };

  useEffect(() => {
    if (isVisible) {
      updatePerformanceData();
      const interval = setInterval(updatePerformanceData, 2000);
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  const memoryUsagePercentage = useMemo(() => {
    if (!performanceData.memory?.total) return 0;
    return Math.round((performanceData.memory.used / performanceData.memory.total) * 100);
  }, [performanceData.memory]);

  const getMemoryColor = (percentage: number) => {
    if (percentage > 80) return 'text-red-600 bg-red-50';
    if (percentage > 60) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  const clearAllCaches = () => {
    cache.clear();
    sedeServiceSimple.invalidateSedeCache();
    updatePerformanceData();
    console.log('🧽 Todos los caches limpiados');
  };

  if (!isVisible) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsVisible(true)}
          className="shadow-lg bg-white/80 backdrop-blur-sm"
          title="Mostrar monitor de rendimiento"
        >
          <Activity className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 w-96 ${className}`}>
      <Card className="shadow-xl bg-white/95 backdrop-blur-sm border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-blue-600" />
              Performance Monitor
              <Badge variant="outline" className="text-xs">
                DEV
              </Badge>
            </CardTitle>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={updatePerformanceData}
                className="h-6 w-6 p-0"
                title="Actualizar datos"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={clearAllCaches}
                className="h-6 w-6 p-0"
                title="Limpiar caches"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsVisible(false)}
                className="h-6 w-6 p-0"
                title="Ocultar monitor"
              >
                <EyeOff className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 text-xs">
          {/* Memoria */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="h-3 w-3 text-yellow-600" />
              <span className="font-medium">Memoria</span>
              <Badge className={getMemoryColor(memoryUsagePercentage)}>
                {memoryUsagePercentage}%
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div>
                <div className="font-medium text-gray-900">
                  {performanceData.memory?.used || 0} MB
                </div>
                <div>Usado</div>
              </div>
              <div>
                <div className="font-medium text-gray-900">
                  {performanceData.memory?.total || 0} MB
                </div>
                <div>Total</div>
              </div>
              <div>
                <div className="font-medium text-gray-900">
                  {performanceData.memory?.limit || 0} MB
                </div>
                <div>Límite</div>
              </div>
            </div>
          </div>

          {/* Cache */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Database className="h-3 w-3 text-blue-600" />
              <span className="font-medium">Cache</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span>Sede Service:</span>
                <Badge variant="outline" className="text-xs">
                  {performanceData.cache?.sede?.size || 0} entradas
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Global Cache:</span>
                <Badge variant="outline" className="text-xs">
                  {performanceData.cache?.global?.size || 0} entradas
                </Badge>
              </div>
            </div>
          </div>

          {/* Navegación */}
          {performanceData.navigation && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-3 w-3 text-green-600" />
                <span className="font-medium">Navegación</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <div className="font-medium text-gray-900">
                    {Math.round(performanceData.navigation.loadEventEnd - performanceData.navigation.navigationStart)}ms
                  </div>
                  <div>Load Total</div>
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    {Math.round(performanceData.navigation.domContentLoadedEventEnd - performanceData.navigation.navigationStart)}ms
                  </div>
                  <div>DOM Ready</div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-1 border-t text-xs text-muted-foreground text-center">
            Actualizado: {performanceData.timestamp}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};