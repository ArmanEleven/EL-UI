import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CloudServerOutlined,
  LogoutOutlined,
  PlusOutlined,
  SafetyOutlined,
} from '@ant-design/icons';

import { HttpUtil } from '@/utils';

type InboundOption = {
  id: number;
  remark: string;
  protocol: string;
  port: number;
  tlsFlowCapable?: boolean;
};

type AdminProfile = {
  userId: number;
  username: string;
  role: string;
  maxClients: number;
  allowUnlimitedClients: boolean;
  trafficQuotaBytes: number;
  allowUnlimitedTraffic: boolean;
  allocatedClients: number;
  allocatedTrafficBytes: number;
  allowedInboundIds: number[];
};

type ApiResponse<T> = { success?: boolean; msg?: string; obj?: T };

const GB = 1024 * 1024 * 1024;

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    return (
      hex.slice(0, 8) +
      '-' +
      hex.slice(8, 12) +
      '-' +
      hex.slice(12, 16) +
      '-' +
      hex.slice(16, 20) +
      '-' +
      hex.slice(20)
    );
  }
  throw new Error('مرورگر از تولید شناسه امن پشتیبانی نمی‌کند.');
}

export default function AdminPortalPage() {
  const [form] = Form.useForm();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [inbounds, setInbounds] = useState<InboundOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createdCredential, setCreatedCredential] = useState<{
    email: string;
    uuid: string;
    password: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const [profileResponse, inboundResponse] = await Promise.all([
        HttpUtil.get('/panel/api/admins/me', undefined, { silent: true }) as Promise<
          ApiResponse<AdminProfile>
        >,
        HttpUtil.get('/panel/api/inbounds/options', undefined, { silent: true }) as Promise<
          ApiResponse<InboundOption[]>
        >,
      ]);
      if (!profileResponse?.success || !profileResponse.obj) {
        throw new Error(profileResponse?.msg || 'دریافت اطلاعات حساب ناموفق بود.');
      }
      if (profileResponse.obj.role !== 'admin') {
        window.location.replace((window.X_UI_BASE_PATH || '/') + 'panel/');
        return;
      }
      setProfile(profileResponse.obj);
      if (!inboundResponse?.success) {
        throw new Error(inboundResponse?.msg || 'دریافت فهرست اینباندها ناموفق بود.');
      }
      setInbounds(Array.isArray(inboundResponse.obj) ? inboundResponse.obj : []);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'خطا در دریافت اطلاعات پنل.');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  const createClient = useCallback(
    async (values: {
      email: string;
      inboundIds: number[];
      totalGB: number;
      expiryDays?: number;
    }) => {
      setSaving(true);
      setCreatedCredential(null);
      try {
        const uuid = generateUuid();
        const password = uuid.replaceAll('-', '').slice(0, 16);
        const subId = generateUuid();
        const expiryTime =
          values.expiryDays && values.expiryDays > 0
            ? Date.now() + values.expiryDays * 24 * 60 * 60 * 1000
            : 0;
        const response = (await HttpUtil.post('/panel/api/clients/add', {
          client: {
            email: values.email.trim(),
            id: uuid,
            subId,
            uuid,
            password,
            totalGB: Math.round(values.totalGB * GB),
            expiryTime,
            enable: true,
          },
          inboundIds: values.inboundIds,
        })) as ApiResponse<unknown>;
        if (!response?.success) {
          throw new Error(response?.msg || 'ساخت کاربر ناموفق بود.');
        }
        setCreatedCredential({ email: values.email.trim(), uuid, password });
        messageApi.success('کاربر با موفقیت ساخته شد.');
        form.resetFields();
        form.setFieldsValue({ totalGB: 10, expiryDays: 30 });
        await load();
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : 'ساخت کاربر ناموفق بود.');
      } finally {
        setSaving(false);
      }
    },
    [form, load, messageApi],
  );

  const logout = useCallback(async () => {
    await HttpUtil.post('/logout');
    window.location.href = window.X_UI_BASE_PATH || '/';
  }, []);

  if (loading || !profile) {
    return (
      <div
        dir="rtl"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--ant-color-bg-layout, #f4f6fb)',
        }}
      >
        {messageContextHolder}
        <Spin size="large" />
      </div>
    );
  }

  const clientsLeft = profile.allowUnlimitedClients
    ? 'نامحدود'
    : Math.max(0, profile.maxClients - profile.allocatedClients).toLocaleString('fa-IR');
  const trafficGB = profile.allowUnlimitedTraffic
    ? 'نامحدود'
    : Math.max(0, profile.trafficQuotaBytes - profile.allocatedTrafficBytes) / GB;

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        padding: 'clamp(16px, 3vw, 36px)',
        background:
          'radial-gradient(circle at 90% 0%, rgba(82, 110, 255, .12), transparent 34%), var(--ant-color-bg-layout, #f4f6fb)',
      }}
    >
      {messageContextHolder}
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 28,
          }}
        >
          <Space size={14}>
            <div
              style={{
                width: 48,
                height: 48,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 16,
                color: '#fff',
                background: 'linear-gradient(135deg, #536dfe, #7c4dff)',
                fontWeight: 800,
                fontSize: 20,
              }}
            >
              EL
            </div>
            <div>
              <Typography.Title level={3} style={{ margin: 0 }}>
                Eleven Panel
              </Typography.Title>
              <Typography.Text type="secondary">
                پرتال ادمین · خوش آمدی {profile.username}
              </Typography.Text>
            </div>
          </Space>
          <Button icon={<LogoutOutlined />} onClick={logout}>
            خروج از حساب
          </Button>
        </header>

        <Alert
          showIcon
          type="info"
          icon={<SafetyOutlined />}
          message="دسترسی محدود ادمین"
          description="در این پرتال فقط می‌توانی مشخصات اینباندهای مجاز را ببینی و کاربر جدید بسازی. ویرایش تنظیمات، حذف کاربران و ورود به پنل اصلی برای این حساب فعال نیست."
          style={{ marginBottom: 20 }}
        />

        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic
                title="ظرفیت باقی‌مانده کاربران"
                value={clientsLeft}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic
                title="ظرفیت ترافیک باقی‌مانده"
                value={
                  profile.allowUnlimitedTraffic
                    ? 'نامحدود'
                    : trafficGB.toLocaleString('fa-IR', { maximumFractionDigits: 2 })
                }
                suffix={profile.allowUnlimitedTraffic ? undefined : 'GB'}
                prefix={<CloudServerOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Card
          title="اینباندهای مجاز"
          extra={<Tag color="blue">{inbounds.length.toLocaleString('fa-IR')} مورد</Tag>}
          style={{ marginBottom: 20 }}
        >
          {inbounds.length === 0 ? (
            <Typography.Text type="secondary">
              هیچ اینباندی برای این حساب مجاز نشده است. با مالک پنل تماس بگیر.
            </Typography.Text>
          ) : (
            <Row gutter={[12, 12]}>
              {inbounds.map((inbound) => (
                <Col xs={24} sm={12} lg={8} key={inbound.id}>
                  <div
                    style={{
                      border: '1px solid var(--ant-color-border-secondary, #e5e7eb)',
                      borderRadius: 12,
                      padding: 16,
                      height: '100%',
                    }}
                  >
                    <Space direction="vertical" size={6}>
                      <Typography.Text strong>
                        {inbound.remark || 'Inbound ' + inbound.id}
                      </Typography.Text>
                      <Space wrap>
                        <Tag>{inbound.protocol.toUpperCase()}</Tag>
                        <Tag color="geekblue">پورت {inbound.port}</Tag>
                        <Tag color={inbound.enable ? 'success' : 'default'}>
                          {inbound.enable ? 'فعال' : 'غیرفعال'}
                        </Tag>
                        <Typography.Text type="secondary">شناسه {inbound.id}</Typography.Text>
                      </Space>
                    </Space>
                  </div>
                </Col>
              ))}
            </Row>
          )}
        </Card>

        <Card title="ساخت کاربر جدید" extra={<PlusOutlined />}>
          <Typography.Paragraph type="secondary">
            کاربر فقط به اینباندهایی متصل می‌شود که مالک پنل برای حسابت مجاز کرده است.
          </Typography.Paragraph>
          <Form
            form={form}
            layout="vertical"
            onFinish={createClient}
            initialValues={{ totalGB: 10, expiryDays: 30 }}
          >
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="نام کاربر / شناسه"
                  name="email"
                  rules={[
                    { required: true, message: 'یک شناسه وارد کن.' },
                    { whitespace: true, message: 'شناسه نمی‌تواند خالی باشد.' },
                    { max: 64, message: 'شناسه حداکثر ۶۴ نویسه است.' },
                  ]}
                >
                  <Input placeholder="مثلاً user-001" maxLength={64} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="اینباندها"
                  name="inboundIds"
                  rules={[{ required: true, message: 'حداقل یک اینباند انتخاب کن.' }]}
                >
                  <Select
                    mode="multiple"
                    allowClear
                    placeholder="اینباندهای موردنظر را انتخاب کن"
                    options={inbounds.map((item) => ({
                      label:
                        (item.remark || 'Inbound ' + item.id) +
                        ' · ' +
                        item.protocol.toUpperCase() +
                        ' · ' +
                        item.port,
                      value: item.id,
                      disabled: item.enable === false,
                    }))}
                    disabled={inbounds.length === 0}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="سهمیه ترافیک (گیگابایت)"
                  name="totalGB"
                  rules={[{ required: true, message: 'سهمیه ترافیک را مشخص کن.' }]}
                >
                  <InputNumber min={1} max={1000000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="اعتبار (روز؛ صفر یعنی بدون انقضا)" name="expiryDays">
                  <InputNumber min={0} max={36500} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              disabled={inbounds.length === 0}
            >
              ساخت کاربر
            </Button>
          </Form>

          {createdCredential && (
            <Alert
              type="success"
              showIcon
              style={{ marginTop: 20 }}
              message="کاربر ساخته شد"
              description={
                <Space direction="vertical">
                  <Typography.Text>شناسه: {createdCredential.email}</Typography.Text>
                  <Typography.Text>UUID: {createdCredential.uuid}</Typography.Text>
                  <Typography.Text>رمز اتصال: {createdCredential.password}</Typography.Text>
                  <Typography.Text type="secondary">
                    UUID را همین حالا کپی و در جای امن ذخیره کن؛ این صفحه فقط یک‌بار آن را نشان می‌دهد.
                  </Typography.Text>
                  <Button
                    onClick={() =>
                      void navigator.clipboard.writeText(
                        'شناسه: ' +
                          createdCredential.email +
                          '\nUUID: ' +
                          createdCredential.uuid +
                          '\nرمز اتصال: ' +
                          createdCredential.password,
                      )
                    }
                  >
                    کپی مشخصات
                  </Button>
                </Space>
              }
            />
          )}
        </Card>
        <Typography.Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 24 }}>
          Eleven Panel · پرتال امن ادمین
        </Typography.Paragraph>
      </div>
    </div>
  );
}
