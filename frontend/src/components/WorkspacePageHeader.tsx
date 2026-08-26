import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface WorkspacePageHeaderProps {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  id?: string
  titleAddon?: ReactNode
  children?: ReactNode
  className?: string
}

const WorkspacePageHeader = ({
  title,
  description,
  eyebrow,
  id,
  titleAddon,
  children,
  className,
}: WorkspacePageHeaderProps) => (
  <header className={cn('flex w-full flex-col gap-3 pb-8 text-left', className)}>
    {eyebrow && (
      <span className="text-xs font-medium tracking-[0.14em] text-muted-foreground">
        {eyebrow}
      </span>
    )}
    <div className="flex w-full flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            id={id}
            className="text-[30px] font-semibold leading-tight tracking-[-0.035em] text-foreground sm:text-[34px]"
          >
            {title}
          </h1>
          {titleAddon}
        </div>
        {description && (
          <p className="mt-2 max-w-[720px] text-sm leading-6 text-muted-foreground sm:text-[15px]">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  </header>
)

export default WorkspacePageHeader
