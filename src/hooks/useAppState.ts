import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

type AppView = 'main' | 'admin' | 'time-metrics' | 'pos';

const STORAGE_KEY = 'ajiaco-app-view';
const NAVIGATION_HISTORY_KEY = 'ajiaco-navigation-history';

export const useAppState = () => {
  const { user } = useAuth();
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showTimeMetrics, setShowTimeMetrics] = useState(false);
  const [showPOS, setShowPOS] = useState(false);
  const [navigationHistory, setNavigationHistory] = useState<AppView[]>([]);

  // Cargar el estado desde localStorage al montar el componente
  useEffect(() => {
    try {
      const savedView = localStorage.getItem(STORAGE_KEY) as AppView;
      const savedHistory = localStorage.getItem(NAVIGATION_HISTORY_KEY);
      console.log('🔄 Cargando vista guardada:', savedView);
      console.log('🔐 Rol del usuario:', user?.role);
      
      if (savedHistory) {
        setNavigationHistory(JSON.parse(savedHistory));
      }
      
      // VALIDACIÓN DE SEGURIDAD: Solo permitir vista admin si el usuario es admin
      if (savedView === 'admin') {
        if (user?.role === 'admin_global' || user?.role === 'admin_punto') {
          setShowAdminPanel(true);
          setShowTimeMetrics(false);
          console.log('✅ Usuario admin autorizado para vista admin');
        } else {
          console.warn('⚠️ SEGURIDAD: Usuario no-admin intentó acceder a vista admin, redirigiendo a vista principal');
          // Limpiar localStorage malicioso y ir a vista principal
          localStorage.setItem(STORAGE_KEY, 'main');
          localStorage.removeItem(NAVIGATION_HISTORY_KEY);
          setShowAdminPanel(false);
          setShowTimeMetrics(false);
        }
      } else if (savedView === 'time-metrics') {
        setShowAdminPanel(false);
        setShowTimeMetrics(true);
        setShowPOS(false);
      } else if (savedView === 'pos') {
        setShowAdminPanel(false);
        setShowTimeMetrics(false);
        setShowPOS(true);
      } else {
        // Vista principal por defecto
        setShowAdminPanel(false);
        setShowTimeMetrics(false);
        setShowPOS(false);
      }
    } catch (error) {
      console.warn('Error loading app state from localStorage:', error);
      // Valores por defecto en caso de error
      setShowAdminPanel(false);
      setShowTimeMetrics(false);
      setShowPOS(false);
      setNavigationHistory([]);
    }
  }, [user?.role]);

  // Función para mostrar AdminPanel
  const navigateToAdmin = () => {
    // VALIDACIÓN DE SEGURIDAD: Solo permitir acceso a usuarios admin
    if (user?.role !== 'admin_global' && user?.role !== 'admin_punto') {
      console.error('🚫 ACCESO DENEGADO: Solo usuarios admin pueden acceder al panel de administración');
      return;
    }

    console.log('📍 Navegando a Admin Panel');
    const newHistory = [...navigationHistory, 'admin'];
    setNavigationHistory(newHistory);
    setShowAdminPanel(true);
    setShowTimeMetrics(false);
    setShowPOS(false);
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
    setShowPOS(false);
    localStorage.setItem(STORAGE_KEY, 'time-metrics');
    localStorage.setItem(NAVIGATION_HISTORY_KEY, JSON.stringify(newHistory));
  };

  // Función para mostrar POS
  const navigateToPOS = () => {
    console.log('📍 Navegando a POS');
    const newHistory = [...navigationHistory, 'pos'];
    setNavigationHistory(newHistory);
    setShowAdminPanel(false);
    setShowTimeMetrics(false);
    setShowPOS(true);
    localStorage.setItem(STORAGE_KEY, 'pos');
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
        setShowPOS(false);
        localStorage.setItem(STORAGE_KEY, 'admin');
      } else if (previousView === 'time-metrics') {
        setShowAdminPanel(false);
        setShowTimeMetrics(true);
        setShowPOS(false);
        localStorage.setItem(STORAGE_KEY, 'time-metrics');
      } else if (previousView === 'pos') {
        setShowAdminPanel(false);
        setShowTimeMetrics(false);
        setShowPOS(true);
        localStorage.setItem(STORAGE_KEY, 'pos');
      } else {
        // Vista principal por defecto
        setShowAdminPanel(false);
        setShowTimeMetrics(false);
        setShowPOS(false);
        localStorage.setItem(STORAGE_KEY, 'main');
      }
    } else {
      // Si no hay historial, ir a la vista principal
      console.log('📍 No hay historial, yendo a vista principal');
      setShowAdminPanel(false);
      setShowTimeMetrics(false);
      setShowPOS(false);
      setNavigationHistory([]);
      localStorage.setItem(STORAGE_KEY, 'main');
      localStorage.setItem(NAVIGATION_HISTORY_KEY, JSON.stringify([]));
    }
  };

  // Función para limpiar el estado
  const clearAppState = () => {
    setShowAdminPanel(false);
    setShowTimeMetrics(false);
    setShowPOS(false);
    setNavigationHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(NAVIGATION_HISTORY_KEY);
  };

  // Función para ir específicamente a la vista principal
  const navigateToMainView = () => {
    console.log('📍 Navegando a vista principal');
    setShowAdminPanel(false);
    setShowTimeMetrics(false);
    setShowPOS(false);
    setNavigationHistory([]);
    localStorage.setItem(STORAGE_KEY, 'main');
    localStorage.setItem(NAVIGATION_HISTORY_KEY, JSON.stringify([]));
  };

  return {
    showAdminPanel,
    showTimeMetrics,
    showPOS,
    navigateToAdmin,
    navigateToTimeMetrics,
    navigateToPOS,
    navigateToMain,
    navigateToMainView,
    clearAppState
  };
};