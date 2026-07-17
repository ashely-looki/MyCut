import React, { useCallback, useEffect, useState } from 'react'
import { Layout, Typography, Table, Input, Switch, Button, Modal, InputNumber, message, Segmented, Card, Alert } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  adminApi,
  AdminOverview,
  AdminUserItem,
  AdminOrderItem,
} from '../services/api'
import { useAuth } from '../context/AuthContext'
import AiModelConfig from '../components/AiModelConfig'
import SpeechRecognitionConfig from '../components/SpeechRecognitionConfig'

const { Content } = Layout
const { Text } = Typography

const PAGE_SIZE = 20

/** 订单状态 → 中文标签 + 语义色（克制，仅用一抹语义色，不做彩色 chip 撞色）。 */
const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  paid: { label: '已支付', color: 'var(--ac-ok, #5BB36A)' },
  pending: { label: '待支付', color: 'var(--ac-sub)' },
  closed: { label: '已关闭', color: 'var(--ac-muted)' },
  failed: { label: '失败', color: 'var(--ac-error, #E66A5C)' },
}

const fmtTime = (t: string | null) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '—')
const fmtDay = (t: string | null) => (t ? dayjs(t).format('YYYY-MM-DD') : '—')

/** 概览大盘的单个统计块。纯单色，数字用 mono，靠留白与发丝分隔。 */
const StatTile: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div
    style={{
      background: 'var(--ac-card)',
      border: '1px solid var(--ac-line)',
      borderRadius: 16,
      padding: '20px 22px',
    }}
  >
    <div
      style={{
        fontSize: 11,
        letterSpacing: '.8px',
        textTransform: 'uppercase',
        color: 'var(--ac-muted)',
        fontWeight: 500,
      }}
    >
      {label}
    </div>
    <div
      style={{
        marginTop: 10,
        fontFamily: 'var(--ac-font-mono, ui-monospace, monospace)',
        fontSize: 30,
        lineHeight: 1.1,
        color: 'var(--ac-ink)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value}
    </div>
    {hint && (
      <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--ac-sub)' }}>{hint}</div>
    )}
  </div>
)

const Mono: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontFamily: 'var(--ac-font-mono, ui-monospace, monospace)', fontVariantNumeric: 'tabular-nums' }}>
    {children}
  </span>
)

/**
 * 管理者后台（Calm Premium，见 DESIGN.md）
 *
 * 三个分段：概览 / 用户与会员 / 订单流水。仅 ADMIN_EMAILS 白名单内的登录者可进
 * （入口在 Header 里同样按 isAdmin 显示）。非管理员直接落到「无权限」态。
 */
const AdminPage: React.FC = () => {
  const { isAdmin, authEnabled, user } = useAuth()
  const [tab, setTab] = useState<'overview' | 'users' | 'orders' | 'ai' | 'speech'>('overview')

  // 概览
  const [overview, setOverview] = useState<AdminOverview | null>(null)

  // 用户
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(1)
  const [usersLoading, setUsersLoading] = useState(false)
  const [onlyMembers, setOnlyMembers] = useState(false)
  const [userQuery, setUserQuery] = useState('')

  // 订单
  const [orders, setOrders] = useState<AdminOrderItem[]>([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [orderStatus, setOrderStatus] = useState<string>('all')

  // 手动发会员弹窗
  const [grantTarget, setGrantTarget] = useState<AdminUserItem | null>(null)
  const [grantMonths, setGrantMonths] = useState(1)
  const [grantNote, setGrantNote] = useState('')
  const [granting, setGranting] = useState(false)

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await adminApi.getOverview())
    } catch {
      message.error('加载概览失败')
    }
  }, [])

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const res = await adminApi.listUsers({
        page: usersPage,
        page_size: PAGE_SIZE,
        only_members: onlyMembers,
        q: userQuery.trim() || undefined,
      })
      setUsers(res.items)
      setUsersTotal(res.total)
    } catch {
      message.error('加载用户失败')
    } finally {
      setUsersLoading(false)
    }
  }, [usersPage, onlyMembers, userQuery])

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true)
    try {
      const res = await adminApi.listOrders({
        page: ordersPage,
        page_size: PAGE_SIZE,
        status: orderStatus === 'all' ? undefined : orderStatus,
      })
      setOrders(res.items)
      setOrdersTotal(res.total)
    } catch {
      message.error('加载订单失败')
    } finally {
      setOrdersLoading(false)
    }
  }, [ordersPage, orderStatus])

  useEffect(() => {
    if (!isAdmin) return
    if (tab === 'overview') loadOverview()
    if (tab === 'users') loadUsers()
    if (tab === 'orders') loadOrders()
  }, [isAdmin, tab, loadOverview, loadUsers, loadOrders])

  const submitGrant = async () => {
    if (!grantTarget) return
    setGranting(true)
    try {
      await adminApi.grantMembership(grantTarget.user_id, grantMonths, grantNote.trim() || undefined)
      message.success('会员已发放')
      setGrantTarget(null)
      setGrantNote('')
      setGrantMonths(1)
      loadUsers()
      if (tab === 'overview') loadOverview()
    } catch {
      message.error('发放失败，请重试')
    } finally {
      setGranting(false)
    }
  }

  // 未开启登录 / 非管理员 → 安静的无权限态
  if (!authEnabled || !isAdmin) {
    return (
      <Content style={{ padding: '56px', minHeight: 'calc(100vh - 64px)' }}>
        <div
          style={{
            maxWidth: 480,
            margin: '80px auto',
            textAlign: 'center',
            color: 'var(--ac-sub)',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ac-ink)', marginBottom: 8 }}>
            无后台权限
          </div>
          <div style={{ fontSize: 14 }}>
            {authEnabled
              ? `当前账号（${user?.email ?? '未知'}）不在管理员白名单内。`
              : '未开启登录，管理者后台不可用。'}
          </div>
        </div>
      </Content>
    )
  }

  const userColumns: ColumnsType<AdminUserItem> = [
    {
      title: '用户 ID',
      dataIndex: 'user_id',
      render: (v: string) => <Mono>{v}</Mono>,
    },
    {
      title: '会员',
      dataIndex: 'is_member',
      width: 160,
      render: (isMember: boolean, row) =>
        isMember ? (
          <span style={{ color: 'var(--ac-ink)' }}>
            至 <Mono>{fmtDay(row.membership_expires_at)}</Mono>
          </span>
        ) : (
          <Text type="secondary">非会员</Text>
        ),
    },
    {
      title: '项目',
      dataIndex: 'project_count',
      width: 80,
      align: 'right',
      render: (v: number) => <Mono>{v}</Mono>,
    },
    {
      title: '已付订单',
      dataIndex: 'paid_order_count',
      width: 100,
      align: 'right',
      render: (v: number) => <Mono>{v}</Mono>,
    },
    {
      title: '累计支付',
      dataIndex: 'total_paid',
      width: 120,
      align: 'right',
      render: (v: string) => <Mono>¥{v}</Mono>,
    },
    {
      title: '首次出现',
      dataIndex: 'first_seen_at',
      width: 140,
      render: (v: string | null) => <Text type="secondary"><Mono>{fmtDay(v)}</Mono></Text>,
    },
    {
      title: '',
      key: 'action',
      width: 96,
      render: (_: unknown, row) => (
        <Button
          type="text"
          size="small"
          onClick={() => setGrantTarget(row)}
          style={{ color: 'var(--ac-accent)', borderRadius: 999 }}
        >
          发会员
        </Button>
      ),
    },
  ]

  const orderColumns: ColumnsType<AdminOrderItem> = [
    {
      title: '商户订单号',
      dataIndex: 'out_trade_no',
      render: (v: string) => <Mono>{v}</Mono>,
    },
    {
      title: '用户 ID',
      dataIndex: 'user_id',
      ellipsis: true,
      render: (v: string) => <Mono>{v}</Mono>,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 100,
      align: 'right',
      render: (v: string) => <Mono>¥{v}</Mono>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: string) => {
        const meta = ORDER_STATUS[s] ?? { label: s, color: 'var(--ac-sub)' }
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: meta.color }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: meta.color }} />
            {meta.label}
          </span>
        )
      },
    },
    {
      title: '支付宝流水号',
      dataIndex: 'alipay_trade_no',
      ellipsis: true,
      render: (v: string | null) => (v ? <Mono>{v}</Mono> : <Text type="secondary">—</Text>),
    },
    {
      title: '下单时间',
      dataIndex: 'created_at',
      width: 160,
      render: (v: string | null) => <Text type="secondary"><Mono>{fmtTime(v)}</Mono></Text>,
    },
  ]

  return (
    <Content style={{ padding: '40px 56px', minHeight: 'calc(100vh - 64px)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ac-ink)', margin: 0 }}>管理者后台</h2>
          <Text type="secondary" style={{ fontSize: 12.5 }}>{user?.email}</Text>
        </div>

        <Segmented
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          options={[
            { label: '概览', value: 'overview' },
            { label: '用户与会员', value: 'users' },
            { label: '订单流水', value: 'orders' },
            { label: 'AI 模型', value: 'ai' },
            { label: '语音转写', value: 'speech' },
          ]}
          style={{ marginBottom: 28 }}
        />

        {tab === 'overview' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 24,
            }}
          >
            <StatTile label="用户总数" value={overview?.total_users ?? '—'} hint={`今日新增 ${overview?.new_users_today ?? 0}`} />
            <StatTile label="有效会员" value={overview?.total_members ?? '—'} />
            <StatTile label="累计收入" value={overview ? `¥${overview.total_revenue}` : '—'} hint={`今日 ¥${overview?.revenue_today ?? '0.00'}`} />
            <StatTile label="订单" value={overview?.total_orders ?? '—'} hint={`已支付 ${overview?.paid_orders ?? 0}`} />
            <StatTile label="项目总数" value={overview?.total_projects ?? '—'} />
            <StatTile label="处理中" value={overview?.processing_projects ?? '—'} />
            <StatTile label="失败项目" value={overview?.failed_projects ?? '—'} />
          </div>
        )}

        {tab === 'users' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <Input.Search
                placeholder="按 user id 搜索"
                allowClear
                style={{ maxWidth: 320 }}
                onSearch={(v) => {
                  setUserQuery(v)
                  setUsersPage(1)
                }}
              />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--ac-sub)', fontSize: 13 }}>
                <Switch
                  size="small"
                  checked={onlyMembers}
                  onChange={(v) => {
                    setOnlyMembers(v)
                    setUsersPage(1)
                  }}
                />
                只看会员
              </span>
            </div>
            <Table
              rowKey="user_id"
              size="middle"
              loading={usersLoading}
              columns={userColumns}
              dataSource={users}
              pagination={{
                current: usersPage,
                pageSize: PAGE_SIZE,
                total: usersTotal,
                onChange: setUsersPage,
                showSizeChanger: false,
                showTotal: (t) => `共 ${t} 位`,
              }}
            />
          </>
        )}

        {tab === 'orders' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Segmented
                size="small"
                value={orderStatus}
                onChange={(v) => {
                  setOrderStatus(v as string)
                  setOrdersPage(1)
                }}
                options={[
                  { label: '全部', value: 'all' },
                  { label: '已支付', value: 'paid' },
                  { label: '待支付', value: 'pending' },
                  { label: '失败', value: 'failed' },
                  { label: '已关闭', value: 'closed' },
                ]}
              />
            </div>
            <Table
              rowKey="out_trade_no"
              size="middle"
              loading={ordersLoading}
              columns={orderColumns}
              dataSource={orders}
              pagination={{
                current: ordersPage,
                pageSize: PAGE_SIZE,
                total: ordersTotal,
                onChange: setOrdersPage,
                showSizeChanger: false,
                showTotal: (t) => `共 ${t} 笔`,
              }}
            />
          </>
        )}

        {/* AI 模型配置：全局共享（DeepSeek Key 等），只有管理员能改 */}
        {tab === 'ai' && <AiModelConfig />}

        {/* 语音转写配置：同样是全局服务配置，移到后台 */}
        {tab === 'speech' && (
          <Card title="语音转写配置" className="settings-card">
            <Alert
              message="语音识别服务配置"
              description="配置语音转写服务，用于视频字幕生成和语音识别。支持本地Whisper模型和多种云服务API。"
              type="info"
              showIcon
              className="settings-alert"
            />
            <SpeechRecognitionConfig
              onConfigChange={(config) => {
                console.log('语音配置已更新:', config)
              }}
            />
          </Card>
        )}
      </div>

      <Modal
        title="手动发放会员"
        open={!!grantTarget}
        onCancel={() => setGrantTarget(null)}
        onOk={submitGrant}
        okText="确认发放"
        cancelText="取消"
        confirmLoading={granting}
        okButtonProps={{ style: { borderRadius: 999 } }}
        cancelButtonProps={{ style: { borderRadius: 999 } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--ac-sub)', marginBottom: 6 }}>目标用户</div>
            <Mono>{grantTarget?.user_id}</Mono>
            {grantTarget?.is_member && (
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12.5 }}>
                当前到期 {fmtDay(grantTarget.membership_expires_at)}，将在此之后累加
              </Text>
            )}
          </div>
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--ac-sub)', marginBottom: 6 }}>延长月数</div>
            <InputNumber min={1} max={120} value={grantMonths} onChange={(v) => setGrantMonths(v ?? 1)} style={{ width: 120 }} />
          </div>
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--ac-sub)', marginBottom: 6 }}>备注（可选）</div>
            <Input placeholder="如：兑换码 A123 / 手动补单" value={grantNote} onChange={(e) => setGrantNote(e.target.value)} maxLength={200} />
          </div>
        </div>
      </Modal>
    </Content>
  )
}

export default AdminPage
