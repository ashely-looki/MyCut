import React, { useState, useEffect } from 'react'
import { Layout, Card, Typography, Alert, Row, Col, message, Switch } from 'antd'
import { SettingOutlined, PoweroffOutlined } from '@ant-design/icons'
import { isDesktopMode } from '../utils/desktopMode'
import { isAnalyticsEnabled, setAnalyticsEnabled } from '../analytics/posthog'
import './SettingsPage.css'

const { Content } = Layout
const { Title, Text, Paragraph } = Typography

/**
 * 系统设置（普通用户）
 *
 * 只保留「应用设置」——开机自启、隐私/匿名统计开关这类每个用户自己可控的项。
 * AI 模型配置、语音转写配置是全局共享的（DeepSeek Key 等），已移到管理者后台 /admin，
 * 只有管理员能改，见 components/AiModelConfig 与 AdminPage。
 */
const SettingsPage: React.FC = () => {
  const [analyticsOn, setAnalyticsOn] = useState(isAnalyticsEnabled())

  return (
    <Content className="settings-page">
      <div className="settings-container">
        <Title level={2} className="settings-title">
          <SettingOutlined /> 系统设置
        </Title>

        <Card title="应用设置" className="settings-card">
          <Alert
            message="应用行为配置"
            description="配置应用的启动行为和系统集成选项。"
            type="info"
            showIcon
            className="settings-alert"
          />

          <AppSettings />
        </Card>

        <Card title="隐私与数据" className="settings-card" style={{ marginTop: 16 }}>
          <Alert
            message="使用数据统计"
            description="为了改进产品，我们会采集匿名的使用数据（如功能使用、出片成功/失败等），不包含你的视频内容、字幕文本或 API 密钥。你可以随时关闭。"
            type="info"
            showIcon
            className="settings-alert"
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
            <div>
              <Text strong>允许匿名使用统计</Text>
              <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                关闭后将不再上报任何使用数据。
              </Paragraph>
            </div>
            <Switch
              checked={analyticsOn}
              onChange={(checked) => {
                setAnalyticsEnabled(checked)
                setAnalyticsOn(checked)
                message.success(checked ? '已开启匿名使用统计' : '已关闭匿名使用统计')
              }}
            />
          </div>
        </Card>
      </div>
    </Content>
  )
}

// 应用设置组件
const AppSettings: React.FC = () => {
  const [autostartEnabled, setAutostartEnabled] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkAutostartStatus()
  }, [])

  const checkAutostartStatus = async () => {
    try {
      const isDesktop = await isDesktopMode()
      if (isDesktop) {
        const { invoke } = await import('@tauri-apps/api/core')
        const enabled = await invoke('is_autostart_enabled')
        setAutostartEnabled(Boolean(enabled))
      }
    } catch (error) {
      console.error('检查自动启动状态失败:', error)
    }
  }

  const handleAutostartToggle = async (enabled: boolean) => {
    const isDesktop = await isDesktopMode()
    if (!isDesktop) {
      message.error('此功能仅在桌面应用中可用')
      return
    }

    setLoading(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      
      if (enabled) {
        await invoke('enable_autostart')
        message.success('已启用自动启动')
      } else {
        await invoke('disable_autostart')
        message.success('已禁用自动启动')
      }
      
      setAutostartEnabled(enabled)
    } catch (error) {
      console.error('切换自动启动状态失败:', error)
      message.error(`操作失败: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card 
            size="small" 
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid #404040',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <PoweroffOutlined style={{ color: '#E8710A', marginRight: '8px' }} />
                  <Text strong style={{ color: 'var(--ac-ink)' }}>开机自动启动</Text>
                </div>
                <Text type="secondary" style={{ color: '#b0b0b0' }}>
                  启用后，应用将在系统启动时自动运行
                </Text>
              </div>
              <Switch
                checked={autostartEnabled}
                onChange={handleAutostartToggle}
                loading={loading}
                checkedChildren="开启"
                unCheckedChildren="关闭"
              />
            </div>
          </Card>
        </Col>
      </Row>
      
      <Alert
        message="提示"
        description="自动启动功能仅在桌面应用中可用。启用后，应用将在系统启动时自动运行，您可以通过系统托盘图标访问应用。"
        type="info"
        showIcon
        style={{ marginTop: '16px' }}
      />
    </div>
  )
}

export default SettingsPage
