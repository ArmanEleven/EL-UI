import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert,
  Button,
  Card,
  Col,
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

function bytesLabel(bytes: number): string {
  if (!bytes) return 'Unlimited';
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function expiryLabel(value: number): string {
  if (!value) return 'Unlimited';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleString();
}

export default function AdminPortalPage() {
  const navigate = useNavigate();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [me, setMe] = useState<ManagementMe | null>(null);
  const [inbounds, setInbounds] = useState<SafeInbound[]>([]);
  const [clients, setClients] = useState<SafeClient[]>([]);
  const [loading, setLoading] = useState(true);
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
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const createClient = useCallback(async (values: CreateClientForm) => {
    setCreating(true);
    try {
      const expiryTime = values.expiryHours && values.expiryHours > 0
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
        messageApi.error(response.msg || 'Client creation failed');
        return;
      }
      messageApi.success('Client created');
      form.resetFields();
      await load();
    } finally {
      setCreating(false);
    }
  }, [form, load, messageApi]);

  const inboundColumns = useMemo<ColumnsType<SafeInbound>>(() => [
    { title: 'ID', dataIndex: 'id', width: 72 },
    { title: 'Remark', dataIndex: 'remark', ellipsis: true },
    { title: 'Protocol', dataIndex: 'protocol', width: 125, render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Port', dataIndex: 'port', width: 95 },
    { title: 'Clients', dataIndex: 'clientCount', width: 100 },
    { title: 'Status', dataIndex: 'enabled', width: 110, render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? 'Enabled' : 'Disabled'}</Tag> },
    { title: 'Traffic used', key: 'traffic', width: 150, render: (_: unknown, row: SafeInbound) => `${bytesLabel(row.up + row.down)} / ${bytesLabel(row.total)}` },
  ], []);

  const clientColumns = useMemo<ColumnsType<SafeClient>>(() => [
    { title: 'Email / Name', dataIndex: 'email', ellipsis: true },
    { title: 'Group', dataIndex: 'group', render: (v: string) => v || '—' },
    { title: 'Volume (GB)', dataIndex: 'totalGB', width: 125, render: (v: number) => v || 'Unlimited' },
    { title: 'Expires', dataIndex: 'expiryTime', width: 180, render: (v: number) => expiryLabel(v) },
    { title: 'Status', dataIndex: 'enabled', width: 105, render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? 'Enabled' : 'Disabled'}</Tag> },
  ], []);

  const canCreate = !!me?.role.permissions?.clients?.create?.allowed;
  const canReadClients = !!me?.role.permissions?.clients?.read?.allowed;

  if (loading) return <div className="management-loading"><Spin size="large" /></div>;
  if (!me) return null;

  return (
    <Layout className="management-portal">
      {messageContextHolder}
      <Layout.Content className="management-content">
        <div className="management-topbar">
          <div>
            <Text type="secondary">EL-UI · Management</Text>
            <Title level={2}>Admin Portal</Title>
          </div>
          <Space wrap>
            <Tag color={me.status === 'active' ? 'success' : 'warning'}>{me.status}</Tag>
            <Button onClick={() => void load()}>Refresh</Button>
            <Button onClick={async () => {
              await HttpUtil.post('/management-api/auth/logout', {}, {
                headers: { 'Content-Type': 'application/json' }, silent: true,
              });
              window.location.href = window.X_UI_BASE_PATH || '/';
            }}>Log out</Button>
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={8}>
            <Card>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Administrator">{me.username}</Descriptions.Item>
                <Descriptions.Item label="Role">{me.role.name}</Descriptions.Item>
                <Descriptions.Item label="Allowed inbounds">{inbounds.length}</Descriptions.Item>
                <Descriptions.Item label="Client limit">{me.effectiveLimits.max_users ?? 'Unlimited'}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col xs={24} xl={16}>
            <Card title="Allowed inbounds">
              <Table<SafeInbound>
                rowKey="id"
                size="small"
                loading={loading}
                columns={inboundColumns}
                dataSource={inbounds}
                pagination={{ pageSize: 8, showSizeChanger: false }}
                locale={{ emptyText: 'No inbounds are available for this role.' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} className="management-lower">
          <Col xs={24} xl={canCreate ? 10 : 24}>
            <Card title="Create client">
              {!canCreate ? (
                <Alert type="info" showIcon message="Your role does not allow client creation." />
              ) : (
                <Form<CreateClientForm> form={form} layout="vertical" onFinish={createClient}>
                  <Form.Item name="email" label="Client email / name" rules={[{ required: true, whitespace: true }, { max: 128 }]}>
                    <Input autoComplete="off" placeholder="client@example.com" />
                  </Form.Item>
                  <Form.Item name="inboundIds" label="Allowed inbounds" rules={[{ required: true, type: 'array', min: 1 }]}>
                    <Select
                      mode="multiple"
                      options={inbounds.map((ib) => ({ value: ib.id, label: `#${ib.id} · ${ib.remark || ib.protocol} : ${ib.port}` }))}
                      placeholder="Select one or more inbounds"
                    />
                  </Form.Item>
                  <Form.Item name="totalGB" label="Traffic limit (GB, 0 = unlimited)">
                    <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="0" />
                  </Form.Item>
                  <Form.Item name="expiryHours" label="Expiry in hours (0 = unlimited)">
                    <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="0" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block loading={creating}>Create client</Button>
                </Form>
              )}
            </Card>
          </Col>
          <Col xs={24} xl={canCreate ? 14 : 24}>
            <Card title="Managed clients">
              {!canReadClients ? (
                <Alert type="info" showIcon message="Your role does not allow viewing managed clients." />
              ) : (
                <Table<SafeClient>
                  rowKey="email"
                  size="small"
                  columns={clientColumns}
                  dataSource={clients}
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  locale={{ emptyText: 'No managed clients yet.' }}
                  scroll={{ x: 600 }}
                />
              )}
            </Card>
          </Col>
        </Row>
        <Text className="management-footnote" type="secondary">
          This portal has no inbound edit/delete controls. Authorization is enforced by the server for every request.
        </Text>
      </Layout.Content>
    </Layout>
  );
}
