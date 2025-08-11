import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface InventoryContextType {
  lastUpdate: Date;
  triggerUpdate: () => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const useInventoryEvents = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventoryEvents must be used within an InventoryProvider');
  }
  return context;
};

interface InventoryProviderProps {
  children: ReactNode;
}

export const InventoryProvider: React.FC<InventoryProviderProps> = ({ children }) => {
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const triggerUpdate = useCallback(() => {
    setLastUpdate(new Date());
  }, []);

  return (
    <InventoryContext.Provider value={{ lastUpdate, triggerUpdate }}>
      {children}
    </InventoryContext.Provider>
  );
}; 