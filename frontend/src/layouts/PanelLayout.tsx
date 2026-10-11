import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Spin } from 'antd';

import { HttpUtil } from '@/utils';
import { useWebSocketBridge } from '@/api/websocketBridge';
import { usePageTitle } from '@/hooks/usePageTitle';
import CommandPalette from '@/components/command-palette/CommandPalette';

type AdminIdentity = { role?: string };
type ApiResponse<T> = { success?: boolean; obj?: T };

function PanelServices() {
  useWebSocketBridge();
  usePageTitle();
  return <CommandPalette />;
}

export default function PanelLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [role, setRole] = useState<'owner' | 'admin' | 'error' | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = (await HttpUtil.get('/panel/api/admins/me', undefined, {
          silent: true,
        })) as ApiResponse<AdminIdentity>;
        if (!response?.success || !response.obj?.role) throw new Error('Unable to identify account');
        if (!cancelled) setRole(response.obj.role === 'admin' ? 'admin' : 'owner');
      } catch {
        if (!cancelled) setRole('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (role === 'admin' && location.pathname !== '/portal') {
      navigate('/portal', { replace: true });
    } else if (role === 'owner' && location.pathname === '/portal') {
      navigate('/', { replace: true });
    } else if (role === 'error') {
      window.location.replace(window.X_UI_BASE_PATH || '/');
    }
  }, [location.pathname, navigate, role]);

  if (role === null || role === 'error' || (role === 'admin' && location.pathname !== '/portal')) {
    return (
      <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (role === 'admin') return <Outlet />;

  return (
    <>
      <PanelServices />
      <Outlet />
    </>
  );
}
