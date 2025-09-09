import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { logDebug, logWarn } from '@/utils/logger';

// Hook para throttling de funciones (limitar llamadas)
export const useThrottle = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const lastCall = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCall.current >= delay) {
      lastCall.current = now;
      return callback(...args);
    } else {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        lastCall.current = Date.now();
        callback(...args);
      }, delay - (now - lastCall.current));
    }
  }, [callback, delay]) as T;
};

// Hook para debouncing de funciones (retrasar ejecución)
export const useDebounce = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: Parameters<T>) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;
};

// Hook para memoización persistente con TTL
interface MemoEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

export const usePersistentMemo = <T>(
  key: string,
  factory: () => T,
  deps: React.DependencyList,
  ttl: number = 5 * 60 * 1000 // 5 minutos por defecto
): T => {
  const cache = useRef<Map<string, MemoEntry<T>>>(new Map());
  
  return useMemo(() => {
    const now = Date.now();
    const depsKey = `${key}:${JSON.stringify(deps)}`;
    const entry = cache.current.get(depsKey);

    // Si existe y no ha expirado, usar cache
    if (entry && (now - entry.timestamp) < entry.ttl) {
      logDebug('PersistentMemo', `✅ Cache hit: ${key}`);
      return entry.value;
    }

    // Crear nuevo valor
    const value = factory();
    cache.current.set(depsKey, {
      value,
      timestamp: now,
      ttl
    });

    // Limpiar entradas expiradas (máximo 100 entradas)
    if (cache.current.size > 100) {
      const entries = Array.from(cache.current.entries());
      const validEntries = entries.filter(([, entry]) => 
        (now - entry.timestamp) < entry.ttl
      );
      
      cache.current.clear();
      validEntries.forEach(([key, entry]) => 
        cache.current.set(key, entry)
      );
    }

    logDebug('PersistentMemo', `💾 Cache miss - computed: ${key}`);
    return value;
  }, deps);
};

// Hook para detectar renders innecesarios
export const useWhyDidYouUpdate = (name: string, props: Record<string, any>) => {
  const previous = useRef<Record<string, any>>();

  useEffect(() => {
    if (previous.current) {
      const allKeys = Object.keys({ ...previous.current, ...props });
      const changedProps: Record<string, { from: any; to: any }> = {};

      allKeys.forEach(key => {
        if (previous.current![key] !== props[key]) {
          changedProps[key] = {
            from: previous.current![key],
            to: props[key]
          };
        }
      });

      if (Object.keys(changedProps).length) {
        logWarn('WhyDidYouUpdate', `🔄 ${name} re-rendered:`, changedProps);
      }
    }

    previous.current = props;
  });
};

// Hook para lazy loading de componentes pesados
export const useLazyComponent = <T,>(
  importFunction: () => Promise<{ default: T }>,
  deps: React.DependencyList = []
) => {
  const [Component, setComponent] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadComponent = useCallback(async () => {
    if (Component) return Component;

    setLoading(true);
    setError(null);

    try {
      const module = await importFunction();
      setComponent(module.default);
      return module.default;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error loading component');
      setError(error);
      logWarn('LazyComponent', 'Error loading component', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, deps);

  return {
    Component,
    loading,
    error,
    loadComponent
  };
};

// Hook para monitoreo de rendimiento
export const usePerformanceMonitor = (componentName: string) => {
  const renderCount = useRef(0);
  const mountTime = useRef<number>(Date.now());
  
  useEffect(() => {
    renderCount.current++;
    
    // Log cada 10 renders para no saturar consola
    if (renderCount.current % 10 === 0) {
      const timeSinceMount = Date.now() - mountTime.current;
      logDebug('PerformanceMonitor', 
        `📊 ${componentName}: ${renderCount.current} renders in ${timeSinceMount}ms`
      );
    }
  });

  const logRenderReason = useCallback((reason: string, data?: any) => {
    logDebug('PerformanceMonitor', `🔄 ${componentName} render: ${reason}`, data);
  }, [componentName]);

  return {
    renderCount: renderCount.current,
    timeSinceMount: Date.now() - mountTime.current,
    logRenderReason
  };
};

// Hook para batch updates (agrupar actualizaciones de estado)
export const useBatchedUpdates = <T,>() => {
  const [state, setState] = useState<T | undefined>();
  const batchedUpdates = useRef<Array<(prev: T | undefined) => T>>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const batchUpdate = useCallback((updater: (prev: T | undefined) => T) => {
    batchedUpdates.current.push(updater);
    
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setState(currentState => {
        return batchedUpdates.current.reduce((acc, updater) => updater(acc), currentState);
      });
      batchedUpdates.current = [];
    }, 0);
  }, []);

  return [state, batchUpdate] as const;
};

// Hook para cache de consultas con invalidación inteligente
export const useSmartQuery = <TData, TKey>(
  queryKey: TKey,
  queryFn: (key: TKey) => Promise<TData>,
  options: {
    ttl?: number;
    retryAttempts?: number;
    retryDelay?: number;
  } = {}
) => {
  const {
    ttl = 5 * 60 * 1000,
    retryAttempts = 3,
    retryDelay = 1000
  } = options;

  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const cache = useRef<Map<string, { data: TData; timestamp: number }>>(new Map());
  const cacheKey = JSON.stringify(queryKey);

  const executeQuery = useCallback(async (attempt = 1): Promise<TData | null> => {
    // Verificar cache primero
    const cached = cache.current.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < ttl) {
      logDebug('SmartQuery', `✅ Cache hit: ${cacheKey}`);
      return cached.data;
    }

    try {
      const result = await queryFn(queryKey);
      
      // Guardar en cache
      cache.current.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      logDebug('SmartQuery', `💾 Query executed: ${cacheKey}`);
      return result;
    } catch (err) {
      if (attempt <= retryAttempts) {
        logWarn('SmartQuery', `⚠️ Query failed, retrying (${attempt}/${retryAttempts})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        return executeQuery(attempt + 1);
      }
      throw err;
    }
  }, [queryKey, queryFn, ttl, retryAttempts, retryDelay, cacheKey]);

  const refetch = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      cache.current.delete(cacheKey);
    }

    setLoading(true);
    setError(null);

    try {
      const result = await executeQuery();
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Query failed');
      setError(error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [executeQuery, cacheKey]);

  // Auto-fetch on mount o cuando cambia la key
  useEffect(() => {
    refetch();
  }, [cacheKey]);

  const invalidate = useCallback(() => {
    cache.current.delete(cacheKey);
    logDebug('SmartQuery', `🔄 Cache invalidated: ${cacheKey}`);
  }, [cacheKey]);

  return {
    data,
    loading,
    error,
    refetch,
    invalidate
  };
};