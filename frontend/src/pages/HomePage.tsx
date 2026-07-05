import React, { useState, useEffect } from 'react'
import { 
  Layout, 
  Typography, 
  Select, 
  Spin, 
  Empty,
  message 
} from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { SearchOutlined, PlusOutlined } from '@ant-design/icons'
import ProjectCard from '../components/ProjectCard'
import FileUpload from '../components/FileUpload'

import { projectApi } from '../services/api'
import { useSimpleProgressStore } from '../stores/useSimpleProgressStore'
import { Project, useProjectStore } from '../store/useProjectStore'
import { useProjectPolling } from '../hooks/useProjectPolling'

const { Content } = Layout
const { Title, Text } = Typography
const { Option } = Select

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  // 关联文案（选题驱动模式）：可来自文案库「用它剪视频」(router state)，也可由本页热点面板就地生成后设置
  const initialAttached = (location.state as { attachedScript?: string } | null)?.attachedScript
  const [attachedScript, setAttachedScript] = useState<string | undefined>(initialAttached)
  const { projects, setProjects, deleteProject, loading, setLoading } = useProjectStore()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  // 右侧上传卡片：默认收起显示加号入口，hover 就地展开完整上传区
  const [uploadHovered, setUploadHovered] = useState(false)

  // 使用项目轮询Hook
  useProjectPolling({
    onProjectsUpdate: (updatedProjects) => {
      setProjects(updatedProjects || [])
    },
    enabled: true,
    interval: 30000 // 30秒轮询一次，减少频繁请求
  })

  // 全局保险：当没有运行中的项目时，强制停止进度轮询并清空缓存
  useEffect(() => {
    const hasActive = projects.some(p => p.status === 'processing' || p.status === 'pending')
    if (!hasActive) {
      try {
        const { stopPolling, clearAllProgress } = useSimpleProgressStore.getState()
        stopPolling()
        clearAllProgress()
        console.log('无运行项目，已全局停止进度轮询并清空进度缓存')
      } catch (e) {
        console.warn('停止全局进度轮询时出现问题:', e)
      }
    }
  }, [projects])

  useEffect(() => {
    // 延迟加载项目，避免启动时立即发起大量请求
    const timer = setTimeout(() => {
      loadProjects()
    }, 1000) // 延迟1秒加载
    
    return () => clearTimeout(timer)
  }, [])

  const loadProjects = async () => {
    setLoading(true)
    try {
      // 从后端API获取真实项目数据
      const projects = await projectApi.getProjects()
      // 确保projects是数组类型
      const safeProjects = Array.isArray(projects) ? projects : []
      setProjects(safeProjects)
    } catch (error) {
      message.error('加载项目失败')
      console.error('Load projects error:', error)
      // 如果API调用失败，设置空数组
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProject = async (id: string) => {
    try {
      await projectApi.deleteProject(id)
      deleteProject(id)
      message.success('项目删除成功')
    } catch (error) {
      message.error('删除项目失败')
      console.error('Delete project error:', error)
    }
  }

  // 由 ProjectCard 在「用户手动点重试」且重试请求已成功后调用。
  // ProjectCard.handleRetry 已经发过 start/retryProcessing 请求，这里只负责
  // 提示 + 刷新列表，绝不能再发一次重试请求（会和卡片自身的请求叠加，并制造
  // loadProjects→重挂载→自动启动 的循环）。
  const handleRetryProject = async () => {
    message.success('已开始重试处理项目')
    try {
      await loadProjects()
    } catch (error) {
      console.error('Refresh after retry error:', error)
    }
  }

  const handleProjectCardClick = (project: Project) => {
    // 导入中状态的项目不能点击进入详情页
    if (project.status === 'pending') {
      message.warning('项目正在导入中，请稍后再查看详情')
      return
    }
    
    // 其他状态可以正常进入详情页
    navigate(`/project/${project.id}`)
  }

  const filteredProjects = (projects || [])
    .filter(project => {
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter
      return matchesStatus
    })
    .sort((a, b) => {
      // 按创建时间倒序排列，最新的在前面
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  return (
    <Layout style={{
      minHeight: '100vh',
      background: 'var(--ac-bg)'
    }}>
      <Content style={{ padding: '40px 56px 56px', position: 'relative' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
          {/* 主操作区：热点选题（左） + 上传视频（右） 并排 */}
          <div style={{
            marginTop: '20px',
            marginBottom: '48px',
            display: 'grid',
            gridTemplateColumns: 'minmax(360px, 6fr) minmax(360px, 5fr)',
            gap: '24px',
            alignItems: 'start',
          }}>
            {/* 左：查热点入口卡片（点进去是完整的查热点→大纲→文案→保存流程） */}
            <div>
              <div style={{ fontSize: '13px', color: 'var(--ac-muted)', margin: '0 4px 14px', letterSpacing: '0.2px' }}>
                找选题
              </div>
              <div
                onClick={() => navigate('/hotspots')}
                style={{
                  background: 'var(--ac-card)', borderRadius: '16px', border: '1px solid var(--ac-line)',
                  boxShadow: 'var(--ac-shadow)', cursor: 'pointer',
                  minHeight: '360px', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '24px',
                  transition: 'border-color .2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--ac-accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--ac-line)')}
              >
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%', background: 'var(--ac-thumb)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <SearchOutlined style={{ fontSize: '28px', color: 'var(--ac-accent)' }} />
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ac-ink)' }}>AI 查热点，选题就地出文案</div>
                <div style={{ fontSize: '13px', color: 'var(--ac-sub)', textAlign: 'center', lineHeight: 1.6 }}>
                  输入领域 → 查热点选题 → 生成大纲和文案 → 保存到文案库
                </div>
              </div>
            </div>

            {/* 右：上传视频 */}
            <div>
              <div style={{ fontSize: '13px', color: 'var(--ac-muted)', margin: '0 4px 14px', letterSpacing: '0.2px' }}>
                {attachedScript ? '选题驱动模式：上传素材，切片偏向匹配文案要点' : '上传本地视频，AI 自动切片'}
              </div>
              {attachedScript && (
                <div style={{
                  fontSize: '13px', color: 'var(--ac-ink)', background: 'var(--ac-line-2)',
                  border: '1px solid var(--ac-line)', borderRadius: '12px',
                  padding: '10px 14px', margin: '0 4px 14px', display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  🎯 已关联文案：{(() => { try { return JSON.parse(attachedScript).title || '(未命名)' } catch { return '(文案)' } })()}
                  <a onClick={() => setAttachedScript(undefined)} style={{ marginLeft: 'auto', color: 'var(--ac-muted)', cursor: 'pointer', fontSize: '12px' }}>取消关联</a>
                </div>
              )}
              <div
                onMouseEnter={() => setUploadHovered(true)}
                onMouseLeave={() => setUploadHovered(false)}
                style={{
                  background: 'var(--ac-card)', borderRadius: '16px',
                  border: uploadHovered ? '1px solid var(--ac-accent)' : '1px solid var(--ac-line)',
                  padding: '18px', boxShadow: 'var(--ac-shadow)',
                  minHeight: '360px', display: 'flex', flexDirection: 'column',
                  justifyContent: 'center', transition: 'border-color .2s ease',
                }}
              >
                {uploadHovered ? (
                  <FileUpload attachedScript={attachedScript} onUploadSuccess={async () => {
                    await loadProjects()
                    message.success(attachedScript ? '选题驱动项目已创建，正在按文案切片…' : '项目创建成功，正在处理中...')
                  }} />
                ) : (
                  /* 收起态：加号入口 */
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '64px', height: '64px', borderRadius: '50%', background: 'var(--ac-thumb)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <PlusOutlined style={{ fontSize: '28px', color: 'var(--ac-accent)' }} />
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ac-ink)' }}>上传本地视频，AI 自动剪辑</div>
                    <div style={{ fontSize: '13px', color: 'var(--ac-muted)' }}>把鼠标移到这里开始上传</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 项目管理区域 */}
          <div style={{
            background: 'transparent',
            padding: '0',
            marginBottom: '32px'
          }}>
            {/* 项目列表标题区域 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginTop: '56px',
              marginBottom: '22px'
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <Title
                  level={2}
                  style={{ margin: 0, color: 'var(--ac-ink)', fontSize: '16px', fontWeight: 600 }}
                >
                  我的项目
                </Title>
                <Text style={{ color: 'var(--ac-muted)', fontSize: '13px' }}>
                  {filteredProjects.length}
                </Text>
              </div>
              
              {/* 状态筛选移到右侧 */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center'
              }}>
                <Select
                  placeholder="全部状态"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  variant="borderless"
                  style={{ minWidth: '120px', fontSize: '13px' }}
                  suffixIcon={<span style={{ color: 'var(--ac-muted)', fontSize: '10px' }}>⌄</span>}
                  allowClear
                >
                  <Option value="all">全部状态</Option>
                  <Option value="completed">已完成</Option>
                  <Option value="processing">处理中</Option>
                  <Option value="error">处理失败</Option>
                </Select>
              </div>
            </div>

            {/* 项目列表内容 */}
             <div>
               {loading ? (
                 <div style={{
                   textAlign: 'center',
                   padding: '72px 0',
                   background: 'var(--ac-card)',
                   borderRadius: '16px',
                   border: '1px solid var(--ac-line)'
                 }}>
                   <Spin size="large" />
                   <div style={{ marginTop: '18px', color: 'var(--ac-muted)', fontSize: '14px' }}>
                     正在加载项目列表…
                   </div>
                 </div>
               ) : filteredProjects.length === 0 ? (
                 <div style={{
                   textAlign: 'center',
                   padding: '72px 0',
                   background: 'var(--ac-card)',
                   borderRadius: '16px',
                   border: '1px solid var(--ac-line)'
                 }}>
                   <Empty
                     image={Empty.PRESENTED_IMAGE_SIMPLE}
                     description={
                       <div>
                         <Text type="secondary">
                           {projects.length === 0 ? '还没有项目，请使用上方的导入区域创建第一个项目' : '没有找到匹配的项目'}
                         </Text>
                       </div>
                     }
                   />
                 </div>
               ) : (
                 <div style={{
                   display: 'grid',
                   gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                   gap: '24px',
                   justifyContent: 'start'
                 }}>
                   {filteredProjects.map((project: Project) => (
                     <div key={project.id} style={{ position: 'relative', zIndex: 1 }}>
                       <ProjectCard 
                         project={project} 
                         onDelete={handleDeleteProject}
                         onRetry={() => handleRetryProject()}
                         onClick={() => handleProjectCardClick(project)}
                       />
                     </div>
                   ))}
                 </div>
               )}
             </div>
           </div>
         </div>
      </Content>
    </Layout>
  )
}

export default HomePage