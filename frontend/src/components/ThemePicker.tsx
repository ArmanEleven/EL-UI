import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BgColorsOutlined, CheckOutlined } from '@ant-design/icons';
import { Button, Popover, Typography } from 'antd';

import { useTheme } from '@/hooks/useTheme';
import { getThemePreset, THEME_IDS } from '@/theme/themes';
import './ThemePicker.css';

const { Text } = Typography;

export default function ThemePicker() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const { themeId, setTheme } = useTheme();
  const activePreset = getThemePreset(themeId);

  const content = (
    <div className="elui-theme-picker" aria-label={t('menu.theme')}>
      <div className="elui-theme-picker__heading">
        <div>
          <Text className="elui-theme-picker__eyebrow">EL-UI</Text>
          <div className="elui-theme-picker__title">{t('menu.theme')}</div>
        </div>
        <span className="elui-theme-picker__active-dot" aria-hidden="true" />
      </div>
      <div className="elui-theme-picker__grid">
        {THEME_IDS.map((id) => {
          const preset = getThemePreset(id);
          const selected = themeId === id;

          return (
            <button
              key={id}
              type="button"
              className={`elui-theme-picker__option${selected ? ' is-selected' : ''}`}
              aria-pressed={selected}
              aria-label={preset.label}
              onClick={() => {
                setTheme(id);
                setOpen(false);
              }}
            >
              <span
                className="elui-theme-picker__swatch"
                style={{
                  background: `linear-gradient(135deg, ${preset.accent}, ${preset.accentStrong} 52%, ${preset.background})`,
                }}
                aria-hidden="true"
              />
              <span className="elui-theme-picker__labels">
                <span className="elui-theme-picker__name">{preset.label}</span>
              </span>
              <span className="elui-theme-picker__check" aria-hidden="true">
                {selected ? <CheckOutlined /> : null}
              </span>
            </button>
          );
        })}
      </div>
      <div className="elui-theme-picker__footer">
        <span className="elui-theme-picker__preview" aria-hidden="true" />
        <span>
          {t('menu.theme')}: {activePreset.label}
        </span>
      </div>
    </div>
  );

  return (
    <div className="elui-theme-picker-anchor">
      <Popover
        content={content}
        trigger="click"
        placement="topRight"
        open={open}
        onOpenChange={setOpen}
        arrow={false}
      >
        <Button
          className="elui-theme-trigger"
          type="default"
          shape="circle"
          icon={<BgColorsOutlined />}
          title={`${t('menu.theme')}: ${activePreset.label}`}
          aria-label={t('menu.theme')}
          aria-expanded={open}
        />
      </Popover>
    </div>
  );
}
