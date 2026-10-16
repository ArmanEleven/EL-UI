export const THEME_IDS = [
  'aurora',
  'obsidian',
  'amethyst',
  'emerald',
  'crimson',
  'amber',
  'horizon',
  'iridescent',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export interface ThemePreset {
  id: ThemeId;
  label: string;
  description: string;
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
  aurora: {
    id: 'aurora',
    label: 'Aurora',
    description: 'Icy blue glass',
    isDark: true,
    isUltra: false,
    background: '#09121d',
    surface: '#101e2c',
    elevated: '#1a3043',
    text: '#edf7ff',
    mutedText: '#a2b9ce',
    accent: '#91e1ff',
    accentStrong: '#42b8e5',
    border: 'rgba(145, 225, 255, 0.18)',
  },

  obsidian: {
    id: 'obsidian',
    label: 'Obsidian',
    description: 'OLED black and silver',
    isDark: true,
    isUltra: true,
    background: '#030405',
    surface: '#0a0d11',
    elevated: '#141920',
    text: '#f2f5f8',
    mutedText: '#a1abb6',
    accent: '#d3dce6',
    accentStrong: '#aebdcd',
    border: 'rgba(211, 220, 230, 0.14)',
  },

  amethyst: {
    id: 'amethyst',
    label: 'Amethyst',
    description: 'Soft violet glass',
    isDark: true,
    isUltra: false,
    background: '#100b1b',
    surface: '#1b1428',
    elevated: '#2b2040',
    text: '#f4efff',
    mutedText: '#b5a9d0',
    accent: '#c4a8ff',
    accentStrong: '#9b78ef',
    border: 'rgba(196, 168, 255, 0.18)',
  },

  emerald: {
    id: 'emerald',
    label: 'Emerald',
    description: 'Deep green glass',
    isDark: true,
    isUltra: false,
    background: '#07130f',
    surface: '#0e2018',
    elevated: '#183529',
    text: '#eafaf1',
    mutedText: '#a0c6b0',
    accent: '#8ce7b8',
    accentStrong: '#42bd80',
    border: 'rgba(140, 231, 184, 0.17)',
  },

  crimson: {
    id: 'crimson',
    label: 'Crimson',
    description: 'Muted ruby glass',
    isDark: true,
    isUltra: false,
    background: '#18090e',
    surface: '#251018',
    elevated: '#381823',
    text: '#fff0f2',
    mutedText: '#d4a7b0',
    accent: '#ff9bae',
    accentStrong: '#e65d7b',
    border: 'rgba(255, 155, 174, 0.17)',
  },

  amber: {
    id: 'amber',
    label: 'Amber',
    description: 'Warm champagne glass',
    isDark: true,
    isUltra: false,
    background: '#171006',
    surface: '#251b0b',
    elevated: '#382811',
    text: '#fff7e8',
    mutedText: '#d4bd92',
    accent: '#ffda91',
    accentStrong: '#e8ae45',
    border: 'rgba(255, 218, 145, 0.17)',
  },

  horizon: {
    id: 'horizon',
    label: 'Horizon',
    description: 'Clean light glass',
    isDark: false,
    isUltra: false,
    background: '#f2f6fb',
    surface: '#ffffff',
    elevated: '#f9fbfe',
    text: '#182437',
    mutedText: '#65758b',
    accent: '#4b8df8',
    accentStrong: '#2767d8',
    border: 'rgba(38, 73, 119, 0.14)',
  },

  iridescent: {
    id: 'iridescent',
    label: 'Iridescent',
    description: 'Prismatic blue and violet glass',
    isDark: true,
    isUltra: false,
    background: '#0b0b16',
    surface: '#141528',
    elevated: '#20213b',
    text: '#f3f2ff',
    mutedText: '#b0b4d0',
    accent: '#a9d8ff',
    accentStrong: '#ad91ff',
    border: 'rgba(174, 168, 255, 0.20)',
  },
};

const LEGACY_THEME_IDS: Record<string, ThemeId> = {
  light: 'horizon',
  graphite: 'aurora',
  midnight: 'amethyst',
  ocean: 'aurora',
  'ultra-dark': 'obsidian',
};

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

export function resolveThemeId(value: string | null | undefined): ThemeId | undefined {
  if (isThemeId(value)) return value;
  if (typeof value === 'string') return LEGACY_THEME_IDS[value];
  return undefined;
}

export function getThemePreset(id: ThemeId): ThemePreset {
  return THEME_PRESETS[id];
}
