import React from 'react'
import { Icon } from '@iconify/react'
import crownLinear from '@iconify-icons/solar/crown-linear'
import hamburgerMenuLinear from '@iconify-icons/solar/hamburger-menu-linear'
import logoutLinear from '@iconify-icons/solar/logout-linear'
import moonLinear from '@iconify-icons/solar/moon-linear'
import settingsLinear from '@iconify-icons/solar/settings-linear'
import shieldUserLinear from '@iconify-icons/solar/shield-user-linear'
import sunLinear from '@iconify-icons/solar/sun-linear'
import userRoundedLinear from '@iconify-icons/solar/user-rounded-linear'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import logoDark from '../assets/logo-dark.svg'
import logoLight from '../assets/logo-light.svg'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { cn } from '../lib/utils'
import { Avatar, AvatarFallback } from './ui/avatar'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface NavigationItem {
  label: string
  path: string
  activePrefixes?: string[]
}

const NAVIGATION_ITEMS: NavigationItem[] = [
  { label: '首页', path: '/' },
  { label: '生成面板', path: '/create', activePrefixes: ['/hotspots', '/script'] },
  { label: '管理', path: '/manage', activePrefixes: ['/scripts', '/projects', '/processing', '/project'] },
]

const UNSAVED_DRAFT_KEY = 'mycut-unsaved-creation'

const Header: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const { authEnabled, user, isAdmin, signOut } = useAuth()
  const isHome = location.pathname === '/'

  const isItemActive = (item: NavigationItem) => (
    location.pathname === item.path ||
    (item.activePrefixes?.some((prefix) => location.pathname.startsWith(prefix)) ?? false)
  )

  const handleLogout = async () => {
    try {
      await signOut()
      toast.success('已退出登录')
    } catch {
      toast.error('退出登录失败，请重试')
    }
  }

  const navigateSafely = (path: string) => {
    const hasUnsavedCreation = sessionStorage.getItem(UNSAVED_DRAFT_KEY) === 'true'
    if (hasUnsavedCreation) {
      const shouldLeave = window.confirm('当前创作还有未保存的修改。确定不保存并离开吗？')
      if (!shouldLeave) return
      sessionStorage.removeItem(UNSAVED_DRAFT_KEY)
    }
    navigate(path)
  }

  const accountName = user?.email?.split('@')[0] || 'MyCut 用户'
  const avatarLabel = accountName.trim().slice(0, 1).toLocaleUpperCase() || 'M'

  const accountMenu = (
    <>
      <DropdownMenuLabel className="px-3 py-3 font-normal">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar size="lg" className="ring-1 ring-border">
            <AvatarFallback className="bg-foreground text-sm font-medium text-background">{avatarLabel}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{accountName}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{user?.email || '本地预览账户'}</p>
          </div>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => navigateSafely('/settings')}>
        <Icon icon={userRoundedLinear} />
        账户
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => navigateSafely('/membership')}>
        <Icon icon={crownLinear} />
        升级会员
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => navigateSafely('/settings')}>
        <Icon icon={settingsLinear} />
        系统设置
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={toggleTheme}>
        <Icon icon={theme === 'dark' ? sunLinear : moonLinear} />
        {theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
      </DropdownMenuItem>
      {isAdmin && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigateSafely('/admin')}>
            <Icon icon={shieldUserLinear} />
            管理员后台
          </DropdownMenuItem>
        </>
      )}
      {authEnabled && user && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => void handleLogout()}>
            <Icon icon={logoutLinear} />
            退出登录
          </DropdownMenuItem>
        </>
      )}
    </>
  )

  return (
    <header
      className={cn(
        'z-50 h-14 shrink-0',
        isHome
          ? 'absolute inset-x-0 top-0 border-b border-white/12 bg-black/10 text-white backdrop-blur-[2px]'
          : 'relative border-b border-border/70 bg-background/92 backdrop-blur-lg supports-[backdrop-filter]:bg-background/88',
      )}
    >
      <div className={cn('relative mx-auto flex h-full w-full items-center justify-between px-5 sm:px-10', isHome ? 'max-w-none lg:px-[60px]' : 'max-w-[1440px]')}>
        <button
          type="button"
          onClick={() => navigateSafely('/')}
          className={cn(
            'rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            isHome ? 'focus-visible:ring-white focus-visible:ring-offset-black' : 'focus-visible:ring-ring focus-visible:ring-offset-background',
          )}
          aria-label="前往 MyCut 首页"
        >
          {isHome ? (
            <img src={logoDark} alt="MyCut" className="h-7 w-auto" />
          ) : (
            <>
              <img src={logoLight} alt="MyCut" className="h-7 w-auto dark:hidden" />
              <img src={logoDark} alt="MyCut" className="hidden h-7 w-auto dark:block" />
            </>
          )}
        </button>

        <nav className="absolute inset-x-0 mx-auto hidden h-full w-fit items-center justify-center gap-1 md:flex" aria-label="主导航">
          {NAVIGATION_ITEMS.map((item) => {
            const active = isItemActive(item)
            return (
              <Button
                key={item.path}
                type="button"
                variant="ghost"
                onClick={() => navigateSafely(item.path)}
                className={cn(
                  'h-full rounded-none px-5 text-[14px] font-normal transition-[color,opacity] hover:bg-transparent',
                  isHome
                    ? active ? 'text-white' : 'text-white/65 hover:text-white'
                    : active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Button>
            )
          })}
        </nav>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'hidden rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-offset-2 md:block',
                  isHome ? 'ring-offset-black focus-visible:ring-white' : 'ring-offset-background focus-visible:ring-ring',
                )}
                aria-label="打开账户菜单"
              >
                <Avatar className={cn('size-8 ring-1', isHome ? 'ring-white/24' : 'ring-border')}>
                  <AvatarFallback className={cn('text-xs font-medium', isHome ? 'bg-white text-black' : 'bg-foreground text-background')}>{avatarLabel}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={10} className="w-64 rounded-xl p-1.5 shadow-lg">
              {accountMenu}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" className={cn('md:hidden', isHome && 'text-white hover:bg-white/10 hover:text-white')} aria-label="打开导航菜单">
                <Icon icon={hamburgerMenuLinear} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={10} className="w-64 rounded-xl p-1.5 md:hidden">
              {NAVIGATION_ITEMS.map((item) => (
                <DropdownMenuItem key={item.path} onSelect={() => navigateSafely(item.path)} className={cn(isItemActive(item) && 'bg-accent text-foreground')}>
                  {item.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {accountMenu}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

export default Header
