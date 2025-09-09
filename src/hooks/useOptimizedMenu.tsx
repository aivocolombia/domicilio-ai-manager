import { useState, useEffect, useCallback } from 'react';
import { sedeService } from '@/services/sedeService';
import { logDebug, logError } from '@/utils/logger';

interface OptimizedMenuData {
  platos: any[];
  bebidas: any[];
  toppings: any[];
}

interface UseOptimizedMenuResult {
  menuData: OptimizedMenuData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  invalidateCache: () => void;
}

export const useOptimizedMenu = (sedeId?: string): UseOptimizedMenuResult => {
  const [menuData, setMenuData] = useState<OptimizedMenuData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMenuData = useCallback(async (forceRefresh = false) => {
    if (!sedeId) {
      setMenuData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      logDebug('OptimizedMenu', `🍽️ Cargando menú para sede ${sedeId}`);

      // Usar el servicio optimizado con caché
      const { platos, bebidas, toppings } = await sedeService.getSedeCompleteInfo(sedeId, forceRefresh);

      const optimizedMenuData: OptimizedMenuData = {
        platos: platos.filter(p => p.is_available),
        bebidas: bebidas.filter(b => b.is_available), 
        toppings: toppings.filter(t => t.is_available)
      };

      setMenuData(optimizedMenuData);
      logDebug('OptimizedMenu', `✅ Menú cargado: ${platos.length} platos, ${bebidas.length} bebidas, ${toppings.length} toppings`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      logError('OptimizedMenu', 'Error cargando menú', err);
      setError(errorMessage);
      setMenuData(null);
    } finally {
      setLoading(false);
    }
  }, [sedeId]);

  const refresh = useCallback(async () => {
    await loadMenuData(true); // Forzar actualización
  }, [loadMenuData]);

  const invalidateCache = useCallback(() => {
    if (sedeId) {
      sedeService.invalidateSedeCache(sedeId);
      logDebug('OptimizedMenu', `🔄 Cache invalidado para sede ${sedeId}`);
    }
  }, [sedeId]);

  // Cargar datos cuando cambie la sede
  useEffect(() => {
    loadMenuData();
  }, [loadMenuData]);

  return {
    menuData,
    loading,
    error,
    refresh,
    invalidateCache
  };
};

// Hook específico para datos de sede con información completa
export const useSedeInfo = (sedeId?: string) => {
  const [sedeInfo, setSedeInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSedeInfo = useCallback(async (forceRefresh = false) => {
    if (!sedeId) {
      setSedeInfo(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      logDebug('SedeInfo', `🏢 Cargando información de sede ${sedeId}`);

      const sede = await sedeService.getSedeById(sedeId, forceRefresh);
      setSedeInfo(sede);

      if (sede) {
        logDebug('SedeInfo', `✅ Sede cargada: ${sede.name}`);
      } else {
        logDebug('SedeInfo', '⚠️ Sede no encontrada');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      logError('SedeInfo', 'Error cargando sede', err);
      setError(errorMessage);
      setSedeInfo(null);
    } finally {
      setLoading(false);
    }
  }, [sedeId]);

  const refresh = useCallback(async () => {
    await loadSedeInfo(true);
  }, [loadSedeInfo]);

  useEffect(() => {
    loadSedeInfo();
  }, [loadSedeInfo]);

  return {
    sedeInfo,
    loading,
    error,
    refresh
  };
};

// Hook para obtener lista de todas las sedes (para selectors)
export const useAllSedes = () => {
  const [sedes, setSedes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAllSedes = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      logDebug('AllSedes', '🏢 Cargando todas las sedes');

      const sedesList = await sedeService.getAllSedes(forceRefresh);
      setSedes(sedesList);

      logDebug('AllSedes', `✅ ${sedesList.length} sedes cargadas`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      logError('AllSedes', 'Error cargando sedes', err);
      setError(errorMessage);
      setSedes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadAllSedes(true);
  }, [loadAllSedes]);

  useEffect(() => {
    loadAllSedes();
  }, [loadAllSedes]);

  return {
    sedes,
    loading,
    error,
    refresh
  };
};