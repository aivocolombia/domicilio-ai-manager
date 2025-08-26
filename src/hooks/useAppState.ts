import { useState, useEffect } from 'react';

type AppView = 'main' | 'admin' | 'time-metrics';

const STORAGE_KEY = 'ajiaco-app-view';
const NAVIGATION_HISTORY_KEY = 'ajiaco-navigation-history';

export const useAppState = () => {
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showTimeMetrics, setShowTimeMetrics] = useState(false);
  const [navigationHistory, setNavigationHistory] = useState<AppView[]>([]);

  // Cargar el estado desde localStorage al montar el componente
  useEffect(() => {
    try {
      const savedView = localStorage.getItem(STORAGE_KEY) as AppView;
      const savedHistory = localStorage.getItem(NAVIGATION_HISTORY_KEY);
      console.log('🔄 Cargando vista guardada:', savedView);
      
      if (savedHistory) {
        setNavigationHistory(JSON.parse(savedHistory));
      }
      
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
      setNavigationHistory([]);
    }
  }, []);

  // Función para mostrar AdminPanel
  const navigateToAdmin = () => {
    console.log('📍 Navegando a Admin Panel');
    const newHistory = [...navigationHistory, 'admin'];
    setNavigationHistory(newHistory);
    setShowAdminPanel(true);
    setShowTimeMetrics(false);
    localStorage.setItem(STORAGE_KEY, 'admin');
    localStorage.setItem(NAVIGATION_HISTORY_KEY, JSON.stringify(newHistory));
  };

  // Función para mostrar TimeMetrics
  const navigateToTimeMetrics = () => {
    console.log('📍 Navegando a Time Metrics');
    const newHistory = [...navigationHistory, 'time-metrics'];
    setNavigationHistory(newHistory);
    setShowAdminPanel(false);
    setShowTimeMetrics(true);
    localStorage.setItem(STORAGE_KEY, 'time-metrics');
    localStorage.setItem(NAVIGATION_HISTORY_KEY, JSON.stringify(newHistory));
  };

  // Función para volver a la vista anterior
  const navigateToMain = () => {
    console.log('📍 Navegando a vista anterior');
    
    // Si hay historial, volver a la vista anterior
    if (navigationHistory.length > 1) {
      const previousView = navigationHistory[navigationHistory.length - 2];
      const newHistory = navigationHistory.slice(0, -1);
      
      console.log('📍 Vista anterior:', previousView);
      
      setNavigationHistory(newHistory);
      localStorage.setItem(NAVIGATION_HISTORY_KEY, JSON.stringify(newHistory));
      
      if (previousView === 'admin') {
        setShowAdminPanel(true);
        setShowTimeMetrics(false);
        localStorage.setItem(STORAGE_KEY, 'admin');
      } else if (previousView === 'time-metrics') {
        setShowAdminPanel(false);
        setShowTimeMetrics(true);
        localStorage.setItem(STORAGE_KEY, 'time-metrics');
      } else {
        // Vista principal por defecto
        setShowAdminPanel(false);
        setShowTimeMetrics(false);
        localStorage.setItem(STORAGE_KEY, 'main');
      }
    } else {
      // Si no hay historial, ir a la vista principal
      console.log('📍 No hay historial, yendo a vista principal');
      setShowAdminPanel(false);
      setShowTimeMetrics(false);
      setNavigationHistory([]);
      localStorage.setItem(STORAGE_KEY, 'main');
      localStorage.setItem(NAVIGATION_HISTORY_KEY, JSON.stringify([]));
    }
  };

  // Función para limpiar el estado
  const clearAppState = () => {
    setShowAdminPanel(false);
    setShowTimeMetrics(false);
    setNavigationHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(NAVIGATION_HISTORY_KEY);
  };

  // Función para ir específicamente a la vista principal
  const navigateToMainView = () => {
    console.log('📍 Navegando a vista principal');
    setShowAdminPanel(false);
    setShowTimeMetrics(false);
    setNavigationHistory([]);
    localStorage.setItem(STORAGE_KEY, 'main');
    localStorage.setItem(NAVIGATION_HISTORY_KEY, JSON.stringify([]));
  };

  return {
    showAdminPanel,
    showTimeMetrics,
    navigateToAdmin,
    navigateToTimeMetrics,
    navigateToMain,
    navigateToMainView,
    clearAppState
  };
};