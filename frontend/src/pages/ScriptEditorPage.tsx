import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Layout, Typography, Input, InputNumber, Select, Button, Spin, message, Empty } from 'antd'
import { ArrowLeftOutlined, BulbOutlined, FileTextOutlined, ScissorOutlined } from '@ant-design/icons'
import { scriptApi, Outline, ScriptSegment, TopicCard } from '../services/api'

const { Content } = Layout
const { Title } = Typography
const { TextArea } = Input

const STYLE_OPTIONS = ['干货', '热血', '亲和', '犀利', '轻松']
const ROLE_LABEL: Record<string, string> = { hook: '开头钩子', body: '正文', cta: '结尾号召' }

/**
 * 文案编辑页（阶段2）：选题 → 大纲 → 分镜文案，全部可编辑。
 * 选题从热点页通过 router state 传入；也可直接手填标题从零创作。
 */
const ScriptEditorPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const passedTopic = (location.state as { topic?: TopicCard } | null)?.topic

  const [title, setTitle] = useState(passedTopic?.title || '')
  const [angle, setAngle] = useState(passedTopic?.angle || '')
  const [audience, setAudience] = useState(passedTopic?.target_audience || '')
  const [keywords] = useState<string[]>(passedTopic?.keywords || [])
  const [duration, setDuration] = useState(60)
  const [style, setStyle] = useState('干货')

  const [outline, setOutline] = useState<Outline | null>(null)
  const [segments, setSegments] = useState<ScriptSegment[]>([])
  const [loadingOutline, setLoadingOutline] = useState(false)
  const [loadingScript, setLoadingScript] = useState(false)

  const handleGenerateOutline = async () => {
    if (!title.trim()) {
      message.warning('请填写选题标题')
      return
    }
    setLoadingOutline(true)
    try {
      const res = await scriptApi.generateOutline({
        title: title.trim(), angle, target_audience: audience, keywords, duration,
      })
      setOutline(res)
      setSegments([])
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '生成大纲失败')
    } finally {
      setLoadingOutline(false)
    }
  }

  const handleGenerateScript = async () => {
    if (!outline) {
      message.warning('请先生成大纲')
      return
    }
    setLoadingScript(true)
    try {
      const res = await scriptApi.generateScript({ title: title.trim(), outline, style, duration })
      setSegments(res)
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '生成文案失败')
    } finally {
      setLoadingScript(false)
    }
  }

  // —— 大纲的就地编辑 ——
  const updateHook = (v: string) => outline && setOutline({ ...outline, hook: v })
  const updateCta = (v: string) => outline && setOutline({ ...outline, cta: v })
  const updateSection = (i: number, field: 'point' | 'detail', v: string) => {
    if (!outline) return
    const sections = outline.sections.map((s, idx) => (idx === i ? { ...s, [field]: v } : s))
    setOutline({ ...outline, sections })
  }

  // —— 分镜的就地编辑 ——
  const updateSegment = (i: number, field: keyof ScriptSegment, v: any) => {
    setSegments((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: v } : s)))
  }

  // 带着文案去首页上传视频（选题驱动切片）
  const handleUseForClip = () => {
    if (!outline) {
      message.warning('请先生成大纲')
      return
    }
    const script = { title: title.trim(), outline, segments }
    navigate('/', { state: { attachedScript: JSON.stringify(script) } })
  }

  const totalSeconds = segments.reduce((sum, s) => sum + (s.est_seconds || 0), 0)

  const boxStyle: React.CSSProperties = {
    background: 'var(--ac-card)',
    border: '1px solid var(--ac-line)',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: 'var(--ac-shadow)',
  }
  const labelStyle: React.CSSProperties = { fontSize: '12px', color: 'var(--ac-sub)', marginBottom: '4px', display: 'block' }

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--ac-bg)' }}>
      <Content style={{ padding: '32px 56px 56px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* 顶部 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/hotspots')}
              style={{ color: 'var(--ac-sub)', borderRadius: '999px' }}>返回热点</Button>
            <Title level={2} style={{ margin: 0, color: 'var(--ac-ink)', fontSize: '20px', fontWeight: 600 }}>
              大纲 + 文案
            </Title>
            <Button
              type="text"
              icon={<ScissorOutlined />}
              onClick={handleUseForClip}
              disabled={segments.length === 0}
              style={{
                marginLeft: 'auto',
                height: '36px',
                borderRadius: '999px',
                border: '1px solid var(--ac-line)',
                background: 'var(--ac-card)',
                color: segments.length ? 'var(--ac-ink)' : 'var(--ac-muted)',
              }}
            >
              用这个文案剪视频 →
            </Button>
          </div>

          {/* 选题信息 + 参数 */}
          <div style={{ ...boxStyle, marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>选题标题 *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="选题标题" size="large" />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ flex: '2 1 260px' }}>
                <label style={labelStyle}>切入角度</label>
                <Input value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="这条视频具体讲什么" />
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <label style={labelStyle}>目标观众</label>
                <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="做给谁看" />
              </div>
              <div style={{ flex: '0 1 120px' }}>
                <label style={labelStyle}>时长(秒)</label>
                <InputNumber min={10} max={600} value={duration} onChange={(v) => setDuration(v || 60)} style={{ width: '100%' }} />
              </div>
              <div style={{ flex: '0 1 120px' }}>
                <label style={labelStyle}>风格</label>
                <Select value={style} onChange={setStyle} style={{ width: '100%' }}
                  options={STYLE_OPTIONS.map((s) => ({ label: s, value: s }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button icon={<BulbOutlined />} onClick={handleGenerateOutline} loading={loadingOutline}
                style={{ height: '38px', borderRadius: '10px', border: '1px solid var(--ac-line)' }}>
                生成大纲
              </Button>
              <Button type="primary" icon={<FileTextOutlined />} onClick={handleGenerateScript} loading={loadingScript} disabled={!outline}
                style={{ height: '38px', borderRadius: '10px', background: 'var(--ac-cta-bg)', borderColor: 'var(--ac-cta-bg)', color: 'var(--ac-cta-fg)' }}>
                生成文案
              </Button>
            </div>
          </div>

          {/* 左右两栏：大纲 | 分镜文案 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 5fr) minmax(360px, 7fr)', gap: '20px', alignItems: 'start' }}>
            {/* 左：大纲 */}
            <div style={boxStyle}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ac-ink)', marginBottom: '14px' }}>大纲</div>
              {loadingOutline ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
              ) : outline ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={labelStyle}>🎣 开头钩子</label>
                    <TextArea value={outline.hook} onChange={(e) => updateHook(e.target.value)} autoSize={{ minRows: 2 }} />
                  </div>
                  <div>
                    <label style={labelStyle}>正文要点</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {outline.sections.map((s, i) => (
                        <div key={i} style={{ border: '1px solid var(--ac-line)', borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <Input value={s.point} onChange={(e) => updateSection(i, 'point', e.target.value)} placeholder={`要点 ${i + 1}`} variant="borderless" style={{ fontWeight: 600, padding: 0 }} />
                          <TextArea value={s.detail} onChange={(e) => updateSection(i, 'detail', e.target.value)} autoSize={{ minRows: 1 }} placeholder="展开一句" variant="borderless" style={{ padding: 0, color: 'var(--ac-sub)' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>📢 结尾号召</label>
                    <TextArea value={outline.cta} onChange={(e) => updateCta(e.target.value)} autoSize={{ minRows: 2 }} />
                  </div>
                </div>
              ) : (
                <Empty description="点击「生成大纲」" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>

            {/* 右：分镜文案 */}
            <div style={boxStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ac-ink)' }}>分镜文案</span>
                {segments.length > 0 && (
                  <span style={{ fontSize: '12px', color: 'var(--ac-muted)' }}>{segments.length} 段 · 约 {totalSeconds} 秒</span>
                )}
              </div>
              {loadingScript ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /><div style={{ marginTop: 12, color: 'var(--ac-muted)', fontSize: 13 }}>AI 正在写文案…</div></div>
              ) : segments.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {segments.map((s, i) => (
                    <div key={i} style={{ border: '1px solid var(--ac-line)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--ac-muted)' }}>
                        <span style={{ background: 'var(--ac-line-2)', borderRadius: '999px', padding: '1px 8px', color: 'var(--ac-sub)' }}>#{s.index}</span>
                        <span>{ROLE_LABEL[s.role] || s.role}</span>
                        <span style={{ marginLeft: 'auto' }}>
                          <InputNumber size="small" min={0} value={s.est_seconds} onChange={(v) => updateSegment(i, 'est_seconds', v || 0)} style={{ width: 64 }} /> 秒
                        </span>
                      </div>
                      <TextArea value={s.narration} onChange={(e) => updateSegment(i, 'narration', e.target.value)} autoSize={{ minRows: 2 }} placeholder="口播文案" />
                      <Input value={s.visual} onChange={(e) => updateSegment(i, 'visual', e.target.value)} placeholder="🎬 画面建议" variant="borderless" style={{ padding: 0, fontSize: '12px', color: 'var(--ac-sub)' }} />
                    </div>
                  ))}
                </div>
              ) : (
                <Empty description="生成大纲后，点「生成文案」" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </div>
        </div>
      </Content>
    </Layout>
  )
}

export default ScriptEditorPage
