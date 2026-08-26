import { Icon } from '@iconify/react'
import altArrowLeftLinear from '@iconify-icons/solar/alt-arrow-left-linear'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SecondaryPageNavigationProps {
  backTo: string
  backLabel: string
  className?: string
}

const SecondaryPageNavigation = ({
  backTo,
  backLabel,
  className,
}: SecondaryPageNavigationProps) => (
  <div className={cn('flex min-h-9 items-center', className)}>
    <Button asChild variant="ghost" size="sm" className="-ml-2 shrink-0 text-muted-foreground hover:text-foreground">
      <Link to={backTo} aria-label={`返回${backLabel}`}>
        <Icon icon={altArrowLeftLinear} className="size-4" />
        返回{backLabel}
      </Link>
    </Button>
  </div>
)

export default SecondaryPageNavigation
