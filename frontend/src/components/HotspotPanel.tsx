import React, { useState } from 'react'
import { Icon } from '@iconify/react'
import infoCircleLinear from '@iconify-icons/solar/info-circle-linear'
import magniferBold from '@iconify-icons/solar/magnifer-bold'
import magniferLinear from '@iconify-icons/solar/magnifer-linear'
import restartLinear from '@iconify-icons/solar/restart-linear'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import TopicCard from './TopicCard'
import { hotspotApi, TopicCard as TopicCardData } from '../services/api'
import { Alert, AlertDescription } from './ui/alert'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Skeleton } from './ui/skeleton'

const HotspotResultSkeleton = () => (
  <Card className="flex min-h-[320px] flex-col border-border/70 shadow-none">
    <CardHeader className="space-y-4 p-5 pb-4">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-4 w-14" />
      </div>
      <Skeleton className="h-6 w-4/5" />
      <Skeleton className="h-4 w-full" />
    </CardHeader>
    <CardContent className="flex flex-1 flex-col gap-4 px-5 pb-5">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="mt-auto flex items-center justify-between border-t pt-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-24 rounded-[10px]" />
      </div>
    </CardContent>
  </Card>
)

/**
 * 热点选题面板：查热点 → 列出选题卡片。
 * 点某个选题卡片「生成文案」→ 跳转到文案编辑页（/script），
 * 生成大纲 / 生成文案 / 保存 / 用它剪视频 都在那个独立页面完成。
 */
interface HotspotPanelProps {
  onPickTopic?: (topic: TopicCardData) => void
  embedded?: boolean
}

const HotspotPanel: React.FC<HotspotPanelProps> = ({ onPickTopic, embedded = false }) => {
  const navigate = useNavigate()
  const [domain, setDomain] = useState('')
  const [keywords, setKeywords] = useState('')
  const [count, setCount] = useState(5)
  const [searching, setSearching] = useState(false)
  const [topics, setTopics] = useState<TopicCardData[]>([])
  const [meta, setMeta] = useState<{ search_available: boolean } | null>(null)
  const [lastQuery, setLastQuery] = useState('')

  const handleSearch = async () => {
    if (!domain.trim()) {
      toast.warning('请输入领域方向')
      return
    }

    setSearching(true)
    try {
      const normalizedDomain = domain.trim()
      const normalizedKeywords = keywords.trim()
      const res = await hotspotApi.search({ domain: normalizedDomain, keywords: normalizedKeywords, count })
      setTopics(res.topics || [])
      setMeta({ search_available: res.search_available })
      setLastQuery([normalizedDomain, normalizedKeywords].filter(Boolean).join(' · '))
      if (!res.topics?.length) toast.info('没有生成选题，换个领域再试试')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || '查热点失败，请检查后端与 LLM 配置')
    } finally {
      setSearching(false)
    }
  }

  const handlePickTopic = (topic: TopicCardData) => {
    if (onPickTopic) {
      onPickTopic(topic)
      return
    }
    navigate('/script', { state: { topic } })
  }

  return (
    <div className={embedded ? 'flex min-h-0 flex-1 flex-col gap-5' : 'space-y-8'}>
      <Card className={embedded ? 'rounded-[var(--studio-surface-radius)] border-0 bg-background shadow-none' : 'border-border/70 shadow-none'}>
        {!embedded && (
          <CardHeader className="gap-3 p-5 pb-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0 sm:p-6 sm:pb-5">
            <div className="space-y-1.5">
              <CardTitle className="text-lg">输入关键词，找到创作方向</CardTitle>
              <CardDescription className="leading-6">描述内容领域，可补充关键词以缩小选题范围。</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit shrink-0 font-normal">每次生成 1–15 个选题</Badge>
          </CardHeader>
        )}

        <CardContent className={embedded ? '@container p-5 sm:p-6' : '@container p-5 pt-0 sm:p-6 sm:pt-0'}>
          <form
            className="grid grid-cols-1 gap-4 @sm:grid-cols-2 @[44rem]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_6rem] @[44rem]:items-end"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSearch()
            }}
          >
            <div className="min-w-0 space-y-2">
              <Label htmlFor="hotspot-domain">领域方向</Label>
              <Input
                id="hotspot-domain"
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
                placeholder="例如：AI 工具、职场成长"
                disabled={searching}
                className="h-11"
              />
            </div>

            <div className="min-w-0 space-y-2">
              <Label htmlFor="hotspot-keywords">关键词 <span className="font-normal text-muted-foreground">可选</span></Label>
              <Input
                id="hotspot-keywords"
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="例如：效率、入门"
                disabled={searching}
                className="h-11"
              />
            </div>

            <div className="min-w-0 space-y-2 @sm:col-span-2 @[44rem]:col-span-1">
              <Label htmlFor="hotspot-count">选题数量</Label>
              <Input
                id="hotspot-count"
                type="number"
                min={1}
                max={15}
                value={count}
                onChange={(event) => {
                  const nextCount = event.currentTarget.valueAsNumber
                  if (!Number.isNaN(nextCount)) setCount(Math.min(15, Math.max(1, nextCount)))
                }}
                disabled={searching}
                className="h-11 tabular-nums"
              />
            </div>

            <Button type="submit" size="lg" disabled={searching} className="h-11 w-full @sm:col-span-2 @[44rem]:col-span-3">
              <Icon icon={searching ? restartLinear : magniferBold} className={searching ? 'size-4 animate-spin text-white' : 'size-4 text-white'} />
              {searching ? '正在查找' : '查热点'}
            </Button>
          </form>

          {meta && !meta.search_available && (
            <Alert className="mt-5 border-0 bg-muted/55 text-muted-foreground">
              <Icon icon={infoCircleLinear} className="size-4" />
              <AlertDescription>
                当前未启用联网搜索，结果由 AI 根据领域知识生成，建议在使用前核对时效性。
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <section className={embedded ? 'flex min-h-[260px] flex-1 flex-col' : undefined} aria-live="polite" aria-busy={searching}>
        {searching ? (
          <div>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.015em]">正在整理选题</h2>
                <p className="mt-1 text-sm text-muted-foreground">AI 正在分析热度、内容角度和目标受众。</p>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <HotspotResultSkeleton />
              <HotspotResultSkeleton />
            </div>
          </div>
        ) : topics.length > 0 ? (
          <div>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.015em]">推荐选题</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  围绕“{lastQuery}”找到 {topics.length} 个可继续创作的方向。
                </p>
              </div>
              <Badge variant="outline" className="w-fit font-normal">
                {meta?.search_available ? '联网热点' : 'AI 推荐'}
              </Badge>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {topics.map((topic) => (
                <TopicCard key={topic.id} topic={topic} onUse={handlePickTopic} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[260px] flex-1 flex-col items-center justify-center rounded-[var(--studio-surface-radius)] bg-background px-6 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
              <Icon icon={magniferLinear} className="size-5" />
            </span>
            <h2 className="mt-4 text-base font-semibold">
              {meta ? '暂时没有找到合适选题' : '从一个明确的领域开始'}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {meta
                ? '可以调整领域描述、减少关键词，或换一个更具体的方向再次搜索。'
                : '输入你准备创作的内容领域，AI 会整理热度、切入角度与适合的人群。'}
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

export default HotspotPanel
