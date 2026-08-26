import { Icon } from '@iconify/react'
import altArrowUpLinear from '@iconify-icons/solar/alt-arrow-up-linear'
import crownLinear from '@iconify-icons/solar/crown-linear'
import logoutLinear from '@iconify-icons/solar/logout-linear'
import moonLinear from '@iconify-icons/solar/moon-linear'
import settingsLinear from '@iconify-icons/solar/settings-linear'
import shieldUserLinear from '@iconify-icons/solar/shield-user-linear'
import sunLinear from '@iconify-icons/solar/sun-linear'
import userRoundedLinear from '@iconify-icons/solar/user-rounded-linear'
import { toast } from 'sonner'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useSafeNavigate } from '@/hooks/use-safe-navigate'

export function NavUser() {
  const navigateSafely = useSafeNavigate()
  const { isMobile } = useSidebar()
  const { authEnabled, user, isAdmin, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'My Cutter'
  const email = user?.email || '本地工作空间'
  const avatarLabel = displayName.trim().slice(0, 1).toLocaleUpperCase() || 'M'

  const handleLogout = async () => {
    try {
      await signOut()
      toast.success('已退出登录')
    } catch {
      toast.error('退出登录失败，请重试')
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 shrink-0 rounded-lg">
                <AvatarFallback className="rounded-lg bg-sidebar-primary text-xs font-medium text-sidebar-primary-foreground">
                  {avatarLabel}
                </AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 gap-0.5 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-medium">{displayName}</span>
                <span className="truncate text-xs text-sidebar-foreground/60">{email}</span>
              </span>
              <Icon icon={altArrowUpLinear} className="ml-auto size-4 text-sidebar-foreground/48 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="px-2 py-2 font-normal">
              <div className="flex items-center gap-2.5">
                <Avatar className="size-9 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-foreground text-xs font-medium text-background">
                    {avatarLabel}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{displayName}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigateSafely('/settings')} className="rounded-lg py-2">
              <Icon icon={userRoundedLinear} />
              账户
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigateSafely('/membership')} className="rounded-lg py-2">
              <Icon icon={crownLinear} />
              升级会员
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigateSafely('/settings')} className="rounded-lg py-2">
              <Icon icon={settingsLinear} />
              系统设置
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={toggleTheme} className="rounded-lg py-2">
              <Icon icon={theme === 'dark' ? sunLinear : moonLinear} />
              {theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigateSafely('/admin')} className="rounded-lg py-2">
                  <Icon icon={shieldUserLinear} />
                  管理员后台
                </DropdownMenuItem>
              </>
            )}
            {authEnabled && user && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => void handleLogout()} className="rounded-lg py-2">
                  <Icon icon={logoutLinear} />
                  退出登录
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
