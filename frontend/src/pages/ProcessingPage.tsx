import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import checkCircleBold from '@iconify-icons/solar/check-circle-bold'
import clapperboardBold from '@iconify-icons/solar/clapperboard-bold'
import clockCircleLinear from '@iconify-icons/solar/clock-circle-linear'
import dangerCircleLinear from '@iconify-icons/solar/danger-circle-linear'
import documentTextLinear from '@iconify-icons/solar/document-text-linear'
import layersMinimalisticLinear from '@iconify-icons/solar/layers-minimalistic-linear'
import restartCircleLinear from '@iconify-icons/solar/restart-circle-linear'
import starsMinimalisticLinear from '@iconify-icons/solar/stars-minimalistic-linear'
import videoFrameLinear from '@iconify-icons/solar/video-frame-linear'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import SecondaryPageNavigation from '@/components/SecondaryPageNavigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { projectApi } from '@/services/api'
import { useProjectStore } from '@/store/useProjectStore'

interface ProcessingStatus {
  status: 'processing' | 'completed' | 'error'
  current_step: number
  total_steps: number
  step_name: string
  progress: number
  error_message?: string
}

type StepState = 'finish' | 'process' | 'error' | 'wait'

const ProcessingPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentProject, setCurrentProject } = useProjectStore()
  const [status, setStatus] = useState<ProcessingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const completionHandled = useRef(false)
  const errorNotified = useRef(false)
  const loadErrorNotified = useRef(false)

  const isComposeProject = Boolean(currentProject?.settings?.compose)
  const steps = useMemo(
    () =>
      isComposeProject
        ? [
            { title: '准备文案', description: '整理口播、字幕和画面节奏' },
            { title: '生成配音', description: '逐句生成配音并校准时长' },
            { title: '设计画面', description: '生成信息动画和视觉层级' },
            { title: '合成视频', description: '渲染画面、字幕与音轨' },
            { title: '完成校验', description: '生成可预览、可下载的成片' },
          ]
        : [
            { title: '素材解析', description: '识别视频内容、人物与画面结构' },
            { title: '文案识别', description: '转写语音并校准字幕时间' },
            { title: '节奏分析', description: '定位需要保留的重点内容' },
            { title: '镜头编排', description: '重组画面并优化叙事节奏' },
            { title: '音画优化', description: '统一字幕、声音和画面表现' },
            { title: '导出成片', description: '生成可预览、可下载的视频' },
          ],
    [isComposeProject],
  )

  const startProcessing = useCallback(async () => {
    if (!id) return

    try {
      await projectApi.startProcessing(id)
      toast.success('项目已进入处理队列')
    } catch (error) {
      toast.error('启动处理失败，请稍后重试')
      console.error('Start processing error:', error)
    }
  }, [id])

  const loadProject = useCallback(async () => {
    if (!id) return

    setLoading(true)
    try {
      const project = await projectApi.getProject(id)
      setCurrentProject(project)

      if (project.status === 'completed') {
        navigate(`/project/${id}`)
        return
      }

      if (project.status === 'pending' && !project.settings?.compose) {
        await startProcessing()
      }
    } catch (error) {
      if (!loadErrorNotified.current) {
        loadErrorNotified.current = true
        toast.error('项目加载失败，请稍后重试')
      }
      console.error('Load project error:', error)
    } finally {
      setLoading(false)
    }
  }, [id, navigate, setCurrentProject, startProcessing])

  const checkStatus = useCallback(async () => {
    if (!id) return

    try {
      const statusData = await projectApi.getProcessingStatus(id)
      setStatus(statusData)

      if (statusData.status === 'completed' && !completionHandled.current) {
        completionHandled.current = true
        toast.success('成片已生成，正在打开结果')
        window.setTimeout(() => navigate(`/project/${id}`), 1200)
      }

      if (statusData.status === 'error' && !errorNotified.current) {
        errorNotified.current = true
        toast.error(statusData.error_message || '处理失败，请重试')
      }
    } catch (error: any) {
      console.error('Check status error:', error)

      if (error.response?.status === 404) {
        toast.error('项目不存在或已被删除')
        window.setTimeout(() => navigate('/projects'), 2000)
      } else if (error.code === 'ECONNABORTED') {
        toast.warning('连接超时，正在自动重试')
      }
    }
  }, [id, navigate])

  useEffect(() => {
    completionHandled.current = false
    errorNotified.current = false
    loadErrorNotified.current = false
    void loadProject().then(checkStatus)
    const interval = window.setInterval(checkStatus, 2000)

    return () => window.clearInterval(interval)
  }, [checkStatus, loadProject])

  const progress = Math.min(100, Math.max(0, status?.progress ?? 0))
  const currentStepIndex = Math.min(
    steps.length - 1,
    Math.max(0, status?.current_step ?? 0),
  )
  const activeStep = steps[currentStepIndex]

  const getStepStatus = (stepIndex: number): StepState => {
    if (!status) return stepIndex === 0 ? 'process' : 'wait'
    if (status.status === 'completed') return 'finish'
    if (status.status === 'error') {
      if (stepIndex < status.current_step) return 'finish'
      return stepIndex === status.current_step ? 'error' : 'wait'
    }
    if (stepIndex < status.current_step) return 'finish'
    if (stepIndex === status.current_step) return 'process'
    return 'wait'
  }

  if (loading) {
    return (
      <main className="min-h-[calc(100svh-3.5rem)] bg-[var(--workspace-background)] px-4 py-12 sm:px-6 md:min-h-svh lg:px-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <SecondaryPageNavigation
            backTo="/projects"
            backLabel="我的项目"
          />
          <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-8">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-10 w-72 rounded-xl" />
            <Skeleton className="h-5 w-80 max-w-full rounded-lg" />
          </div>
          <Skeleton className="h-[310px] rounded-[2rem]" />
          <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
            <Skeleton className="h-[360px] rounded-[2rem]" />
            <Skeleton className="h-[360px] rounded-[2rem]" />
          </div>
        </div>
      </main>
    )
  }

  if (!currentProject || currentProject.id !== id) {
    return (
      <main className="min-h-[calc(100svh-3.5rem)] bg-[var(--workspace-background)] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <SecondaryPageNavigation
            backTo="/projects"
            backLabel="我的项目"
          />
          <Alert variant="destructive" className="rounded-[20px]">
            <Icon icon={dangerCircleLinear} className="size-5" />
            <AlertTitle>项目加载失败</AlertTitle>
            <AlertDescription className="mt-2">
              <p>没有找到对应项目，或当前连接暂时不可用。</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void loadProject()}>
                  <Icon icon={restartCircleLinear} />
                  重新加载
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate('/projects')}>
                  返回我的项目
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </main>
    )
  }

  const isError = status?.status === 'error'
  const isCompleted = status?.status === 'completed'
  const heading = isError
    ? '生成过程遇到问题'
    : isCompleted
      ? '你的成片已准备好'
      : '正在生成你的成片'
  const displayProjectName = currentProject.name.replace(/^成片(?:\s*[：:]\s*)?/, '').trim() || currentProject.name

  return (
    <main className="relative min-h-[calc(100svh-3.5rem)] overflow-hidden bg-[var(--workspace-background)] px-4 pb-16 pt-10 sm:px-6 sm:pt-14 md:min-h-svh lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-13rem] hidden h-[34rem] w-[52rem] max-w-[110vw] -translate-x-1/2 dark:block dark:bg-[image:var(--brand-halo)]"
      />

      <div className="relative mx-auto max-w-5xl">
        <SecondaryPageNavigation
          backTo="/projects"
          backLabel="我的项目"
          className="mb-7"
        />

        <section className="mx-auto mb-9 flex max-w-2xl flex-col items-center text-center sm:mb-11">
          <Badge className="mb-4 gap-1.5 border-0 bg-[var(--brand-soft)] px-3 py-1.5 text-foreground shadow-none hover:bg-[var(--brand-soft)]">
            <Icon icon={starsMinimalisticLinear} className="size-3.5 text-primary" />
            {isComposeProject ? '智能成片' : '智能切片'}
          </Badge>
          <h1 className="brand-gradient-text text-[clamp(1.75rem,1.45rem+1.3vw,2.5rem)] font-semibold leading-tight tracking-[-0.035em]">
            {heading}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            {isError
              ? '项目内容已保留，你可以重新连接或返回项目列表继续处理。'
              : isCompleted
                ? '生成结果已经完成，即将为你打开预览。'
                : 'MyCut 正在完成画面、字幕和声音的组合，你可以离开此页面，任务会在后台继续。'}
          </p>
        </section>

        {isError && (
          <Alert
            variant="destructive"
            className="mb-6 rounded-3xl border-0 bg-destructive/8 px-5 py-5 shadow-none sm:px-6"
          >
            <Icon icon={dangerCircleLinear} className="size-5" />
            <AlertTitle>本次处理未能完成</AlertTitle>
            <AlertDescription className="mt-1 text-foreground/70">
              <p>{status.error_message || '处理过程中发生未知错误。'}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="brand-gradient rounded-full text-[var(--brand-on-gradient)] shadow-none hover:brightness-[0.98]"
                  onClick={() => window.location.reload()}
                >
                  <Icon icon={restartCircleLinear} />
                  重新连接
                </Button>
                <Button type="button" variant="secondary" className="rounded-full" onClick={() => navigate('/projects')}>
                  返回我的项目
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card className="rounded-[2rem] border-0 bg-card/95 shadow-[var(--brand-card-shadow)] backdrop-blur-sm">
          <CardHeader className="gap-5 p-6 pb-5 sm:p-8 sm:pb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="brand-gradient flex size-11 shrink-0 items-center justify-center rounded-2xl text-[var(--brand-on-gradient)] shadow-sm">
                  <Icon icon={clapperboardBold} className="size-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="truncate text-lg sm:text-xl">
                    {displayProjectName}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {isComposeProject ? 'AI 自动成片任务' : '视频智能拆解任务'}
                  </CardDescription>
                </div>
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  'w-fit gap-1.5 border-0 px-3 py-1.5 font-normal',
                  isError
                    ? 'bg-destructive/10 text-destructive'
                    : isCompleted
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'bg-[var(--brand-soft)] text-foreground',
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    isError
                      ? 'bg-destructive'
                      : isCompleted
                        ? 'bg-emerald-500'
                        : 'bg-primary motion-safe:animate-pulse',
                  )}
                />
                {isError ? '需要处理' : isCompleted ? '已完成' : '生成中'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 p-6 pt-0 sm:p-8 sm:pt-0">
            <div>
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {status?.step_name || activeStep?.title || '正在连接处理队列'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    第 {Math.min(currentStepIndex + 1, steps.length)} / {steps.length} 个阶段
                  </p>
                </div>
                <span className="ac-mono text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">
                  {Math.round(progress)}<span className="ml-0.5 text-sm font-normal text-muted-foreground">%</span>
                </span>
              </div>
              <Progress
                value={progress}
                aria-label={`项目处理进度 ${Math.round(progress)}%`}
                className="h-2 bg-muted"
                indicatorClassName="brand-gradient"
              />
            </div>

            <div className="flex items-start gap-3 rounded-2xl bg-muted/60 p-4 sm:p-5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft-strong)] text-primary">
                <Icon
                  icon={isError ? dangerCircleLinear : isCompleted ? checkCircleBold : restartCircleLinear}
                  className={cn('size-[18px]', !isError && !isCompleted && 'motion-safe:animate-spin')}
                />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-medium">
                  {isError ? '任务已暂停' : isCompleted ? '任务处理完成' : activeStep?.title || '准备开始'}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {isError
                    ? '请检查错误信息后重新连接。'
                    : isCompleted
                      ? '正在打开项目预览，请稍候。'
                      : activeStep?.description || '正在准备项目所需资源。'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-[2rem] border-0 bg-card shadow-[var(--brand-card-shadow)]">
            <CardHeader className="p-6 pb-4 sm:p-8 sm:pb-5">
              <CardTitle className="text-lg">处理流程</CardTitle>
              <CardDescription>每个阶段完成后会自动进入下一步</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5 p-4 pt-0 sm:p-6 sm:pt-0">
              {steps.map((step, index) => {
                const stepState = getStepStatus(index)
                const isActive = stepState === 'process' || stepState === 'error'

                return (
                  <div
                    key={step.title}
                    aria-current={isActive ? 'step' : undefined}
                    className={cn(
                      'flex items-start gap-3 rounded-2xl px-3 py-3.5 transition-colors sm:px-4',
                      isActive && 'bg-[var(--brand-soft)]',
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-medium',
                        stepState === 'finish' && 'brand-gradient text-[var(--brand-on-gradient)]',
                        stepState === 'process' && 'bg-[var(--brand-soft-strong)] text-primary',
                        stepState === 'error' && 'bg-destructive/10 text-destructive',
                        stepState === 'wait' && 'bg-muted text-muted-foreground',
                      )}
                    >
                      {stepState === 'finish' ? (
                        <Icon icon={checkCircleBold} className="size-4" />
                      ) : stepState === 'process' ? (
                        <Icon icon={restartCircleLinear} className="size-4 motion-safe:animate-spin" />
                      ) : stepState === 'error' ? (
                        <Icon icon={dangerCircleLinear} className="size-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={cn('text-sm font-medium', stepState === 'wait' && 'text-foreground/70')}>
                        {step.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-0 bg-card shadow-[var(--brand-card-shadow)]">
            <CardHeader className="p-6 pb-4 sm:p-8 sm:pb-5">
              <CardTitle className="text-lg">本次任务</CardTitle>
              <CardDescription>生成期间无需停留在当前页面</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0 sm:p-6 sm:pt-0">
              {[
                {
                  icon: videoFrameLinear,
                  label: '生成方式',
                  value: isComposeProject ? '脚本自动成片' : '源视频智能切片',
                },
                { icon: layersMinimalisticLinear, label: '处理阶段', value: `${steps.length} 个阶段` },
                { icon: clockCircleLinear, label: '运行方式', value: '云端后台处理' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-2xl px-3 py-3 sm:px-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Icon icon={item.icon} className="size-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="mt-0.5 truncate text-sm font-medium">{item.value}</p>
                  </div>
                </div>
              ))}

              <div className="mt-4 rounded-2xl bg-muted/60 p-4">
                <div className="flex gap-2.5">
                  <Icon icon={documentTextLinear} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p className="text-xs leading-5 text-muted-foreground">
                    页面关闭后任务也不会中断，完成的项目会保存在工作台中。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

export default ProcessingPage
