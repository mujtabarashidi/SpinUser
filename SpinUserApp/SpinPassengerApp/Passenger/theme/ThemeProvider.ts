export type ThemeColors = {
  primary: string;
  text: string;
  background: string;
  card: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  // Extended colors for UI components
  surface: string;
  surfaceAlt: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
  error: string;
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
};

const defaultColors: ThemeColors = {
  primary: '#007AFF',
  text: '#111',
  background: '#fff',
  card: '#F8F9FA',
  border: '#E8E9EB',
  success: '#28a745',
  warning: '#fd7e14',
  danger: '#dc3545',
  // Extended colors
  surface: '#FFFFFF',
  surfaceAlt: '#F8F9FA',
  textPrimary: '#1C1C1E',
  textMuted: '#8E8E93',
  accent: '#007AFF',
  error: '#FF3B30',
  inputBackground: '#F2F2F7',
  inputBorder: '#E5E5EA',
  inputText: '#1C1C1E',
  inputPlaceholder: '#C7C7CC',
};

export function useAppTheme() {
  return { colors: defaultColors };
}
