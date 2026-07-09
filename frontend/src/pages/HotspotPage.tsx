import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout, Typography, Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import HotspotPanel from '../components/HotspotPanel'

const { Content } = Layout
const { Title, Text } = Typography

/**
 * 查热点全页：从首页入口卡片进入。
 * 完整流程都在这一页：查热点 → 生成大纲 → 生成文案 → 保存到文案库 / 用这个文案剪视频。
 */
const HotspotPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--ac-bg)' }}>
      <Content style={{ padding: '32px 56px 56px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {/* 顶部 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}
              style={{ color: 'var(--ac-sub)', borderRadius: '999px' }}>返回</Button>
            <Title level={2} style={{ margin: 0, color: 'var(--ac-ink)', fontSize: '20px', fontWeight: 600 }}>
              AI 查热点
            </Title>
          </div>
          <Text style={{ color: 'var(--ac-muted)', fontSize: '13px', display: 'block', marginBottom: '24px', paddingLeft: '4px' }}>
            输入领域找选题，点选题进入下一步生成大纲和文案
          </Text>

          {/* 查热点 → 选题卡片（点选题跳文案编辑页生成大纲/文案） */}
          <div style={{ background: 'var(--ac-card)', borderRadius: '16px', border: '1px solid var(--ac-line)', padding: '20px', boxShadow: 'var(--ac-shadow)' }}>
            <HotspotPanel />
          </div>
        </div>
      </Content>
    </Layout>
  )
}

export default HotspotPage
