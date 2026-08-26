import { useEffect, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import clockCircleLinear from '@iconify-icons/solar/clock-circle-linear'
import disketteLinear from '@iconify-icons/solar/diskette-linear'
import documentTextBold from '@iconify-icons/solar/document-text-bold'
import lightbulbLinear from '@iconify-icons/solar/lightbulb-linear'
import restartCircleLinear from '@iconify-icons/solar/restart-circle-linear'
import videoFramePlayHorizontalBold from '@iconify-icons/solar/video-frame-play-horizontal-bold'
import videoFramePlayHorizontalLinear from '@iconify-icons/solar/video-frame-play-horizontal-linear'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import FileUpload from '@/components/FileUpload'
import HotspotPanel from '@/components/HotspotPanel'
import SecondaryPageNavigation from '@/components/SecondaryPageNavigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { composeApi, scriptApi } from '@/services/api'
import type { Outline, SavedScript, ScriptSegment, TopicCard } from '@/services/api'

const STYLE_OPTIONS = ['干货', '热血', '亲和', '犀利', '轻松']

const ROLE_LABEL: Record<ScriptSegment['role'], string> = {
  hook: '开头钩子',
  body: '正文要点',
  cta: '结尾号召',
}

type CreationMode = 'topic' | 'upload'
type StudioStage = 'topic' | 'brief' | 'outline' | 'storyboard'
const UNSAVED_DRAFT_KEY = 'mycut-unsaved-creation'

const STAGES: { value: StudioStage; number: string; label: string; description: string }[] = [
  { value: 'topic', number: '01', label: '确定选题', description: '搜索热点与创作方向' },
  { value: 'brief', number: '02', label: '创作设置', description: '明确角度、观众与风格' },
  { value: 'outline', number: '03', label: '内容大纲', description: '组织钩子、正文与号召' },
  { value: 'storyboard', number: '04', label: '分镜文案', description: '调整口播、画面与时长' },
]

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response
    if (response?.data?.detail) return response.data.detail
  }
  return fallback
}

function hasOutlineContent(outline: Outline | null) {
  return Boolean(outline && (outline.hook.trim() || outline.cta.trim() || outline.sections.length))
}

const ScriptEditorPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as {
    topic?: TopicCard
    savedScript?: SavedScript
    creationMode?: CreationMode
    attachedScript?: string
  } | null
  const passedTopic = state?.topic
  const savedScript = state?.savedScript
  const isSavedEditorRoute = location.pathname === '/script' && Boolean(savedScript)
  const requestedMode: CreationMode = new URLSearchParams(location.search).get('mode') === 'upload'
    ? 'upload'
    : state?.creationMode || 'topic'

  const initialStage: StudioStage = savedScript?.segments?.length
    ? 'storyboard'
    : hasOutlineContent(savedScript?.outline || null)
      ? 'outline'
      : passedTopic || savedScript
        ? 'brief'
        : 'topic'

  const mode = requestedMode
  const [stage, setStage] = useState<StudioStage>(initialStage)
  const [scriptId, setScriptId] = useState<string | null>(savedScript?.id || null)
  const [title, setTitle] = useState(savedScript?.title || passedTopic?.title || '')
  const [angle, setAngle] = useState(savedScript?.angle || passedTopic?.angle || '')
  const [audience, setAudience] = useState(savedScript?.target_audience || passedTopic?.target_audience || '')
  const [keywords, setKeywords] = useState<string[]>(savedScript?.keywords || passedTopic?.keywords || [])
  const [duration, setDuration] = useState(savedScript?.est_duration || 60)
  const [style, setStyle] = useState(savedScript?.style || '干货')
  const [outline, setOutline] = useState<Outline | null>(savedScript?.outline || null)
  const [segments, setSegments] = useState<ScriptSegment[]>(savedScript?.segments || [])
  const [loadingOutline, setLoadingOutline] = useState(false)
  const [loadingScript, setLoadingScript] = useState(false)
  const [saving, setSaving] = useState(false)
  const [composing, setComposing] = useState(false)
  const [withScene, setWithScene] = useState(true)
  const [dirty, setDirty] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  const hasOutline = hasOutlineContent(outline)
  const hasSegments = segments.length > 0
  const totalSeconds = segments.reduce((sum, segment) => sum + (segment.est_seconds || 0), 0)

  useEffect(() => {
    sessionStorage.setItem(UNSAVED_DRAFT_KEY, dirty ? 'true' : 'false')
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  useEffect(() => () => sessionStorage.removeItem(UNSAVED_DRAFT_KEY), [])

  const canOpenStage = (nextStage: StudioStage) => {
    if (nextStage === 'topic' || nextStage === 'brief') return true
    if (nextStage === 'outline') return hasOutline
    return hasSegments
  }

  const openStage = (nextStage: StudioStage) => {
    if (!canOpenStage(nextStage)) return
    setStage(nextStage)
    window.setTimeout(() => canvasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
  }

  const markDirty = () => setDirty(true)

  const handlePickTopic = (topic: TopicCard) => {
    setTitle(topic.title || '')
    setAngle(topic.angle || '')
    setAudience(topic.target_audience || '')
    setKeywords(topic.keywords || [])
    setOutline(null)
    setSegments([])
    setDirty(true)
    setStage('brief')
    toast.success('选题已加入创作设置')
  }

  const handleGenerateOutline = async () => {
    if (!title.trim()) {
      toast.warning('请填写选题标题')
      return
    }
    setLoadingOutline(true)
    try {
      const response = await scriptApi.generateOutline({
        title: title.trim(),
        angle,
        target_audience: audience,
        keywords,
        duration,
      })
      setOutline(response)
      setSegments([])
      setDirty(true)
      setStage('outline')
    } catch (error: unknown) {
      toast.error(getRequestErrorMessage(error, '生成大纲失败'))
    } finally {
      setLoadingOutline(false)
    }
  }

  const handleGenerateScript = async () => {
    if (!outline || !hasOutline) {
      toast.warning('请先完善内容大纲')
      return
    }
    setLoadingScript(true)
    try {
      const response = await scriptApi.generateScript({ title: title.trim(), outline, style, duration })
      setSegments(response)
      setDirty(true)
      setStage('storyboard')
    } catch (error: unknown) {
      toast.error(getRequestErrorMessage(error, '生成文案失败'))
    } finally {
      setLoadingScript(false)
    }
  }

  const updateHook = (value: string) => {
    if (!outline) return
    setOutline({ ...outline, hook: value })
    markDirty()
  }

  const updateCta = (value: string) => {
    if (!outline) return
    setOutline({ ...outline, cta: value })
    markDirty()
  }

  const updateSection = (index: number, field: 'point' | 'detail', value: string) => {
    if (!outline) return
    setOutline({
      ...outline,
      sections: outline.sections.map((section, sectionIndex) => (
        sectionIndex === index ? { ...section, [field]: value } : section
      )),
    })
    markDirty()
  }

  const updateSegment = <K extends keyof ScriptSegment>(index: number, field: K, value: ScriptSegment[K]) => {
    setSegments((current) => current.map((segment, segmentIndex) => (
      segmentIndex === index ? { ...segment, [field]: value } : segment
    )))
    markDirty()
  }

  const buildPayload = () => ({
    title: title.trim(),
    angle,
    target_audience: audience,
    keywords,
    outline: outline || { hook: '', sections: [], cta: '' },
    segments,
    style,
    est_duration: duration,
  })

  const handleSave = async () => {
    if (!title.trim()) {
      toast.warning('请填写选题标题')
      return
    }
    setSaving(true)
    try {
      if (scriptId) {
        await scriptApi.update(scriptId, buildPayload())
      } else {
        const created = await scriptApi.save(buildPayload())
        setScriptId(created.id)
      }
      setDirty(false)
      toast.success('已保存到草稿箱')
    } catch (error: unknown) {
      toast.error(getRequestErrorMessage(error, '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  const handleCompose = async () => {
    if (!hasSegments) {
      toast.warning('请先生成分镜文案')
      return
    }
    setComposing(true)
    try {
      const ready = await composeApi.ready()
      if (!ready.ready) {
        toast.warning(ready.hint || '自动成片依赖未就绪')
        return
      }
      let id = scriptId
      if (id) {
        await scriptApi.update(id, buildPayload())
      } else {
        const created = await scriptApi.save(buildPayload())
        id = created.id
        setScriptId(created.id)
      }
      const response = await composeApi.fromScript(id, withScene)
      setDirty(false)
      toast.success('视频已进入生成队列')
      navigate(`/processing/${response.project_id}`)
    } catch (error: unknown) {
      toast.error(getRequestErrorMessage(error, '启动生成视频失败'))
    } finally {
      setComposing(false)
    }
  }

  const stageMeta = STAGES.find((item) => item.value === stage) || STAGES[0]
  const stageHeader = stage === 'topic'
    ? { label: '输入关键词，找到创作方向', description: '描述内容领域，可补充关键词以缩小选题范围。' }
    : stageMeta

  return (
    <main className="min-h-[calc(100svh-4rem)] bg-background p-6">
      <div className="w-full">
        {isSavedEditorRoute && (
          <SecondaryPageNavigation backTo="/manage?tab=scripts" backLabel="文案管理" />
        )}

        <div className="min-h-[calc(100svh-7rem)]">
          <div className={cn('grid min-h-[calc(100svh-7rem)] gap-6', mode === 'topic' && 'lg:grid-cols-[260px_minmax(0,1fr)]')}>
            {mode === 'topic' && (
              <aside className="flex min-w-0 flex-col">
                <nav aria-label="创作阶段">
                  <div className="flex snap-x gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:block lg:space-y-1.5 lg:overflow-visible lg:pb-0">
                    {STAGES.map((item) => {
                      const active = stage === item.value
                      const enabled = canOpenStage(item.value)
                      return (
                        <Button
                          key={item.value}
                          type="button"
                          variant="ghost"
                          disabled={!enabled}
                          onClick={() => openStage(item.value)}
                          className={cn(
                            'h-auto min-w-[166px] snap-start justify-start gap-3 rounded-xl px-2 py-3 text-left disabled:cursor-not-allowed disabled:opacity-38 lg:w-full lg:min-w-0',
                            active ? 'bg-muted text-foreground shadow-none hover:bg-muted' : 'text-muted-foreground hover:bg-muted/55 hover:text-foreground',
                          )}
                        >
                          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-medium tabular-nums', active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground')}>
                            {item.number}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-medium">{item.label}</span>
                            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{item.description}</span>
                          </span>
                        </Button>
                      )
                    })}
                  </div>
                </nav>

                <div className="mt-3 flex gap-2 px-2 lg:mt-auto lg:flex-col lg:pt-6">
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-w-0 flex-1 lg:w-full"
                    disabled={!title.trim() || saving}
                    onClick={() => void handleSave()}
                  >
                    <Icon icon={saving ? restartCircleLinear : disketteLinear} className={saving ? 'motion-safe:animate-spin' : undefined} />
                    {saving ? '保存中' : '保存草稿'}
                  </Button>
                  <Button
                    type="button"
                    className="min-w-0 flex-1 lg:w-full"
                    disabled={!hasSegments || composing}
                    onClick={() => void handleCompose()}
                  >
                    <Icon icon={composing ? restartCircleLinear : videoFramePlayHorizontalBold} className={composing ? 'motion-safe:animate-spin' : 'text-primary-foreground'} />
                    {composing ? '正在启动' : '生成视频'}
                  </Button>
                </div>
              </aside>
            )}

            <Card
              ref={canvasRef}
              className={cn(
                'flex min-w-0 scroll-mt-3 overflow-visible rounded-none border-0 shadow-none',
                mode === 'topic' ? 'bg-muted' : 'bg-transparent',
              )}
            >
              {mode === 'upload' ? (
                <FileUpload
                  attachedScript={state?.attachedScript || (outline ? JSON.stringify({ title: title.trim(), outline, segments }) : undefined)}
                  onUploadSuccess={(projectId) => {
                    toast.success('项目已创建，正在分析视频')
                    navigate(`/processing/${projectId}`)
                  }}
                />
            ) : (
              <div className="flex min-h-full flex-1 flex-col p-6">
                <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-medium tracking-[-0.03em]">{stageHeader.label}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{stageHeader.description}</p>
                  </div>
                  {stage === 'storyboard' && hasSegments && (
                    <div className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                      <span>{segments.length} 个镜头</span>
                      <span className="flex items-center gap-1.5 tabular-nums"><Icon icon={clockCircleLinear} />约 {totalSeconds} 秒</span>
                    </div>
                  )}
                </header>

                {stage === 'topic' && <HotspotPanel embedded onPickTopic={handlePickTopic} />}

                {stage === 'brief' && (
                  <div className="flex min-h-0 flex-1 flex-col gap-5">
                    <div className="grid gap-5 rounded-[var(--studio-surface-radius)] bg-background p-5 sm:p-6 lg:grid-cols-2">
                      <div className="space-y-2 lg:col-span-2">
                        <Label htmlFor="script-title">选题标题</Label>
                        <Input id="script-title" value={title} onChange={(event) => { setTitle(event.target.value); markDirty() }} placeholder="输入本期内容主题" className="bg-background" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="script-angle">切入角度</Label>
                        <Textarea id="script-angle" value={angle} onChange={(event) => { setAngle(event.target.value); markDirty() }} placeholder="这条内容具体讲什么" className="min-h-28 resize-none bg-background" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="script-audience">目标观众</Label>
                        <Textarea id="script-audience" value={audience} onChange={(event) => { setAudience(event.target.value); markDirty() }} placeholder="这条内容要讲给谁听" className="min-h-28 resize-none bg-background" />
                      </div>
                      <div className="space-y-2 lg:col-span-2">
                        <Label htmlFor="script-keywords">内容关键词</Label>
                        <Input id="script-keywords" value={keywords.join('、')} onChange={(event) => { setKeywords(event.target.value.split(/[、,，]/).map((item) => item.trim()).filter(Boolean)); markDirty() }} placeholder="例如：效率、AI、创作者" className="bg-background" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="script-duration">目标时长</Label>
                        <Select value={String(duration)} onValueChange={(value) => { setDuration(Number(value)); markDirty() }}>
                          <SelectTrigger id="script-duration" className="bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 秒</SelectItem>
                            <SelectItem value="60">60 秒</SelectItem>
                            <SelectItem value="90">90 秒</SelectItem>
                            <SelectItem value="180">3 分钟</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="script-style">表达风格</Label>
                        <Select value={style} onValueChange={(value) => { setStyle(value); markDirty() }}>
                          <SelectTrigger id="script-style" className="bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>{STYLE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mt-auto flex justify-end pt-5">
                      <Button type="button" size="lg" disabled={loadingOutline} onClick={() => void handleGenerateOutline()}>
                        <Icon icon={loadingOutline ? restartCircleLinear : lightbulbLinear} className={loadingOutline ? 'motion-safe:animate-spin' : undefined} />
                        {loadingOutline ? '正在生成大纲' : hasOutline ? '重新生成大纲' : '生成大纲'}
                      </Button>
                    </div>
                  </div>
                )}

                {stage === 'outline' && (
                  <div className="space-y-4">
                    {loadingOutline ? (
                      <div className="space-y-3"><Skeleton className="h-28 rounded-[var(--studio-surface-radius)]" /><Skeleton className="h-56 rounded-[var(--studio-surface-radius)]" /><Skeleton className="h-28 rounded-[var(--studio-surface-radius)]" /></div>
                    ) : outline ? (
                      <>
                        <div className="rounded-[var(--studio-surface-radius)] bg-background p-5">
                          <div className="mb-3"><Label htmlFor="outline-hook">开头钩子</Label></div>
                          <Textarea id="outline-hook" value={outline.hook} onChange={(event) => updateHook(event.target.value)} className="min-h-24 resize-none bg-background" />
                        </div>
                        <div className="rounded-[var(--studio-surface-radius)] bg-background p-5">
                          <div className="mb-4 flex items-center justify-between"><Label>正文要点</Label><span className="text-xs text-muted-foreground">{outline.sections.length} 个部分</span></div>
                          <div className="space-y-4">
                            {outline.sections.map((section, index) => (
                              <div key={index} className="grid grid-cols-[30px_minmax(0,1fr)] gap-3">
                                <span className="flex size-7 items-center justify-center rounded-[9px] bg-foreground text-[10px] text-background">{String(index + 1).padStart(2, '0')}</span>
                                <div className="space-y-2">
                                  <Input value={section.point} onChange={(event) => updateSection(index, 'point', event.target.value)} className="bg-background font-medium" aria-label={`正文要点 ${index + 1}`} />
                                  <Textarea value={section.detail} onChange={(event) => updateSection(index, 'detail', event.target.value)} className="min-h-20 resize-none bg-background" aria-label={`正文要点 ${index + 1} 详情`} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-[var(--studio-surface-radius)] bg-background p-5">
                          <div className="mb-3"><Label htmlFor="outline-cta">结尾号召</Label></div>
                          <Textarea id="outline-cta" value={outline.cta} onChange={(event) => updateCta(event.target.value)} className="min-h-24 resize-none bg-background" />
                        </div>
                        <div className="flex justify-end pt-1">
                          <Button type="button" size="lg" disabled={loadingScript} onClick={() => void handleGenerateScript()}>
                            <Icon icon={loadingScript ? restartCircleLinear : documentTextBold} className={loadingScript ? 'motion-safe:animate-spin' : undefined} />
                            {loadingScript ? '正在生成分镜' : hasSegments ? '重新生成分镜' : '生成分镜文案'}
                          </Button>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}

                {stage === 'storyboard' && (
                  <div className="space-y-4">
                    {loadingScript ? (
                      <div className="space-y-3"><Skeleton className="h-44 rounded-[var(--studio-surface-radius)]" /><Skeleton className="h-44 rounded-[var(--studio-surface-radius)]" /><Skeleton className="h-44 rounded-[var(--studio-surface-radius)]" /></div>
                    ) : (
                      segments.map((segment, index) => (
                        <article key={`${segment.index}-${index}`} className="rounded-[var(--studio-surface-radius)] bg-background p-5 sm:p-6">
                          <div className="mb-4 flex flex-wrap items-center gap-2.5">
                            <span className="flex size-8 items-center justify-center rounded-[10px] bg-foreground text-[10px] tabular-nums text-background">{String(index + 1).padStart(2, '0')}</span>
                            <span className="text-sm font-medium">{ROLE_LABEL[segment.role]}</span>
                            <div className="ml-auto flex items-center gap-2">
                              <Label htmlFor={`segment-duration-${index}`} className="text-xs font-normal text-muted-foreground">时长</Label>
                              <Input id={`segment-duration-${index}`} type="number" min={0} value={segment.est_seconds} onChange={(event) => updateSegment(index, 'est_seconds', Number(event.target.value) || 0)} className="h-8 w-20 bg-background text-xs tabular-nums" />
                            </div>
                          </div>
                          <div className="space-y-3">
                            <Textarea value={segment.narration} onChange={(event) => updateSegment(index, 'narration', event.target.value)} placeholder="输入这一镜的口播文案" className="min-h-24 resize-y bg-background text-[15px] leading-7" aria-label={`镜头 ${index + 1} 口播文案`} />
                            <div className="relative">
                              <Icon icon={videoFramePlayHorizontalLinear} className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                              <Input value={segment.visual} onChange={(event) => updateSegment(index, 'visual', event.target.value)} placeholder="补充画面、构图或动效建议" className="bg-background pl-10 text-xs" aria-label={`镜头 ${index + 1} 画面建议`} />
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                    <div className="flex flex-col gap-3 rounded-[var(--studio-surface-radius)] bg-foreground p-5 text-background sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">分镜已经准备好</p>
                        <p className="mt-1 text-xs text-background/55">确认配音、字幕与信息动画后即可生成视频。</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs text-background/70">
                          <Switch checked={withScene} onCheckedChange={setWithScene} aria-label="生成信息动画" />
                          信息动画
                        </label>
                        <Button type="button" variant="secondary" disabled={composing} onClick={() => void handleCompose()}>
                          <Icon icon={composing ? restartCircleLinear : videoFramePlayHorizontalBold} className={composing ? 'motion-safe:animate-spin' : undefined} />
                          {composing ? '正在启动' : '生成视频'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
        </div>
      </div>
    </main>
  )
}

export default ScriptEditorPage
