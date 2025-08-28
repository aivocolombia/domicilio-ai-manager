import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Wifi, WifiOff, AlertCircle, RefreshCw, Search } from 'lucide-react';
import { runRealtimeFullDiagnosis } from '@/utils/realtimeDebug';

interface RealtimeStatusProps {
  realtimeStatus: {
    isConnected: () => boolean;
    getChannelsStatus: () => {
      totalChannels: number;
      isConnected: boolean;
      sedeId?: string;
    };
    reconnect: () => void;
  };
  className?: string;
}

export const RealtimeStatus: React.FC<RealtimeStatusProps> = ({ 
  realtimeStatus, 
  className = "" 
}) => {
  const [status, setStatus] = useState({
    isConnected: false,
    totalChannels: 0,
    sedeId: undefined as string | undefined
  });
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());

  // Actualizar estado cada segundo
  useEffect(() => {
    const updateStatus = () => {
      if (realtimeStatus) {
        const channelStatus = realtimeStatus.getChannelsStatus();
        const connected = realtimeStatus.isConnected();
        
        setStatus({
          isConnected: connected,
          totalChannels: channelStatus.totalChannels,
          sedeId: channelStatus.sedeId
        });
        
        setLastUpdateTime(new Date());
      }
    };

    updateStatus(); // Actualización inmediata
    const interval = setInterval(updateStatus, 2000); // Cada 2 segundos

    return () => clearInterval(interval);
  }, [realtimeStatus]);

  const handleReconnect = () => {
    console.log('🔄 Intentando reconectar realtime desde componente...');
    if (realtimeStatus && realtimeStatus.reconnect) {
      realtimeStatus.reconnect();
    }
  };

  const handleDiagnosis = async () => {
    console.log('🔍 Ejecutando diagnóstico completo de realtime...');
    await runRealtimeFullDiagnosis();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Card className={`${className}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status.isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            
            <div className="flex items-center gap-2">
              <Badge 
                variant={status.isConnected ? "default" : "destructive"} 
                className="text-xs"
              >
                {status.isConnected ? 'Tiempo Real Activo' : 'Desconectado'}
              </Badge>
              
              {status.totalChannels > 0 && (
                <span className="text-xs text-muted-foreground">
                  {status.totalChannels} canales
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {formatTime(lastUpdateTime)}
            </span>
            
            {!status.isConnected && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReconnect}
                  className="h-6 px-2 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Reconectar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDiagnosis}
                  className="h-6 px-2 text-xs"
                  title="Ejecutar diagnóstico en consola"
                >
                  <Search className="h-3 w-3 mr-1" />
                  Diagnosticar
                </Button>
              </>
            )}
          </div>
        </div>
        
        {status.sedeId && (
          <div className="mt-2 text-xs text-muted-foreground">
            Escuchando sede: {status.sedeId}
          </div>
        )}
        
        {!status.isConnected && status.totalChannels === 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-orange-600">
            <AlertCircle className="h-3 w-3" />
            <span>Verifica que Supabase Realtime esté habilitado</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};