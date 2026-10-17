import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { theme as antdTheme } from 'antd';
import type { ThemeConfig } from 'antd';

import { getThemePreset, resolveThemeId, THEME_IDS, type ThemeId } from '@/theme/themes';

const STORAGE_THEME = 'elui-theme';
const STORAGE_DARK = 'dark-mode';
const STORAGE_ULTRA = 'isUltraDarkThemeEnabled';

function hexToRgbChannels(value: string): string {
  const match = /^#([\da-f]{6})$/i.exec(value.trim());
  if (!match) return '101, 216, 255';
  const number = Number.parseInt(match[1], 16);
  return [number >> 16, (number >> 8) & 255, number & 255].join(', ');
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === 'true';
  } catch {
    return fallback;
  }
}

function readInitialTheme(): ThemeId {
  try {
    const stored = resolveThemeId(localStorage.getItem(STORAGE_THEME));
    if (stored) return stored;
  } catch {
    // Browser storage may be unavailable.
  }

  if (readBool(STORAGE_ULTRA, false)) return 'obsidian';
  return readBool(STORAGE_DARK, true) ? 'aurora' : 'horizon';
}

function applyDom(themeId: ThemeId): void {
  if (typeof document === 'undefined' || !document.documentElement) return;

  const preset = getThemePreset(themeId);
  const root = document.documentElement;
  const body = document.body;

  if (body) {
    body.classList.remove('dark', 'light');
    body.classList.add(preset.isDark ? 'dark' : 'light');
  }

  root.style.colorScheme = preset.isDark ? 'dark' : 'light';
  root.setAttribute('data-palette', themeId);

  // Keep the old marker for existing ultra-dark selectors while migrating CSS.
  if (preset.isUltra) root.setAttribute('data-theme', 'ultra-dark');
  else root.removeAttribute('data-theme');

  // Keep EL-UI's legacy tokens and expose the semantic tokens used by the
  // approved Liquid Glass prototype. One palette selection must drive every
  // surface, focus ring, border and accent instead of leaving old green CSS.
  const variables: Record<string, string> = {
    '--elui-bg': preset.background,
    '--elui-surface': preset.surface,
    '--elui-surface-elevated': preset.elevated,
    '--elui-text': preset.text,
    '--elui-muted-text': preset.mutedText,
    '--elui-accent': preset.accent,
    '--elui-accent-strong': preset.accentStrong,
    '--elui-border': preset.border,
    '--elui-border-light': preset.border,
    '--elui-border-dark': preset.border,
    '--elui-ink': preset.isDark ? preset.background : preset.text,
    '--bg-page': preset.background,
    '--bg-card': preset.surface,

    // Liquid Glass beta token bridge.
    '--bg': preset.background,
    '--bg-deep': preset.backgroundDeep ?? preset.background,
    '--surface': preset.surface,
    '--surface-2': preset.surfaceSecondary ?? preset.elevated,
    '--surface-3': preset.surfaceTertiary ?? preset.elevated,
    '--surface-glass': `color-mix(in srgb, ${preset.surface} 80%, transparent)`,
    '--text': preset.text,
    '--text-2': preset.mutedText,
    '--text-3': preset.faintText ?? preset.mutedText,
    '--accent': preset.accent,
    '--accent-strong': preset.accentStrong,
    '--accent-rgb': hexToRgbChannels(preset.accent),
    '--border': preset.border,
    '--border-strong': preset.borderStrong ?? preset.border,
    '--success': preset.isDark ? '#57d6a0' : '#16794f',
    '--warning': preset.isDark ? '#f2bd66' : '#9a6508',
    '--danger': preset.isDark ? '#ff6f87' : '#c62b45',
    '--info': preset.isDark ? '#75baff' : '#2868d5',
    '--shadow': preset.isDark ? '0 24px 70px rgb(0 0 0 / 28%)' : '0 24px 70px rgb(31 57 90 / 12%)',
    '--shadow-soft': preset.isDark
      ? '0 12px 36px rgb(0 0 0 / 18%)'
      : '0 12px 36px rgb(31 57 90 / 8%)',
    '--glow': `0 0 38px color-mix(in srgb, ${preset.accent} 10%, transparent)`,
  };

  for (const [name, value] of Object.entries(variables)) {
    root.style.setProperty(name, value);
  }

  const message = document.getElementById('message');
  if (message) {
    message.classList.remove('dark', 'light');
    message.classList.add(preset.isDark ? 'dark' : 'light');
  }
}

const initialThemeId = readInitialTheme();
applyDom(initialThemeId);

const STATISTIC_TOKENS = {
  contentFontSize: 17,
  titleFontSize: 11,
};

const SHARED_STYLE_CONFIG = {
  hashed: false,
  cssVar: { key: 'elui' },
} as const;

export function buildAntdThemeConfig(
  isDark: boolean,
  isUltra: boolean,
  themeId?: ThemeId,
): ThemeConfig {
  const id = themeId ?? (isUltra ? 'obsidian' : isDark ? 'aurora' : 'horizon');
  const preset = getThemePreset(id);
  const primary = preset.accentStrong;

  const token = {
    colorBgBase: preset.background,
    colorBgLayout: preset.background,
    colorBgContainer: preset.surface,
    colorBgElevated: preset.elevated,
    colorTextBase: preset.text,
    colorText: preset.text,
    colorTextSecondary: preset.mutedText,
    colorTextDescription: preset.mutedText,
    colorTextTertiary: preset.mutedText,
    colorTextPlaceholder: preset.mutedText,
    colorBorder: preset.border,
    colorBorderSecondary: preset.border,
    colorPrimary: primary,
    colorPrimaryHover: preset.accent,
    colorPrimaryActive: preset.accentStrong,
    colorError: '#cf1322',
    colorErrorText: '#cf1322',
    colorSuccessText: '#16794f',
    borderRadius: 12,
  };

  if (!preset.isDark) {
    return {
      ...SHARED_STYLE_CONFIG,
      algorithm: antdTheme.defaultAlgorithm,
      token,
      components: {
        Statistic: STATISTIC_TOKENS,
        Button: {
          colorPrimary: primary,
          colorPrimaryHover: preset.accent,
          colorPrimaryActive: preset.accentStrong,
        },
      },
    };
  }

  return {
    ...SHARED_STYLE_CONFIG,
    algorithm: antdTheme.darkAlgorithm,
    token,
    components: {
      Layout: {
        bodyBg: preset.background,
        headerBg: preset.background,
        headerColor: preset.text,
        footerBg: preset.background,
        siderBg: preset.background,
        triggerBg: preset.elevated,
        triggerColor: preset.text,
      },
      Menu: {
        darkItemBg: preset.background,
        darkSubMenuItemBg: preset.background,
        darkPopupBg: preset.elevated,
      },
      Card: {
        colorBorderSecondary: preset.border,
      },
      Statistic: STATISTIC_TOKENS,
    },
  };
}

export function pauseAnimationsUntilLeave(elementId: string): void {
  if (typeof document === 'undefined') return;

  document.documentElement.setAttribute('data-theme-animations', 'off');
  const element = document.getElementById(elementId);
  if (!element) {
    document.documentElement.removeAttribute('data-theme-animations');
    return;
  }

  const restore = () => {
    document.documentElement.removeAttribute('data-theme-animations');
    element.removeEventListener('mouseleave', restore);
    element.removeEventListener('touchend', restore);
  };

  element.addEventListener('mouseleave', restore);
  element.addEventListener('touchend', restore);
}

interface ThemeContextValue {
  isDark: boolean;
  isUltra: boolean;
  themeId: ThemeId;
  setTheme: (themeId: ThemeId) => void;
  cycleTheme: () => void;
  toggleTheme: () => void;
  toggleUltra: () => void;
  antdThemeConfig: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(initialThemeId);
  const preset = getThemePreset(themeId);
  const isDark = preset.isDark;
  const isUltra = preset.isUltra;

  useLayoutEffect(() => {
    applyDom(themeId);
    try {
      localStorage.setItem(STORAGE_THEME, themeId);
      localStorage.setItem(STORAGE_DARK, String(isDark));
      localStorage.setItem(STORAGE_ULTRA, String(isUltra));
    } catch {
      // The active in-memory theme still works without storage.
    }
  }, [themeId, isDark, isUltra]);

  const setTheme = useCallback((nextTheme: ThemeId) => {
    setThemeId(nextTheme);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeId((current) => {
      const index = THEME_IDS.indexOf(current);
      return THEME_IDS[(index + 1) % THEME_IDS.length];
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeId((current) => (getThemePreset(current).isDark ? 'horizon' : 'aurora'));
  }, []);

  const toggleUltra = useCallback(() => {
    setThemeId((current) => (getThemePreset(current).isUltra ? 'aurora' : 'obsidian'));
  }, []);

  const antdThemeConfig = useMemo(
    () => buildAntdThemeConfig(isDark, isUltra, themeId),
    [isDark, isUltra, themeId],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      isDark,
      isUltra,
      themeId,
      setTheme,
      cycleTheme,
      toggleTheme,
      toggleUltra,
      antdThemeConfig,
    }),
    [isDark, isUltra, themeId, setTheme, cycleTheme, toggleTheme, toggleUltra, antdThemeConfig],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
