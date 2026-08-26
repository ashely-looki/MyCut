import { useLocation } from 'react-router-dom'

import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

const getPageTitle = (pathname: string, search: string) => {
  if (pathname === '/') return '首页'
  if (pathname === '/create') {
    return new URLSearchParams(search).get('mode') === 'upload' ? '智能剪辑' : '内容创作'
  }
  if (pathname === '/script') return '内容创作'
  if (pathname === '/hotspots') return 'AI 查热点'
  if (pathname === '/manage') {
    return new URLSearchParams(search).get('tab') === 'projects' ? '项目管理' : '文案管理'
  }
  if (pathname === '/scripts') return '文案管理'
  if (pathname === '/projects') return '项目管理'
  if (pathname.startsWith('/processing/')) return '视频生成'
  if (pathname.startsWith('/project/')) return '项目详情'
  if (pathname === '/membership') return '会员'
  if (pathname === '/settings') return '系统设置'
  if (pathname === '/admin') return '管理者后台'
  return 'MyCut'
}

export function AppShellHeader() {
  const location = useLocation()

  return (
    <header className="flex h-16 shrink-0 items-center border-b border-border/70 bg-background">
      <div className="flex w-full min-w-0 items-center px-6">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mx-2 h-4 w-0! border-l border-border/80 bg-transparent" />
        <span className="truncate text-sm font-medium tracking-[-0.01em] text-foreground">
          {getPageTitle(location.pathname, location.search)}
        </span>
      </div>
    </header>
  )
}
