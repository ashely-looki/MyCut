import React from 'react'
import { Layout, Button, Dropdown, message } from 'antd'
import type { MenuProps } from 'antd'
import { SettingOutlined, ArrowLeftOutlined, BulbOutlined, MoonOutlined, FileTextOutlined, UserOutlined, LogoutOutlined, CrownOutlined, DashboardOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

const { Header: AntHeader } = Layout

// Calm Premium header — see DESIGN.md
const Header: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const isHomePage = location.pathname === '/'
  const { theme, toggleTheme } = useTheme()
  const { authEnabled, user, isAdmin, signOut } = useAuth()

  const handleLogout = async () => {
    try {
      await signOut()
      message.success('已退出登录')
    } catch {
      message.error('退出登录失败，请重试')
    }
  }

  const userMenu: MenuProps['items'] = [
    { key: 'email', label: user?.email ?? '', disabled: true },
    { type: 'divider' },
    { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: handleLogout },
  ]

  return (
    <AntHeader
      style={{
        padding: '0 56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '64px',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backdropFilter: 'blur(10px)',
        background: 'color-mix(in srgb, var(--ac-bg) 78%, transparent)',
        borderBottom: '1px solid var(--ac-line-2)',
      }}
    >
      {/* Wordmark — serif, italic "Clip" */}
      <div
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => navigate('/')}
      >
        <span
          style={{
            fontFamily: 'var(--ac-font-serif)',
            fontSize: '30px',
            color: 'var(--ac-ink)',
            letterSpacing: '1px',
          }}
        >
          My<em style={{ fontStyle: 'italic' }}>Cut</em>
        </span>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {!isHomePage && (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
            style={{ color: 'var(--ac-sub)', height: '36px', borderRadius: '999px' }}
          >
            返回
          </Button>
        )}
        <Button
          type="text"
          className="glass-btn"
          icon={theme === 'dark' ? <BulbOutlined /> : <MoonOutlined />}
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
          title={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
          style={{
            color: 'var(--ac-sub)',
            borderRadius: '999px',
            width: '36px',
            height: '36px',
            padding: 0,
          }}
        />
        <Button
          type="text"
          className="glass-btn"
          icon={<FileTextOutlined />}
          onClick={() => navigate('/scripts')}
          style={{
            color: location.pathname === '/scripts' ? 'var(--ac-accent)' : 'var(--ac-sub)',
            borderRadius: '999px',
            height: '36px',
            padding: '0 16px',
          }}
        >
          文案库
        </Button>
        <Button
          type="text"
          className="glass-btn"
          icon={<CrownOutlined />}
          onClick={() => navigate('/membership')}
          style={{
            color: location.pathname === '/membership' ? 'var(--ac-accent)' : 'var(--ac-sub)',
            borderRadius: '999px',
            height: '36px',
            padding: '0 16px',
          }}
        >
          会员
        </Button>
        {isAdmin && (
          <Button
            type="text"
            className="glass-btn"
            icon={<DashboardOutlined />}
            onClick={() => navigate('/admin')}
            style={{
              color: location.pathname === '/admin' ? 'var(--ac-accent)' : 'var(--ac-sub)',
              borderRadius: '999px',
              height: '36px',
              padding: '0 16px',
            }}
          >
            后台
          </Button>
        )}
        <Button
          type="text"
          className="glass-btn"
          icon={<SettingOutlined />}
          onClick={() => navigate('/settings')}
          style={{
            color: 'var(--ac-sub)',
            borderRadius: '999px',
            height: '36px',
            padding: '0 16px',
          }}
        >
          设置
        </Button>
        {authEnabled && user && (
          <Dropdown menu={{ items: userMenu }} placement="bottomRight" trigger={['click']}>
            <Button
              type="text"
              className="glass-btn"
              icon={<UserOutlined />}
              aria-label="账号"
              title={user.email ?? '账号'}
              style={{
                color: 'var(--ac-sub)',
                borderRadius: '999px',
                width: '36px',
                height: '36px',
                padding: 0,
              }}
            />
          </Dropdown>
        )}
      </div>
    </AntHeader>
  )
}

export default Header
