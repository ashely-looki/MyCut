import React, { useState } from 'react'
import { Input, InputNumber, Select, Button, Spin, message } from 'antd'
import { SearchOutlined, BulbOutlined, FileTextOutlined, SaveOutlined, ScissorOutlined } from '@ant-design/icons'
import TopicCard from './TopicCard'
import { hotspotApi, scriptApi, TopicCard as TopicCardData, Outline, ScriptSegment } from '../services/api'

const STYLE_OPTIONS = ['干货', '热血', '亲和', '犀利', '轻松']
const ROLE_LABEL: Record<string, string> = { hook: '开头钩子', body: '正文', cta: '结尾号召' }

const { TextArea } = Input

interface HotspotPanelProps {
  /** 「用这个文案剪视频」：把文案交给外部（首页）用于上传关联 */
  onUseForClip?: (scriptJson: string) => void
}

/**
 * 热点选题 + 就地生成文案 面板（可嵌入首页列）。
 * 流程：查热点 → 点选题卡片「生成文案」→ 卡片下方就地展开大纲+分镜文案（可编辑）
 *       → 保存到文案库 / 用这个文案剪视频。
 */
const HotspotPanel: React.FC<HotspotPanelProps> = ({ onUseForClip }) => {
  // —— 查热点 ——
  const [domain, setDomain] = useState('')
  const [keywords, setKeywords] = useState('')
  const [count, setCount] = useState(5)
  const [searching, setSearching] = useState(false)
  const [topics, setTopics] = useState<TopicCardData[]>([])
  const [meta, setMeta] = useState<{ search_available: boolean } | null>(null)

  // —— 就地文案编辑（针对当前选中的选题）——
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null)
  const [duration, setDuration] = useState(60)
  const [style, setStyle] = useState('干货')
  const [outline, setOutline] = useState<Outline | null>(null)
  const [segments, setSegments] = useState<ScriptSegment[]>([])
  const [scriptId, setScriptId] = useState<string | null>(null)
  const [loadingOutline, setLoadingOutline] = useState(false)
  const [loadingScript, setLoadingScript] = useState(false)
  const [saving, setSaving] = useState(false)

  const activeTopic = topics.find((t) => t.id === activeTopicId) || null

  const handleSearch = async () => {
    if (!domain.trim()) {
      message.warning('请输入领域方向')
      return
    }
    setSearching(true)
    setActiveTopicId(null); setOutline(null); setSegments([]); setScriptId(null)
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

  // 选中一个选题 → 展开文案编辑（重置该选题的文案状态）
  const handlePickTopic = (topic: TopicCardData) => {
    if (activeTopicId === topic.id) {
      setActiveTopicId(null)  // 再点一次收起
      return
    }
    setActiveTopicId(topic.id)
    setOutline(null); setSegments([]); setScriptId(null)
  }

  const handleGenerateOutline = async () => {
    if (!activeTopic) return
    setLoadingOutline(true)
    try {
      const res = await scriptApi.generateOutline({
        title: activeTopic.title, angle: activeTopic.angle,
        target_audience: activeTopic.target_audience, keywords: activeTopic.keywords, duration,
      })
      setOutline(res); setSegments([])
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '生成大纲失败')
    } finally {
      setLoadingOutline(false)
    }
  }

  const handleGenerateScript = async () => {
    if (!activeTopic || !outline) { message.warning('请先生成大纲'); return }
    setLoadingScript(true)
    try {
      const res = await scriptApi.generateScript({ title: activeTopic.title, outline, style, duration })
      setSegments(res)
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '生成文案失败')
    } finally {
      setLoadingScript(false)
    }
  }

  const buildPayload = () => ({
    title: activeTopic?.title || '未命名文案',
    domain, angle: activeTopic?.angle, target_audience: activeTopic?.target_audience,
    keywords: activeTopic?.keywords || [],
    outline: outline || { hook: '', sections: [], cta: '' },
    segments, style, est_duration: duration,
  })

  const handleSave = async () => {
    if (!outline) { message.warning('请先生成大纲再保存'); return }
    setSaving(true)
    try {
      if (scriptId) {
        await scriptApi.update(scriptId, buildPayload()); message.success('已更新到文案库')
      } else {
        const created = await scriptApi.save(buildPayload()); setScriptId(created.id)
        message.success('已保存到文案库')
      }
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleUseForClip = () => {
    if (!outline || !activeTopic) return
    const script = { title: activeTopic.title, outline, segments }
    onUseForClip?.(JSON.stringify(script))
  }

  const updateSection = (i: number, field: 'point' | 'detail', v: string) => {
    if (!outline) return
    setOutline({ ...outline, sections: outline.sections.map((s, idx) => idx === i ? { ...s, [field]: v } : s) })
  }
  const updateSegment = (i: number, field: keyof ScriptSegment, v: any) =>
    setSegments((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: v } : s))

  const labelStyle: React.CSSProperties = { fontSize: '12px', color: 'var(--ac-sub)' }
  const totalSeconds = segments.reduce((sum, s) => sum + (s.est_seconds || 0), 0)

  // —— 就地文案编辑区（展开在选中卡片下方）——
  const renderEditor = () => (
    <div style={{
      border: '1px solid var(--ac-accent)', borderRadius: '14px', padding: '16px',
      background: 'var(--ac-card)', display: 'flex', flexDirection: 'column', gap: '14px',
    }}>
      {/* 参数 + 生成按钮 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
        <div style={{ flex: '0 1 110px' }}>
          <div style={labelStyle}>时长(秒)</div>
          <InputNumber min={10} max={600} value={duration} onChange={(v) => setDuration(v || 60)} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: '0 1 120px' }}>
          <div style={labelStyle}>风格</div>
          <Select value={style} onChange={setStyle} style={{ width: '100%' }} options={STYLE_OPTIONS.map((s) => ({ label: s, value: s }))} />
        </div>
        <Button icon={<BulbOutlined />} onClick={handleGenerateOutline} loading={loadingOutline}
          style={{ borderRadius: '8px', border: '1px solid var(--ac-line)' }}>生成大纲</Button>
        <Button type="primary" icon={<FileTextOutlined />} onClick={handleGenerateScript} loading={loadingScript} disabled={!outline}
          style={{ borderRadius: '8px', background: 'var(--ac-cta-bg)', borderColor: 'var(--ac-cta-bg)', color: 'var(--ac-cta-fg)' }}>生成文案</Button>
      </div>

      {/* 大纲 */}
      {loadingOutline ? <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div> : outline && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <div style={labelStyle}>🎣 开头钩子</div>
            <TextArea value={outline.hook} onChange={(e) => setOutline({ ...outline, hook: e.target.value })} autoSize={{ minRows: 2 }} />
          </div>
          {outline.sections.map((s, i) => (
            <div key={i} style={{ border: '1px solid var(--ac-line)', borderRadius: '8px', padding: '8px' }}>
              <Input value={s.point} onChange={(e) => updateSection(i, 'point', e.target.value)} variant="borderless" style={{ fontWeight: 600, padding: 0 }} placeholder={`要点 ${i + 1}`} />
              <TextArea value={s.detail} onChange={(e) => updateSection(i, 'detail', e.target.value)} variant="borderless" autoSize style={{ padding: 0, color: 'var(--ac-sub)' }} placeholder="展开" />
            </div>
          ))}
          <div>
            <div style={labelStyle}>📢 结尾号召</div>
            <TextArea value={outline.cta} onChange={(e) => setOutline({ ...outline, cta: e.target.value })} autoSize={{ minRows: 1 }} />
          </div>
        </div>
      )}

      {/* 分镜文案 */}
      {loadingScript ? <div style={{ textAlign: 'center', padding: '20px' }}><Spin /><div style={{ marginTop: 8, fontSize: 13, color: 'var(--ac-muted)' }}>AI 正在写文案…</div></div> : segments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '12px', color: 'var(--ac-muted)' }}>分镜文案 · {segments.length} 段 · 约 {totalSeconds} 秒</div>
          {segments.map((s, i) => (
            <div key={i} style={{ border: '1px solid var(--ac-line)', borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--ac-muted)' }}>
                <span style={{ background: 'var(--ac-line-2)', borderRadius: '999px', padding: '1px 8px', color: 'var(--ac-sub)' }}>#{s.index}</span>
                <span>{ROLE_LABEL[s.role] || s.role}</span>
                <span style={{ marginLeft: 'auto' }}><InputNumber size="small" min={0} value={s.est_seconds} onChange={(v) => updateSegment(i, 'est_seconds', v || 0)} style={{ width: 60 }} /> 秒</span>
              </div>
              <TextArea value={s.narration} onChange={(e) => updateSegment(i, 'narration', e.target.value)} autoSize={{ minRows: 2 }} placeholder="口播文案" />
              <Input value={s.visual} onChange={(e) => updateSegment(i, 'visual', e.target.value)} variant="borderless" style={{ padding: 0, fontSize: '12px', color: 'var(--ac-sub)' }} placeholder="🎬 画面建议" />
            </div>
          ))}
        </div>
      )}

      {/* 保存 / 用文案剪视频 —— 生成大纲后即可保存 */}
      {outline && (
        <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--ac-line)', paddingTop: '12px' }}>
          <Button icon={<SaveOutlined />} onClick={handleSave} loading={saving}
            style={{ borderRadius: '999px', border: '1px solid var(--ac-line)' }}>
            {scriptId ? '更新到文案库' : '保存到文案库'}
          </Button>
          <Button type="primary" icon={<ScissorOutlined />} onClick={handleUseForClip} disabled={segments.length === 0}
            style={{ borderRadius: '999px', background: 'var(--ac-cta-bg)', borderColor: 'var(--ac-cta-bg)', color: 'var(--ac-cta-fg)' }}>
            用这个文案剪视频 →
          </Button>
        </div>
      )}
    </div>
  )

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
            <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <TopicCard topic={t} active={activeTopicId === t.id} onUse={handlePickTopic} />
              {activeTopicId === t.id && renderEditor()}
            </div>
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
