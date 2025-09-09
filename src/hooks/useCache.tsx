import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { logDebug, logWarn } from '@/utils/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheContextType {
  get: <T>(key: string) => T | null;
  set: <T>(key: string, data: T, ttl?: number) => void;
  delete: (key: string) => void;
  clear: () => void;
  invalidate: (pattern?: string) => void;
  stats: () => { size: number; keys: string[] };
}

const CacheContext = createContext<CacheContextType | null>(null);

interface CacheProviderProps {
  children: React.ReactNode;
  defaultTTL?: number; // tiempo de vida por defecto en ms
}

export const CacheProvider: React.FC<CacheProviderProps> = ({ 
  children, 
  defaultTTL = 5 * 60 * 1000 // 5 minutos por defecto
}) => {
  const cacheRef = useRef<Map<string, CacheEntry<any>>>(new Map());
  const [, forceUpdate] = useState({});

  // Limpiar entradas expiradas cada minuto
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      const cache = cacheRef.current;
      let cleaned = 0;

      for (const [key, entry] of cache.entries()) {
        if (now > entry.expiresAt) {
          cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logDebug('Cache', `🧹 Limpiadas ${cleaned} entradas expiradas`);
        forceUpdate({});
      }
    }, 60000); // cada minuto

    return () => clearInterval(cleanup);
  }, []);

  const get = useCallback(<T>(key: string): T | null => {
    const entry = cacheRef.current.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      cacheRef.current.delete(key);
      logDebug('Cache', `⏰ Entrada expirada eliminada: ${key}`);
      return null;
    }

    logDebug('Cache', `✅ Cache hit: ${key}`);
    return entry.data;
  }, []);

  const set = useCallback(<T>(key: string, data: T, ttl: number = defaultTTL) => {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + ttl
    };

    cacheRef.current.set(key, entry);
    logDebug('Cache', `💾 Cached: ${key} (TTL: ${ttl/1000}s)`);
    forceUpdate({});
  }, [defaultTTL]);

  const deleteEntry = useCallback((key: string) => {
    const deleted = cacheRef.current.delete(key);
    if (deleted) {
      logDebug('Cache', `🗑️ Eliminada entrada: ${key}`);
      forceUpdate({});
    }
    return deleted;
  }, []);

  const clear = useCallback(() => {
    const size = cacheRef.current.size;
    cacheRef.current.clear();
    logDebug('Cache', `🧽 Cache limpiado (${size} entradas)`);
    forceUpdate({});
  }, []);

  const invalidate = useCallback((pattern?: string) => {
    if (!pattern) {
      clear();
      return;
    }

    const regex = new RegExp(pattern);
    let deleted = 0;

    for (const key of cacheRef.current.keys()) {
      if (regex.test(key)) {
        cacheRef.current.delete(key);
        deleted++;
      }
    }

    logDebug('Cache', `🔄 Invalidadas ${deleted} entradas con patrón: ${pattern}`);
    if (deleted > 0) {
      forceUpdate({});
    }
  }, [clear]);

  const stats = useCallback(() => ({
    size: cacheRef.current.size,
    keys: Array.from(cacheRef.current.keys())
  }), []);

  const contextValue: CacheContextType = {
    get,
    set,
    delete: deleteEntry,
    clear,
    invalidate,
    stats
  };

  return (
    <CacheContext.Provider value={contextValue}>
      {children}
    </CacheContext.Provider>
  );
};

export const useCache = (): CacheContextType => {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error('useCache debe ser usado dentro de un CacheProvider');
  }
  return context;
};

// Hook específico para datos de sedes con caché inteligente
export const useSedeCache = () => {
  const cache = useCache();
  
  const getSedeData = useCallback(<T>(sedeId: string, type: 'info' | 'platos' | 'bebidas' | 'toppings'): T | null => {
    return cache.get(`sede:${sedeId}:${type}`);
  }, [cache]);

  const setSedeData = useCallback(<T>(sedeId: string, type: 'info' | 'platos' | 'bebidas' | 'toppings', data: T) => {
    // TTL más largo para datos de sede (15 minutos)
    cache.set(`sede:${sedeId}:${type}`, data, 15 * 60 * 1000);
  }, [cache]);

  const invalidateSede = useCallback((sedeId?: string) => {
    if (sedeId) {
      cache.invalidate(`^sede:${sedeId}:`);
    } else {
      cache.invalidate('^sede:');
    }
  }, [cache]);

  return {
    getSedeData,
    setSedeData,
    invalidateSede
  };
};

// Hook para caché de usuario
export const useUserCache = () => {
  const cache = useCache();

  const getUserProfile = useCallback((userId: string) => {
    return cache.get(`user:${userId}:profile`);
  }, [cache]);

  const setUserProfile = useCallback((userId: string, profile: any) => {
    // TTL más largo para perfiles (30 minutos)
    cache.set(`user:${userId}:profile`, profile, 30 * 60 * 1000);
  }, [cache]);

  const invalidateUser = useCallback((userId?: string) => {
    if (userId) {
      cache.invalidate(`^user:${userId}:`);
    } else {
      cache.invalidate('^user:');
    }
  }, [cache]);

  return {
    getUserProfile,
    setUserProfile,
    invalidateUser
  };
};