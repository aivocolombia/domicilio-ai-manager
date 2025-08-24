import { useState, useEffect } from 'react';

type ViewMode = 'summary' | 'chart' | 'states';

interface TimeMetricsState {
  viewMode: ViewMode;
  selectedSede: string;
  dateRange: { from: Date; to: Date };
}

const STORAGE_KEY = 'ajiaco-time-metrics-state';

const getDefaultState = (): TimeMetricsState => ({
  viewMode: 'summary',
  selectedSede: 'global',
  dateRange: {
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date()
  }
});

export const useTimeMetricsState = () => {
  const [state, setState] = useState<TimeMetricsState>(getDefaultState());

  // Cargar el estado desde localStorage al montar el componente
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        setState({
          viewMode: parsed.viewMode || 'summary',
          selectedSede: parsed.selectedSede || 'global',
          dateRange: {
            from: parsed.dateRange?.from ? new Date(parsed.dateRange.from) : new Date(new Date().setDate(new Date().getDate() - 7)),
            to: parsed.dateRange?.to ? new Date(parsed.dateRange.to) : new Date()
          }
        });
      }
    } catch (error) {
      console.warn('Error loading time metrics state from localStorage:', error);
    }
  }, []);

  // Función para actualizar el estado y guardarlo en localStorage
  const updateState = (newState: Partial<TimeMetricsState>) => {
    const updatedState = { ...state, ...newState };
    setState(updatedState);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedState));
    } catch (error) {
      console.warn('Error saving time metrics state to localStorage:', error);
    }
  };

  // Función para resetear el estado
  const resetState = () => {
    const defaultState = getDefaultState();
    setState(defaultState);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    viewMode: state.viewMode,
    selectedSede: state.selectedSede,
    dateRange: state.dateRange,
    updateState,
    resetState
  };
};