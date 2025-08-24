import { useState, useEffect } from 'react';

type AppView = 'main' | 'admin' | 'time-metrics';

const STORAGE_KEY = 'ajiaco-app-view';

export const useAppState = () => {
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showTimeMetrics, setShowTimeMetrics] = useState(false);

  // Cargar el estado desde localStorage al montar el componente
  useEffect(() => {
    try {
      const savedView = localStorage.getItem(STORAGE_KEY) as AppView;
      console.log('🔄 Cargando vista guardada:', savedView);
      
      if (savedView === 'admin') {
        setShowAdminPanel(true);
        setShowTimeMetrics(false);
      } else if (savedView === 'time-metrics') {
        setShowAdminPanel(false);
        setShowTimeMetrics(true);
      } else {
        // Vista principal por defecto
        setShowAdminPanel(false);
        setShowTimeMetrics(false);
      }
    } catch (error) {
      console.warn('Error loading app state from localStorage:', error);
      // Valores por defecto en caso de error
      setShowAdminPanel(false);
      setShowTimeMetrics(false);
    }
  }, []);

  // Función para mostrar AdminPanel
  const navigateToAdmin = () => {
    console.log('📍 Navegando a Admin Panel');
    setShowAdminPanel(true);
    setShowTimeMetrics(false);
    localStorage.setItem(STORAGE_KEY, 'admin');
  };

  // Función para mostrar TimeMetrics
  const navigateToTimeMetrics = () => {
    console.log('📍 Navegando a Time Metrics');
    setShowAdminPanel(false);
    setShowTimeMetrics(true);
    localStorage.setItem(STORAGE_KEY, 'time-metrics');
  };

  // Función para volver a la vista principal
  const navigateToMain = () => {
    console.log('📍 Navegando a vista principal');
    setShowAdminPanel(false);
    setShowTimeMetrics(false);
    localStorage.setItem(STORAGE_KEY, 'main');
  };

  // Función para limpiar el estado
  const clearAppState = () => {
    setShowAdminPanel(false);
    setShowTimeMetrics(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    showAdminPanel,
    showTimeMetrics,
    navigateToAdmin,
    navigateToTimeMetrics,
    navigateToMain,
    clearAppState
  };
};