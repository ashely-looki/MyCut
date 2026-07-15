import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout, Typography, Button, message } from 'antd'
import { ArrowLeftOutlined, CheckOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { payApi, Membership } from '../services/api'
import { openAlipayForm } from '../utils/alipay'

const { Content } = Layout
const { Title, Text } = Typography

// 月会员权益（先写死，跟 ¥98/月 套餐对应）
const BENEFITS = [
  '不限量 AI 视频切片',
  'AI 查热点 + 大纲/文案生成',
  '自动成片与合集导出',
  '优先体验新功能',
]

/**
 * 会员购买页（Calm Premium，见 DESIGN.md）
 *
 * 流程：点「立即开通」→ 后端下单拿支付宝表单 → 新标签页跳收银台 →
 * 本页轮询订单状态（后端会向支付宝反查兜底）→ 支付成功刷新会员状态。
 */
const MembershipPage: React.FC = () => {
  const navigate = useNavigate()
  const [membership, setMembership] = useState<Membership | null>(null)
  const [paying, setPaying] = useState(false)
  const pollTimer = useRef<number | null>(null)

  const price = '98'

  const loadMembership = useCallback(async () => {
    try {
      setMembership(await payApi.getMembership())
    } catch {
      // 会员状态拉取失败不阻断页面
    }
  }, [])

  useEffect(() => {
    loadMembership()
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current)
    }
  }, [loadMembership])

  const startPolling = useCallback((outTradeNo: string) => {
    let elapsed = 0
    const interval = 3000
    const timeout = 5 * 60 * 1000 // 最多轮询 5 分钟

    pollTimer.current = window.setInterval(async () => {
      elapsed += interval
      try {
        const order = await payApi.getOrderStatus(outTradeNo)
        if (order.status === 'paid') {
          if (pollTimer.current) window.clearInterval(pollTimer.current)
          setPaying(false)
          message.success('支付成功，会员已开通')
          loadMembership()
          return
        }
      } catch {
        // 单次轮询失败忽略，继续下一次
      }
      if (elapsed >= timeout) {
        if (pollTimer.current) window.clearInterval(pollTimer.current)
        setPaying(false)
        message.info('未检测到支付完成，如已付款请稍后刷新')
      }
    }, interval)
  }, [loadMembership])

  const handleBuy = async () => {
    setPaying(true)
    try {
      const { out_trade_no, pay_form_html } = await payApi.createAlipayOrder(1)
      const win = openAlipayForm(pay_form_html)
      if (!win) {
        setPaying(false)
        message.warning('浏览器拦截了支付窗口，请允许弹窗后重试')
        return
      }
      message.info('已打开支付宝收银台，请在新标签页完成支付')
      startPolling(out_trade_no)
    } catch (err: any) {
      setPaying(false)
      const detail = err?.response?.data?.detail
      message.error(detail || '发起支付失败，请稍后重试')
    }
  }

  const isMember = membership?.is_member
  const expiresText = membership?.expires_at
    ? dayjs(membership.expires_at).format('YYYY-MM-DD')
    : null

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--ac-bg)' }}>
      <Content style={{ padding: '32px 56px 56px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}
              style={{ color: 'var(--ac-sub)', borderRadius: 999 }}>返回</Button>
            <Title level={2} style={{ margin: 0, color: 'var(--ac-ink)', fontSize: 20, fontWeight: 600 }}>
              会员
            </Title>
          </div>
          <Text style={{ color: 'var(--ac-muted)', fontSize: 13, display: 'block', marginBottom: 28, paddingLeft: 4 }}>
            {isMember
              ? `你已是会员${expiresText ? `，有效期至 ${expiresText}` : ''}`
              : '开通会员，解锁全部创作能力'}
          </Text>

          {/* 定价卡 */}
          <div
            style={{
              background: 'var(--ac-card)',
              border: '1px solid var(--ac-line)',
              borderRadius: 16,
              padding: '32px 28px',
              boxShadow: 'var(--ac-shadow)',
            }}
          >
            <Text style={{ color: 'var(--ac-sub)', fontSize: 13, letterSpacing: '.5px' }}>月会员</Text>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '10px 0 24px' }}>
              <span style={{ color: 'var(--ac-ink)', fontSize: 15 }}>¥</span>
              <span
                className="ac-mono"
                style={{ color: 'var(--ac-ink)', fontSize: 44, fontWeight: 600, lineHeight: 1 }}
              >
                {price}
              </span>
              <span style={{ color: 'var(--ac-muted)', fontSize: 14 }}>/ 月</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
              {BENEFITS.map((b) => (
                <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckOutlined style={{ color: 'var(--ac-accent)', fontSize: 14 }} />
                  <Text style={{ color: 'var(--ac-ink)', fontSize: 14 }}>{b}</Text>
                </div>
              ))}
            </div>

            <Button
              type="primary"
              block
              size="large"
              loading={paying}
              onClick={handleBuy}
              style={{
                borderRadius: 999,
                height: 46,
                background: 'var(--ac-cta-bg)',
                color: 'var(--ac-cta-fg)',
                border: 'none',
                fontWeight: 500,
              }}
            >
              {isMember ? '续费一个月' : '立即开通'}
            </Button>

            <Text
              style={{
                color: 'var(--ac-muted)',
                fontSize: 12,
                display: 'block',
                textAlign: 'center',
                marginTop: 14,
              }}
            >
              支付宝安全支付 · 支付完成后自动开通
            </Text>
          </div>
        </div>
      </Content>
    </Layout>
  )
}

export default MembershipPage
