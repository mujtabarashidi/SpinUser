import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  Theme as NavigationTheme,
} from '@react-navigation/native';
import React, { createContext, PropsWithChildren, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  card: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentContrast: string;
  accentMuted: string;
  inputBackground: string;
  inputBorder: string;
  inputPlaceholder: string;
  inputText: string;
  buttonPrimary: string;
  buttonPrimaryText: string;
  buttonSecondary: string;
  buttonSecondaryText: string;
  success: string;
  warning: string;
  error: string;
  overlay: string;
};

const ACCENT = '#FF9F1C';

const lightColors: ThemeColors = {
  background: '#F5F6FB',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  card: '#FFFFFF',
  border: '#E5E7EB',
  textPrimary: '#111827',
  textSecondary: '#374151',
  textMuted: '#6B7280',
  accent: ACCENT,
  accentContrast: '#111827',
  accentMuted: '#FFF5E8',
  inputBackground: '#FFFFFF',
  inputBorder: '#D1D5DB',
  inputPlaceholder: '#9CA3AF',
  inputText: '#111827',
  buttonPrimary: ACCENT,
  buttonPrimaryText: '#111827',
  buttonSecondary: '#1F2937',
  buttonSecondaryText: '#F9FAFB',
  success: '#047857',
  warning: '#F59E0B',
  error: '#B91C1C',
  overlay: 'rgba(17, 24, 39, 0.35)',
};

const darkColors: ThemeColors = {
  background: '#2A2F3A',
  surface: '#3A4553',
  surfaceAlt: '#4A5568',
  card: '#3A4553',
  border: '#5A6470',
  textPrimary: '#FFFFFF',
  textSecondary: '#F0F4F8',
  textMuted: '#CBD5E0',
  accent: ACCENT,
  accentContrast: '#111827',
  accentMuted: '#5A4A35',
  inputBackground: '#3A4553',
  inputBorder: '#5A6470',
  inputPlaceholder: '#CBD5E0',
  inputText: '#FFFFFF',
  buttonPrimary: ACCENT,
  buttonPrimaryText: '#111827',
  buttonSecondary: '#5A6470',
  buttonSecondaryText: '#FFFFFF',
  success: '#68D391',
  warning: '#F6AD55',
  error: '#FC8181',
  overlay: 'rgba(42, 47, 58, 0.65)',
};

export interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  navigationTheme: NavigationTheme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const buildNavigationTheme = (mode: ThemeMode, colors: ThemeColors): NavigationTheme => {
  const base = mode === 'dark' ? NavigationDarkTheme : NavigationDefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.accent,
    },
  };
};

export const ThemeProvider = ({ children }: PropsWithChildren<{}>) => {
  const scheme = useColorScheme();
  const mode: ThemeMode = scheme === 'dark' ? 'dark' : 'light';

  const value = useMemo<ThemeContextValue>(() => {
    const colors = mode === 'dark' ? darkColors : lightColors;
    return {
      mode,
      colors,
      navigationTheme: buildNavigationTheme(mode, colors),
    };
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useAppTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return ctx;
};

export { darkColors, lightColors };

