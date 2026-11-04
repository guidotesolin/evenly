import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { useColorScheme, type TextStyle } from 'react-native';

// Approved design "Libreta": see ARCHITECTURE.md § Design and UI copy. Contrast is ≥4.5:1 for
// text and muted text on every surface, in both schemes.
const light = {
  bg: '#f5f6f8',
  surface: '#ffffff',
  surface2: '#eef0f4',
  text: '#14171c',
  muted: '#5a6170',
  line: '#e2e5ea',
  accent: '#2f55d4',
  onAccent: '#ffffff',
  accentSoft: '#e6ecfd',
  warn: '#a64a00',
  warnSoft: '#fdeedf',
  scrim: 'rgba(10, 12, 16, 0.45)',
};

export type Colors = typeof light;

const dark: Colors = {
  bg: '#0e1014',
  surface: '#181b21',
  surface2: '#22262e',
  text: '#eceef2',
  muted: '#a2a8b4',
  line: '#2a2f38',
  accent: '#8ea8ff',
  onAccent: '#0e1014',
  accentSoft: '#232c47',
  warn: '#f2a35e',
  warnSoft: '#3a2a1b',
  scrim: 'rgba(0, 0, 0, 0.6)',
};

/** Follows the system scheme (`userInterfaceStyle: automatic` in app.json). */
export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Header and tab bar colours for expo-router's navigators. */
export function useNavigationTheme(): Theme {
  const scheme = useColorScheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const c = scheme === 'dark' ? dark : light;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.accent,
      background: c.bg,
      card: c.surface,
      text: c.text,
      border: c.line,
    },
  };
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { field: 12, sheet: 16, pill: 999 };

/** Minimum touch target. */
export const touch = 48;

// Roboto is Android's system font, so no font is bundled.
export const type = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
  total: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '500' },
  body: { fontSize: 16, lineHeight: 22 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} satisfies Record<string, TextStyle>;
