import { useState, useEffect } from 'react';

type TabValue = 'dashboard' | 'inventory' | 'personnel' | 'callcenter' | 'sede';

const STORAGE_KEY = 'ajiaco-active-tab';

export const useActiveTab = () => {
  const [activeTab, setActiveTab] = useState<TabValue>('dashboard');

  // Cargar la vista activa desde localStorage al montar el componente
  useEffect(() => {
    const savedTab = localStorage.getItem(STORAGE_KEY) as TabValue;
    if (savedTab && ['dashboard', 'inventory', 'personnel', 'callcenter', 'sede'].includes(savedTab)) {
      setActiveTab(savedTab);
    }
  }, []);

  // Función para cambiar la vista activa y guardarla en localStorage
  const setActiveTabAndPersist = (tab: TabValue) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
  };

  // Función para resetear la vista activa al dashboard
  const resetToDashboard = () => {
    setActiveTab('dashboard');
    localStorage.setItem(STORAGE_KEY, 'dashboard');
  };

  // Función para limpiar el localStorage
  const clearStoredTab = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    activeTab,
    setActiveTab: setActiveTabAndPersist,
    resetToDashboard,
    clearStoredTab
  };
}; 