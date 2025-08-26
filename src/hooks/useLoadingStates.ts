import { useState, useCallback } from 'react';
import { logger } from '@/utils/logger';

export type LoadingSection = 'users' | 'sedes' | 'repartidores' | 'metrics';

interface LoadingState {
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  retryCount: number;
}

interface LoadingStates {
  users: LoadingState;
  sedes: LoadingState;
  repartidores: LoadingState;
  metrics: LoadingState;
}

interface UseLoadingStatesReturn {
  loadingStates: LoadingStates;
  isAnyLoading: boolean;
  startLoading: (section: LoadingSection) => void;
  finishLoading: (section: LoadingSection, error?: string) => void;
  clearError: (section: LoadingSection) => void;
  incrementRetry: (section: LoadingSection) => void;
  resetSection: (section: LoadingSection) => void;
  resetAll: () => void;
  getLoadingInfo: (section: LoadingSection) => LoadingState;
}

const createInitialState = (): LoadingState => ({
  isLoading: false,
  error: null,
  lastUpdated: null,
  retryCount: 0
});

const createInitialStates = (): LoadingStates => ({
  users: createInitialState(),
  sedes: createInitialState(),
  repartidores: createInitialState(),
  metrics: createInitialState()
});

export function useLoadingStates(): UseLoadingStatesReturn {
  const [loadingStates, setLoadingStates] = useState<LoadingStates>(createInitialStates);

  const startLoading = useCallback((section: LoadingSection) => {
    logger.info(`Starting loading for ${section}`);
    setLoadingStates(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        isLoading: true,
        error: null
      }
    }));
  }, []);

  const finishLoading = useCallback((section: LoadingSection, error?: string) => {
    logger.info(`Finished loading for ${section}`, { error: error || 'none' });
    setLoadingStates(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        isLoading: false,
        error: error || null,
        lastUpdated: new Date()
      }
    }));
  }, []);

  const clearError = useCallback((section: LoadingSection) => {
    setLoadingStates(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        error: null
      }
    }));
  }, []);

  const incrementRetry = useCallback((section: LoadingSection) => {
    setLoadingStates(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        retryCount: prev[section].retryCount + 1
      }
    }));
  }, []);

  const resetSection = useCallback((section: LoadingSection) => {
    logger.info(`Resetting loading state for ${section}`);
    setLoadingStates(prev => ({
      ...prev,
      [section]: createInitialState()
    }));
  }, []);

  const resetAll = useCallback(() => {
    logger.info('Resetting all loading states');
    setLoadingStates(createInitialStates);
  }, []);

  const getLoadingInfo = useCallback((section: LoadingSection): LoadingState => {
    return loadingStates[section];
  }, [loadingStates]);

  const isAnyLoading = Object.values(loadingStates).some(state => state.isLoading);

  return {
    loadingStates,
    isAnyLoading,
    startLoading,
    finishLoading,
    clearError,
    incrementRetry,
    resetSection,
    resetAll,
    getLoadingInfo
  };
}