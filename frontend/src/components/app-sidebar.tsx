import type { ComponentProps } from 'react'
import crownBold from '@iconify-icons/solar/crown-bold'
import crownLinear from '@iconify-icons/solar/crown-linear'
import documentTextBold from '@iconify-icons/solar/document-text-bold'
import documentTextLinear from '@iconify-icons/solar/document-text-linear'
import folderOpenBold from '@iconify-icons/solar/folder-open-bold'
import folderOpenLinear from '@iconify-icons/solar/folder-open-linear'
import notesBold from '@iconify-icons/solar/notes-bold'
import notesLinear from '@iconify-icons/solar/notes-linear'
import videoFramePlayHorizontalBold from '@iconify-icons/solar/video-frame-play-horizontal-bold'
import videoFramePlayHorizontalLinear from '@iconify-icons/solar/video-frame-play-horizontal-linear'
import widgetBold from '@iconify-icons/solar/widget-bold'
import widgetLinear from '@iconify-icons/solar/widget-linear'

import logoDark from '@/assets/logo-dark.svg'
import logoLight from '@/assets/logo-light.svg'
import logoMark from '@/assets/logo-mark.svg'
import { NavMain, type NavItem } from '@/components/nav-main'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useSafeNavigate } from '@/hooks/use-safe-navigate'

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const navigateSafely = useSafeNavigate()
  const navigationItems: NavItem[] = [
    {
      title: '首页',
      path: '/',
      icon: widgetLinear,
      activeIcon: widgetBold,
    },
    {
      title: '内容创作',
      path: '/create?mode=topic',
      icon: documentTextLinear,
      activeIcon: documentTextBold,
      activePrefixes: ['/hotspots', '/script'],
    },
    {
      title: '智能剪辑',
      path: '/create?mode=upload',
      icon: videoFramePlayHorizontalLinear,
      activeIcon: videoFramePlayHorizontalBold,
    },
    {
      title: '文案管理',
      path: '/manage?tab=scripts&view=history',
      icon: notesLinear,
      activeIcon: notesBold,
      activePrefixes: ['/scripts'],
      items: [
        { title: '历史文案', path: '/manage?tab=scripts&view=history' },
        { title: '草稿箱', path: '/manage?tab=scripts&view=drafts' },
      ],
    },
    {
      title: '项目管理',
      path: '/manage?tab=projects&status=all',
      icon: folderOpenLinear,
      activeIcon: folderOpenBold,
      activePrefixes: ['/projects', '/processing', '/project'],
      items: [
        { title: '全部', path: '/manage?tab=projects&status=all' },
        { title: '处理中', path: '/manage?tab=projects&status=active' },
        { title: '已完成', path: '/manage?tab=projects&status=completed' },
        { title: '失败', path: '/manage?tab=projects&status=failed' },
      ],
    },
    {
      title: '会员',
      path: '/membership',
      icon: crownLinear,
      activeIcon: crownBold,
    },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              size="lg"
              aria-label="MyCut 首页"
              tooltip="MyCut 首页"
              onClick={() => navigateSafely('/')}
            >
              <img
                src={logoMark}
                alt=""
                className="hidden size-8 shrink-0 group-data-[collapsible=icon]:block"
              />
              <span className="flex min-w-0 flex-1 items-center overflow-hidden group-data-[collapsible=icon]:hidden">
                <img src={logoLight} alt="MyCut" className="h-6 w-auto dark:hidden" />
                <img src={logoDark} alt="MyCut" className="hidden h-6 w-auto dark:block" />
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navigationItems} />
      </SidebarContent>

      <SidebarFooter className="p-2">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
