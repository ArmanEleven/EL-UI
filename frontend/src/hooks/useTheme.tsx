import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { theme as antdTheme } from 'antd';
import type { ThemeConfig } from 'antd';

import { getThemePreset, isThemeId, THEME_IDS, type ThemeId } from '@/theme/themes';

const STORAGE_THEME = 'elui-theme';
const STORAGE_DARK = 'dark-mode';
const STORAGE_ULTRA = 'isUltraDarkThemeEnabled';

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === 'true';
  } catch {
    return fallback;
  }
}

function readInitialTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_THEME);
    if (isThemeId(stored)) return stored;
  } catch {
    // Storage can be unavailable in privacy modes; fall back to legacy defaults.
  }
  if (readBool(STORAGE_ULTRA, false)) return 'ultra-dark';
  return readBool(STORAGE_DARK, true) ? 'graphite' : 'light';
}

function applyDom(themeId: ThemeId) {
  const preset = getThemePreset(themeId);
  document.body.classList.remove('dark', 'light');
  document.body.classList.add(preset.isDark ? 'dark' : 'light');
  document.documentElement.style.colorScheme = preset.isDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-palette', themeId);
  if (preset.isUltra) {
    document.documentElement.setAttribute('data-theme', 'ultra-dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  const root = document.documentElement;
  root.style.setProperty('--elui-bg', preset.background);
  root.style.setProperty('--elui-surface', preset.surface);
  root.style.setProperty('--elui-surface-elevated', preset.elevated);
  root.style.setProperty('--elui-text', preset.text);
  root.style.setProperty('--elui-muted-text', preset.mutedText);
  root.style.setProperty('--elui-accent', preset.accent);
  root.style.setProperty('--elui-accent-strong', preset.accentStrong);
  root.style.setProperty('--elui-border', preset.border);

  const msg = document.getElementById('message');
  if (msg) {
    msg.classList.remove('dark', 'light');
    msg.classList.add(preset.isDark ? 'dark' : 'light');
  }
}

// Apply before React mounts to avoid a flash of the wrong palette.
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
  const id = themeId ?? (isUltra ? 'ultra-dark' : isDark ? 'graphite' : 'light');
  const preset = getThemePreset(id);
  const primary = preset.accentStrong;
  const token = {
    colorBgBase: preset.background,
    colorBgLayout: preset.background,
    colorBgContainer: preset.surface,
    colorBgElevated: preset.elevated,
    colorTextBase: preset.text,
    colorPrimary: primary,
    colorPrimaryHover: preset.accent,
    colorPrimaryActive: preset.accentStrong,
    colorTextDescription: preset.mutedText,
    colorTextTertiary: preset.mutedText,
    colorTextPlaceholder: preset.mutedText,
    colorBorderSecondary: preset.border,
    colorError: '#ff626e',
    colorErrorText: '#d9363e',
    colorSuccessText: '#269b70',
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
  document.documentElement.setAttribute('data-theme-animations', 'off');
  const el = document.getElementById(elementId);
  if (!el) return;
  const restore = () => {
    document.documentElement.removeAttribute('data-theme-animations');
    el.removeEventListener('mouseleave', restore);
    el.removeEventListener('touchend', restore);
  };
  el.addEventListener('mouseleave', restore);
  el.addEventListener('touchend', restore);
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
      // Keep legacy keys in sync so older UI entry points keep behaving.
      localStorage.setItem(STORAGE_DARK, String(isDark));
      localStorage.setItem(STORAGE_ULTRA, String(isUltra));
    } catch {
      // The active in-memory theme still works when storage is blocked.
    }
  }, [themeId, isDark, isUltra]);

  const setTheme = useCallback((nextTheme: ThemeId) => setThemeId(nextTheme), []);
  const cycleTheme = useCallback(() => {
    setThemeId((current) => {
      const index = THEME_IDS.indexOf(current);
      return THEME_IDS[(index + 1) % THEME_IDS.length];
    });
  }, []);
  const toggleTheme = useCallback(() => {
    setThemeId((current) => (getThemePreset(current).isDark ? 'light' : 'graphite'));
  }, []);
  const toggleUltra = useCallback(() => {
    setThemeId((current) => (getThemePreset(current).isUltra ? 'graphite' : 'ultra-dark'));
  }, []);

  const antdThemeConfig = useMemo(
    () => buildAntdThemeConfig(isDark, isUltra, themeId),
    [isDark, isUltra, themeId],
  );
  const value = useMemo<ThemeContextValue>(
    () => ({ isDark, isUltra, themeId, setTheme, cycleTheme, toggleTheme, toggleUltra, antdThemeConfig }),
    [isDark, isUltra, themeId, setTheme, cycleTheme, toggleTheme, toggleUltra, antdThemeConfig],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
