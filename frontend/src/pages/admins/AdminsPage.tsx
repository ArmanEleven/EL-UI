import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { HttpUtil } from '@/utils';

const GIB = 1024 ** 3;

interface AdminRecord {
  userId: number;
  username: string;
  enabled: boolean;
  maxClients: number;
  allowUnlimitedClients: boolean;
  trafficQuotaBytes: number;
  allowUnlimitedTraffic: boolean;
  allowedInboundIds: number[];
  allocatedClients: number;
  allocatedTrafficBytes: number;
}

interface FormValues {
  username: string;
  password: string;
  enabled: boolean;
  maxClients: number;
  allowUnlimitedClients: boolean;
  trafficQuotaGB: number;
  allowUnlimitedTraffic: boolean;
  allowedInboundIds: string;
}

export default function AdminsPage() {
  const [form] = Form.useForm<FormValues>();
  const [rows, setRows] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [owner, setOwner] = useState<boolean | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await HttpUtil.get<AdminRecord[]>('/panel/api/admins', undefined, {
      silent: true,
    });
    if (result.success && Array.isArray(result.obj)) {
      setRows(result.obj);
    } else {
      message.error(result.msg || 'دریافت فهرست ادمین‌ها ناموفق بود');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void HttpUtil.get<{ role?: string }>('/panel/api/admins/me', undefined, {
      silent: true,
    }).then((r) => {
      if (!active) return;
      const allowed = r.success && r.obj?.role === 'owner';
      setOwner(allowed);
      if (allowed) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const resetForm = () => {
    setSelectedAdmin(null);
    form.resetFields();
    form.setFieldsValue({
      enabled: true,
      maxClients: 10,
      allowUnlimitedClients: false,
      trafficQuotaGB: 100,
      allowUnlimitedTraffic: false,
      allowedInboundIds: '',
      password: '',
    });
  };

  const save = async (values: FormValues) => {
    setSaving(true);
    const inboundIds = values.allowedInboundIds
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isInteger(v) && v > 0);
    const payload = {
      username: values.username.trim(),
      password: values.password || '',
      enabled: values.enabled,
      maxClients: values.allowUnlimitedClients ? 0 : values.maxClients,
      allowUnlimitedClients: values.allowUnlimitedClients,
      trafficQuotaBytes: values.allowUnlimitedTraffic
        ? 0
        : Math.round(values.trafficQuotaGB * GIB),
      allowUnlimitedTraffic: values.allowUnlimitedTraffic,
      allowedInboundIds: inboundIds,
    };
    const result = selectedAdmin
      ? await HttpUtil.post(`/panel/api/admins/${selectedAdmin.userId}`, payload)
      : await HttpUtil.post('/panel/api/admins', payload);
    setSaving(false);
    if (result.success) {
      resetForm();
      await load();
    }
  };

  const edit = (admin: AdminRecord) => {
    setSelectedAdmin(admin);
    form.setFieldsValue({
      username: admin.username,
      password: '',
      enabled: admin.enabled,
      maxClients: admin.maxClients,
      allowUnlimitedClients: admin.allowUnlimitedClients,
      trafficQuotaGB: admin.trafficQuotaBytes / GIB,
      allowUnlimitedTraffic: admin.allowUnlimitedTraffic,
      allowedInboundIds: admin.allowedInboundIds.join(', '),
    });
  };

  const remove = async (id: number) => {
    const result = await HttpUtil.delete(`/panel/api/admins/${id}`);
    if (result.success) {
      if (selectedAdmin?.userId === id) resetForm();
      await load();
    }
  };

  const columns: ColumnsType<AdminRecord> = [
    { title: 'نام کاربری', dataIndex: 'username', key: 'username' },
    {
      title: 'وضعیت',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (v: boolean) => (
        <Tag color={v ? 'success' : 'default'}>{v ? 'فعال' : 'غیرفعال'}</Tag>
      ),
    },
    {
      title: 'سقف کاربران',
      key: 'clients',
      render: (_, r) =>
        r.allowUnlimitedClients
          ? 'نامحدود'
          : `${r.allocatedClients.toLocaleString('fa-IR')} از ${r.maxClients.toLocaleString('fa-IR')}`,
    },
    {
      title: 'سهمیه ترافیک',
      key: 'traffic',
      render: (_, r) =>
        r.allowUnlimitedTraffic
          ? 'نامحدود'
          : `${(r.allocatedTrafficBytes / GIB).toLocaleString('fa-IR')} از ${(r.trafficQuotaBytes / GIB).toLocaleString('fa-IR')} گیگابایت`,
    },
    {
      title: 'Inboundهای مجاز',
      dataIndex: 'allowedInboundIds',
      key: 'inbounds',
      render: (v: number[]) => (v.length ? v.join('، ') : 'هیچ‌کدام'),
    },
    {
      title: 'عملیات',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button onClick={() => edit(r)}>ویرایش</Button>
          <Popconfirm
            title="حذف این ادمین؟"
            okText="حذف"
            cancelText="لغو"
            onConfirm={() => remove(r.userId)}
          >
            <Button danger>حذف</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (owner === null) {
    return (
      <div dir="rtl" style={{ padding: 24 }}>
        در حال بررسی دسترسی...
      </div>
    );
  }
  if (!owner) {
    return (
      <div dir="rtl" style={{ padding: 24 }}>
        <Alert type="error" showIcon message="این بخش فقط برای مالک اصلی پنل است." />
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ padding: 24 }}>
      <Card title="مدیریت ادمین‌ها">
        <Typography.Paragraph type="secondary">
          برای هر ادمین سقف کاربران، سهمیه ترافیک و Inboundهای مجاز تعیین کن. دسترسی نامحدود فقط با
          انتخاب صریح فعال می‌شود.
        </Typography.Paragraph>
        <Form
          form={form}
          layout="vertical"
          onFinish={save}
          initialValues={{
            enabled: true,
            maxClients: 10,
            allowUnlimitedClients: false,
            trafficQuotaGB: 100,
            allowUnlimitedTraffic: false,
            allowedInboundIds: '',
            password: '',
          }}
        >
          <Space align="start" wrap style={{ width: '100%' }}>
            <Form.Item
              label="نام کاربری"
              name="username"
              rules={[{ required: true, whitespace: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label={selectedAdmin ? 'رمز جدید (اختیاری؛ حداقل ۱۰ نویسه)' : 'رمز عبور (حداقل ۱۰ نویسه)'}
              name="password"
              rules={[
                { required: !selectedAdmin, min: 10, message: 'رمز عبور باید حداقل ۱۰ نویسه باشد.' },
              ]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item label="سقف کاربران" name="maxClients" rules={[{ required: true }]}>
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item
              label="سهمیه ترافیک (گیگابایت)"
              name="trafficQuotaGB"
              rules={[{ required: true }]}
            >
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item label="Inboundهای مجاز" name="allowedInboundIds" extra="مثال: 1, 2, 5">
              <Input placeholder="1, 2, 5" />
            </Form.Item>
          </Space>
          <Space direction="vertical">
            <Form.Item name="enabled" valuePropName="checked">
              <Checkbox>حساب فعال باشد</Checkbox>
            </Form.Item>
            <Form.Item name="allowUnlimitedClients" valuePropName="checked">
              <Checkbox>تعداد کاربران نامحدود</Checkbox>
            </Form.Item>
            <Form.Item name="allowUnlimitedTraffic" valuePropName="checked">
              <Checkbox>ترافیک نامحدود</Checkbox>
            </Form.Item>
          </Space>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              {selectedAdmin ? 'ذخیره تغییرات' : 'ساخت ادمین'}
            </Button>
            {selectedAdmin && <Button onClick={resetForm}>لغو ویرایش</Button>}
          </Space>
        </Form>
        <Table<AdminRecord>
          style={{ marginTop: 24 }}
          rowKey="userId"
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
          locale={{ emptyText: 'هنوز ادمین فرعی ساخته نشده است' }}
        />
      </Card>
    </div>
  );
}
