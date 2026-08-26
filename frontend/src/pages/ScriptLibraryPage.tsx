import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import clockCircleLinear from '@iconify-icons/solar/clock-circle-linear'
import documentTextLinear from '@iconify-icons/solar/document-text-linear'
import downloadLinear from '@iconify-icons/solar/download-linear'
import magniferLinear from '@iconify-icons/solar/magnifer-linear'
import menuDotsLinear from '@iconify-icons/solar/menu-dots-linear'
import penNewSquareLinear from '@iconify-icons/solar/pen-new-square-linear'
import restartCircleLinear from '@iconify-icons/solar/restart-circle-linear'
import scissorsLinear from '@iconify-icons/solar/scissors-linear'
import trashBinLinear from '@iconify-icons/solar/trash-bin-minimalistic-linear'
import videoFramePlayBold from '@iconify-icons/solar/video-frame-play-horizontal-bold'
import dayjs from 'dayjs'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import WorkspacePageHeader from '@/components/WorkspacePageHeader'
import { cn } from '@/lib/utils'
import { composeApi, scriptApi } from '@/services/api'
import type { CaptionStyle, SavedScript } from '@/services/api'

const CAPTION_STYLE_OPTIONS: { value: CaptionStyle; label: string; description: string }[] = [
  { value: 'classic', label: '经典字幕', description: '整句显示，画面干净稳定，适合大多数内容。' },
  { value: 'karaoke', label: '逐字点亮', description: '跟随口播逐字强调，更适合节奏鲜明的短视频。' },
]

const SEGMENT_ROLE_LABEL: Record<SavedScript['segments'][number]['role'], string> = {
  hook: '开头钩子',
  body: '正文',
  cta: '结尾号召',
}

type SortOption = 'updated' | 'created' | 'title'
type ScriptStatusFilter = 'draft' | 'ready'
type DateFilter = 'all' | '7' | '30'
type ExportFormat = 'txt' | 'md' | 'json' | 'srt'

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response
    if (response?.data?.detail) return response.data.detail
  }

  return fallback
}

function scriptTimestamp(script: SavedScript, field: 'created_at' | 'updated_at') {
  const value = script[field]
  return value ? dayjs(value).valueOf() : 0
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return remaining ? `${minutes} 分 ${remaining} 秒` : `${minutes} 分钟`
}

function formatSrtTime(totalSeconds: number) {
  const milliseconds = Math.max(0, Math.round(totalSeconds * 1000))
  const hours = Math.floor(milliseconds / 3_600_000)
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000)
  const seconds = Math.floor((milliseconds % 60_000) / 1000)
  const remainder = milliseconds % 1000
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':') + `,${String(remainder).padStart(3, '0')}`
}

function exportScript(script: SavedScript, format: ExportFormat) {
  let content = ''
  let mimeType = 'text/plain;charset=utf-8'

  if (format === 'json') {
    content = JSON.stringify(script, null, 2)
    mimeType = 'application/json;charset=utf-8'
  } else if (format === 'srt') {
    let cursor = 0
    content = (script.segments || []).map((segment, index) => {
      const end = cursor + Math.max(1, segment.est_seconds || 1)
      const block = `${index + 1}\n${formatSrtTime(cursor)} --> ${formatSrtTime(end)}\n${segment.narration.trim()}`
      cursor = end
      return block
    }).join('\n\n')
  } else {
    const outline = script.outline
    const lines = [
      script.title,
      '',
      `切入角度：${script.angle || '—'}`,
      `目标观众：${script.target_audience || '—'}`,
      `表达风格：${script.style || '—'}`,
      `目标时长：${script.est_duration || 0} 秒`,
      '',
      '开头钩子',
      outline?.hook || '—',
      '',
      '正文要点',
      ...(outline?.sections || []).flatMap((section, index) => [`${index + 1}. ${section.point}`, section.detail]),
      '',
      '结尾号召',
      outline?.cta || '—',
      '',
      '分镜文案',
      ...(script.segments || []).flatMap((segment, index) => [
        `${index + 1}. ${SEGMENT_ROLE_LABEL[segment.role]} · ${segment.est_seconds} 秒`,
        segment.narration,
        `画面：${segment.visual}`,
        '',
      ]),
    ]
    content = format === 'md'
      ? lines.map((line) => {
          if (line === script.title) return `# ${line}`
          if (['开头钩子', '正文要点', '结尾号召', '分镜文案'].includes(line)) return `## ${line}`
          return line
        }).join('\n')
      : lines.join('\n')
    mimeType = format === 'md' ? 'text/markdown;charset=utf-8' : mimeType
  }

  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const safeTitle = script.title.replace(/[\\/:*?"<>|]/g, '-').trim() || '未命名文案'
  anchor.href = url
  anchor.download = `${safeTitle}.${format}`
  anchor.click()
  URL.revokeObjectURL(url)
}

const ScriptLibraryPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [scripts, setScripts] = useState<SavedScript[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('updated')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [composingId, setComposingId] = useState<string | null>(null)
  const [pendingScript, setPendingScript] = useState<SavedScript | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SavedScript | null>(null)
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('classic')
  const statusFilter: ScriptStatusFilter = searchParams.get('view') === 'drafts' ? 'draft' : 'ready'
  const sectionTitle = statusFilter === 'draft' ? '草稿箱' : '历史文案'

  const load = async () => {
    setLoading(true)
    try {
      setScripts(await scriptApi.list())
    } catch {
      toast.error('加载文案列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const visibleScripts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
    const dateThreshold = dateFilter === 'all' ? 0 : dayjs().subtract(Number(dateFilter), 'day').valueOf()
    const filtered = scripts.filter((script) => {
      const isReady = Boolean(script.segments?.length)
      if (statusFilter === 'draft' && isReady) return false
      if (statusFilter === 'ready' && !isReady) return false
      if (dateThreshold && scriptTimestamp(script, 'updated_at') < dateThreshold) return false

      if (normalizedQuery) {
          const searchableText = [
            script.title,
            script.outline?.hook,
            script.angle,
            script.target_audience,
            script.style,
          ].filter(Boolean).join(' ').toLocaleLowerCase()
          return searchableText.includes(normalizedQuery)
      }
      return true
    })

    return filtered.sort((a, b) => {
      if (sortOption === 'title') return a.title.localeCompare(b.title, 'zh-CN')
      if (sortOption === 'created') return scriptTimestamp(b, 'created_at') - scriptTimestamp(a, 'created_at')
      return scriptTimestamp(b, 'updated_at') - scriptTimestamp(a, 'updated_at')
    })
  }, [dateFilter, scripts, searchQuery, sortOption, statusFilter])

  const handleEdit = (script: SavedScript) => navigate('/script', { state: { savedScript: script } })

  const handleUseForClip = (script: SavedScript) => {
    const selected = { title: script.title, outline: script.outline, segments: script.segments }
    navigate('/create', { state: { creationMode: 'upload', attachedScript: JSON.stringify(selected) } })
  }

  const openComposeSheet = (script: SavedScript) => {
    if (!script.segments?.length) {
      toast.warning('这篇文案还没有分镜内容，无法生成视频')
      return
    }
    setCaptionStyle('classic')
    setPendingScript(script)
  }

  const handleCompose = async () => {
    const script = pendingScript
    if (!script) return
    setComposingId(script.id)

    try {
      const ready = await composeApi.ready()
      if (!ready.ready) {
        toast.warning(ready.hint || '自动成片依赖未就绪')
        return
      }
      await composeApi.fromScript(script.id, true, captionStyle)
      setPendingScript(null)
      toast.success('已开始生成视频，可以查看实时进度')
      navigate('/manage?tab=projects')
    } catch (error: unknown) {
      toast.error(getRequestErrorMessage(error, '启动生成视频失败'))
    } finally {
      setComposingId(null)
    }
  }

  const handleDelete = async () => {
    const script = deleteTarget
    if (!script) return

    try {
      await scriptApi.remove(script.id)
      setScripts((current) => current.filter((item) => item.id !== script.id))
      setDeleteTarget(null)
      toast.success('文案已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  return (
    <main className="min-h-[calc(100svh-3.5rem)] bg-background px-6 pb-16 pt-10 lg:pb-20">
      <div className="w-full max-w-[1240px]">
        <WorkspacePageHeader
          title={sectionTitle}
        />

        <div className="grid items-start gap-5">
          <section aria-labelledby="library-list-heading" className="@container">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative min-w-0 flex-1">
                <Icon icon={magniferLinear} className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索标题、钩子或风格"
                  aria-label="搜索文案"
                  className="border-transparent bg-muted pl-10"
                />
              </div>
              <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)}>
                <SelectTrigger className="w-full rounded-xl border-transparent bg-muted md:w-[148px]" aria-label="更新时间范围">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部时间</SelectItem>
                  <SelectItem value="7">最近 7 天</SelectItem>
                  <SelectItem value="30">最近 30 天</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                <SelectTrigger className="w-full rounded-xl border-transparent bg-muted md:w-[148px]" aria-label="文案排序方式">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">最近更新</SelectItem>
                  <SelectItem value="created">最近创建</SelectItem>
                  <SelectItem value="title">标题排序</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <h2 id="library-list-heading" className="sr-only">{sectionTitle}</h2>

            {loading ? (
              <div className="grid gap-4 @[48rem]:grid-cols-2">
                {[0, 1, 2, 3].map((item) => (
                  <Card key={item} className="min-h-[360px] rounded-[20px] border-border/70 p-0 shadow-none">
                    <CardHeader className="gap-4 p-5 pb-0">
                      <div className="flex items-center justify-between">
                        <Skeleton className="size-10 rounded-xl" />
                        <Skeleton className="h-6 w-28 rounded-full" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-3/5" />
                        <Skeleton className="h-4 w-4/5" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5 p-5">
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-16 rounded-full" />
                        <Skeleton className="h-6 w-20 rounded-full" />
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </div>
                      <Skeleton className="h-24 rounded-2xl" />
                    </CardContent>
                    <CardFooter className="mt-auto gap-2 border-t border-border/60 p-4">
                      <Skeleton className="h-9 flex-1 rounded-[10px]" />
                      <Skeleton className="h-9 flex-1 rounded-[10px]" />
                      <Skeleton className="size-9 rounded-[10px]" />
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : visibleScripts.length > 0 ? (
              <div className="grid gap-4 @[48rem]:grid-cols-2">
                {visibleScripts.map((script) => {
                  const outlinePoints = script.outline?.sections?.map((section) => section.point).filter(Boolean).slice(0, 2) || []
                  const updatedAt = script.updated_at || script.created_at
                  const isDraft = !script.segments?.length

                  return (
                    <Card
                      key={script.id}
                      className="group flex min-h-[360px] flex-col overflow-hidden rounded-[20px] border-border/70 bg-card p-0 shadow-none transition-[border-color,box-shadow] hover:border-foreground/15 hover:shadow-sm"
                    >
                      <CardHeader className="gap-0 p-5 pb-0">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
                            <Icon icon={documentTextLinear} className="size-[18px]" />
                          </span>
                          <div className="flex min-w-0 items-center gap-2">
                            <Badge variant="secondary" className="shrink-0 border-0 font-normal">
                              {isDraft ? '草稿' : '已完成'}
                            </Badge>
                            <span className="truncate text-xs text-muted-foreground">
                              {updatedAt ? `${dayjs(updatedAt).format('M 月 D 日 HH:mm')} 更新` : '最近更新'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleEdit(script)}
                          className="mt-4 min-w-0 text-left outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <CardTitle className="line-clamp-2 text-[17px] leading-6 tracking-[-0.02em] transition-colors group-hover:text-primary">
                            {script.title}
                          </CardTitle>
                        </button>
                      </CardHeader>

                      <CardContent className="flex flex-1 flex-col px-5 pb-5 pt-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="border-0 font-normal">{script.segments?.length || 0} 个分镜</Badge>
                          {script.est_duration ? (
                            <Badge variant="secondary" className="gap-1.5 border-0 font-normal">
                              <Icon icon={clockCircleLinear} className="size-3.5" />
                              {formatDuration(script.est_duration)}
                            </Badge>
                          ) : null}
                          {script.style ? <Badge variant="secondary" className="border-0 font-normal">{script.style}</Badge> : null}
                        </div>

                        <div className="mt-5 min-h-[104px] rounded-2xl bg-muted/55 p-4">
                          <span className="text-xs font-medium text-muted-foreground">大纲快照</span>
                          {outlinePoints.length > 0 ? (
                            <ul className="mt-3 space-y-2.5">
                              {outlinePoints.map((point, index) => (
                                <li key={`${point}-${index}`} className="flex min-w-0 items-start gap-2.5 text-xs leading-5 text-foreground/80">
                                  <span className="mt-0.5 shrink-0 text-[10px] tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                                  <span className="line-clamp-1 min-w-0">{point}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-3 text-xs leading-5 text-muted-foreground">继续编辑，补充内容大纲与分镜结构。</p>
                          )}
                        </div>
                      </CardContent>

                      <CardFooter className="gap-2 border-t border-border/60 bg-muted/15 p-4">
                        <Button
                          size="sm"
                          variant={isDraft ? 'default' : 'secondary'}
                          className="min-w-0 flex-1"
                          onClick={() => handleEdit(script)}
                        >
                          <Icon icon={penNewSquareLinear} className={isDraft ? 'text-white' : undefined} />
                          {isDraft ? '继续编辑' : '编辑文案'}
                        </Button>
                        {!isDraft && (
                          <Button
                            size="sm"
                            className="min-w-0 flex-1"
                            onClick={() => openComposeSheet(script)}
                            disabled={composingId === script.id}
                          >
                            <Icon
                              icon={composingId === script.id ? restartCircleLinear : videoFramePlayBold}
                              className={composingId === script.id ? 'motion-safe:animate-spin' : 'text-white'}
                            />
                            生成视频
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label={`更多操作：${script.title}`}>
                              <Icon icon={menuDotsLinear} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl">
                            <DropdownMenuItem onSelect={() => handleUseForClip(script)}>
                              <Icon icon={scissorsLinear} />
                              剪辑视频
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <Icon icon={downloadLinear} />
                                导出文案
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-48 rounded-xl">
                                <DropdownMenuItem onSelect={() => exportScript(script, 'md')}>Markdown (.md)</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => exportScript(script, 'txt')}>纯文本 (.txt)</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => exportScript(script, 'json')}>结构化数据 (.json)</DropdownMenuItem>
                                <DropdownMenuItem disabled={isDraft} onSelect={() => exportScript(script, 'srt')}>字幕文件 (.srt)</DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(script)}>
                              <Icon icon={trashBinLinear} />
                              删除文案
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardFooter>
                    </Card>
                  )
                })}
              </div>
            ) : scripts.length > 0 ? (
              <Card className="border-border/70 shadow-none">
                <CardContent className="flex min-h-[390px] flex-col items-center justify-center px-6 text-center">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                    <Icon icon={magniferLinear} className="size-5" />
                  </span>
                  <h2 className="mt-4 text-sm font-semibold">没有找到匹配的文案</h2>
                  <p className="mt-2 text-xs text-muted-foreground">换一个关键词，或清除当前搜索条件。</p>
                  <Button className="mt-5" size="sm" variant="outline" onClick={() => setSearchQuery('')}>清除搜索</Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border/70 shadow-none">
                <CardContent className="flex min-h-[390px] flex-col items-center justify-center px-6 text-center">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                    <Icon icon={documentTextLinear} className="size-5" />
                  </span>
                  <h2 className="mt-5 text-base font-semibold">建立你的第一篇文案</h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">从一个选题开始，依次完成大纲、分镜和成片。</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Button onClick={() => navigate('/create')}>开始创作</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </section>

        </div>
      </div>

      <Sheet open={Boolean(pendingScript)} onOpenChange={(open) => !open && setPendingScript(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-[440px]">
          <SheetHeader className="border-b px-6 pb-6 pt-7">
            <SheetTitle className="text-xl">生成视频</SheetTitle>
            <SheetDescription className="pt-1 leading-6">
              为「{pendingScript?.title}」选择字幕呈现方式。
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto px-6 py-6">
            <p className="mb-4 text-sm font-medium">字幕样式</p>
            {CAPTION_STYLE_OPTIONS.map((option) => {
              const active = captionStyle === option.value
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setCaptionStyle(option.value)}
                  className={cn(
                    'w-full rounded-2xl border p-4 text-left outline-none transition-[border-color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring',
                    active ? 'border-primary/35 bg-[var(--brand-soft)]' : 'border-border bg-background hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={cn('text-sm font-medium', active && 'text-primary')}>{option.label}</span>
                    {option.value === 'classic' && <Badge variant="secondary" className="border-0 font-normal">推荐</Badge>}
                  </div>
                  <span className="mt-2 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                </button>
              )
            })}
          </div>

          <SheetFooter className="border-t px-6 py-5">
            <Button className="w-full" size="lg" disabled={Boolean(composingId)} onClick={() => void handleCompose()}>
              <Icon
                icon={composingId ? restartCircleLinear : videoFramePlayBold}
                className={composingId ? 'motion-safe:animate-spin' : 'text-white'}
              />
              {composingId ? '正在启动' : '开始生成视频'}
            </Button>
            <p className="text-center text-xs leading-5 text-muted-foreground">生成后可在工作台查看实时进度</p>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>删除这篇文案？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.title}」及其大纲和分镜内容将被永久删除，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void handleDelete()}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

export default ScriptLibraryPage
