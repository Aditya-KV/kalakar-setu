import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage } from '../../lib/storage';

export type AppMode = 'seller' | 'customer';

interface AppModeContextType {
  mode: AppMode;
  isReady: boolean;
  setMode: (mode: AppMode) => Promise<void>;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export const AppModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<AppMode>('seller');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    storage.getAppMode().then((saved) => {
      if (saved) setModeState(saved);
      setIsReady(true);
    });
  }, []);

  const setMode = async (newMode: AppMode) => {
    setModeState(newMode);
    await storage.setAppMode(newMode);
  };

  return (
    <AppModeContext.Provider value={{ mode, isReady, setMode }}>
      {children}
    </AppModeContext.Provider>
  );
};

export const useAppMode = () => {
  const context = useContext(AppModeContext);
  if (!context) {
    throw new Error('useAppMode must be used within an AppModeProvider');
  }
  return context;
};
