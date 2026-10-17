import { fireEvent, render } from '@testing-library/react';
import { expect, test } from 'vitest';

import { ThemeProvider, useTheme } from '@/hooks/useTheme';
import { getThemePreset, THEME_IDS } from '@/theme/themes';

function PaletteHarness() {
  const { setTheme } = useTheme();
  return (
    <div>
      {THEME_IDS.map((id) => (
        <button key={id} type="button" onClick={() => setTheme(id)}>
          {id}
        </button>
      ))}
    </div>
  );
}

test('all eight approved palettes apply their complete semantic token bridge', () => {
  const { getByRole } = render(
    <ThemeProvider>
      <PaletteHarness />
    </ThemeProvider>,
  );
  const root = document.documentElement;

  for (const id of THEME_IDS) {
    const preset = getThemePreset(id);
    fireEvent.click(getByRole('button', { name: id }));

    expect(root.dataset.palette).toBe(id);
    expect(root.style.getPropertyValue('--elui-bg')).toBe(preset.background);
    expect(root.style.getPropertyValue('--elui-surface')).toBe(preset.surface);
    expect(root.style.getPropertyValue('--elui-accent')).toBe(preset.accent);
    expect(root.style.getPropertyValue('--elui-accent-strong')).toBe(preset.accentStrong);
    expect(root.style.getPropertyValue('--bg')).toBe(preset.background);
    expect(root.style.getPropertyValue('--bg-deep')).toBe(preset.backgroundDeep ?? preset.background);
    expect(root.style.getPropertyValue('--surface')).toBe(preset.surface);
    expect(root.style.getPropertyValue('--surface-2')).toBe(
      preset.surfaceSecondary ?? preset.elevated,
    );
    expect(root.style.getPropertyValue('--surface-3')).toBe(
      preset.surfaceTertiary ?? preset.elevated,
    );
    expect(root.style.getPropertyValue('--text')).toBe(preset.text);
    expect(root.style.getPropertyValue('--text-2')).toBe(preset.mutedText);
    expect(root.style.getPropertyValue('--text-3')).toBe(preset.faintText ?? preset.mutedText);
    expect(root.style.getPropertyValue('--accent')).toBe(preset.accent);
    expect(root.style.getPropertyValue('--accent-strong')).toBe(preset.accentStrong);
    expect(root.style.getPropertyValue('--accent-rgb')).toMatch(/^\d+,\s*\d+,\s*\d+$/);
    expect(root.style.getPropertyValue('--border')).toBe(preset.border);
    expect(root.style.getPropertyValue('--border-strong')).toBe(
      preset.borderStrong ?? preset.border,
    );
  }
});
