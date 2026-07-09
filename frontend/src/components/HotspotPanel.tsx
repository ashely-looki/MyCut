import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input, InputNumber, Button, Spin, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import TopicCard from './TopicCard'
import { hotspotApi, TopicCard as TopicCardData } from '../services/api'

/**
 * 热点选题面板：查热点 → 列出选题卡片。
 * 点某个选题卡片「生成文案」→ 跳转到文案编辑页（/script），
 * 生成大纲 / 生成文案 / 保存 / 用它剪视频 都在那个独立页面完成。
 */
const HotspotPanel: React.FC = () => {
  const navigate = useNavigate()
  const [domain, setDomain] = useState('')
  const [keywords, setKeywords] = useState('')
  const [count, setCount] = useState(5)
  const [searching, setSearching] = useState(false)
  const [topics, setTopics] = useState<TopicCardData[]>([])
  const [meta, setMeta] = useState<{ search_available: boolean } | null>(null)

  const handleSearch = async () => {
    if (!domain.trim()) {
      message.warning('请输入领域方向')
      return
    }
    setSearching(true)
    try {
      const res = await hotspotApi.search({ domain: domain.trim(), keywords: keywords.trim(), count })
      setTopics(res.topics || [])
      setMeta({ search_available: res.search_available })
      if (!res.topics?.length) message.info('没有生成选题，换个领域再试试')
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '查热点失败，请检查后端与 LLM 配置')
    } finally {
      setSearching(false)
    }
  }

  // 选中选题 → 跳到文案编辑页，把选题带过去（那边生成大纲/文案）
  const handlePickTopic = (topic: TopicCardData) => {
    navigate('/script', { state: { topic } })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 搜索区 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Input placeholder="领域方向，如：AI工具 / 普通人副业" value={domain} onChange={(e) => setDomain(e.target.value)} onPressEnter={handleSearch} size="large" />
        <div style={{ display: 'flex', gap: '8px' }}>
          <Input placeholder="关键词(可选)" value={keywords} onChange={(e) => setKeywords(e.target.value)} onPressEnter={handleSearch} />
          <InputNumber min={1} max={15} value={count} onChange={(v) => setCount(v || 5)} style={{ width: 80 }} />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={searching}
            style={{ borderRadius: '10px', background: 'var(--ac-cta-bg)', borderColor: 'var(--ac-cta-bg)', color: 'var(--ac-cta-fg)' }}>查热点</Button>
        </div>
      </div>

      {meta && !meta.search_available && (
        <div style={{ fontSize: '12px', color: 'var(--ac-muted)' }}>
          未配置 Bing，选题为 AI 基于领域常识生成（未联网校验）。
        </div>
      )}

      {/* 结果 */}
      {searching ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin size="large" /><div style={{ marginTop: 14, color: 'var(--ac-muted)', fontSize: 13 }}>AI 正在查找选题…</div></div>
      ) : topics.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {topics.map((t) => (
            <TopicCard key={t.id} topic={t} onUse={handlePickTopic} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '48px 0' }}>
          <SearchOutlined style={{ fontSize: '40px', color: 'var(--ac-muted)' }} />
          <div style={{ fontSize: '14px', color: 'var(--ac-sub)' }}>AI 查热点，选题就地出文案</div>
        </div>
      )}
    </div>
  )
}

export default HotspotPanel
