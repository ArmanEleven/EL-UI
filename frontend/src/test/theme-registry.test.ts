import { expect, test } from 'vitest';

import { getThemePreset, isThemeId, THEME_IDS } from '@/theme/themes';
import { buildAntdThemeConfig } from '@/hooks/useTheme';

test('registers five distinct EL-UI palettes', () => {
  expect(THEME_IDS).toHaveLength(5);
  expect(new Set(THEME_IDS.map((id) => getThemePreset(id).accent)).size).toBe(5);
});

test('recognizes stored palette ids without accepting arbitrary values', () => {
  expect(isThemeId('graphite')).toBe(true);
  expect(isThemeId('ultra-dark')).toBe(true);
  expect(isThemeId('not-a-theme')).toBe(false);
  expect(isThemeId(null)).toBe(false);
});

test('keeps Ant Design config aligned with the selected palette', () => {
  const config = buildAntdThemeConfig(true, false, 'midnight');
  expect(config.token?.colorPrimary).toBe('#9275f2');
  expect(config.token?.colorBgBase).toBe('#0c0b14');
});

test('keeps the light palette on Ant Design default algorithm', () => {
  const config = buildAntdThemeConfig(false, false, 'light');
  expect(config.token?.colorPrimary).toBe('#245ed0');
});
