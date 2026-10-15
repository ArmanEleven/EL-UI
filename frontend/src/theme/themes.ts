export const THEME_IDS = ['light', 'graphite', 'midnight', 'ocean', 'ultra-dark'] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export interface ThemePreset {
  id: ThemeId;
  label: string;
  isDark: boolean;
  isUltra: boolean;
  background: string;
  surface: string;
  elevated: string;
  text: string;
  mutedText: string;
  accent: string;
  accentStrong: string;
  border: string;
}

export const THEME_PRESETS: Record<ThemeId, ThemePreset> = {
  light: {
    id: 'light',
    label: 'Light',
    isDark: false,
    isUltra: false,
    background: '#f4f6fa',
    surface: '#ffffff',
    elevated: '#ffffff',
    text: '#172033',
    mutedText: '#667085',
    accent: '#3478f6',
    accentStrong: '#245ed0',
    border: 'rgba(31, 51, 83, 0.12)',
  },
  graphite: {
    id: 'graphite',
    label: 'Graphite Cyan',
    isDark: true,
    isUltra: false,
    background: '#0a0d12',
    surface: '#111720',
    elevated: '#192331',
    text: '#eaf2fb',
    mutedText: '#98a8bb',
    accent: '#61d5ff',
    accentStrong: '#2da8d8',
    border: 'rgba(97, 213, 255, 0.15)',
  },
  midnight: {
    id: 'midnight',
    label: 'Midnight Violet',
    isDark: true,
    isUltra: false,
    background: '#0c0b14',
    surface: '#151323',
    elevated: '#211d35',
    text: '#f0edff',
    mutedText: '#aaa5c4',
    accent: '#b8a1ff',
    accentStrong: '#9275f2',
    border: 'rgba(184, 161, 255, 0.16)',
  },
  ocean: {
    id: 'ocean',
    label: 'Deep Ocean',
    isDark: true,
    isUltra: false,
    background: '#07121c',
    surface: '#0d1c2a',
    elevated: '#142b3e',
    text: '#e7f5ff',
    mutedText: '#94b4c9',
    accent: '#4db6ff',
    accentStrong: '#208bd6',
    border: 'rgba(77, 182, 255, 0.16)',
  },
  'ultra-dark': {
    id: 'ultra-dark',
    label: 'OLED Black',
    isDark: true,
    isUltra: true,
    background: '#030405',
    surface: '#0a0d11',
    elevated: '#10151c',
    text: '#f0f6fc',
    mutedText: '#9aa8b8',
    accent: '#72ddff',
    accentStrong: '#2db5e4',
    border: 'rgba(114, 221, 255, 0.12)',
  },
};

export function isThemeId(value: string | null): value is ThemeId {
  return value !== null && (THEME_IDS as readonly string[]).includes(value);
}

export function getThemePreset(id: ThemeId): ThemePreset {
  return THEME_PRESETS[id];
}
