import { expect, test } from 'vitest';

import { getThemePreset, isThemeId, resolveThemeId, THEME_IDS } from '@/theme/themes';

import { buildAntdThemeConfig } from '@/hooks/useTheme';

test('registers the eight planned EL-UI palettes', () => {
  expect(THEME_IDS).toHaveLength(8);
  expect(THEME_IDS).toEqual([
    'aurora',
    'obsidian',
    'amethyst',
    'emerald',
    'crimson',
    'amber',
    'horizon',
    'iridescent',
  ]);

  expect(new Set(THEME_IDS.map((id) => getThemePreset(id).accent)).size).toBe(8);
});

test('rejects arbitrary palette ids and migrates legacy ids', () => {
  expect(isThemeId('aurora')).toBe(true);
  expect(isThemeId('obsidian')).toBe(true);
  expect(isThemeId('not-a-theme')).toBe(false);
  expect(isThemeId(null)).toBe(false);
  expect(resolveThemeId('graphite')).toBe('aurora');
  expect(resolveThemeId('midnight')).toBe('amethyst');
  expect(resolveThemeId('ultra-dark')).toBe('obsidian');
  expect(resolveThemeId('light')).toBe('horizon');
  expect(resolveThemeId('not-a-theme')).toBeUndefined();
});

test('keeps Ant Design tokens aligned with the selected palette', () => {
  const config = buildAntdThemeConfig(true, false, 'amethyst');
  expect(config.token?.colorPrimary).toBe('#9a72ef');
  expect(config.token?.colorBgBase).toBe('#100b1b');
  expect(config.token?.colorBgContainer).toBe('#1b1428');
});

test('keeps Horizon on the light Ant Design algorithm', () => {
  const config = buildAntdThemeConfig(false, false, 'horizon');
  expect(config.token?.colorPrimary).toBe('#2868d5');
  expect(config.token?.colorBgBase).toBe('#f2f6fb');
});

test('keeps Obsidian as the OLED dark preset', () => {
  const preset = getThemePreset('obsidian');
  const config = buildAntdThemeConfig(true, true, 'obsidian');
  expect(preset.isDark).toBe(true);
  expect(preset.isUltra).toBe(true);
  expect(preset.background).toBe('#050607');
  expect(config.token?.colorBgBase).toBe('#050607');
});
