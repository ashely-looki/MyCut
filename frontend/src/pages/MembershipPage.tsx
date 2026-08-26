import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import altArrowDownLinear from '@iconify-icons/solar/alt-arrow-down-linear'
import checkCircleLinear from '@iconify-icons/solar/check-circle-linear'
import crownBold from '@iconify-icons/solar/crown-bold'
import documentTextLinear from '@iconify-icons/solar/document-text-linear'
import magicStickLinear from '@iconify-icons/solar/magic-stick-linear'
import restartCircleLinear from '@iconify-icons/solar/restart-circle-linear'
import videoFramePlayHorizontalLinear from '@iconify-icons/solar/video-frame-play-horizontal-linear'
import dayjs from 'dayjs'
import { toast } from 'sonner'

import workflowBackdrop from '@/assets/home/mycut-editorial-hero.webp'
import WorkspacePageHeader from '@/components/WorkspacePageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { payApi } from '@/services/api'
import type { Membership } from '@/services/api'
import { openAlipayForm } from '@/utils/alipay'

const BASIC_BENEFITS = [
  '完整的热点选题与文案创作流程',
  '草稿、历史文案和项目集中管理',
  '标准任务处理队列',
]

const PRO_BENEFITS = [
  '不限量 AI 智能剪辑与视频切片',
  '热点、文案、大纲与分镜一体生成',
  '自动成片、字幕与高清视频导出',
  '更高优先级的任务处理队列',
  '新功能优先体验与持续更新',
]

const MEMBERSHIP_FAQS = [
  {
    question: '开通 Pro 后什么时候生效？',
    answer: '支付宝完成支付后，MyCut 会自动确认订单并开通权益。通常会立即生效；如果页面没有及时更新，稍后刷新会员页即可。',
  },
  {
    question: '升级后，原来的文案和项目会发生变化吗？',
    answer: '不会。升级只会解锁更多创作与处理能力，已有的草稿、历史文案、项目和生成结果都会继续保留。',
  },
  {
    question: '会员到期后还能查看之前的内容吗？',
    answer: '可以。会员到期不会删除已有内容，你仍然可以查看和管理历史文案与项目；需要 Pro 权益的功能会恢复为基础版限制。',
  },
  {
    question: '目前的会员会自动续费吗？',
    answer: '当前采用按月主动购买的方式，到期后由你决定是否续费，不会在未确认的情况下自动扣款。',
  },
]

const WORKFLOW_BENEFITS = [
  {
    icon: magicStickLinear,
    title: '从热点到结构',
    description: '围绕关键词完成选题、切入角度、目标观众与内容大纲。',
  },
  {
    icon: documentTextLinear,
    title: '从大纲到分镜',
    description: '逐段编辑口播文案、画面提示和持续时长，内容始终可控。',
  },
  {
    icon: videoFramePlayHorizontalLinear,
    title: '从素材到成片',
    description: '自动识别长视频内容、拆分精彩片段，并集中管理生成结果。',
  },
]

function getPaymentErrorMessage(error: unknown) {
  if (
    typeof error === 'object'
    && error !== null
    && 'response' in error
  ) {
    const response = (error as { response?: { data?: { detail?: string } } }).response
    if (response?.data?.detail) return response.data.detail
  }

  return '发起支付失败，请稍后重试'
}

const MembershipPage = () => {
  const [membership, setMembership] = useState<Membership | null>(null)
  const [membershipLoading, setMembershipLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const pollTimer = useRef<number | null>(null)

  const loadMembership = useCallback(async () => {
    try {
      setMembership(await payApi.getMembership())
    } catch {
      // Membership state does not block the purchase page.
    } finally {
      setMembershipLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMembership()
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current)
    }
  }, [loadMembership])

  const startPolling = useCallback((outTradeNo: string) => {
    let elapsed = 0
    const interval = 3000
    const timeout = 5 * 60 * 1000

    pollTimer.current = window.setInterval(async () => {
      elapsed += interval
      try {
        const order = await payApi.getOrderStatus(outTradeNo)
        if (order.status === 'paid') {
          if (pollTimer.current) window.clearInterval(pollTimer.current)
          setPaying(false)
          toast.success('支付成功，会员已开通')
          void loadMembership()
          return
        }
      } catch {
        // Keep polling after a transient request failure.
      }

      if (elapsed >= timeout) {
        if (pollTimer.current) window.clearInterval(pollTimer.current)
        setPaying(false)
        toast.info('暂未检测到支付完成，如已付款请稍后刷新')
      }
    }, interval)
  }, [loadMembership])

  const handleBuy = async () => {
    setPaying(true)
    try {
      const { out_trade_no, pay_form_html } = await payApi.createAlipayOrder(1)
      const paymentWindow = openAlipayForm(pay_form_html)
      if (!paymentWindow) {
        setPaying(false)
        toast.warning('浏览器拦截了支付窗口，请允许弹窗后重试')
        return
      }
      toast.info('已打开支付宝收银台，请在新标签页完成支付')
      startPolling(out_trade_no)
    } catch (error: unknown) {
      setPaying(false)
      toast.error(getPaymentErrorMessage(error))
    }
  }

  const isMember = membership?.is_member
  const expiresText = membership?.expires_at
    ? dayjs(membership.expires_at).format('YYYY 年 M 月 D 日')
    : null

  return (
    <main className="min-h-[calc(100svh-3.5rem)] bg-background px-6 pb-24 pt-10">
      <div className="w-full max-w-[1240px]">
        <WorkspacePageHeader
          title="选择适合你的会员方案"
          description="两个清晰的创作等级，让你从选题、文案到智能剪辑和成片交付，都能在同一个工作区持续完成。"
          className="pb-0"
        />

        <section aria-label="会员方案概览" className="mt-14 grid gap-4 lg:grid-cols-2">
          <Card className="relative flex min-h-[570px] flex-col overflow-hidden border-0 bg-[#f4f4f2]/55 p-0 shadow-none dark:bg-[#202022]/70">
            <div className="relative z-10 flex items-start justify-between gap-4 p-7 sm:p-8">
              <div>
                <h2 className="text-3xl font-medium tracking-[-0.04em]">基础版</h2>
                <p className="mt-2 text-sm text-muted-foreground">开始稳定创作所需的基础工作区</p>
              </div>
              {membershipLoading ? (
                <Skeleton className="h-7 w-20 rounded-full" />
              ) : (
                <Badge variant="secondary" className="border-0 bg-background/85 px-3 py-1.5 shadow-none">
                  {!isMember ? '当前方案' : '基础能力'}
                </Badge>
              )}
            </div>

            <div aria-hidden="true" className="relative mx-auto mt-2 h-64 w-full max-w-md">
              <div className="absolute inset-x-12 bottom-0 top-12 rounded-full bg-cyan-200/45 blur-3xl dark:bg-cyan-500/10" />
              <div className="absolute left-1/2 top-1/2 flex h-40 w-64 -translate-x-1/2 -translate-y-1/2 -rotate-6 flex-col justify-between rounded-[24px] bg-white/90 p-5 shadow-[0_24px_70px_rgb(40_120_150/0.16)] backdrop-blur-sm dark:bg-white/10">
                <span className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground">MYCUT MEMBERSHIP</span>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-semibold tracking-[-0.04em]">BASIC</span>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-foreground text-background">
                    <Icon icon={documentTextLinear} className="size-5" />
                  </span>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-auto p-7 pt-5 sm:p-8 sm:pt-5">
              <p className="mb-4 text-sm font-medium">适合希望：</p>
              <ul className="space-y-3.5">
                {BASIC_BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3 text-sm text-foreground/75">
                    <Icon icon={checkCircleLinear} className="size-[18px] shrink-0 text-muted-foreground" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card className="relative flex min-h-[570px] flex-col overflow-hidden border-0 bg-[#111112] p-0 text-white shadow-none dark:bg-[#09090a]">
            <div className="relative z-10 flex items-start justify-between gap-4 p-7 sm:p-8">
              <div>
                <h2 className="text-3xl font-medium tracking-[-0.04em] text-white">Pro</h2>
                <p className="mt-2 text-sm text-white/52">面向高频创作者的完整 AI 生产力</p>
              </div>
              {membershipLoading ? (
                <Skeleton className="h-7 w-20 rounded-full bg-white/12" />
              ) : (
                <Badge className="border-0 bg-white/10 px-3 py-1.5 text-white shadow-none hover:bg-white/10">
                  {isMember ? '当前方案' : '推荐升级'}
                </Badge>
              )}
            </div>

            <div aria-hidden="true" className="relative mx-auto mt-2 h-64 w-full max-w-md">
              <div className="absolute left-1/2 top-1/2 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_35%_35%,#ffb28f_0%,#ff72b6_35%,#7868ff_63%,transparent_74%)] opacity-75 blur-2xl" />
              <div className="absolute left-1/2 top-1/2 flex h-40 w-64 -translate-x-1/2 -translate-y-1/2 rotate-6 flex-col justify-between rounded-[24px] bg-black/55 p-5 shadow-[0_26px_80px_rgb(104_72_255/0.26)] backdrop-blur-xl">
                <span className="text-[10px] font-medium tracking-[0.2em] text-white/45">MYCUT MEMBERSHIP</span>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-semibold tracking-[-0.04em] text-white">PRO</span>
                  <span className="brand-gradient flex size-10 items-center justify-center rounded-xl text-white">
                    <Icon icon={crownBold} className="size-5 text-white" />
                  </span>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-auto p-7 pt-5 sm:p-8 sm:pt-5">
              <p className="mb-4 text-sm font-medium text-white">适合希望：</p>
              <ul className="space-y-3.5">
                {PRO_BENEFITS.slice(0, 3).map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3 text-sm text-white/68">
                    <Icon icon={checkCircleLinear} className="size-[18px] shrink-0 text-white/45" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </section>

        <div className="mt-6 flex justify-center">
          <Button
            type="button"
            size="lg"
            disabled={paying}
            onClick={() => void handleBuy()}
            className="min-w-48 bg-foreground text-background shadow-none hover:bg-foreground/90 hover:brightness-100 [&_svg]:text-background"
          >
            {paying && <Icon icon={restartCircleLinear} className="motion-safe:animate-spin" />}
            {paying ? '正在打开收银台' : isMember ? '续费 Pro 一个月' : '升级到 Pro'}
          </Button>
        </div>

        <section className="relative mt-[88px] overflow-hidden rounded-[24px] bg-[#111112] px-6 py-10 text-white sm:px-10 sm:py-12 lg:px-12">
          <img
            src={workflowBackdrop}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full object-cover object-center"
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgb(0_0_0/0.88)_0%,rgb(0_0_0/0.72)_48%,rgb(0_0_0/0.42)_100%)]" />

          <div className="relative z-10 max-w-2xl">
            <h2 className="text-4xl font-medium leading-[1.08] tracking-[-0.045em] sm:text-5xl">
              把时间留给内容，<br />把重复工作交给 AI。
            </h2>
            <p className="mt-5 text-sm leading-7 text-white/62 sm:text-base">
              Pro 不是孤立的功能包，而是贯穿整条创作链路的效率升级。从确定方向到整理分镜，再到处理素材和生成成片，每一步都延续在同一个项目里。
            </p>
          </div>

          <div className="relative z-10 mt-12 grid gap-px overflow-hidden rounded-[20px] bg-white/14 backdrop-blur-md md:grid-cols-3">
            {WORKFLOW_BENEFITS.map((benefit, index) => (
              <article key={benefit.title} className="bg-black/52 p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-white/8 text-white">
                    <Icon icon={benefit.icon} className="size-5" />
                  </span>
                  <span className="text-xs tabular-nums text-white/28">0{index + 1}</span>
                </div>
                <h3 className="mt-8 text-lg font-medium">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/48">{benefit.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="compare-plans" className="scroll-mt-24 pt-24">
          <header className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground">会员权益</p>
            <h2 className="mt-4 text-4xl font-medium tracking-[-0.045em] sm:text-5xl">选择适合当前节奏的方案</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">先用基础版建立流程，需要更高频率和更完整的自动化时，再升级到 Pro。</p>
          </header>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <Card className="flex flex-col border-border/60 bg-card p-7 shadow-none sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-medium tracking-[-0.035em]">基础版</h3>
                  <p className="mt-2 text-sm text-muted-foreground">适合刚开始建立 AI 内容工作流</p>
                </div>
                {!membershipLoading && !isMember && <Badge variant="secondary">使用中</Badge>}
              </div>
              <div className="mt-9 flex items-end gap-2">
                <span className="text-5xl font-semibold leading-none tracking-[-0.055em]">¥0</span>
                <span className="pb-1 text-sm text-muted-foreground">长期使用</span>
              </div>
              <Separator className="my-7" />
              <p className="text-sm font-medium">基础版包含：</p>
              <ul className="mt-5 space-y-4">
                {BASIC_BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3 text-sm text-foreground/78">
                    <Icon icon={checkCircleLinear} className="mt-px size-[18px] shrink-0 text-muted-foreground" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
              <Button type="button" variant="secondary" size="lg" disabled className="mt-9 w-full">
                {isMember ? '已包含基础能力' : '当前方案'}
              </Button>
            </Card>

            <Card className="flex flex-col border-0 bg-[#111112] p-7 text-white shadow-none sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-medium tracking-[-0.035em] text-white">Pro</h3>
                  <p className="mt-2 text-sm text-white/48">完整的 AI 内容与视频生产能力</p>
                </div>
                <Badge className="border-0 bg-white/10 text-white shadow-none hover:bg-white/10">{isMember ? '使用中' : '推荐'}</Badge>
              </div>
              <div className="mt-9 flex items-end gap-2">
                <span className="text-sm font-medium">¥</span>
                <span className="text-5xl font-semibold leading-none tracking-[-0.055em]">98</span>
                <span className="pb-1 text-sm text-white/45">/ 月</span>
              </div>
              <p className="mt-3 min-h-5 text-xs text-white/38">
                {membershipLoading
                  ? '正在读取会员状态'
                  : isMember && expiresText
                    ? `当前有效期至 ${expiresText}`
                    : '支付完成后立即生效'}
              </p>
              <Separator className="my-7 bg-white/12" />
              <p className="text-sm font-medium text-white">Pro 包含：</p>
              <ul className="mt-5 space-y-4">
                {PRO_BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3 text-sm text-white/68">
                    <Icon icon={checkCircleLinear} className="mt-px size-[18px] shrink-0 text-white/42" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                disabled={paying}
                onClick={() => void handleBuy()}
                className="mt-9 w-full bg-white text-black hover:bg-white/90"
              >
                {paying && <Icon icon={restartCircleLinear} className="motion-safe:animate-spin" />}
                {paying ? '正在打开收银台' : isMember ? '续费一个月' : '选择 Pro'}
              </Button>
            </Card>
          </div>
        </section>

        <section className="mx-auto mt-24 max-w-4xl">
          <header className="text-center">
            <h2 className="text-4xl font-medium tracking-[-0.045em] sm:text-5xl">常见问题</h2>
            <p className="mt-4 text-base text-muted-foreground">关于权益、内容保留和续费方式的说明。</p>
          </header>

          <div className="mt-10 border-y border-border/70">
            {MEMBERSHIP_FAQS.map((item) => (
              <Collapsible key={item.question} className="group/collapsible border-b border-border/70 last:border-b-0">
                <CollapsibleTrigger className="group/trigger flex w-full items-center gap-5 py-6 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-4">
                  <span className="flex-1 text-base font-medium sm:text-lg">{item.question}</span>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover/trigger:bg-foreground group-hover/trigger:text-background">
                    <Icon icon={altArrowDownLinear} className="size-4 transition-transform duration-200 group-data-[state=open]/trigger:rotate-180" />
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                  <p className="max-w-3xl pb-6 pr-14 text-sm leading-7 text-muted-foreground sm:text-base">{item.answer}</p>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

export default MembershipPage
