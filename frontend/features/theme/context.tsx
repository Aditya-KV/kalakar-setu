import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { Colors, ColorScheme, ThemeColors } from '../../constants/Colors';
import { storage } from '../../lib/storage';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  scheme: ColorScheme;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    const loadSaved = async () => {
      const saved = await storage.getThemeMode();
      if (saved) setModeState(saved);
    };
    loadSaved();
  }, []);

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    await storage.setThemeMode(newMode);
  };

  const scheme: ColorScheme = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
  const colors = useMemo(() => Colors[scheme], [scheme]);

  return (
    <ThemeContext.Provider value={{ mode, scheme, colors, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
