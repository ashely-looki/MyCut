import React from 'react'
import { Icon } from '@iconify/react'
import arrowRightUpLinear from '@iconify-icons/solar/arrow-right-up-linear'
import fileTextBold from '@iconify-icons/solar/file-text-bold'
import linkCircleLinear from '@iconify-icons/solar/link-circle-linear'

import { TopicCard as TopicCardData } from '../services/api'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'
import { Progress } from './ui/progress'

interface TopicCardProps {
  topic: TopicCardData
  onUse?: (topic: TopicCardData) => void
  /** 主操作按钮文案，默认「生成文案」 */
  actionLabel?: string
}

const getSourceLabel = (source: string, index: number) => {
  try {
    return new URL(source).hostname.replace(/^www\./, '')
  } catch {
    return `参考来源 ${index + 1}`
  }
}

/**
 * 选题卡片：呈现热度、创作角度、受众与来源，主操作保持为生成文案。
 */
const TopicCard: React.FC<TopicCardProps> = ({ topic, onUse, actionLabel = '生成文案' }) => {
  const heatPct = Math.max(0, Math.min(100, Math.round((topic.heat_score || 0) * 100)))
  const visibleSources = topic.sources?.slice(0, 3) || []

  return (
    <Card className="group flex h-full flex-col border-border/70 shadow-none transition-[border-color,box-shadow] duration-200 hover:border-border hover:shadow-[var(--brand-card-shadow)]">
      <CardHeader className="space-y-4 p-5 pb-4">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="shrink-0 font-normal tabular-nums">热度 {heatPct}</Badge>
          <Progress className="min-w-0 flex-1" value={heatPct} aria-label={`选题热度 ${heatPct}`} indicatorClassName="brand-gradient" />
        </div>

        <div className="space-y-2">
          <CardTitle className="text-lg leading-7">{topic.title}</CardTitle>
          {topic.angle && (
            <CardDescription className="text-sm leading-6 text-foreground/72">
              {topic.angle}
            </CardDescription>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 px-5 pb-5">
        {(topic.why_hot || topic.target_audience) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {topic.why_hot && (
              <div className="rounded-xl bg-muted/45 p-3.5">
                <p className="text-xs font-medium text-muted-foreground">为什么值得做</p>
                <p className="mt-1.5 text-sm leading-5 text-foreground/80">{topic.why_hot}</p>
              </div>
            )}
            {topic.target_audience && (
              <div className="rounded-xl bg-muted/45 p-3.5">
                <p className="text-xs font-medium text-muted-foreground">适合人群</p>
                <p className="mt-1.5 text-sm leading-5 text-foreground/80">{topic.target_audience}</p>
              </div>
            )}
          </div>
        )}

        {topic.keywords?.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="选题关键词">
            {topic.keywords.map((keyword, index) => (
              <Badge key={`${keyword}-${index}`} variant="outline" className="font-normal text-muted-foreground">
                {keyword}
              </Badge>
            ))}
          </div>
        )}

        {visibleSources.length > 0 && (
          <div className="mt-auto border-t border-border/70 pt-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Icon icon={linkCircleLinear} className="size-3.5" />
              参考来源
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {visibleSources.map((source, index) => (
                <a
                  key={`${source}-${index}`}
                  href={source}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center gap-1 text-xs text-foreground/72 underline-offset-4 hover:text-foreground hover:underline"
                  aria-label={`打开来源 ${getSourceLabel(source, index)}`}
                >
                  <span className="max-w-44 truncate">{getSourceLabel(source, index)}</span>
                  <Icon icon={arrowRightUpLinear} className="size-3" />
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="mt-auto justify-between gap-4 border-t border-border/70 px-5 py-3.5">
        <span className="text-xs text-muted-foreground">
          {visibleSources.length > 0 ? `${visibleSources.length} 条参考来源` : 'AI 综合判断'}
        </span>
        <Button type="button" size="sm" onClick={() => onUse?.(topic)}>
          <Icon icon={fileTextBold} className="size-4 text-white" />
          {actionLabel}
        </Button>
      </CardFooter>
    </Card>
  )
}

export default TopicCard
