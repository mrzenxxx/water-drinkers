'use client';

import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

import type { ThemePreference } from '@/lib/theme';
import {
  getServerSnapshot,
  getSnapshot,
  setPreference,
  subscribe,
  type ThemeState,
} from '@/lib/theme-store';

type ThemeContextValue = ThemeState & {
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  // На сервере снимок всегда «системная тема»; после гидратации React сам
  // перерисует компонент с настоящим значением из localStorage.
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const value = useMemo<ThemeContextValue>(
    () => ({ ...state, setPreference }),
    [state],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
}
