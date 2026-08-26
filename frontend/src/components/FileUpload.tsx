import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import closeCircleLinear from '@iconify-icons/solar/close-circle-linear'
import restartLinear from '@iconify-icons/solar/restart-linear'
import subtitlesLinear from '@iconify-icons/solar/subtitles-linear'
import uploadBold from '@iconify-icons/solar/upload-bold'
import uploadLinear from '@iconify-icons/solar/upload-linear'
import videoFrameBold from '@iconify-icons/solar/video-frame-bold'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'

import uploadCanvasVideo from '../assets/home/biograph-memberships-hero.mp4'
import { cn } from '../lib/utils'
import { projectApi, VideoCategory } from '../services/api'
import { useProjectStore } from '../store/useProjectStore'
import { validateApiConfigBeforeProjectCreation } from '../utils/apiConfigCheck'
import WorkspacePageHeader from './WorkspacePageHeader'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Progress } from './ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Skeleton } from './ui/skeleton'

interface FileUploadProps {
  onUploadSuccess?: (projectId: string) => void
  attachedScript?: string
  variant?: 'default' | 'figma-home'
}

interface UploadError {
  code?: string
  message?: string
  userMessage?: string
  response?: {
    status?: number
    data?: { detail?: string }
  }
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess, attachedScript, variant = 'default' }) => {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [projectName, setProjectName] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categories, setCategories] = useState<VideoCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [files, setFiles] = useState<{ video?: File; srt?: File }>({})
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const { addProject } = useProjectStore()

  useEffect(() => {
    if (!files.video) {
      setPreviewUrl(null)
      return undefined
    }

    const objectUrl = URL.createObjectURL(files.video)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [files.video])

  useEffect(() => {
    const loadCategories = async () => {
      setLoadingCategories(true)
      try {
        const response = await projectApi.getVideoCategories()
        setCategories(response.categories)
        if (response.default_category) setSelectedCategory(response.default_category)
        else if (response.categories.length > 0) setSelectedCategory(response.categories[0].value)
      } catch (error) {
        console.error('Failed to load video categories:', error)
        toast.error('加载视频分类失败')
      } finally {
        setLoadingCategories(false)
      }
    }

    void loadCategories()
  }, [])

  const onDrop = (acceptedFiles: File[]) => {
    const nextFiles = { ...files }

    acceptedFiles.forEach((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(extension || '')) {
        nextFiles.video = file
        setProjectName(file.name.replace(/\.[^/.]+$/, ''))
      } else if (extension === 'srt') {
        nextFiles.srt = file
      }
    })

    setFiles(nextFiles)
  }

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm'],
      'application/x-subrip': ['.srt'],
    },
    multiple: true,
    disabled: uploading,
    noClick: true,
    noKeyboard: true,
  })

  const handleUpload = async () => {
    if (!files.video) {
      toast.error('请选择视频文件')
      return
    }
    if (!projectName.trim()) {
      toast.error('请输入项目名称')
      return
    }

    const hasValidApiConfig = await validateApiConfigBeforeProjectCreation()
    if (!hasValidApiConfig) return

    setUploading(true)
    setUploadProgress(0)
    let progressInterval: number | undefined

    try {
      progressInterval = window.setInterval(() => {
        setUploadProgress((currentProgress) => {
          if (currentProgress >= 85) return currentProgress
          const increment = Math.max(1, Math.floor((90 - currentProgress) / 10))
          return currentProgress + increment
        })
      }, 300)

      const newProject = await projectApi.uploadFiles({
        video_file: files.video,
        srt_file: files.srt,
        project_name: projectName.trim(),
        video_category: selectedCategory,
        script_json: attachedScript,
      })

      if (progressInterval) window.clearInterval(progressInterval)
      setUploadProgress(100)
      addProject(newProject)
      toast.success('项目创建成功，正在后台处理')

      setFiles({})
      setProjectName('')
      setUploadProgress(0)
      if (categories.length > 0) setSelectedCategory(categories[0].value)
      onUploadSuccess?.(newProject.id)
    } catch (rawError) {
      const error = rawError as UploadError
      console.error('上传失败，详细错误:', error)

      let errorMessage = '上传失败，请重试'
      let warning = false

      if (error.response?.status === 413) {
        errorMessage = '文件太大，请选择较小的视频文件'
        warning = true
      } else if (error.response?.status === 415) {
        errorMessage = '不支持该文件格式，请使用 MP4、AVI、MOV、MKV 或 WebM'
        warning = true
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.detail || '文件格式或内容有问题，请检查后重试'
      } else if (error.response?.status === 500) {
        errorMessage = '服务器处理文件时出错，请稍后重试'
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = '上传超时，请检查网络连接后重试'
      } else {
        errorMessage = error.response?.data?.detail || error.userMessage || error.message || errorMessage
      }

      if (warning) toast.warning(errorMessage)
      else toast.error(errorMessage)

      if (error.code === 'ECONNABORTED' || (error.response?.status || 0) >= 500) {
        toast.info('如果问题持续存在，请检查网络连接或联系技术支持')
      }
    } finally {
      if (progressInterval) window.clearInterval(progressInterval)
      setUploading(false)
    }
  }

  const removeFile = (type: 'video' | 'srt') => {
    setFiles((currentFiles) => {
      const nextFiles = { ...currentFiles }
      delete nextFiles[type]
      return nextFiles
    })
    if (type === 'video') setProjectName('')
  }

  if (!files.video && variant === 'figma-home') {
    return (
      <div
        {...getRootProps()}
        className={cn(
          'h-[183px] w-full overflow-hidden rounded-[24px] border border-black/[0.08] bg-background p-[7px] transition-colors dark:border-white/10',
          isDragActive && 'border-primary/55 bg-[var(--brand-soft)]',
          uploading && 'pointer-events-none opacity-60',
        )}
      >
        <input {...getInputProps()} />
        <Button
          type="button"
          variant="ghost"
          onClick={open}
          disabled={uploading}
          className="flex h-[167px] w-full flex-col gap-0 rounded-[16px] border border-dashed border-black/[0.12] bg-[#fcfcfc] px-6 py-0 hover:bg-muted/45 dark:border-white/12 dark:bg-card dark:hover:bg-muted/55"
        >
          <span className="brand-gradient flex size-11 items-center justify-center rounded-full shadow-[var(--brand-button-shadow)]">
            <Icon icon={uploadBold} className="size-5" />
          </span>
          <span className="mt-4 text-[19px] font-semibold leading-none text-foreground">
            {isDragActive ? '松开以上传素材' : '上传本地视频，AI 自动剪辑'}
          </span>
          <span className="mt-[9px] whitespace-normal text-center text-sm font-normal leading-5 text-foreground/40">
            支持 MP4、MOV、AVI、MKV、WebM，可导入 SRT 字幕或交由 AI 自动生成
          </span>
        </Button>
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'min-h-full w-full flex-1',
        files.video
          ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]'
          : 'flex flex-col',
        uploading && 'pointer-events-none opacity-70',
      )}
    >
      <input {...getInputProps()} />

      <section className={cn('flex min-w-0 flex-col', !files.video && 'min-h-full w-full')}>
        <WorkspacePageHeader
          title="素材画布"
          description="导入一条长视频，AI 会自动转写、分析并拆分精彩片段。"
          className="pb-0 pt-0"
        >
          <Badge variant="secondary" className="border-0 bg-muted px-3 py-1.5 font-normal text-muted-foreground">
            {files.video ? '素材已就绪' : '等待导入'}
          </Badge>
        </WorkspacePageHeader>

        {!files.video ? (
          <div className="flex min-h-0 flex-1 items-stretch justify-center pt-6">
            <div
              className={cn(
                'relative flex min-h-[520px] w-full items-center justify-center overflow-hidden rounded-[var(--studio-surface-radius)] bg-[#111113] px-6 py-12 text-center text-white transition-[transform,box-shadow] duration-200 md:min-h-[calc(100svh-15rem)]',
                isDragActive && 'scale-[0.995] shadow-[inset_0_0_0_2px_rgb(255_255_255/0.42)]',
              )}
            >
              <video
                aria-hidden="true"
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                src={uploadCanvasVideo}
                tabIndex={-1}
                className="pointer-events-none absolute inset-0 size-full object-cover motion-reduce:hidden"
              />
              <div
                className={cn(
                  'pointer-events-none absolute inset-0 bg-black/55 transition-colors duration-200',
                  isDragActive && 'bg-black/40',
                )}
              />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,transparent_0%,rgb(0_0_0/0.42)_78%)]" />
              <div className="relative z-10 flex max-w-md flex-col items-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-white/10 text-white shadow-[0_1px_0_rgb(255_255_255/0.12)_inset]">
                  <Icon icon={uploadLinear} className="size-6" />
                </span>
                <h3 className="mt-5 text-xl font-medium tracking-[-0.025em]">
                  {isDragActive ? '松开以导入素材' : '把视频拖到素材画布'}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  支持 MP4、MOV、AVI、MKV、WebM，单个文件建议不超过 2 GB。
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={open}
                  disabled={uploading}
                  className="mt-6 bg-white text-black shadow-none hover:bg-white/90"
                >
                  <Icon icon={uploadBold} className="size-4 text-black" />
                  选择视频
                </Button>
                <span className="mt-4 text-xs text-white/38">可同时选择一份 SRT 字幕</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-6 overflow-hidden rounded-[var(--studio-surface-radius)] bg-[#0b0b0c]">
              {previewUrl && (
                <video
                  src={previewUrl}
                  controls
                  preload="metadata"
                  className="aspect-video w-full bg-black object-contain"
                  aria-label={`${files.video.name} 视频预览`}
                />
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[16px] bg-muted/60 p-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm">
                <Icon icon={videoFrameBold} className="size-5" />
              </span>
              <div className="min-w-[12rem] flex-1">
                <p className="truncate text-sm font-medium">{files.video.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {(files.video.size / 1024 / 1024).toFixed(2)} MB · 视频素材
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={open} disabled={uploading}>更换素材</Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeFile('video')} disabled={uploading} aria-label="移除视频">
                <Icon icon={closeCircleLinear} />
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[16px] bg-muted/35 p-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm">
                <Icon icon={subtitlesLinear} className="size-5" />
              </span>
              <div className="min-w-[12rem] flex-1">
                <p className="truncate text-sm font-medium">{files.srt ? files.srt.name : 'AI 自动生成字幕'}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {files.srt ? '已使用你提供的 SRT 字幕' : '不上传字幕时将自动识别视频语音'}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={open} disabled={uploading}>{files.srt ? '更换字幕' : '添加字幕'}</Button>
              {files.srt && (
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeFile('srt')} disabled={uploading} aria-label="移除字幕">
                  <Icon icon={closeCircleLinear} />
                </Button>
              )}
            </div>
          </>
        )}
      </section>

      {files.video && (
        <aside className="flex min-w-0 flex-col rounded-[24px] bg-muted/45 p-6">
          <div>
            <h2 className="text-xl font-medium tracking-[-0.025em]">剪辑设置</h2>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">确认项目信息后开始导入，处理过程可以离开当前页面。</p>
          </div>

          <div className="mt-7 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="project-name">项目名称</Label>
              <Input id="project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="输入项目名称" disabled={uploading} className="bg-muted/45" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="video-category">视频分类</Label>
              {loadingCategories ? (
                <Skeleton className="h-10 w-full rounded-xl" />
              ) : (
                <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={uploading}>
                  <SelectTrigger id="video-category" className="w-full bg-muted/45" aria-label="选择视频分类">
                    <SelectValue placeholder="选择视频分类" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {uploading && (
            <div className="mt-6 space-y-3 rounded-[16px] bg-muted/60 p-4" role="status">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <Icon icon={restartLinear} className="size-4 animate-spin" />
                  正在上传素材
                </span>
                <span className="tabular-nums text-muted-foreground">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          <div className="mt-auto pt-8">
            <div className="mb-4 rounded-[16px] bg-muted/45 p-4 text-xs leading-5 text-muted-foreground">
              创建后，AI 将在后台完成字幕识别、内容分析和候选片段生成。
            </div>
            <Button type="button" size="lg" onClick={() => void handleUpload()} disabled={uploading || !projectName.trim()} className="w-full">
              <Icon icon={uploadBold} className={cn('size-4', uploading && 'animate-pulse')} />
              {uploading ? '正在创建项目' : '开始智能剪辑'}
            </Button>
          </div>
        </aside>
      )}
    </div>
  )
}

export default FileUpload
