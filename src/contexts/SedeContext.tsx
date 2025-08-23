import React, { createContext, useContext } from 'react';

interface SedeContextType {
  effectiveSedeId: string | null;
  currentSedeName: string;
}

const SedeContext = createContext<SedeContextType | undefined>(undefined);

export function SedeProvider({ children, effectiveSedeId, currentSedeName }: { 
  children: React.ReactNode;
  effectiveSedeId: string | null;
  currentSedeName: string;
}) {
  return (
    <SedeContext.Provider value={{ effectiveSedeId, currentSedeName }}>
      {children}
    </SedeContext.Provider>
  );
}

export function useSede() {
  const context = useContext(SedeContext);
  if (context === undefined) {
    throw new Error('useSede must be used within a SedeProvider');
  }
  return context;
}