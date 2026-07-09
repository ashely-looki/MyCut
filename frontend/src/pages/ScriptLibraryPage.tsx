import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout, Typography, Button, Spin, Empty, Popconfirm, message } from 'antd'
import { EditOutlined, ScissorOutlined, DeleteOutlined, PlusOutlined, VideoCameraOutlined } from '@ant-design/icons'
import { scriptApi, composeApi, SavedScript } from '../services/api'

const { Content } = Layout
const { Title, Text } = Typography

/**
 * 我的文案（阶段: 文案保存）。
 * 列出已存文案，每篇可：编辑 / 用它剪视频（带文案去上传）/ 删除。
 */
const ScriptLibraryPage: React.FC = () => {
  const navigate = useNavigate()
  const [scripts, setScripts] = useState<SavedScript[]>([])
  const [loading, setLoading] = useState(true)
  // 正在启动成片的文案 id（按钮 loading）
  const [composingId, setComposingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setScripts(await scriptApi.list())
    } catch {
      message.error('加载文案列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleEdit = (s: SavedScript) => navigate('/script', { state: { savedScript: s } })

  const handleUseForClip = (s: SavedScript) => {
    const script = { title: s.title, outline: s.outline, segments: s.segments }
    navigate('/', { state: { attachedScript: JSON.stringify(script) } })
  }

  // 自动成片：文案 → 配音 + 逐句字幕 → 项目库出片
  const handleCompose = async (s: SavedScript) => {
    if (!s.segments?.length) {
      message.warning('这篇文案还没有分镜内容，无法生成视频')
      return
    }
    setComposingId(s.id)
    try {
      const ready = await composeApi.ready()
      if (!ready.ready) {
        message.warning(ready.hint || '自动成片依赖未就绪')
        return
      }
      await composeApi.fromScript(s.id)
      message.success('已开始生成视频，去首页看进度')
      navigate('/')
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '启动生成视频失败')
    } finally {
      setComposingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await scriptApi.remove(id)
      message.success('已删除')
      setScripts((prev) => prev.filter((x) => x.id !== id))
    } catch {
      message.error('删除失败')
    }
  }

  const boxStyle: React.CSSProperties = {
    background: 'var(--ac-card)', border: '1px solid var(--ac-line)',
    borderRadius: '16px', padding: '18px', boxShadow: 'var(--ac-shadow)',
    display: 'flex', flexDirection: 'column', gap: '10px',
  }

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--ac-bg)' }}>
      <Content style={{ padding: '40px 56px 56px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* 标题 */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '24px', marginTop: '12px' }}>
            <Title level={2} style={{ margin: 0, color: 'var(--ac-ink)', fontSize: '20px', fontWeight: 600 }}>
              我的文案
            </Title>
            <Text style={{ color: 'var(--ac-muted)', fontSize: '13px' }}>{scripts.length}</Text>
            <Button
              type="text" icon={<PlusOutlined />} onClick={() => navigate('/script')}
              style={{ marginLeft: 'auto', height: '36px', borderRadius: '999px', border: '1px solid var(--ac-line)', background: 'var(--ac-card)', color: 'var(--ac-ink)' }}
            >
              新建文案
            </Button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '72px 0' }}><Spin size="large" /></div>
          ) : scripts.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {scripts.map((s) => (
                <div key={s.id} style={boxStyle}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ac-ink)', lineHeight: 1.4 }}>{s.title}</div>
                  {s.outline?.hook && (
                    <div style={{ fontSize: '13px', color: 'var(--ac-sub)', lineHeight: 1.5 }}>🎣 {s.outline.hook}</div>
                  )}
                  <div style={{ fontSize: '12px', color: 'var(--ac-muted)', display: 'flex', gap: '12px' }}>
                    <span>{s.segments?.length || 0} 段</span>
                    {s.est_duration ? <span>约 {s.est_duration} 秒</span> : null}
                    {s.style ? <span>{s.style}</span> : null}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '4px' }}>
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(s)}
                      style={{ borderRadius: '999px', border: '1px solid var(--ac-line)' }}>编辑</Button>
                    <Button size="small" icon={<ScissorOutlined />} onClick={() => handleUseForClip(s)}
                      style={{ borderRadius: '999px', border: '1px solid var(--ac-line)', color: 'var(--ac-ink)' }}>用它剪视频</Button>
                    <Button size="small" icon={<VideoCameraOutlined />} loading={composingId === s.id}
                      onClick={() => handleCompose(s)}
                      style={{ borderRadius: '999px', border: '1px solid var(--ac-line)', color: 'var(--ac-accent)' }}>生成视频</Button>
                    <Popconfirm title="删除这篇文案？" onConfirm={() => handleDelete(s.id)} okText="删除" cancelText="取消">
                      <Button size="small" type="text" icon={<DeleteOutlined />} danger style={{ marginLeft: 'auto', borderRadius: '999px' }} />
                    </Popconfirm>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty description="还没有保存的文案，去「热点」生成后保存" style={{ padding: '48px 0' }}>
              <Button type="primary" onClick={() => navigate('/hotspots')}
                style={{ background: 'var(--ac-cta-bg)', borderColor: 'var(--ac-cta-bg)', color: 'var(--ac-cta-fg)' }}>
                去查热点
              </Button>
            </Empty>
          )}
        </div>
      </Content>
    </Layout>
  )
}

export default ScriptLibraryPage
