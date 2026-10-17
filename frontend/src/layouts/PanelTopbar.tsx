import { SearchOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';

import ThemePicker from '@/components/ThemePicker';
import { useCommandPalette } from '@/components/command-palette/useCommandPalette';
import './PanelTopbar.css';

const PAGE_TITLE_KEYS: Record<string, string> = {
  '/': 'menu.dashboard',
  '/inbounds': 'menu.inbounds',
  '/clients': 'menu.clients',
  '/groups': 'menu.groups',
  '/nodes': 'menu.nodes',
  '/hosts': 'menu.hosts',
  '/outbound': 'menu.outbounds',
  '/routing': 'menu.routing',
  '/settings': 'menu.settings',
  '/xray': 'menu.xray',
  '/api-docs': 'menu.apiDocs',
  '/admin-management': 'menu.adminManagement',
  '/sponsors': 'menu.sponsors',
};

export default function PanelTopbar() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const { open: openCommandPalette } = useCommandPalette();
  const normalizedPath = pathname.replace(/^\/panel(?=\/|$)/, '') || '/';
  const title = t(PAGE_TITLE_KEYS[normalizedPath] ?? 'menu.dashboard');

  return (
    <header className="elui-topbar">
      <div className="elui-topbar__breadcrumb" aria-label={title}>
        <span className="elui-topbar__product">EL-UI</span>
        <span className="elui-topbar__separator" aria-hidden="true">
          /
        </span>
        <strong className="elui-topbar__current">{title}</strong>
      </div>
      <div className="elui-topbar__actions">
        <Button
          type="default"
          className="elui-topbar__search"
          aria-label={t('search')}
          title={t('search')}
          onClick={openCommandPalette}
          icon={<SearchOutlined />}
        >
          <span className="elui-topbar__search-label">{t('search')}</span>
          <kbd>Ctrl K</kbd>
        </Button>
        <ThemePicker inline />
      </div>
    </header>
  );
}
