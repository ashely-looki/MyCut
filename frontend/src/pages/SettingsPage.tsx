import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import chartLinear from '@iconify-icons/solar/chart-linear'
import moonLinear from '@iconify-icons/solar/moon-linear'
import subtitlesLinear from '@iconify-icons/solar/subtitles-linear'
import sunLinear from '@iconify-icons/solar/sun-linear'
import userRoundedLinear from '@iconify-icons/solar/user-rounded-linear'
import videoFrameLinear from '@iconify-icons/solar/video-frame-linear'
import { toast } from 'sonner'

import WorkspacePageHeader from '@/components/WorkspacePageHeader'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { isAnalyticsEnabled, setAnalyticsEnabled } from '@/analytics/posthog'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'

const SETTINGS_STORAGE_KEY = 'mycut-creation-defaults'

interface CreationDefaults {
  ratio: string
  duration: string
  captions: string
  notifications: boolean
  reducedMotion: boolean
}

const DEFAULTS: CreationDefaults = {
  ratio: '9:16',
  duration: '60',
  captions: 'classic',
  notifications: true,
  reducedMotion: false,
}

function readDefaults(): CreationDefaults {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}') }
  } catch {
    return DEFAULTS
  }
}

const SettingRow = ({
  icon,
  title,
  description,
  children,
}: {
  icon: typeof chartLinear
  title: string
  description: string
  children: React.ReactNode
}) => (
  <div className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
      <Icon icon={icon} className="size-[18px]" />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
    <div className="w-full shrink-0 sm:w-[180px]">{children}</div>
  </div>
)

const SettingsPage = () => {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const [analyticsOn, setAnalyticsOn] = useState(isAnalyticsEnabled())
  const [defaults, setDefaults] = useState<CreationDefaults>(readDefaults)

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(defaults))
    document.documentElement.classList.toggle('reduce-motion', defaults.reducedMotion)
  }, [defaults])

  const accountName = user?.email?.split('@')[0] || 'MyCut 用户'

  return (
    <main className="min-h-full bg-[var(--workspace-background)] px-6 pb-14 pt-10">
      <div className="w-full max-w-4xl">
        <WorkspacePageHeader
          title="系统设置"
          description="管理账户信息、创作默认值和使用偏好。"
          className="mb-8"
        />

        <div className="grid gap-6">
          <Card className="rounded-[24px] shadow-none">
            <CardHeader className="p-6 pb-4 sm:p-7 sm:pb-5">
              <CardTitle className="text-base">账户</CardTitle>
              <CardDescription>当前登录信息与会员状态</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 sm:p-7 sm:pt-0">
              <div className="flex items-center gap-4 rounded-2xl bg-muted/55 p-4">
                <Avatar size="lg" className="size-12 ring-1 ring-border">
                  <AvatarFallback className="bg-foreground text-background">{accountName.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{accountName}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{user?.email || '本地预览账户'}</p>
                </div>
                <span className="ml-auto rounded-full bg-background px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-border">免费版</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] shadow-none">
            <CardHeader className="p-6 pb-4 sm:p-7 sm:pb-5">
              <CardTitle className="text-base">创作偏好</CardTitle>
              <CardDescription>这些选项会成为新项目的默认设置，仍可在生成前修改</CardDescription>
            </CardHeader>
            <CardContent className="divide-y p-6 pt-0 sm:p-7 sm:pt-0">
              <SettingRow icon={videoFrameLinear} title="默认视频比例" description="短视频平台建议使用 9:16。">
                <Select value={defaults.ratio} onValueChange={(ratio) => setDefaults((current) => ({ ...current, ratio }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9:16">竖屏 9:16</SelectItem>
                    <SelectItem value="16:9">横屏 16:9</SelectItem>
                    <SelectItem value="1:1">方形 1:1</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow icon={userRoundedLinear} title="默认目标时长" description="生成大纲和分镜时使用的初始时长。">
                <Select value={defaults.duration} onValueChange={(duration) => setDefaults((current) => ({ ...current, duration }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 秒</SelectItem>
                    <SelectItem value="60">60 秒</SelectItem>
                    <SelectItem value="90">90 秒</SelectItem>
                    <SelectItem value="180">3 分钟</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow icon={subtitlesLinear} title="默认字幕样式" description="生成视频时默认选择的字幕呈现方式。">
                <Select value={defaults.captions} onValueChange={(captions) => setDefaults((current) => ({ ...current, captions }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic">经典字幕</SelectItem>
                    <SelectItem value="karaoke">逐字点亮</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] shadow-none">
            <CardHeader className="p-6 pb-4 sm:p-7 sm:pb-5">
              <CardTitle className="text-base">界面与通知</CardTitle>
              <CardDescription>控制显示、动画和完成提醒</CardDescription>
            </CardHeader>
            <CardContent className="divide-y p-6 pt-0 sm:p-7 sm:pt-0">
              <SettingRow icon={theme === 'dark' ? moonLinear : sunLinear} title="外观模式" description="Light 和 Dark 模式都会保留完整的视觉层级。">
                <button type="button" onClick={toggleTheme} className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                  {theme === 'dark' ? 'Dark' : 'Light'}
                  <Icon icon={theme === 'dark' ? moonLinear : sunLinear} className="size-4 text-muted-foreground" />
                </button>
              </SettingRow>
              <SettingRow icon={chartLinear} title="生成完成通知" description="视频处理完成或失败时在应用内提醒。">
                <div className="flex h-10 items-center justify-end">
                  <Switch checked={defaults.notifications} onCheckedChange={(notifications) => setDefaults((current) => ({ ...current, notifications }))} aria-label="生成完成通知" />
                </div>
              </SettingRow>
              <SettingRow icon={chartLinear} title="减少动态效果" description="减少页面转场和非必要动画。">
                <div className="flex h-10 items-center justify-end">
                  <Switch checked={defaults.reducedMotion} onCheckedChange={(reducedMotion) => setDefaults((current) => ({ ...current, reducedMotion }))} aria-label="减少动态效果" />
                </div>
              </SettingRow>
              <SettingRow icon={chartLinear} title="匿名使用统计" description="只记录功能使用与生成状态，不包含视频和文案内容。">
                <div className="flex h-10 items-center justify-end">
                  <Switch
                    checked={analyticsOn}
                    onCheckedChange={(checked) => {
                      setAnalyticsEnabled(checked)
                      setAnalyticsOn(checked)
                      toast.success(checked ? '已开启匿名使用统计' : '已关闭匿名使用统计')
                    }}
                    aria-label="匿名使用统计"
                  />
                </div>
              </SettingRow>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

export default SettingsPage
