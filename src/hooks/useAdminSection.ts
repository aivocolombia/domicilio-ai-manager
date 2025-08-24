import { useState, useEffect } from 'react';

type AdminSectionValue = 'config' | 'metrics';

const STORAGE_KEY = 'ajiaco-admin-active-section';

export const useAdminSection = () => {
  const [activeSection, setActiveSection] = useState<AdminSectionValue>('config');

  // Cargar la sección activa desde localStorage al montar el componente
  useEffect(() => {
    const savedSection = localStorage.getItem(STORAGE_KEY) as AdminSectionValue;
    if (savedSection && ['config', 'metrics'].includes(savedSection)) {
      setActiveSection(savedSection);
    }
  }, []);

  // Función para cambiar la sección activa y guardarla en localStorage
  const setActiveSectionAndPersist = (section: AdminSectionValue) => {
    setActiveSection(section);
    localStorage.setItem(STORAGE_KEY, section);
  };

  // Función para resetear la sección activa a config
  const resetToConfig = () => {
    setActiveSection('config');
    localStorage.setItem(STORAGE_KEY, 'config');
  };

  // Función para limpiar el localStorage
  const clearStoredSection = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    activeSection,
    setActiveSection: setActiveSectionAndPersist,
    resetToConfig,
    clearStoredSection
  };
};