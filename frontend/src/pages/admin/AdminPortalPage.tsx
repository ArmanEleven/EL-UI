import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  Col,
  ConfigProvider,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Layout,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { HttpUtil } from '@/utils';
import { useTheme } from '@/hooks/useTheme';
import ThemePicker from '@/components/ThemePicker';
import './AdminPortalPage.css';

type Permission = { allowed: boolean; scope: number };
type ManagementMe = {
  id: number;
  username: string;
  status: string;
  role: {
    name: string;
    permissions: Record<string, Record<string, Permission>>;
    access: { allowed_inbound_ids?: number[] };
  };
  effectiveLimits: {
    max_users?: number;
    data_limit_min?: number;
    data_limit_max?: number;
    expire_min?: number;
    expire_max?: number;
  };
};
type SafeInbound = {
  id: number;
  remark: string;
  enabled: boolean;
  port: number;
  protocol: string;
  tag?: string;
  nodeId?: number;
  expiryTime: number;
  trafficReset: string;
  total: number;
  up: number;
  down: number;
  clientCount: number;
};
type SafeClient = {
  email: string;
  enabled: boolean;
  totalGB: number;
  expiryTime: number;
  group: string;
  createdAt: number;
};
type CreateClientForm = {
  email: string;
  inboundIds: number[];
  totalGB?: number;
  expiryHours?: number;
};

const { Title, Text } = Typography;

function bytesLabel(bytes: number, unlimitedLabel = 'Unlimited'): string {
  if (!bytes) return unlimitedLabel;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function expiryLabel(value: number, unlimitedLabel = 'Unlimited'): string {
  if (!value) return unlimitedLabel;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleString();
}

export default function AdminPortalPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { antdThemeConfig } = useTheme();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [me, setMe] = useState<ManagementMe | null>(null);
  const [inbounds, setInbounds] = useState<SafeInbound[]>([]);
  const [clients, setClients] = useState<SafeClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<CreateClientForm>();

  const load = useCallback(async () => {
    try {
      const [meResp, inboundResp, clientResp] = await Promise.all([
        HttpUtil.get<ManagementMe>('/management-api/auth/me', undefined, { silent: true }),
        HttpUtil.get<SafeInbound[]>('/management-api/inbounds', undefined, { silent: true }),
        HttpUtil.get<SafeClient[]>('/management-api/clients', undefined, { silent: true }),
      ]);
      if (!meResp.success || !meResp.obj) {
        navigate('/');
        return;
      }
      setMe(meResp.obj);
      setInbounds(inboundResp.success && inboundResp.obj ? inboundResp.obj : []);
      setClients(clientResp.success && clientResp.obj ? clientResp.obj : []);
      const canReadInbounds = !!meResp.obj.role.permissions?.inbounds?.read?.allowed;
      const canReadClients = !!meResp.obj.role.permissions?.clients?.read?.allowed;
      if ((!inboundResp.success && canReadInbounds) || (!clientResp.success && canReadClients)) {
        setLoadError(t('adminPortal.loadFailed'));
      } else {
        setLoadError(null);
      }
    } catch {
      setLoadError(t('adminPortal.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [navigate, t]);

  const refresh = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    void load();
  }, [load]);

  useEffect(() => {
    // The initial fetch is asynchronous; state updates happen after the network requests settle.
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const createClient = useCallback(
    async (values: CreateClientForm) => {
      setCreating(true);
      try {
        const expiryTime =
          values.expiryHours && values.expiryHours > 0
            ? Date.now() + values.expiryHours * 60 * 60 * 1000
            : 0;
        const response = await HttpUtil.post<{ email: string }>(
          '/management-api/clients',
          {
            client: {
              email: values.email.trim(),
              enable: true,
              totalGB: values.totalGB || 0,
              expiryTime,
              trafficReset: 'never',
              trafficResetDay: 1,
            },
            inboundIds: values.inboundIds,
          },
          { headers: { 'Content-Type': 'application/json' }, silent: true },
        );
        if (!response.success) {
          messageApi.error(response.msg || t('adminPortal.createFailed'));
          return;
        }
        messageApi.success(t('adminPortal.createSuccess'));
        form.resetFields();
        await load();
      } catch {
        messageApi.error(t('adminPortal.createFailed'));
      } finally {
        setCreating(false);
      }
    },
    [form, load, messageApi, t],
  );

  const inboundColumns = useMemo<ColumnsType<SafeInbound>>(
    () => [
      { title: 'ID', dataIndex: 'id', width: 72 },
      { title: t('remark'), dataIndex: 'remark', ellipsis: true },
      {
        title: t('protocol'),
        dataIndex: 'protocol',
        width: 125,
        render: (v: string) => <Tag>{v}</Tag>,
      },
      { title: t('adminPortal.port'), dataIndex: 'port', width: 95 },
      { title: t('clients'), dataIndex: 'clientCount', width: 100 },
      {
        title: t('status'),
        dataIndex: 'enabled',
        width: 110,
        render: (v: boolean) => (
          <Tag color={v ? 'success' : 'default'}>{v ? t('enabled') : t('disabled')}</Tag>
        ),
      },
      {
        title: t('adminPortal.trafficUsed'),
        key: 'traffic',
        width: 150,
        render: (_: unknown, row: SafeInbound) =>
          `${bytesLabel(row.up + row.down, t('unlimited'))} / ${bytesLabel(row.total, t('unlimited'))}`,
      },
    ],
    [t],
  );

  const clientColumns = useMemo<ColumnsType<SafeClient>>(
    () => [
      { title: t('adminPortal.emailColumn'), dataIndex: 'email', ellipsis: true },
      { title: t('adminPortal.group'), dataIndex: 'group', render: (v: string) => v || '—' },
      {
        title: t('adminPortal.volume'),
        dataIndex: 'totalGB',
        width: 125,
        render: (v: number) => v || t('unlimited'),
      },
      {
        title: t('adminPortal.expires'),
        dataIndex: 'expiryTime',
        width: 180,
        render: (v: number) => expiryLabel(v, t('unlimited')),
      },
      {
        title: t('status'),
        dataIndex: 'enabled',
        width: 105,
        render: (v: boolean) => (
          <Tag color={v ? 'success' : 'default'}>{v ? t('enabled') : t('disabled')}</Tag>
        ),
      },
    ],
    [t],
  );

  const canCreate = !!me?.role.permissions?.clients?.create?.allowed;
  const canReadClients = !!me?.role.permissions?.clients?.read?.allowed;

  if (loading)
    return (
      <ConfigProvider theme={antdThemeConfig}>
        <div className="management-loading">
          <Spin size="large" />
        </div>
      </ConfigProvider>
    );
  if (!me) return null;

  return (
    <ConfigProvider theme={antdThemeConfig}>
      <Layout className="management-portal">
        {messageContextHolder}
        <Layout.Content className="management-content">
          <div className="management-topbar">
            <div>
              <Text type="secondary">{t('adminPortal.brand')}</Text>
              <Title level={2}>{t('adminPortal.title')}</Title>
            </div>
            <Space wrap>
              <Tag color={me.status === 'active' ? 'success' : 'warning'}>{me.status}</Tag>
              <ThemePicker inline />
              <Button onClick={refresh}>{t('adminPortal.refresh')}</Button>
              <Button
                onClick={async () => {
                  await HttpUtil.post(
                    '/management-api/auth/logout',
                    {},
                    {
                      headers: { 'Content-Type': 'application/json' },
                      silent: true,
                    },
                  );
                  window.location.href = window.X_UI_BASE_PATH || '/';
                }}
              >
                {t('adminPortal.logout')}
              </Button>
            </Space>
          </div>

          {loadError && (
            <Alert
              type="warning"
              showIcon
              message={loadError}
              action={
                <Button size="small" onClick={() => void load()}>
                  {t('adminPortal.refresh')}
                </Button>
              }
            />
          )}

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={8}>
              <Card>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t('adminPortal.administrator')}>
                    {me.username}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('adminPortal.role')}>
                    {me.role.name}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('adminPortal.allowedInbounds')}>
                    {inbounds.length}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('adminPortal.clientLimit')}>
                    {me.effectiveLimits.max_users ?? t('unlimited')}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
            <Col xs={24} xl={16}>
              <Card title={t('adminPortal.allowedInbounds')}>
                <Table<SafeInbound>
                  rowKey="id"
                  size="small"
                  loading={loading}
                  columns={inboundColumns}
                  dataSource={inbounds}
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  locale={{ emptyText: t('adminPortal.noInbounds') }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} className="management-lower">
            <Col xs={24} xl={canCreate ? 10 : 24}>
              <Card title={t('adminPortal.createClient')}>
                {!canCreate ? (
                  <Alert type="info" showIcon message={t('adminPortal.noCreatePermission')} />
                ) : (
                  <Form<CreateClientForm> form={form} layout="vertical" onFinish={createClient}>
                    <Form.Item
                      name="email"
                      label={t('adminPortal.clientEmail')}
                      rules={[{ required: true, whitespace: true }, { max: 128 }]}
                    >
                      <Input autoComplete="off" placeholder={t('adminPortal.clientPlaceholder')} />
                    </Form.Item>
                    <Form.Item
                      name="inboundIds"
                      label={t('adminPortal.allowedInbounds')}
                      rules={[{ required: true, type: 'array', min: 1 }]}
                    >
                      <Select
                        mode="multiple"
                        options={inbounds.map((ib) => ({
                          value: ib.id,
                          label: `#${ib.id} · ${ib.remark || ib.protocol} : ${ib.port}`,
                        }))}
                        placeholder={t('adminPortal.selectInbounds')}
                      />
                    </Form.Item>
                    <Form.Item name="totalGB" label={t('adminPortal.trafficLimit')}>
                      <InputNumber
                        min={0}
                        precision={0}
                        style={{ width: '100%' }}
                        placeholder="0"
                      />
                    </Form.Item>
                    <Form.Item name="expiryHours" label={t('adminPortal.expiryHours')}>
                      <InputNumber
                        min={0}
                        precision={0}
                        style={{ width: '100%' }}
                        placeholder="0"
                      />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block loading={creating}>
                      {t('adminPortal.createClient')}
                    </Button>
                  </Form>
                )}
              </Card>
            </Col>
            <Col xs={24} xl={canCreate ? 14 : 24}>
              <Card title={t('adminPortal.managedClients')}>
                {!canReadClients ? (
                  <Alert type="info" showIcon message={t('adminPortal.noViewClientsPermission')} />
                ) : (
                  <Table<SafeClient>
                    rowKey="email"
                    size="small"
                    columns={clientColumns}
                    dataSource={clients}
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                    locale={{ emptyText: t('adminPortal.noClients') }}
                    scroll={{ x: 600 }}
                  />
                )}
              </Card>
            </Col>
          </Row>
          <Text className="management-footnote" type="secondary">
            {t('adminPortal.footnote')}
          </Text>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
}
