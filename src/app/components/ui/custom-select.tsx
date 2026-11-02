import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react'
import { ChevronDown, Check, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CustomSelectThemeColor =
  | 'violet'
  | 'cyan'
  | 'emerald'
  | 'amber'
  | 'indigo'
  | 'rose'
  | 'default'

export interface SelectOption {
  value: string
  label: string
  subLabel?: string
  badge?: string
  icon?: ReactNode
  disabled?: boolean
}

export interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  className?: string
  triggerClassName?: string
  menuClassName?: string
  align?: 'left' | 'right'
  icon?: ReactNode
  themeColor?: CustomSelectThemeColor
  size?: 'xs' | 'sm' | 'md'
  id?: string
  title?: string
  ariaLabel?: string
  headerNode?: ReactNode
  footerNode?: ReactNode
  customRenderOption?: (opt: SelectOption, isSelected: boolean) => ReactNode
}

const THEME_CLASSES: Record<
  CustomSelectThemeColor,
  {
    activeBorder: string
    chevronActive: string
    itemActive: string
    checkColor: string
    focusBorder: string
  }
> = {
  violet: {
    activeBorder: 'border-violet-500/60 ring-2 ring-violet-500/25',
    chevronActive: 'text-violet-400',
    itemActive: 'bg-violet-600/25 text-violet-200 border-violet-500/35 font-medium border shadow-sm',
    checkColor: 'text-violet-400',
    focusBorder: 'focus:border-violet-400',
  },
  cyan: {
    activeBorder: 'border-cyan-500/60 ring-2 ring-cyan-500/25',
    chevronActive: 'text-cyan-400',
    itemActive: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/35 font-medium border shadow-sm',
    checkColor: 'text-cyan-400',
    focusBorder: 'focus:border-cyan-400',
  },
  emerald: {
    activeBorder: 'border-emerald-500/60 ring-2 ring-emerald-500/25',
    chevronActive: 'text-emerald-400',
    itemActive: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/35 font-medium border shadow-sm',
    checkColor: 'text-emerald-400',
    focusBorder: 'focus:border-emerald-400',
  },
  amber: {
    activeBorder: 'border-amber-500/60 ring-2 ring-amber-500/25',
    chevronActive: 'text-amber-400',
    itemActive: 'bg-amber-500/20 text-amber-200 border-amber-500/35 font-medium border shadow-sm',
    checkColor: 'text-amber-400',
    focusBorder: 'focus:border-amber-400',
  },
  indigo: {
    activeBorder: 'border-indigo-500/60 ring-2 ring-indigo-500/25',
    chevronActive: 'text-indigo-400',
    itemActive: 'bg-indigo-600/25 text-indigo-200 border-indigo-500/35 font-medium border shadow-sm',
    checkColor: 'text-indigo-400',
    focusBorder: 'focus:border-indigo-400',
  },
  rose: {
    activeBorder: 'border-rose-500/60 ring-2 ring-rose-500/25',
    chevronActive: 'text-rose-400',
    itemActive: 'bg-rose-500/20 text-rose-200 border-rose-500/35 font-medium border shadow-sm',
    checkColor: 'text-rose-400',
    focusBorder: 'focus:border-rose-400',
  },
  default: {
    activeBorder: 'border-white/40 ring-2 ring-white/15',
    chevronActive: 'text-white',
    itemActive: 'bg-white/15 text-white border-white/25 font-medium border shadow-sm',
    checkColor: 'text-white',
    focusBorder: 'focus:border-white/40',
  },
}

const SIZE_TRIGGER_CLASSES = {
  xs: 'h-6 px-2 py-0.5 text-[10px] rounded-md gap-1.5',
  sm: 'h-7 px-2.5 py-1 text-[10.5px] rounded-lg gap-2',
  md: 'h-9 px-3 py-1.5 text-xs rounded-xl gap-2.5',
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Chọn một mục...',
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Tìm kiếm...',
  className,
  triggerClassName,
  menuClassName,
  align = 'left',
  icon,
  themeColor = 'violet',
  size = 'sm',
  id,
  title,
  ariaLabel,
  headerNode,
  footerNode,
  customRenderOption,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (!isOpen) {
      setSearchQuery('')
    }
  }

  // Focus search input on open
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen, searchable])

  // Click outside and keyboard handling
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Find currently selected option
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  )

  // Filter options by search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options
    const q = searchQuery.toLowerCase()
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    )
  }, [options, searchQuery])

  const themeClasses = THEME_CLASSES[themeColor] || THEME_CLASSES.violet
  const sizeClasses = SIZE_TRIGGER_CLASSES[size] || SIZE_TRIGGER_CLASSES.sm

  return (
    <div ref={containerRef} className={cn('relative inline-block w-full', className)}>
      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        title={title}
        aria-label={ariaLabel || title}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between text-left transition-all duration-200 select-none cursor-pointer',
          'bg-black/50 border border-white/10 text-white shadow-inner font-medium',
          'hover:bg-white/[0.07] hover:border-white/25 active:scale-[0.99]',
          sizeClasses,
          isOpen && themeClasses.activeBorder,
          disabled && 'opacity-40 cursor-not-allowed hover:bg-black/50 hover:border-white/10 active:scale-100',
          triggerClassName
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
          {icon && <span className="shrink-0 flex items-center text-white/60">{icon}</span>}
          {selectedOption ? (
            <span className="truncate text-white/95 flex items-center gap-1.5 min-w-0">
              {selectedOption.badge && (
                <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-mono bg-white/10 text-white/70 border border-white/10">
                  {selectedOption.badge}
                </span>
              )}
              <span className="truncate">{selectedOption.label}</span>
            </span>
          ) : (
            <span className="text-white/40 truncate">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-white/40 shrink-0 transition-transform duration-200 ease-out',
            isOpen && cn('rotate-180', themeClasses.chevronActive)
          )}
        />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div
          role="listbox"
          className={cn(
            'absolute top-full mt-1.5 z-50 min-w-[200px] w-full max-w-[360px] max-h-[260px] flex flex-col',
            align === 'right' ? 'right-0' : 'left-0',
            'bg-[#0c101d]/95 backdrop-blur-2xl border border-white/15 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.08)]',
            'p-1 animate-in fade-in zoom-in-95 duration-150 ease-out overflow-hidden',
            menuClassName
          )}
        >
          {/* Header Node (Optional) */}
          {headerNode && <div className="shrink-0 border-b border-white/[0.08] mb-1">{headerNode}</div>}

          {/* Search Box if enabled */}
          {searchable && (
            <div className="shrink-0 p-1 border-b border-white/[0.08] mb-1">
              <div className="relative flex items-center">
                <Search className="w-3 h-3 text-white/40 absolute left-2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className={cn(
                    'w-full bg-black/60 border border-white/10 rounded-lg pl-7 pr-7 py-1 text-[11px] text-white placeholder:text-white/30',
                    'focus:outline-none focus:border-white/25',
                    themeClasses.focusBorder
                  )}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-white/40 hover:text-white p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-0.5 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2.5 text-center text-[11px] text-white/40">
                Không tìm thấy lựa chọn nào
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value
                if (customRenderOption) {
                  return (
                    <div
                      key={opt.value}
                      onClick={() => {
                        if (!opt.disabled) {
                          onChange(opt.value)
                          setIsOpen(false)
                        }
                      }}
                    >
                      {customRenderOption(opt, isSelected)}
                    </div>
                  )
                }

                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => {
                      if (!opt.disabled) {
                        onChange(opt.value)
                        setIsOpen(false)
                      }
                    }}
                    className={cn(
                      'w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-all duration-150 cursor-pointer',
                      isSelected
                        ? themeClasses.itemActive
                        : 'text-white/80 hover:bg-white/[0.08] hover:text-white',
                      opt.disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      {opt.badge && (
                        <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-mono bg-white/10 text-white/70 border border-white/10">
                          {opt.badge}
                        </span>
                      )}
                      <div className="min-w-0 flex-1 flex flex-col">
                        <span className="truncate text-[11px]">{opt.label}</span>
                        {opt.subLabel && (
                          <span className="text-[9.5px] text-white/40 font-mono truncate">
                            {opt.subLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className={cn('w-3.5 h-3.5 shrink-0', themeClasses.checkColor)} />
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* Footer Node (Optional) */}
          {footerNode && <div className="shrink-0 border-t border-white/[0.08] mt-1 pt-1">{footerNode}</div>}
        </div>
      )}
    </div>
  )
}
