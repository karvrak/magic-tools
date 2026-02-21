import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center gap-1 text-sm min-w-0', className)}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <span key={index} className="flex items-center gap-1 min-w-0">
            {index > 0 && (
              <ChevronRight className="w-3.5 h-3.5 text-dungeon-500 flex-shrink-0" />
            )}

            {isLast || !item.href ? (
              <span
                className={cn(
                  'truncate max-w-[200px]',
                  isLast
                    ? 'text-parchment-200 font-medium'
                    : 'text-parchment-500'
                )}
                title={item.label}
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-gold-400 hover:text-gold-300 transition-colors truncate max-w-[200px]"
                title={item.label}
              >
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
