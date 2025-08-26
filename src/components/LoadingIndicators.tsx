import React from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SectionLoadingProps {
  isLoading: boolean;
  error?: string | null;
  lastUpdated?: Date | null;
  retryCount?: number;
  onRetry?: () => void;
  sectionName: string;
  className?: string;
}

export function SectionLoading({ 
  isLoading, 
  error, 
  lastUpdated, 
  retryCount = 0, 
  onRetry, 
  sectionName,
  className = ""
}: SectionLoadingProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Cargando {sectionName}...</span>
          {retryCount > 0 && (
            <Badge variant="outline" className="text-xs">
              Intento {retryCount + 1}
            </Badge>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`py-4 ${className}`}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <div className="font-medium">Error cargando {sectionName}</div>
              <div className="text-sm mt-1">{error}</div>
              {retryCount > 0 && (
                <div className="text-xs mt-1 opacity-80">
                  Intentos realizados: {retryCount}
                </div>
              )}
            </div>
            {onRetry && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onRetry}
                className="ml-4"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Reintentar
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Success state with last updated info
  if (lastUpdated) {
    return (
      <div className={`flex items-center gap-2 text-xs text-muted-foreground py-2 ${className}`}>
        <CheckCircle className="h-3 w-3 text-green-600" />
        <span>Actualizado: {lastUpdated.toLocaleTimeString()}</span>
      </div>
    );
  }

  return null;
}

interface TableSectionLoadingProps {
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  sectionName: string;
  emptyMessage?: string;
  itemCount?: number;
}

export function TableSectionLoading({ 
  isLoading, 
  error, 
  onRetry, 
  sectionName,
  emptyMessage = "No hay datos disponibles",
  itemCount = 0
}: TableSectionLoadingProps) {
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
        <p className="text-muted-foreground">Cargando {sectionName}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <p className="text-destructive font-medium mb-1">Error cargando {sectionName}</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        )}
      </div>
    );
  }

  if (itemCount === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return null;
}

interface CompactLoadingProps {
  isLoading: boolean;
  error?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CompactLoading({ 
  isLoading, 
  error, 
  size = 'md',
  className = ""
}: CompactLoadingProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4', 
    lg: 'h-5 w-5'
  };

  if (isLoading) {
    return (
      <RefreshCw className={`animate-spin ${sizeClasses[size]} ${className}`} />
    );
  }

  if (error) {
    return (
      <AlertTriangle className={`text-destructive ${sizeClasses[size]} ${className}`} />
    );
  }

  return null;
}

interface MetricsLoadingProps {
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  lastUpdated?: Date | null;
  className?: string;
}

export function MetricsLoading({
  isLoading,
  error,
  onRetry,
  lastUpdated,
  className = ""
}: MetricsLoadingProps) {
  if (isLoading) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="text-lg">Calculando métricas...</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Esto puede tomar unos momentos
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-medium text-destructive mb-2">
          Error calculando métricas
        </h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          {error}
        </p>
        {onRetry && (
          <Button onClick={onRetry} className="mx-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar cálculo
          </Button>
        )}
      </div>
    );
  }

  return null;
}

interface StatusIndicatorProps {
  isLoading: boolean;
  error?: string | null;
  lastUpdated?: Date | null;
  size?: 'sm' | 'md';
}

export function StatusIndicator({ 
  isLoading, 
  error, 
  lastUpdated, 
  size = 'sm' 
}: StatusIndicatorProps) {
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  if (isLoading) {
    return <RefreshCw className={`animate-spin text-blue-500 ${iconSize}`} />;
  }

  if (error) {
    return <AlertTriangle className={`text-red-500 ${iconSize}`} />;
  }

  if (lastUpdated) {
    const isRecent = Date.now() - lastUpdated.getTime() < 60000; // Less than 1 minute
    return (
      <div className="flex items-center gap-1">
        <CheckCircle className={`text-green-500 ${iconSize}`} />
        {size === 'md' && (
          <span className="text-xs text-muted-foreground">
            {isRecent ? 'Actualizado' : lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
    );
  }

  return <Clock className={`text-gray-400 ${iconSize}`} />;
}