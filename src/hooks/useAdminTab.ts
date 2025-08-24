import { useState, useEffect } from 'react';

type AdminTabValue = 'users' | 'sedes' | 'metrics';

const STORAGE_KEY = 'ajiaco-admin-active-tab';

export const useAdminTab = () => {
  const [activeTab, setActiveTab] = useState<AdminTabValue>('users');

  // Cargar la vista activa desde localStorage al montar el componente
  useEffect(() => {
    const savedTab = localStorage.getItem(STORAGE_KEY) as AdminTabValue;
    if (savedTab && ['users', 'sedes', 'metrics'].includes(savedTab)) {
      setActiveTab(savedTab);
    }
  }, []);

  // Función para cambiar la vista activa y guardarla en localStorage
  const setActiveTabAndPersist = (tab: AdminTabValue) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
  };

  // Función para resetear la vista activa a users
  const resetToUsers = () => {
    setActiveTab('users');
    localStorage.setItem(STORAGE_KEY, 'users');
  };

  // Función para limpiar el localStorage
  const clearStoredTab = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    activeTab,
    setActiveTab: setActiveTabAndPersist,
    resetToUsers,
    clearStoredTab
  };
}; 