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
  backgroundDeep?: string;
  surface: string;
  surfaceSecondary?: string;
  surfaceTertiary?: string;
  elevated: string;
  text: string;
  mutedText: string;
  faintText?: string;
  accent: string;
  accentStrong: string;
  border: string;
  borderStrong?: string;
}

export const THEME_PRESETS: Record<ThemeId, ThemePreset> = {
  aurora: {
    id: 'aurora',
    label: 'Aurora',
    description: 'Icy blue glass',
    isDark: true,
    isUltra: false,
    background: '#080f1b',
    backgroundDeep: '#050a12',
    surface: '#101a29',
    surfaceSecondary: '#142236',
    surfaceTertiary: '#1b2b42',
    elevated: '#1b2b42',
    text: '#edf5ff',
    mutedText: '#a4b4c9',
    faintText: '#71839c',
    accent: '#65d8ff',
    accentStrong: '#2daddc',
    border: 'rgb(150 187 223 / 15%)',
    borderStrong: 'rgb(150 187 223 / 25%)',
  },

  obsidian: {
    id: 'obsidian',
    label: 'Obsidian',
    description: 'OLED black and silver',
    isDark: true,
    isUltra: true,
    background: '#050607',
    backgroundDeep: '#000000',
    surface: '#0d0f12',
    surfaceSecondary: '#14171c',
    surfaceTertiary: '#1c2128',
    elevated: '#1c2128',
    text: '#f3f5f8',
    mutedText: '#a7b0bc',
    faintText: '#737e8b',
    accent: '#d4dde7',
    accentStrong: '#aebdcd',
    border: 'rgb(212 221 231 / 12%)',
    borderStrong: 'rgb(212 221 231 / 22%)',
  },

  amethyst: {
    id: 'amethyst',
    label: 'Amethyst',
    description: 'Soft violet glass',
    isDark: true,
    isUltra: false,
    background: '#100b1b',
    backgroundDeep: '#090611',
    surface: '#1a1428',
    surfaceSecondary: '#241b36',
    surfaceTertiary: '#302447',
    elevated: '#302447',
    text: '#f4efff',
    mutedText: '#b8add3',
    faintText: '#877ba8',
    accent: '#c5a6ff',
    accentStrong: '#9a72ef',
    border: 'rgb(197 166 255 / 16%)',
    borderStrong: 'rgb(197 166 255 / 26%)',
  },

  emerald: {
    id: 'emerald',
    label: 'Emerald',
    description: 'Deep green glass',
    isDark: true,
    isUltra: false,
    background: '#07130f',
    backgroundDeep: '#030a07',
    surface: '#0e2018',
    surfaceSecondary: '#163025',
    surfaceTertiary: '#1d3d2e',
    elevated: '#1d3d2e',
    text: '#eafaf1',
    mutedText: '#a0c6b0',
    faintText: '#6b9c81',
    accent: '#8ce7b8',
    accentStrong: '#42bd80',
    border: 'rgb(140 231 184 / 16%)',
    borderStrong: 'rgb(140 231 184 / 26%)',
  },

  crimson: {
    id: 'crimson',
    label: 'Crimson',
    description: 'Muted ruby glass',
    isDark: true,
    isUltra: false,
    background: '#18090e',
    backgroundDeep: '#0b0407',
    surface: '#251018',
    surfaceSecondary: '#321620',
    surfaceTertiary: '#421d2b',
    elevated: '#421d2b',
    text: '#fff0f2',
    mutedText: '#d4a7b0',
    faintText: '#a77480',
    accent: '#ff9bae',
    accentStrong: '#e65d7b',
    border: 'rgb(255 155 174 / 16%)',
    borderStrong: 'rgb(255 155 174 / 26%)',
  },

  amber: {
    id: 'amber',
    label: 'Amber',
    description: 'Warm champagne glass',
    isDark: true,
    isUltra: false,
    background: '#171006',
    backgroundDeep: '#0b0803',
    surface: '#251b0b',
    surfaceSecondary: '#33240e',
    surfaceTertiary: '#433014',
    elevated: '#433014',
    text: '#fff7e8',
    mutedText: '#d4bd92',
    faintText: '#a68b5d',
    accent: '#ffda91',
    accentStrong: '#e8ae45',
    border: 'rgb(255 218 145 / 16%)',
    borderStrong: 'rgb(255 218 145 / 26%)',
  },

  horizon: {
    id: 'horizon',
    label: 'Horizon',
    description: 'Clean light glass',
    isDark: false,
    isUltra: false,
    background: '#eef3f9',
    backgroundDeep: '#e6edf5',
    surface: '#ffffff',
    surfaceSecondary: '#f7faff',
    surfaceTertiary: '#edf3fa',
    elevated: '#f7faff',
    text: '#152439',
    mutedText: '#5b6c83',
    faintText: '#8090a5',
    accent: '#4c8bf5',
    accentStrong: '#2868d5',
    border: 'rgb(38 73 119 / 13%)',
    borderStrong: 'rgb(38 73 119 / 22%)',
  },

  iridescent: {
    id: 'iridescent',
    label: 'Iridescent',
    description: 'Prismatic blue and violet glass',
    isDark: true,
    isUltra: false,
    background: '#0b0b16',
    backgroundDeep: '#05050d',
    surface: '#141528',
    surfaceSecondary: '#1b1d35',
    surfaceTertiary: '#252747',
    elevated: '#252747',
    text: '#f3f2ff',
    mutedText: '#b0b4d0',
    faintText: '#7e83aa',
    accent: '#a9d8ff',
    accentStrong: '#ad91ff',
    border: 'rgb(174 168 255 / 17%)',
    borderStrong: 'rgb(174 168 255 / 28%)',
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
