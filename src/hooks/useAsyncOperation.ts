import { useState, useCallback, useRef } from 'react';

interface UseAsyncOperationOptions {
  timeout?: number;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

export const useAsyncOperation = <T = unknown>(options: UseAsyncOperationOptions = {}) => {
  const { timeout = 10000, onError, onSuccess } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);
  
  // Ref para cancelar operaciones pendientes
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (operation: () => Promise<T>): Promise<T | null> => {
    // Cancelar operación anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Crear nuevo controlador de abort
    abortControllerRef.current = new AbortController();
    const abortController = abortControllerRef.current;

    try {
      setLoading(true);
      setError(null);

      // Crear timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Operación cancelada por timeout (${timeout}ms)`));
        }, timeout);

        // Limpiar timeout si se cancela
        abortController.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('Operación cancelada'));
        });
      });

      // Ejecutar operación con timeout
      const result = await Promise.race([operation(), timeoutPromise]);
      
      // Solo actualizar estado si no se canceló
      if (!abortController.signal.aborted) {
        setData(result);
        onSuccess?.();
        return result;
      }
      
      return null;
    } catch (err) {
      // Solo actualizar error si no se canceló
      if (!abortController.signal.aborted) {
        const error = err instanceof Error ? err : new Error('Error desconocido');
        setError(error);
        onError?.(error);
        throw error;
      }
      return null;
    } finally {
      // Solo actualizar loading si no se canceló
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [timeout, onError, onSuccess]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    cancel();
    setError(null);
    setData(null);
    setLoading(false);
  }, [cancel]);

  return {
    loading,
    error,
    data,
    execute,
    cancel,
    reset
  };
};