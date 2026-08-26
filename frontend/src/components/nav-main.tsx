import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import altArrowRightLinear from '@iconify-icons/solar/alt-arrow-right-linear'
import type { IconifyIcon } from '@iconify/types'
import { useLocation } from 'react-router-dom'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useSafeNavigate } from '@/hooks/use-safe-navigate'

export interface NavSubItem {
  title: string
  path: string
  icon?: IconifyIcon
  activeIcon?: IconifyIcon
  activePrefixes?: string[]
}

export interface NavItem extends NavSubItem {
  icon: IconifyIcon
  items?: NavSubItem[]
}

interface NavMainProps {
  items: NavItem[]
}

const matchesPrefix = (pathname: string, prefix: string) => (
  pathname === prefix || pathname.startsWith(`${prefix}/`)
)

const isPathActive = (
  pathname: string,
  search: string,
  item: Pick<NavSubItem, 'path' | 'activePrefixes'>,
) => {
  const [targetPath, targetQuery = ''] = item.path.split('?')

  if (pathname === targetPath) {
    const expectedParams = Array.from(new URLSearchParams(targetQuery).entries())
    if (!expectedParams.length) return true

    const currentParams = new URLSearchParams(search)
    return expectedParams.every(([key, value]) => {
      const fallback = key === 'tab'
        ? 'scripts'
        : key === 'mode'
          ? 'topic'
          : key === 'view'
            ? 'history'
            : key === 'status'
              ? 'all'
              : null
      return (currentParams.get(key) ?? fallback) === value
    })
  }

  return item.activePrefixes?.some((prefix) => matchesPrefix(pathname, prefix)) ?? false
}

function NavMainEntry({ item }: { item: NavItem }) {
  const location = useLocation()
  const navigateSafely = useSafeNavigate()
  const { setOpenMobile, state: sidebarState } = useSidebar()
  const hasChildren = Boolean(item.items?.length)
  const itemActive = isPathActive(location.pathname, location.search, item)
  const childActive = item.items?.some((subItem) => (
    isPathActive(location.pathname, location.search, subItem)
  )) ?? false
  const branchActive = itemActive || childActive
  const [open, setOpen] = useState(branchActive)

  useEffect(() => {
    if (sidebarState === 'expanded' && branchActive) setOpen(true)
  }, [branchActive, sidebarState])

  const openItem = (path: string) => {
    const navigated = navigateSafely(path)
    if (navigated) setOpenMobile(false)
  }

  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          type="button"
          aria-label={item.title}
          tooltip={item.title}
          isActive={itemActive}
          onClick={() => openItem(item.path)}
        >
          <Icon icon={itemActive ? item.activeIcon ?? item.icon : item.icon} />
          <span>{item.title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            type="button"
            aria-label={item.title}
            tooltip={item.title}
            isActive={false}
            onClick={() => {
              if (sidebarState === 'collapsed') openItem(item.path)
            }}
          >
            <Icon icon={item.icon} />
            <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
            <Icon
              icon={altArrowRightLinear}
              className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden"
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items?.map((subItem) => {
              const subItemActive = isPathActive(location.pathname, location.search, subItem)

              return (
                <SidebarMenuSubItem key={subItem.path}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={subItemActive}
                  >
                    <a
                      href={`#${subItem.path}`}
                      onClick={(event) => {
                        event.preventDefault()
                        openItem(subItem.path)
                      }}
                    >
                      <span>{subItem.title}</span>
                    </a>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

export function NavMain({ items }: NavMainProps) {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => (
          <NavMainEntry key={item.path} item={item} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
