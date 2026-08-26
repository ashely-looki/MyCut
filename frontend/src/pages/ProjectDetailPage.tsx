import { useEffect, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import clapperboardLinear from '@iconify-icons/solar/clapperboard-linear'
import downloadBold from '@iconify-icons/solar/download-bold'
import restartCircleLinear from '@iconify-icons/solar/restart-circle-linear'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { ProjectTaskManager } from '@/components/ProjectTaskManager'
import SecondaryPageNavigation from '@/components/SecondaryPageNavigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { projectApi } from '@/services/api'
import { useProjectStore } from '@/store/useProjectStore'

const ProjectDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentProject, setCurrentProject, upsertProject } = useProjectStore()
  const [statusLoading, setStatusLoading] = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const loadErrorNotified = useRef(false)

  const loadProject = async () => {
    if (!id) return

    try {
      const project = await projectApi.getProject(id)
      setCurrentProject(project)
      upsertProject(project)
    } catch (loadError) {
      console.error('Failed to load project:', loadError)
      setPageError('没有找到这个项目，或当前连接暂时不可用。')
      if (!loadErrorNotified.current) {
        loadErrorNotified.current = true
        toast.error('加载项目失败')
      }
    } finally {
      setPageLoading(false)
    }
  }

  const loadProcessingStatus = async () => {
    if (!id) return
    setStatusLoading(true)
    try {
      await projectApi.getProcessingStatus(id)
    } catch (statusError) {
      console.error('Failed to load processing status:', statusError)
    } finally {
      setStatusLoading(false)
    }
  }

  useEffect(() => {
    loadErrorNotified.current = false
    setPageError(null)
    setPageLoading(true)
    setVideoError(false)

    if (!id) {
      setPageError('缺少项目 ID。')
      setPageLoading(false)
      return
    }

    void loadProject()
    void loadProcessingStatus()
  }, [id])

  const handleStartProcessing = async () => {
    if (!id) return
    try {
      await projectApi.startProcessing(id)
      toast.success('项目已开始处理')
      await loadProcessingStatus()
      await loadProject()
    } catch (startError) {
      console.error('Failed to start processing:', startError)
      toast.error('启动处理失败')
    }
  }

  const handleDownload = async () => {
    if (!id || downloadLoading) return
    setDownloadLoading(true)
    try {
      await projectApi.downloadVideo(id)
      toast.success('成片已开始下载')
    } catch (downloadError) {
      console.error('Failed to download project video:', downloadError)
      toast.error('下载失败，请稍后重试')
    } finally {
      setDownloadLoading(false)
    }
  }

  if (pageLoading) {
    return (
      <main className="min-h-svh bg-background px-6 py-10">
        <div className="mx-auto max-w-6xl space-y-6">
          <SecondaryPageNavigation backTo="/projects" backLabel="我的项目" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-80" />
            <Skeleton className="h-5 w-[28rem] max-w-full" />
          </div>
          <Skeleton className="aspect-video w-full rounded-[24px]" />
        </div>
      </main>
    )
  }

  if (pageError || !currentProject || currentProject.id !== id) {
    return (
      <main className="min-h-svh bg-background px-6 py-10">
        <div className="mx-auto max-w-3xl space-y-6">
          <SecondaryPageNavigation backTo="/projects" backLabel="我的项目" />
          <Alert variant="destructive" className="rounded-[20px]">
            <AlertTitle>项目加载失败</AlertTitle>
            <AlertDescription className="mt-2 flex flex-wrap items-center justify-between gap-4">
              <span>{pageError || '没有找到这个项目。'}</span>
              <Button variant="secondary" size="sm" onClick={() => navigate('/projects')}>返回我的项目</Button>
            </AlertDescription>
          </Alert>
        </div>
      </main>
    )
  }

  const isCompleted = currentProject.status === 'completed'
  const displayProjectName = currentProject.name.replace(/^成片(?:\s*[：:]\s*)?/, '').trim() || currentProject.name
  const projectSubtitle = currentProject.description?.trim() || '成片已准备好，可以直接预览或下载。'
  const videoUrl = projectApi.getProjectVideoUrl(currentProject.id)

  return (
    <main className="min-h-svh bg-background px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <SecondaryPageNavigation
          backTo="/projects"
          backLabel="我的项目"
          className="mb-8"
        />

        <header className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="max-w-4xl text-2xl font-semibold tracking-[-0.025em] sm:text-[1.75rem]">
              {displayProjectName}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {projectSubtitle}
            </p>
          </div>

          {currentProject.status === 'pending' ? (
            <Button onClick={() => void handleStartProcessing()} disabled={statusLoading}>
              {statusLoading ? '正在启动' : '开始处理'}
            </Button>
          ) : isCompleted ? (
            <Button onClick={() => void handleDownload()} disabled={downloadLoading} className="shrink-0">
              <Icon icon={downloadBold} className="size-4 text-white" />
              {downloadLoading ? '正在下载' : '下载成片'}
            </Button>
          ) : null}
        </header>

        {isCompleted ? (
          <section aria-label="成片预览" className="rounded-[24px] bg-[#0d0d0f] shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
            <div className="relative aspect-video w-full overflow-hidden rounded-[24px] [clip-path:inset(0_round_24px)]">
              {videoError ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center text-white">
                  <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-white/10">
                    <Icon icon={clapperboardLinear} className="size-6" />
                  </span>
                  <p className="text-sm font-medium">暂时无法加载成片</p>
                  <p className="mt-1 text-xs text-white/55">请确认成片文件仍然存在，然后重新加载。</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-5"
                    onClick={() => {
                      setVideoError(false)
                      const video = document.querySelector<HTMLVideoElement>('[data-project-video]')
                      video?.load()
                    }}
                  >
                    <Icon icon={restartCircleLinear} />
                    重新加载
                  </Button>
                </div>
              ) : null}
              <video
                data-project-video
                src={videoUrl}
                poster={currentProject.thumbnail || undefined}
                controls
                playsInline
                preload="metadata"
                className="h-full w-full rounded-[24px] bg-[#0d0d0f] object-contain [clip-path:inset(0_round_24px)]"
                onError={() => setVideoError(true)}
              >
                当前浏览器不支持视频播放。
              </video>
            </div>
          </section>
        ) : (
          <div className="space-y-5">
            <Card>
              <CardContent className="p-5 sm:p-6">
                <ProjectTaskManager projectId={currentProject.id} projectName={displayProjectName} />
              </CardContent>
            </Card>
            <div className="flex min-h-48 flex-col items-center justify-center rounded-[20px] bg-muted/65 px-6 text-center">
              <Icon icon={clapperboardLinear} className="mb-3 size-7 text-muted-foreground" />
              <p className="text-sm font-medium">项目正在准备中</p>
              <p className="mt-1 text-xs text-muted-foreground">完成处理后即可在这里预览和下载成片。</p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default ProjectDetailPage
