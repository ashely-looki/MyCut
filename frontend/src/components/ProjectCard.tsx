import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import clapperboardBold from '@iconify-icons/solar/clapperboard-bold'
import downloadBold from '@iconify-icons/solar/download-bold'
import downloadLinear from '@iconify-icons/solar/download-linear'
import playCircleBold from '@iconify-icons/solar/play-circle-bold'
import playLinear from '@iconify-icons/solar/play-linear'
import restartLinear from '@iconify-icons/solar/restart-linear'
import trashBinMinimalisticLinear from '@iconify-icons/solar/trash-bin-minimalistic-linear'
import trashBinMinimalisticBold from '@iconify-icons/solar/trash-bin-minimalistic-bold'
import videoFrameLinear from '@iconify-icons/solar/video-frame-linear'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import 'dayjs/locale/zh-cn'

import { projectApi } from '../services/api'
import { Project } from '../store/useProjectStore'
import { UnifiedStatusBar } from './UnifiedStatusBar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardFooter } from './ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

dayjs.extend(relativeTime)
dayjs.extend(timezone)
dayjs.extend(utc)
dayjs.locale('zh-cn')

const autoStartedProjectIds = new Set<string>()

interface ProjectCardProps {
  project: Project
  onDelete: (id: string) => void
  onRetry?: (id: string) => void
  onClick?: () => void
  variant?: 'default' | 'compact'
  fallbackThumbnail?: string
}

const categoryMap: Record<string, string> = {
  default: '默认',
  knowledge: '知识科普',
  business: '商业财经',
  opinion: '观点评论',
  experience: '经验分享',
  speech: '演讲脱口秀',
  content_review: '内容解说',
  entertainment: '娱乐内容',
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onDelete,
  onRetry,
  onClick,
  variant = 'default',
  fallbackThumbnail,
}) => {
  const navigate = useNavigate()
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null)
  const [thumbnailLoading, setThumbnailLoading] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isDownloadingVideo, setIsDownloadingVideo] = useState(false)
  const isComposedVideo = Boolean(project.settings?.compose || project.video_path?.includes('/output/compose.mp4'))
  const thumbnailCacheKey = `thumbnail_v2_${project.id}`

  useEffect(() => {
    let cancelled = false

    const generateThumbnail = async () => {
      if (project.thumbnail) {
        setVideoThumbnail(project.thumbnail)
        return
      }

      if (!project.video_path) return

      const cachedThumbnail = localStorage.getItem(thumbnailCacheKey)
      if (cachedThumbnail) {
        setVideoThumbnail(cachedThumbnail)
        return
      }

      setThumbnailLoading(true)

      try {
        const video = document.createElement('video')
        video.crossOrigin = 'anonymous'
        video.muted = true
        video.preload = 'metadata'

        const possiblePaths = [
          'compose.mp4',
          'input/input.mp4',
          'input.mp4',
          project.video_path,
          `${project.video_path}/input.mp4`,
        ].filter((path): path is string => Boolean(path))

        let videoLoaded = false

        for (const path of possiblePaths) {
          if (videoLoaded || cancelled) break

          try {
            const videoUrl = projectApi.getProjectFileUrl(project.id, path)

            await new Promise<string>((resolve, reject) => {
              const timeoutId = window.setTimeout(() => reject(new Error('视频加载超时')), 10000)

              video.onloadedmetadata = () => {
                window.clearTimeout(timeoutId)
                // 自动成片的视频在正文阶段会带字幕渐变蒙版，封面改取干净的片头帧。
                video.currentTime = isComposedVideo
                  ? Math.min(0.2, Math.max(video.duration - 0.05, 0))
                  : Math.min(5, video.duration / 4)
              }

              video.onseeked = () => {
                window.clearTimeout(timeoutId)
                try {
                  const canvas = document.createElement('canvas')
                  const context = canvas.getContext('2d')
                  if (!context) {
                    reject(new Error('无法获取 canvas 上下文'))
                    return
                  }

                  const maxWidth = 640
                  const maxHeight = 360
                  const aspectRatio = video.videoWidth / video.videoHeight
                  let width = maxWidth
                  let height = maxHeight

                  if (aspectRatio > maxWidth / maxHeight) height = maxWidth / aspectRatio
                  else width = maxHeight * aspectRatio

                  canvas.width = width
                  canvas.height = height
                  context.drawImage(video, 0, 0, width, height)

                  const thumbnail = canvas.toDataURL('image/jpeg', 0.72)
                  if (!cancelled) setVideoThumbnail(thumbnail)

                  try {
                    localStorage.setItem(thumbnailCacheKey, thumbnail)
                  } catch {
                    const keys = Object.keys(localStorage).filter((key) => key.startsWith('thumbnail_'))
                    if (keys.length > 50) {
                      keys.slice(0, 10).forEach((key) => localStorage.removeItem(key))
                      localStorage.setItem(thumbnailCacheKey, thumbnail)
                    }
                  }

                  videoLoaded = true
                  resolve(thumbnail)
                } catch (error) {
                  reject(error)
                }
              }

              video.onerror = reject
              video.src = videoUrl
            })

            break
          } catch (error) {
            console.warn(`缩略图路径 ${path} 加载失败:`, error)
          }
        }
      } catch (error) {
        console.error('生成缩略图时发生错误:', error)
      } finally {
        if (!cancelled) setThumbnailLoading(false)
      }
    }

    void generateThumbnail()
    return () => {
      cancelled = true
    }
  }, [isComposedVideo, project.id, project.thumbnail, project.video_path, thumbnailCacheKey])

  const downloadProgress = project.processing_config?.download_progress || 0
  const isDownloading = project.status === 'pending' && downloadProgress > 0 && downloadProgress < 100
  const isImporting = project.status === 'pending' && !isDownloading
  const normalizedStatus = project.status === 'error'
    ? 'failed'
    : isDownloading
      ? 'downloading'
      : isImporting
        ? 'importing'
        : project.status

  const progressPercent = project.status === 'completed'
    ? 100
    : project.status === 'failed'
      ? 0
      : isDownloading
        ? downloadProgress
        : isImporting
          ? 5
          : project.current_step && project.total_steps
            ? Math.round((project.current_step / project.total_steps) * 100)
            : project.status === 'processing'
              ? 10
              : 0

  const handleRetry = async (options?: { silent?: boolean }) => {
    if (isRetrying) return

    setIsRetrying(true)
    try {
      if (project.status === 'pending') await projectApi.startProcessing(project.id)
      else await projectApi.retryProcessing(project.id)

      if (onRetry && !options?.silent) onRetry(project.id)
    } catch (error) {
      console.error('重试失败:', error)
      if (!options?.silent) toast.error('重试失败，请稍后再试')
    } finally {
      setIsRetrying(false)
    }
  }

  useEffect(() => {
    if (
      project.status === 'pending' &&
      !isDownloading &&
      !autoStartedProjectIds.has(project.id)
    ) {
      autoStartedProjectIds.add(project.id)
      void handleRetry({ silent: true })
    }
  }, [project.status, project.id, isDownloading])

  const handleOpenProject = () => {
    if (project.status === 'pending') {
      toast.warning('项目正在导入中，请稍后再查看详情')
      return
    }

    if (project.status === 'processing') {
      navigate(`/processing/${project.id}`)
      return
    }

    if (onClick) onClick()
    else navigate(`/project/${project.id}`)
  }

  const handleDownloadVideo = async () => {
    if (isDownloadingVideo) return
    setIsDownloadingVideo(true)
    try {
      await projectApi.downloadVideo(project.id)
      toast.success('成片已开始下载')
    } catch (error) {
      console.error('下载项目失败:', error)
      toast.error('下载失败，请稍后重试')
    } finally {
      setIsDownloadingVideo(false)
    }
  }

  const videoCategory = project.video_category || project.settings?.video_category || project.project_type || 'default'
  const category = categoryMap[videoCategory] || categoryMap.default
  const canRetry = normalizedStatus === 'failed' || normalizedStatus === 'processing' || normalizedStatus === 'importing'
  const displayName = project.name.replace(/^成片(?:\s*[：:]\s*)?/, '').trim() || project.name

  if (variant === 'compact') {
    const displayThumbnail = videoThumbnail || fallbackThumbnail
    const statusLabel = normalizedStatus === 'completed'
      ? '已完成'
      : normalizedStatus === 'failed'
        ? '处理失败'
        : normalizedStatus === 'downloading'
          ? `下载中 ${progressPercent}%`
          : normalizedStatus === 'importing'
            ? '导入中'
            : '处理中'

    return (
      <Card className="group h-[355px] overflow-hidden rounded-[24px] border-0 bg-card shadow-none">
        <button
          type="button"
          onClick={handleOpenProject}
          className="relative block h-[204px] w-full overflow-hidden bg-muted text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          aria-label={`打开项目 ${displayName}`}
        >
          {displayThumbnail ? (
            <img src={displayThumbnail} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]" />
          ) : thumbnailLoading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Icon icon={restartLinear} className="size-5 animate-spin" />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Icon icon={videoFrameLinear} className="size-6" />
            </div>
          )}
          <span className="absolute bottom-3 left-3 flex size-10 items-center justify-center rounded-full bg-white/72 text-white shadow-sm backdrop-blur-md dark:bg-black/60">
            <Icon icon={playCircleBold} className="size-6 text-white" />
          </span>
        </button>

        <div className="p-4">
          <button type="button" onClick={handleOpenProject} className="block w-full text-left outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring">
            <h3 className="line-clamp-1 text-[19px] font-semibold leading-none text-[#333] dark:text-foreground" title={displayName}>{displayName}</h3>
            <p className="mt-2 text-sm leading-none text-[#333]/72 dark:text-muted-foreground">
              {dayjs(project.created_at).tz('Asia/Shanghai').fromNow()}
            </p>
          </button>

          <div className="mt-5 flex items-center justify-between gap-3">
            <Badge className="h-10 rounded-full border-0 bg-[#2f86f6]/[0.08] px-4 text-sm font-normal text-[#2f86f6] shadow-none hover:bg-[#2f86f6]/[0.08]">
              <Icon icon={playCircleBold} className="size-5" />
              {statusLabel}
            </Badge>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleOpenProject}
                    className="size-10 rounded-full bg-[#151515] text-white hover:bg-black hover:text-white dark:bg-foreground dark:text-background dark:hover:bg-foreground/90"
                    aria-label="预览成片"
                  >
                    <Icon icon={clapperboardBold} className="size-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>预览</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleDownloadVideo()}
                    disabled={isDownloadingVideo}
                    className="size-10 rounded-full bg-[#151515] text-white hover:bg-black hover:text-white dark:bg-foreground dark:text-background dark:hover:bg-foreground/90"
                    aria-label="下载项目"
                  >
                    <Icon icon={downloadBold} className="size-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>下载</TooltipContent>
              </Tooltip>

              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10 rounded-full bg-[#151515] text-white hover:bg-black hover:text-white dark:bg-foreground dark:text-background dark:hover:bg-foreground/90"
                        aria-label="删除项目"
                      >
                        <Icon icon={trashBinMinimalisticBold} className="size-5" />
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>删除</TooltipContent>
                </Tooltip>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>删除“{displayName}”？</AlertDialogTitle>
                    <AlertDialogDescription>项目及相关处理结果将被永久删除，此操作无法撤销。</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(project.id)} className="bg-destructive text-white hover:bg-destructive/90">
                      删除项目
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="group overflow-hidden border-border/80 bg-card shadow-none transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--brand-card-shadow)]">
      <button
        type="button"
        onClick={handleOpenProject}
        className="relative block aspect-video w-full overflow-hidden bg-muted/70 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-label={`打开项目 ${displayName}`}
      >
        {videoThumbnail ? (
          <img
            src={videoThumbnail}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {thumbnailLoading ? (
              <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                <Icon icon={restartLinear} className="size-5 animate-spin" />
                正在生成封面
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                <span className="flex size-9 items-center justify-center rounded-full bg-background/70 shadow-sm">
                  <Icon icon={playLinear} className="size-4" />
                </span>
                打开项目
              </div>
            )}
          </div>
        )}

        {videoCategory !== 'default' && (
          <Badge variant="secondary" className="absolute left-3 top-3 border-0 bg-background/92 font-normal shadow-sm backdrop-blur-sm">
            {category}
          </Badge>
        )}

        {normalizedStatus === 'completed' && (
          <Badge className="absolute right-3 top-3 rounded-full border-0 bg-background/92 px-3 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-sm hover:bg-background/92">
            已完成
          </Badge>
        )}

        {videoThumbnail && (
          <span className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 scale-95 items-center justify-center rounded-full bg-black/70 text-white opacity-0 shadow-lg backdrop-blur-md transition-[opacity,transform] duration-200 group-hover:scale-100 group-hover:opacity-100">
            <Icon icon={playCircleBold} className="size-6 text-white" />
          </span>
        )}
      </button>

      <CardContent className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={handleOpenProject}
            className="min-w-0 text-left outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
          >
            <h3 className="line-clamp-1 text-[15px] font-semibold" title={displayName}>{displayName}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {dayjs(project.created_at).tz('Asia/Shanghai').fromNow()}
            </p>
          </button>
        </div>

        {normalizedStatus !== 'completed' && (
          <div className="mt-3">
            <UnifiedStatusBar
              projectId={project.id}
              status={normalizedStatus}
              downloadProgress={progressPercent}
              onStatusChange={(newStatus) => {
                console.log(`项目 ${project.id} 状态变化: ${normalizedStatus} -> ${newStatus}`)
              }}
              onDownloadProgressUpdate={(progress) => {
                console.log(`项目 ${project.id} 下载进度更新: ${progress}%`)
              }}
            />
          </div>
        )}

      </CardContent>

      <CardFooter className="justify-between border-t border-border/70 bg-transparent px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon icon={videoFrameLinear} className="size-3.5" />
          {normalizedStatus === 'completed'
            ? '可预览和下载'
            : normalizedStatus === 'failed'
              ? '处理失败'
              : normalizedStatus === 'pending'
                ? '等待处理'
                : '后台处理中'}
        </span>
        <div className="flex items-center gap-1">
          {canRetry && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void handleRetry()}
                  disabled={isRetrying}
                  aria-label={project.status === 'pending' ? '开始处理' : '重新处理'}
                >
                  <Icon icon={restartLinear} className={isRetrying ? 'animate-spin' : ''} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{project.status === 'pending' ? '开始处理' : '重新处理'}</TooltipContent>
            </Tooltip>
          )}

          {normalizedStatus === 'completed' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void handleDownloadVideo()}
                  disabled={isDownloadingVideo}
                  aria-label="下载项目"
                >
                  <Icon icon={downloadLinear} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>下载</TooltipContent>
            </Tooltip>
          )}

          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="删除项目">
                    <Icon icon={trashBinMinimalisticLinear} />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>删除</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>删除“{displayName}”？</AlertDialogTitle>
                <AlertDialogDescription>
                  项目及相关处理结果将被永久删除，此操作无法撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(project.id)}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  删除项目
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardFooter>
    </Card>
  )
}

export default ProjectCard
