import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  QRCode,
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
  enable: boolean;
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

type ClientSummary = {
  email: string;
  enable: boolean;
  totalGB: number;
  expiryTime: number;
  inboundIds: number[];
};

type TwoFactorStatus = {
  panelTwoFactorEnabled: boolean;
  twoFactorEnabled: boolean;
};

const GB = 1024 * 1024 * 1024;
const BASIC_CLIENT_PROTOCOLS = new Set(['vless', 'vmess', 'trojan', 'hysteria', 'tuic', 'masque']);

function collectConnectionLinks(value: unknown): string[] {
  const pattern = /^(?:vless|vmess|trojan|ss|ssr|hysteria2?|tuic|masque|socks|https?):\/\//i;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return pattern.test(trimmed) ? [trimmed] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectConnectionLinks);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectConnectionLinks);
  }
  return [];
}

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
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [setupSecret, setSetupSecret] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [selectedLinks, setSelectedLinks] = useState<{ email: string; links: string[] } | null>(
    null,
  );
  const [linksLoading, setLinksLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createdCredential, setCreatedCredential] = useState<{
    email: string;
    uuid: string;
    password: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const [profileResponse, twoFactorResponse] = await Promise.all([
        HttpUtil.get('/panel/api/admins/me', undefined, { silent: true }) as Promise<
          ApiResponse<AdminProfile>
        >,
        HttpUtil.get('/panel/api/admins/me/2fa', undefined, { silent: true }) as Promise<
          ApiResponse<TwoFactorStatus>
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
      if (!twoFactorResponse?.success || !twoFactorResponse.obj) {
        throw new Error(twoFactorResponse?.msg || 'بررسی وضعیت تأیید دومرحله‌ای ناموفق بود.');
      }
      setTwoFactorStatus(twoFactorResponse.obj);
      if (twoFactorResponse.obj.panelTwoFactorEnabled && !twoFactorResponse.obj.twoFactorEnabled) {
        setInbounds([]);
        setClients([]);
        return;
      }
      const [inboundResponse, clientResponse] = await Promise.all([
        HttpUtil.get('/panel/api/inbounds/options', undefined, { silent: true }) as Promise<
          ApiResponse<InboundOption[]>
        >,
        HttpUtil.get('/panel/api/clients/list/paged?page=1&pageSize=100', undefined, {
          silent: true,
        }) as Promise<ApiResponse<{ items?: ClientSummary[] }>>,
      ]);
      if (!inboundResponse?.success) {
        throw new Error(inboundResponse?.msg || 'دریافت فهرست اینباندها ناموفق بود.');
      }
      setInbounds(Array.isArray(inboundResponse.obj) ? inboundResponse.obj : []);
      if (clientResponse?.success && clientResponse.obj) {
        setClients(Array.isArray(clientResponse.obj.items) ? clientResponse.obj.items : []);
      } else {
        setClients([]);
      }
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
            auth: password,
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

  const beginTwoFactorSetup = useCallback(async () => {
    setSetupLoading(true);
    try {
      const response = (await HttpUtil.post('/panel/api/admins/me/2fa/setup', {})) as ApiResponse<{
        secret: string;
        otpauthUrl: string;
      }>;
      if (!response?.success || !response.obj) {
        throw new Error(response?.msg || 'شروع راه‌اندازی 2FA ناموفق بود.');
      }
      setSetupSecret(response.obj);
      setSetupCode('');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'شروع راه‌اندازی 2FA ناموفق بود.');
    } finally {
      setSetupLoading(false);
    }
  }, [messageApi]);

  const confirmTwoFactorSetup = useCallback(async () => {
    if (!setupCode.trim()) {
      messageApi.error('کد برنامه احراز هویت را وارد کن.');
      return;
    }
    setSetupLoading(true);
    try {
      const response = (await HttpUtil.post('/panel/api/admins/me/2fa/confirm', {
        code: setupCode.trim(),
      })) as ApiResponse<unknown>;
      if (!response?.success) {
        throw new Error(response?.msg || 'تأیید کد ناموفق بود.');
      }
      setSetupSecret(null);
      setSetupCode('');
      messageApi.success('تأیید دومرحله‌ای فعال شد.');
      await load();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'تأیید کد ناموفق بود.');
    } finally {
      setSetupLoading(false);
    }
  }, [load, messageApi]);

  const showClientLinks = useCallback(
    async (email: string) => {
      setLinksLoading(true);
      try {
        const response = (await HttpUtil.get(
          '/panel/api/clients/links/' + encodeURIComponent(email),
          undefined,
          { silent: true },
        )) as ApiResponse<unknown>;
        if (!response?.success) {
          throw new Error(response?.msg || 'دریافت لینک‌های اتصال ناموفق بود.');
        }
        const links = collectConnectionLinks(response.obj);
        if (links.length === 0) {
          throw new Error('برای این کاربر لینک اتصالی پیدا نشد.');
        }
        setSelectedLinks({ email, links: [...new Set(links)] });
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : 'دریافت لینک‌ها ناموفق بود.');
      } finally {
        setLinksLoading(false);
      }
    },
    [messageApi],
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

  if (twoFactorStatus?.panelTwoFactorEnabled && !twoFactorStatus.twoFactorEnabled) {
    return (
      <div
        dir="rtl"
        style={{
          minHeight: '100vh',
          padding: 24,
          display: 'grid',
          placeItems: 'center',
          background: 'var(--ant-color-bg-layout, #f4f6fb)',
        }}
      >
        {messageContextHolder}
        <Card title="فعال‌سازی تأیید دومرحله‌ای" style={{ width: 'min(560px, 100%)' }}>
          <Alert
            type="warning"
            showIcon
            message="برای امنیت پنل، ابتدا 2FA شخصی خودت را فعال کن"
            description="تا قبل از تأیید کد برنامه احراز هویت، اطلاعات اینباندها و کاربران قفل می‌ماند."
            style={{ marginBottom: 20 }}
          />
          {!setupSecret ? (
            <Button
              type="primary"
              block
              loading={setupLoading}
              onClick={() => void beginTwoFactorSetup()}
            >
              شروع راه‌اندازی
            </Button>
          ) : (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <QRCode value={setupSecret.otpauthUrl} size={220} />
              <Typography.Text>اگر QR اسکن نمی‌شود، این کلید را دستی وارد کن:</Typography.Text>
              <Typography.Paragraph copyable>{setupSecret.secret}</Typography.Paragraph>
              <Input
                value={setupCode}
                onChange={(event) => setSetupCode(event.target.value)}
                inputMode="numeric"
                placeholder="کد ۶ رقمی برنامه احراز هویت"
                maxLength={8}
              />
              <Button
                type="primary"
                block
                loading={setupLoading}
                onClick={() => void confirmTwoFactorSetup()}
              >
                تأیید و فعال‌سازی
              </Button>
            </Space>
          )}
          <Button block style={{ marginTop: 12 }} onClick={() => void logout()}>
            خروج از حساب
          </Button>
        </Card>
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
          'radial-gradient(circle at 90% 0%, rgba(139, 92, 246, .14), transparent 34%), var(--ant-color-bg-layout, #f4f6fb)',
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
                background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
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
          {inbounds.some((item) => !BASIC_CLIENT_PROTOCOLS.has(item.protocol.toLowerCase())) && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="بعضی پروتکل‌ها به تنظیمات اختصاصی نیاز دارند"
              description="در فرم ساخت سریع فقط VLESS، VMess، Trojan، Hysteria، TUIC و MASQUE فعال هستند. سایر اینباندها قابل مشاهده‌اند، اما از این فرم برایشان کاربر نساز."
            />
          )}
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
                        {!BASIC_CLIENT_PROTOCOLS.has(inbound.protocol.toLowerCase()) && (
                          <Tag color="warning">تنظیمات ویژه</Tag>
                        )}
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

        <Card
          title="کاربران من"
          extra={<Tag color="purple">{clients.length.toLocaleString('fa-IR')} مورد</Tag>}
          style={{ marginBottom: 20 }}
        >
          {clients.length === 0 ? (
            <Typography.Text type="secondary">
              هنوز کاربری نساخته‌ای یا فهرست خالی است.
            </Typography.Text>
          ) : (
            <Row gutter={[12, 12]}>
              {clients.map((client) => (
                <Col xs={24} md={12} lg={8} key={client.email}>
                  <Card
                    size="small"
                    title={client.email}
                    extra={
                      <Tag color={client.enable ? 'success' : 'default'}>
                        {client.enable ? 'فعال' : 'غیرفعال'}
                      </Tag>
                    }
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Typography.Text type="secondary">
                        حجم کل:{' '}
                        {(client.totalGB / GB).toLocaleString('fa-IR', {
                          maximumFractionDigits: 2,
                        })}{' '}
                        GB
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        انقضا:{' '}
                        {client.expiryTime > 0
                          ? new Date(client.expiryTime).toLocaleDateString('fa-IR')
                          : 'بدون انقضا'}
                      </Typography.Text>
                      <Button
                        block
                        loading={linksLoading}
                        onClick={() => void showClientLinks(client.email)}
                      >
                        نمایش لینک و QR
                      </Button>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card>

        <Modal
          title={selectedLinks ? 'لینک اتصال · ' + selectedLinks.email : 'لینک اتصال'}
          open={selectedLinks !== null}
          onCancel={() => setSelectedLinks(null)}
          footer={<Button onClick={() => setSelectedLinks(null)}>بستن</Button>}
          width={720}
        >
          {selectedLinks && (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {selectedLinks.links.map((link, index) => (
                <Card key={link + index} size="small">
                  <Space direction="vertical" align="center" style={{ width: '100%' }}>
                    <QRCode value={link} size={176} />
                    <Typography.Paragraph
                      copyable={{ text: link }}
                      style={{ width: '100%', wordBreak: 'break-all' }}
                    >
                      {link}
                    </Typography.Paragraph>
                  </Space>
                </Card>
              ))}
            </Space>
          )}
        </Modal>

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
                      disabled:
                        item.enable === false ||
                        !BASIC_CLIENT_PROTOCOLS.has(item.protocol.toLowerCase()),
                    }))}
                    disabled={
                      !inbounds.some(
                        (item) =>
                          item.enable && BASIC_CLIENT_PROTOCOLS.has(item.protocol.toLowerCase()),
                      )
                    }
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
              disabled={
                !inbounds.some(
                  (item) => item.enable && BASIC_CLIENT_PROTOCOLS.has(item.protocol.toLowerCase()),
                )
              }
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
