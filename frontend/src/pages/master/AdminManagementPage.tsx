import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  ConfigProvider,
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
import AppSidebar from '@/layouts/AppSidebar';
import PanelTopbar from '@/layouts/PanelTopbar';
import './AdminManagementPage.css';

type PermissionGrant = { allowed: boolean; scope: number };
type Role = {
  name: string;
  is_owner?: boolean;
  permissions: Record<string, Record<string, PermissionGrant>>;
  limits: Record<string, number | undefined>;
  access: { allowed_inbound_ids?: number[] | null };
};
type RoleRow = { id: number; role: Role };
type AdminRow = {
  id: number;
  username: string;
  roleId: number;
  status: 'active' | 'disabled' | 'limited';
  createdAt: string;
  lastLoginAt?: string;
};
type InboundRow = { id: number; remark: string; port: number; protocol: string };
type RoleForm = {
  name: string;
  permissionsJSON: string;
  allowedInboundIds: number[];
  allInbounds: boolean;
  maxUsers?: number;
  dataLimitMinGB?: number;
  dataLimitMaxGB?: number;
  expiryMinHours?: number;
  expiryMaxHours?: number;
};
type AdminForm = {
  username: string;
  password: string;
  roleId: number;
  permissionOverridesJSON: string;
};

const EMPTY_ROLES: RoleRow[] = [];
const EMPTY_ADMINS: AdminRow[] = [];
const EMPTY_INBOUNDS: InboundRow[] = [];

const { Title, Text } = Typography;
const DEFAULT_PERMISSIONS = JSON.stringify(
  {
    clients: {
      read: { allowed: true, scope: 1 },
      create: { allowed: true, scope: 1 },
    },
    inbounds: { read: { allowed: true, scope: 1 } },
  },
  null,
  2,
);

async function fetchManagementList<T>(path: string): Promise<T[]> {
  const response = await HttpUtil.get<T[]>(path, undefined, { silent: true });
  if (!response?.success) {
    throw new Error(response?.msg || 'Could not load management data');
  }
  return response.obj ?? [];
}

function parseJSON<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(label + ' must be valid JSON.');
  }
}

function roleToForm(role: Role): Partial<RoleForm> {
  const allowed = role.access?.allowed_inbound_ids;
  const limits = role.limits || {};
  return {
    name: role.name,
    permissionsJSON: JSON.stringify(role.permissions || {}, null, 2),
    allowedInboundIds: allowed || [],
    allInbounds: allowed == null,
    maxUsers: limits.max_users,
    dataLimitMinGB: limits.data_limit_min ? limits.data_limit_min / 1024 ** 3 : undefined,
    dataLimitMaxGB: limits.data_limit_max ? limits.data_limit_max / 1024 ** 3 : undefined,
    expiryMinHours: limits.expire_min ? limits.expire_min / 3600 : undefined,
    expiryMaxHours: limits.expire_max ? limits.expire_max / 3600 : undefined,
  };
}

export default function AdminManagementPage() {
  const { antdThemeConfig } = useTheme();
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();
  const [savingRole, setSavingRole] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleRow | null>(null);
  const [roleForm] = Form.useForm<RoleForm>();
  const [adminForm] = Form.useForm<AdminForm>();
  const allInbounds = Form.useWatch('allInbounds', roleForm);

  const rolesQuery = useQuery({
    queryKey: ['management', 'roles'],
    queryFn: () => fetchManagementList<RoleRow>('/management-api/master/roles'),
  });
  const adminsQuery = useQuery({
    queryKey: ['management', 'admins'],
    queryFn: () => fetchManagementList<AdminRow>('/management-api/master/admins'),
  });
  const inboundsQuery = useQuery({
    queryKey: ['management', 'inbounds'],
    queryFn: () => fetchManagementList<InboundRow>('/management-api/master/inbounds'),
  });

  const roles = rolesQuery.data ?? EMPTY_ROLES;
  const admins = adminsQuery.data ?? EMPTY_ADMINS;
  const inbounds = inboundsQuery.data ?? EMPTY_INBOUNDS;
  const loading = rolesQuery.isPending || adminsQuery.isPending || inboundsQuery.isPending;
  const queryError = rolesQuery.error || adminsQuery.error || inboundsQuery.error;

  const refresh = useCallback(async () => {
    await Promise.all([rolesQuery.refetch(), adminsQuery.refetch(), inboundsQuery.refetch()]);
  }, [adminsQuery, inboundsQuery, rolesQuery]);

  const saveRole = useCallback(
    async (values: RoleForm) => {
      setSavingRole(true);
      try {
        const permissions = parseJSON<Role['permissions']>(values.permissionsJSON, 'Permissions');
        const limits = {
          max_users: values.maxUsers || undefined,
          data_limit_min: values.dataLimitMinGB
            ? Math.round(values.dataLimitMinGB * 1024 ** 3)
            : undefined,
          data_limit_max: values.dataLimitMaxGB
            ? Math.round(values.dataLimitMaxGB * 1024 ** 3)
            : undefined,
          expire_min: values.expiryMinHours ? Math.round(values.expiryMinHours * 3600) : undefined,
          expire_max: values.expiryMaxHours ? Math.round(values.expiryMaxHours * 3600) : undefined,
        };
        const response = await HttpUtil.post(
          selectedRole
            ? '/management-api/master/roles/' + selectedRole.id
            : '/management-api/master/roles',
          {
            name: values.name.trim(),
            permissions,
            limits,
            features: { can_use_reset_strategy: true, can_use_next_plan: true },
            access: {
              allowed_inbound_ids: values.allInbounds ? null : values.allowedInboundIds || [],
            },
            hwid: { mode: 'use_global' },
            disabledWhenLimited: false,
            disconnectUsersWhenLimited: true,
            disconnectUsersWhenDisabled: true,
          },
          { headers: { 'Content-Type': 'application/json' }, silent: true },
        );
        if (!response.success) {
          messageApi.error(response.msg || 'Role could not be saved');
          return;
        }
        messageApi.success(selectedRole ? 'Role updated' : 'Role created');
        setSelectedRole(null);
        roleForm.resetFields();
        await queryClient.invalidateQueries({ queryKey: ['management', 'roles'] });
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : 'Invalid role settings');
      } finally {
        setSavingRole(false);
      }
    },
    [messageApi, queryClient, roleForm, selectedRole],
  );

  const createAdmin = useCallback(
    async (values: AdminForm) => {
      setSavingAdmin(true);
      try {
        const permissionOverrides = parseJSON<Record<string, number>>(
          values.permissionOverridesJSON || '{}',
          'Limit overrides',
        );
        const response = await HttpUtil.post(
          '/management-api/master/admins',
          {
            username: values.username.trim(),
            password: values.password,
            roleId: values.roleId,
            permissionOverrides,
          },
          {
            headers: { 'Content-Type': 'application/json' },
            silent: true,
          },
        );
        if (!response.success) {
          messageApi.error(response.msg || 'Administrator could not be created');
          return;
        }
        messageApi.success('Administrator created');
        adminForm.resetFields();
        await queryClient.invalidateQueries({ queryKey: ['management', 'admins'] });
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : 'Invalid override JSON');
      } finally {
        setSavingAdmin(false);
      }
    },
    [adminForm, messageApi, queryClient],
  );

  const setAdminStatus = useCallback(
    async (admin: AdminRow, status: AdminRow['status']) => {
      try {
        const response = await HttpUtil.post(
          '/management-api/master/admins/' + admin.id + '/status',
          { status },
          { headers: { 'Content-Type': 'application/json' }, silent: true },
        );
        if (!response.success) {
          messageApi.error(response.msg || 'Status update failed');
          return;
        }
        messageApi.success(admin.username + ': ' + status);
        await queryClient.invalidateQueries({ queryKey: ['management', 'admins'] });
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : 'Status update failed');
      }
    },
    [messageApi, queryClient],
  );

  const roleColumns = useMemo<ColumnsType<RoleRow>>(
    () => [
      { title: 'Role', dataIndex: ['role', 'name'] },
      {
        title: 'Client creation',
        key: 'create',
        render: (_: unknown, row: RoleRow) =>
          row.role.permissions?.clients?.create?.allowed ? (
            <Tag color="success">Allowed</Tag>
          ) : (
            <Tag>Denied</Tag>
          ),
      },
      {
        title: 'Inbound read',
        key: 'inbounds',
        render: (_: unknown, row: RoleRow) =>
          row.role.permissions?.inbounds?.read?.allowed ? (
            <Tag color="success">Allowed</Tag>
          ) : (
            <Tag>Denied</Tag>
          ),
      },
      {
        title: 'Edit',
        key: 'edit',
        render: (_: unknown, row: RoleRow) => (
          <Button
            size="small"
            disabled={!!row.role.is_owner}
            title={row.role.is_owner ? 'The Owner role is protected' : undefined}
            onClick={() => {
              setSelectedRole(row);
              roleForm.setFieldsValue(roleToForm(row.role));
            }}
          >
            {row.role.is_owner ? 'Protected' : 'Edit'}
          </Button>
        ),
      },
    ],
    [roleForm],
  );

  const adminColumns = useMemo<ColumnsType<AdminRow>>(
    () => [
      { title: 'Username', dataIndex: 'username' },
      {
        title: 'Role',
        dataIndex: 'roleId',
        render: (id: number) => roles.find((r) => r.id === id)?.role.name || '#' + id,
      },
      {
        title: 'Status',
        dataIndex: 'status',
        render: (status: string) => (
          <Tag
            color={status === 'active' ? 'success' : status === 'limited' ? 'warning' : 'default'}
          >
            {status}
          </Tag>
        ),
      },
      {
        title: 'Last login',
        dataIndex: 'lastLoginAt',
        render: (value?: string) => (value ? new Date(value).toLocaleString() : 'Never'),
      },
      {
        title: 'Change status',
        key: 'statusActions',
        render: (_: unknown, row: AdminRow) => (
          <Space wrap>
            <Button
              size="small"
              disabled={row.status === 'active'}
              onClick={() => void setAdminStatus(row, 'active')}
            >
              Activate
            </Button>
            <Button
              size="small"
              disabled={row.status === 'limited'}
              onClick={() => void setAdminStatus(row, 'limited')}
            >
              Limit
            </Button>
            <Button
              size="small"
              danger
              disabled={row.status === 'disabled'}
              onClick={() => void setAdminStatus(row, 'disabled')}
            >
              Disable
            </Button>
          </Space>
        ),
      },
    ],
    [roles, setAdminStatus],
  );

  if (loading)
    return (
      <ConfigProvider theme={antdThemeConfig}>
        <Layout className="admin-management-shell">
          <AppSidebar />
          <Layout className="content-shell">
            <PanelTopbar />
            <Layout.Content className="content-area">
              <div className="admin-management-loading">
                <Spin size="large" />
              </div>
            </Layout.Content>
          </Layout>
        </Layout>
      </ConfigProvider>
    );

  return (
    <ConfigProvider theme={antdThemeConfig}>
      <Layout className="admin-management-shell">
        <AppSidebar />
        <Layout className="content-shell">
          <PanelTopbar />
          <Layout.Content className="content-area">
            <div className="admin-management-page">
              {contextHolder}
              <div className="admin-management-header">
                <div>
                  <Text type="secondary">EL-UI · Master controls</Text>
                  <Title level={2}>Admin Management</Title>
                  <Text type="secondary">
                    Create scoped roles and delegated accounts. Server-side authorization remains
                    authoritative.
                  </Text>
                </div>
                <Button onClick={() => void refresh()}>Refresh</Button>
              </div>
              {queryError && (
                <Alert
                  showIcon
                  type="error"
                  message={
                    queryError instanceof Error ? queryError.message : 'Could not load management data'
                  }
                  description="Confirm that you are signed in to the Master Panel, then refresh the page."
                  className="admin-management-error"
                />
              )}
              <Alert
                showIcon
                type="warning"
                message="Protect the Master Panel account"
                description="Delegated accounts are separate from the native Master identity. The Owner role cannot be assigned through this page."
              />
              <Row gutter={[16, 16]} className="admin-management-grid">
                <Col xs={24} xl={12}>
                  <Card title={selectedRole ? 'Edit role: ' + selectedRole.role.name : 'Create role'}>
                    <Form<RoleForm>
                      form={roleForm}
                      layout="vertical"
                      initialValues={{
                        permissionsJSON: DEFAULT_PERMISSIONS,
                        allowedInboundIds: [],
                        allInbounds: false,
                      }}
                      onFinish={saveRole}
                    >
                      <Form.Item
                        name="name"
                        label="Role name"
                        rules={[{ required: true, whitespace: true }, { max: 64 }]}
                      >
                        <Input placeholder="reseller-readonly" />
                      </Form.Item>
                      <Form.Item
                        name="permissionsJSON"
                        label="Permissions JSON"
                        rules={[{ required: true }]}
                      >
                        <Input.TextArea rows={8} spellCheck={false} />
                      </Form.Item>
                      <Form.Item name="allInbounds" valuePropName="checked">
                        <Checkbox>Allow every Master inbound (only for ALL scope)</Checkbox>
                      </Form.Item>
                      <Form.Item name="allowedInboundIds" label="Allowed inbounds">
                        <Select
                          mode="multiple"
                          allowClear
                          disabled={!!allInbounds}
                          options={inbounds.map((inbound) => ({
                            value: inbound.id,
                            label:
                              '#' +
                              inbound.id +
                              ' · ' +
                              (inbound.remark || inbound.protocol) +
                              ' : ' +
                              inbound.port,
                          }))}
                          placeholder="Select specific inbound IDs"
                        />
                      </Form.Item>
                      <Row gutter={12}>
                        <Col span={12}>
                          <Form.Item name="maxUsers" label="Max clients">
                            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="dataLimitMinGB" label="Min volume (GB)">
                            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="dataLimitMaxGB" label="Max volume (GB)">
                            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="expiryMinHours" label="Min expiry (hours)">
                            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="expiryMaxHours" label="Max expiry (hours)">
                            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Space>
                        <Button type="primary" htmlType="submit" loading={savingRole}>
                          {selectedRole ? 'Save role' : 'Create role'}
                        </Button>
                        {selectedRole && (
                          <Button
                            onClick={() => {
                              setSelectedRole(null);
                              roleForm.resetFields();
                            }}
                          >
                            Cancel edit
                          </Button>
                        )}
                      </Space>
                    </Form>
                  </Card>
                  <Card title="Create delegated admin" className="admin-management-card">
                    <Form<AdminForm>
                      form={adminForm}
                      layout="vertical"
                      initialValues={{ permissionOverridesJSON: '{}' }}
                      onFinish={createAdmin}
                    >
                      <Form.Item
                        name="username"
                        label="Username"
                        rules={[
                          { required: true, min: 3, max: 64, pattern: /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/ },
                        ]}
                      >
                        <Input autoComplete="off" />
                      </Form.Item>
                      <Form.Item
                        name="password"
                        label="Initial password (12–72 bytes)"
                        rules={[{ required: true, min: 12, max: 72 }]}
                      >
                        <Input.Password autoComplete="new-password" />
                      </Form.Item>
                      <Form.Item name="roleId" label="Role" rules={[{ required: true }]}>
                        <Select
                          options={roles.map((role) => ({ value: role.id, label: role.role.name }))}
                        />
                      </Form.Item>
                      <Form.Item name="permissionOverridesJSON" label="Per-admin limit overrides (JSON)">
                        <Input.TextArea rows={3} spellCheck={false} />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" loading={savingAdmin} block>
                        Create administrator
                      </Button>
                    </Form>
                  </Card>
                </Col>
                <Col xs={24} xl={12}>
                  <Card title="Roles">
                    <Table<RoleRow>
                      rowKey="id"
                      size="small"
                      columns={roleColumns}
                      dataSource={roles}
                      pagination={{ pageSize: 6 }}
                    />
                  </Card>
                  <Card title="Delegated administrators" className="admin-management-card">
                    <Table<AdminRow>
                      rowKey="id"
                      size="small"
                      columns={adminColumns}
                      dataSource={admins}
                      pagination={{ pageSize: 6 }}
                      scroll={{ x: 650 }}
                    />
                  </Card>
                </Col>
              </Row>
            </div>
          </Layout.Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
