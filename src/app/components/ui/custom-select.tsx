import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react'
import { ChevronDown, Check, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  subLabel?: string
  badge?: string
  icon?: ReactNode
}

interface CustomSelectProps {
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
  themeColor?: 'violet' | 'cyan' | 'emerald'
  title?: string
  ariaLabel?: string
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
  title,
  ariaLabel,
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

  // Click outside to close
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

  // Color theme classes
  const themeClasses = {
    violet: {
      activeBorder: 'border-violet-500/60 ring-2 ring-violet-500/20',
      itemActive: 'bg-violet-600/25 text-violet-200 border-violet-500/30',
      checkColor: 'text-violet-400',
      focusBorder: 'focus:border-violet-400',
    },
    cyan: {
      activeBorder: 'border-cyan-500/60 ring-2 ring-cyan-500/20',
      itemActive: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/30',
      checkColor: 'text-cyan-400',
      focusBorder: 'focus:border-cyan-400',
    },
    emerald: {
      activeBorder: 'border-emerald-500/60 ring-2 ring-emerald-500/20',
      itemActive: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30',
      checkColor: 'text-emerald-400',
      focusBorder: 'focus:border-emerald-400',
    },
  }[themeColor]

  return (
    <div ref={containerRef} className={cn('relative inline-block w-full', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        title={title}
        aria-label={ariaLabel || title}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-all select-none',
          'bg-black/50 border border-white/15 text-white shadow-inner',
          'hover:bg-white/[0.06] hover:border-white/25',
          triggerClassName,
          isOpen && themeClasses.activeBorder,
          disabled && 'opacity-40 cursor-not-allowed hover:bg-black/50 hover:border-white/15'
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          {icon && <span className="shrink-0 flex items-center text-white/60">{icon}</span>}
          {selectedOption ? (
            <span className="truncate text-white/90">
              {selectedOption.badge && (
                <span className="mr-1.5 px-1.5 py-0.2 rounded text-[9px] font-mono bg-white/10 text-white/70 border border-white/10">
                  {selectedOption.badge}
                </span>
              )}
              {selectedOption.label}
            </span>
          ) : (
            <span className="text-white/40 truncate">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-white/50 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180 text-white'
          )}
        />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute top-full mt-1.5 z-50 min-w-[200px] w-full max-w-[360px]',
            align === 'right' ? 'right-0' : 'left-0',
            'bg-[#0d111c]/95 backdrop-blur-2xl border border-white/15 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)]',
            'p-1 space-y-0.5 animate-in fade-in zoom-in-95 duration-100',
            menuClassName
          )}
        >
          {/* Search Box if enabled */}
          {searchable && (
            <div className="p-1 border-b border-white/[0.08] mb-1">
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
          <div className="max-h-60 overflow-y-auto custom-scrollbar p-0.5 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2.5 text-center text-[11px] text-white/40">
                Không tìm thấy lựa chọn nào
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value)
                      setIsOpen(false)
                    }}
                    className={cn(
                      'w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-all',
                      isSelected
                        ? cn(themeClasses.itemActive, 'font-medium border shadow-sm')
                        : 'text-white/80 hover:bg-white/[0.08] hover:text-white'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      {opt.badge && (
                        <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-mono bg-white/10 text-white/70 border border-white/10">
                          {opt.badge}
                        </span>
                      )}
                      <div className="min-w-0 truncate flex flex-col">
                        <span className="truncate text-[11.5px]">{opt.label}</span>
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
        </div>
      )}
    </div>
  )
}
