import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Checkbox, Form, Input, InputNumber, Popconfirm, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { HttpUtil } from '@/utils';

const GIB = 1024 ** 3;
interface AdminRecord {
  userId: number; username: string; enabled: boolean; maxClients: number;
  allowUnlimitedClients: boolean; trafficQuotaBytes: number; allowUnlimitedTraffic: boolean;
  allowedInboundIds: number[]; allocatedClients: number; allocatedTrafficBytes: number;
}
interface FormValues {
  username: string; password: string; maxClients: number; allowUnlimitedClients: boolean;
  trafficQuotaGB: number; allowUnlimitedTraffic: boolean; allowedInboundIds: string;
}
export default function AdminsPage() {
  const [form] = Form.useForm<FormValues>();
  const [rows, setRows] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [owner, setOwner] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await HttpUtil.get<AdminRecord[]>('/panel/api/admins', undefined, { silent: true });
    if (result.success && Array.isArray(result.obj)) setRows(result.obj);
    else message.error(result.msg || 'دریافت فهرست ادمین‌ها ناموفق بود');
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void HttpUtil.get<{ role?: string }>('/panel/api/admins/me', undefined, { silent: true }).then((r) => {
      if (!active) return;
      const allowed = r.success && r.obj?.role === 'owner';
      setOwner(allowed);
      if (allowed) void load();
    });
    return () => { active = false; };
  }, [load]);

  const create = async (values: FormValues) => {
    setSaving(true);
    const inboundIds = values.allowedInboundIds.split(',').map((v) => Number(v.trim())).filter((v) => Number.isInteger(v) && v > 0);
    const result = await HttpUtil.post('/panel/api/admins', {
      username: values.username.trim(), password: values.password,
      maxClients: values.allowUnlimitedClients ? 0 : values.maxClients,
      allowUnlimitedClients: values.allowUnlimitedClients,
      trafficQuotaBytes: values.allowUnlimitedTraffic ? 0 : Math.round(values.trafficQuotaGB * GIB),
      allowUnlimitedTraffic: values.allowUnlimitedTraffic, allowedInboundIds: inboundIds,
    });
    setSaving(false);
    if (result.success) {
      form.resetFields();
      await load();
    }
  };

  const remove = async (id: number) => {
    const result = await HttpUtil.delete(`/panel/api/admins/${id}`);
    if (result.success) await load();
  };

  const columns: ColumnsType<AdminRecord> = [
    { title: 'نام کاربری', dataIndex: 'username', key: 'username' },
    { title: 'وضعیت', dataIndex: 'enabled', key: 'enabled', render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? 'فعال' : 'غیرفعال'}</Tag> },
    { title: 'سقف کاربران', key: 'clients', render: (_, r) => r.allowUnlimitedClients ? 'نامحدود' : `${r.allocatedClients.toLocaleString('fa-IR')} از ${r.maxClients.toLocaleString('fa-IR')}` },
    { title: 'سهمیه ترافیک', key: 'traffic', render: (_, r) => r.allowUnlimitedTraffic ? 'نامحدود' : `${(r.allocatedTrafficBytes / GIB).toLocaleString('fa-IR')} از ${(r.trafficQuotaBytes / GIB).toLocaleString('fa-IR')} گیگابایت` },
    { title: 'Inboundهای مجاز', dataIndex: 'allowedInboundIds', key: 'inbounds', render: (v: number[]) => v.length ? v.join('، ') : 'هیچ‌کدام' },
    { title: 'عملیات', key: 'actions', render: (_, r) => <Popconfirm title="حذف این ادمین؟" okText="حذف" cancelText="لغو" onConfirm={() => remove(r.userId)}><Button danger>حذف</Button></Popconfirm> },
  ];

  if (owner === null) return <div dir="rtl" style={{ padding: 24 }}>در حال بررسی دسترسی...</div>;
  if (!owner) return <div dir="rtl" style={{ padding: 24 }}><Alert type="error" showIcon message="این بخش فقط برای مالک اصلی پنل است." /></div>;

  return (
    <div dir="rtl" style={{ padding: 24 }}>
      <Card title="مدیریت ادمین‌ها">
        <Typography.Paragraph type="secondary">برای هر ادمین سقف کاربران، سهمیه ترافیک و Inboundهای مجاز تعیین کن. دسترسی نامحدود فقط با انتخاب صریح فعال می‌شود.</Typography.Paragraph>
        <Form form={form} layout="vertical" onFinish={create} initialValues={{ maxClients: 10, allowUnlimitedClients: false, trafficQuotaGB: 100, allowUnlimitedTraffic: false, allowedInboundIds: '' }}>
          <Space align="start" wrap style={{ width: '100%' }}>
            <Form.Item label="نام کاربری" name="username" rules={[{ required: true, whitespace: true }]}><Input /></Form.Item>
            <Form.Item label="رمز عبور (حداقل ۱۰ نویسه)" name="password" rules={[{ required: true, min: 10 }]}><Input.Password /></Form.Item>
            <Form.Item label="سقف کاربران" name="maxClients" rules={[{ required: true }]}><InputNumber min={0} /></Form.Item>
            <Form.Item label="سهمیه ترافیک (گیگابایت)" name="trafficQuotaGB" rules={[{ required: true }]}><InputNumber min={0} /></Form.Item>
            <Form.Item label="Inboundهای مجاز" name="allowedInboundIds" extra="مثال: 1, 2, 5"><Input placeholder="1, 2, 5" /></Form.Item>
          </Space>
          <Space direction="vertical">
            <Form.Item name="allowUnlimitedClients" valuePropName="checked"><Checkbox>تعداد کاربران نامحدود</Checkbox></Form.Item>
            <Form.Item name="allowUnlimitedTraffic" valuePropName="checked"><Checkbox>ترافیک نامحدود</Checkbox></Form.Item>
          </Space>
          <Button type="primary" htmlType="submit" loading={saving}>ساخت ادمین</Button>
        </Form>
        <Table<AdminRecord> style={{ marginTop: 24 }} rowKey="userId" columns={columns} dataSource={rows} loading={loading} pagination={{ pageSize: 10 }} scroll={{ x: 800 }} locale={{ emptyText: 'هنوز ادمین فرعی ساخته نشده است' }} />
      </Card>
    </div>
  );
}
