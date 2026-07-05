import React, { useState } from 'react'
import { Layout, Typography, Input, InputNumber, Button, Spin, Empty, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import TopicCard from '../components/TopicCard'
import { hotspotApi, TopicCard as TopicCardData } from '../services/api'

const { Content } = Layout
const { Title, Text } = Typography

/**
 * 热点选题页（阶段1）：输入领域/关键词 → AI 联网查热点 → 选题卡片。
 * 无 Bing key 时后端会降级为纯 LLM 生成（页面会提示未联网校验）。
 */
const HotspotPage: React.FC = () => {
  const [domain, setDomain] = useState('')
  const [keywords, setKeywords] = useState('')
  const [count, setCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [topics, setTopics] = useState<TopicCardData[]>([])
  const [meta, setMeta] = useState<{ searched: boolean; search_available: boolean } | null>(null)

  const handleSearch = async () => {
    if (!domain.trim()) {
      message.warning('请输入领域方向')
      return
    }
    setLoading(true)
    try {
      const res = await hotspotApi.search({ domain: domain.trim(), keywords: keywords.trim(), count })
      setTopics(res.topics || [])
      setMeta({ searched: res.searched, search_available: res.search_available })
      if (!res.topics?.length) message.info('没有生成选题，换个领域再试试')
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '查热点失败，请检查后端与 LLM 配置')
    } finally {
      setLoading(false)
    }
  }

  const handleUse = (topic: TopicCardData) => {
    // 阶段2 将跳转到文案编辑页；当前先提示
    message.info(`已选中选题：${topic.title}（文案生成将在阶段2接入）`)
  }

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--ac-bg)' }}>
      <Content style={{ padding: '40px 56px 56px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* 标题 */}
          <div style={{ marginBottom: '24px', marginTop: '12px' }}>
            <Title level={2} style={{ margin: 0, color: 'var(--ac-ink)', fontSize: '20px', fontWeight: 600 }}>
              AI 查热点
            </Title>
            <Text style={{ color: 'var(--ac-muted)', fontSize: '13px' }}>
              输入领域，AI 帮你找当下值得做的短视频选题
            </Text>
          </div>

          {/* 输入区 */}
          <div
            style={{
              background: 'var(--ac-card)',
              border: '1px solid var(--ac-line)',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: 'var(--ac-shadow)',
              marginBottom: '32px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'flex-end',
            }}
          >
            <div style={{ flex: '2 1 260px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Text style={{ fontSize: '12px', color: 'var(--ac-sub)' }}>领域方向 *</Text>
              <Input
                placeholder="如：AI工具 / 普通人副业 / 职场成长"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onPressEnter={handleSearch}
                size="large"
              />
            </div>
            <div style={{ flex: '2 1 220px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Text style={{ fontSize: '12px', color: 'var(--ac-sub)' }}>补充关键词（可选）</Text>
              <Input
                placeholder="逗号分隔，如：AI视频, 自动剪辑"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                onPressEnter={handleSearch}
                size="large"
              />
            </div>
            <div style={{ flex: '0 1 100px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Text style={{ fontSize: '12px', color: 'var(--ac-sub)' }}>数量</Text>
              <InputNumber min={1} max={15} value={count} onChange={(v) => setCount(v || 5)} size="large" style={{ width: '100%' }} />
            </div>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearch}
              loading={loading}
              size="large"
              style={{ height: '40px', borderRadius: '10px', background: 'var(--ac-cta-bg)', borderColor: 'var(--ac-cta-bg)', color: 'var(--ac-cta-fg)' }}
            >
              查热点
            </Button>
          </div>

          {/* 联网状态提示 */}
          {meta && !meta.search_available && (
            <div style={{ marginBottom: '20px', fontSize: '12px', color: 'var(--ac-muted)' }}>
              未配置 Bing 联网搜索，当前选题为 AI 基于领域常识生成（未联网校验）。配置 BING_SEARCH_KEY 后将更贴合实时热点。
            </div>
          )}

          {/* 结果区 */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '72px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: '18px', color: 'var(--ac-muted)', fontSize: '14px' }}>AI 正在查找热点选题…</div>
            </div>
          ) : topics.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '20px',
              }}
            >
              {topics.map((t) => (
                <TopicCard key={t.id} topic={t} onUse={handleUse} />
              ))}
            </div>
          ) : (
            <Empty description="输入领域后点击「查热点」" style={{ padding: '48px 0' }} />
          )}
        </div>
      </Content>
    </Layout>
  )
}

export default HotspotPage
