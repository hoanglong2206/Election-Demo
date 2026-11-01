import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type TabThemeColor = 'violet' | 'cyan' | 'emerald' | 'amber' | 'indigo' | 'rose' | 'default'

export interface TabItem<T extends string = string> {
  id: T
  label: ReactNode
  icon?: ReactNode
  badge?: ReactNode
  title?: string
  disabled?: boolean
  idAttr?: string
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[]
  activeTab: T
  onChange: (tabId: T) => void
  themeColor?: TabThemeColor
  size?: 'xs' | 'sm' | 'md'
  variant?: 'segmented' | 'pills'
  className?: string
  tabClassName?: string
  activeTabClassName?: string
  fullWidth?: boolean
}

const THEME_ACTIVE_STYLES: Record<TabThemeColor, { tab: string; icon: string }> = {
  violet: {
    tab: 'bg-violet-600/30 text-violet-100 border-violet-500/40 shadow-sm shadow-violet-500/20 font-semibold',
    icon: 'text-violet-300',
  },
  cyan: {
    tab: 'bg-cyan-500/25 text-cyan-100 border-cyan-500/40 shadow-sm shadow-cyan-500/20 font-semibold',
    icon: 'text-cyan-300',
  },
  emerald: {
    tab: 'bg-emerald-500/25 text-emerald-100 border-emerald-500/40 shadow-sm shadow-emerald-500/20 font-semibold',
    icon: 'text-emerald-300',
  },
  amber: {
    tab: 'bg-amber-500/25 text-amber-100 border-amber-500/40 shadow-sm shadow-amber-500/20 font-semibold',
    icon: 'text-amber-300',
  },
  indigo: {
    tab: 'bg-indigo-600/30 text-indigo-100 border-indigo-500/40 shadow-sm shadow-indigo-500/20 font-semibold',
    icon: 'text-indigo-300',
  },
  rose: {
    tab: 'bg-rose-500/25 text-rose-100 border-rose-500/40 shadow-sm shadow-rose-500/20 font-semibold',
    icon: 'text-rose-300',
  },
  default: {
    tab: 'bg-white/15 text-white border-white/25 shadow-sm font-semibold',
    icon: 'text-white',
  },
}

const SIZE_STYLES = {
  xs: {
    container: 'p-0.5 rounded-lg gap-0.5 text-[10px]',
    tab: 'h-6 px-2 text-[10px] gap-1 rounded-md',
    icon: 'w-3 h-3',
  },
  sm: {
    container: 'p-1 rounded-xl gap-1 text-[11px]',
    tab: 'h-7 px-2.5 text-[11px] gap-1.5 rounded-lg',
    icon: 'w-3.5 h-3.5',
  },
  md: {
    container: 'p-1 rounded-xl gap-1 text-xs',
    tab: 'h-8 px-3.5 text-xs gap-2 rounded-lg',
    icon: 'w-4 h-4',
  },
}

/**
 * Standardized, accessible, and themeable Tabs/Segmented Control component.
 * Provides unified glassmorphism container, smooth transitions, scale feedback,
 * active indicator glow, and iconography across all features.
 */
export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  themeColor = 'violet',
  size = 'sm',
  variant = 'segmented',
  className,
  tabClassName,
  activeTabClassName,
  fullWidth = false,
}: TabsProps<T>) {
  const sizeConfig = SIZE_STYLES[size]
  const themeConfig = THEME_ACTIVE_STYLES[themeColor]

  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center shrink-0 select-none backdrop-blur-md transition-all',
        variant === 'segmented'
          ? 'bg-black/50 border border-white/[0.08] shadow-inner'
          : 'bg-transparent gap-1.5',
        sizeConfig.container,
        fullWidth && 'w-full',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            id={tab.idAttr}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            title={tab.title}
            onClick={() => !tab.disabled && onChange(tab.id)}
            className={cn(
              'relative flex items-center justify-center font-medium transition-all duration-200 select-none whitespace-nowrap cursor-pointer border',
              'active:scale-[0.98]',
              sizeConfig.tab,
              fullWidth && 'flex-1 min-w-0',
              isActive
                ? cn(themeConfig.tab, activeTabClassName)
                : 'border-transparent text-white/50 hover:text-white/90 hover:bg-white/[0.06]',
              tab.disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-white/50 active:scale-100',
              tabClassName
            )}
          >
            {tab.icon && (
              <span
                className={cn(
                  'shrink-0 flex items-center transition-colors duration-200',
                  isActive ? themeConfig.icon : 'text-white/40'
                )}
              >
                {tab.icon}
              </span>
            )}
            <span className="truncate">{tab.label}</span>
            {tab.badge && <span className="shrink-0">{tab.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}
