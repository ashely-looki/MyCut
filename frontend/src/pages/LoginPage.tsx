import React, { useState } from 'react'
import { Input, Button, Segmented, Form, message } from 'antd'
import { MailOutlined, LockOutlined } from '@ant-design/icons'
import { useAuth } from '../context/AuthContext'

type Mode = 'signin' | 'signup'

/**
 * 登录 / 注册页（Calm Premium 风格，见 DESIGN.md）
 *
 * 邮箱 + 密码。登录/注册用胶囊分段切换。整页安静、留白多、近乎单色，
 * 品牌 wordmark 用衬线斜体 Cut，与 Header 一致。
 */
const LoginPage: React.FC = () => {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      message.warning('请输入邮箱和密码')
      return
    }
    if (mode === 'signup' && password.length < 6) {
      message.warning('密码至少 6 位')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password)
        message.success('登录成功')
      } else {
        const { needsEmailConfirm } = await signUp(email.trim(), password)
        if (needsEmailConfirm) {
          message.success('注册成功，请到邮箱点击确认链接后再登录')
          setMode('signin')
        } else {
          message.success('注册成功')
        }
      }
    } catch (err: any) {
      // Supabase 的错误信息为英文，做一层常见映射
      const raw = err?.message || '操作失败，请重试'
      const friendly =
        /invalid login credentials/i.test(raw) ? '邮箱或密码不正确'
        : /user already registered/i.test(raw) ? '该邮箱已注册，请直接登录'
        : /email not confirmed/i.test(raw) ? '邮箱未确认，请先到邮箱点击确认链接'
        : raw
      message.error(friendly)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--ac-bg)',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'var(--ac-card)',
          border: '1px solid var(--ac-line)',
          borderRadius: 16,
          padding: '40px 32px',
          boxShadow: 'var(--ac-shadow)',
        }}
      >
        {/* Wordmark */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span
            style={{
              fontFamily: 'var(--ac-font-serif)',
              fontSize: 34,
              color: 'var(--ac-ink)',
              letterSpacing: '1px',
            }}
          >
            My<em style={{ fontStyle: 'italic' }}>Cut</em>
          </span>
        </div>
        <p
          style={{
            textAlign: 'center',
            color: 'var(--ac-sub)',
            fontSize: 13.5,
            margin: '0 0 28px',
          }}
        >
          {mode === 'signin' ? '登录以继续你的创作' : '创建账号，开始你的创作'}
        </p>

        {/* 登录 / 注册 分段切换（胶囊） */}
        <Segmented
          block
          value={mode}
          onChange={(v) => setMode(v as Mode)}
          options={[
            { label: '登录', value: 'signin' },
            { label: '注册', value: 'signup' },
          ]}
          style={{ marginBottom: 24 }}
        />

        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item style={{ marginBottom: 16 }}>
            <Input
              size="large"
              prefix={<MailOutlined style={{ color: 'var(--ac-muted)' }} />}
              placeholder="邮箱"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ borderRadius: 10 }}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 24 }}>
            <Input.Password
              size="large"
              prefix={<LockOutlined style={{ color: 'var(--ac-muted)' }} />}
              placeholder={mode === 'signup' ? '密码（至少 6 位）' : '密码'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ borderRadius: 10 }}
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={submitting}
            style={{
              borderRadius: 999,
              height: 44,
              background: 'var(--ac-cta-bg)',
              color: 'var(--ac-cta-fg)',
              border: 'none',
              fontWeight: 500,
            }}
          >
            {mode === 'signin' ? '登录' : '注册'}
          </Button>
        </Form>
      </div>
    </div>
  )
}

export default LoginPage
