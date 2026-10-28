import { useState, useRef, useEffect } from 'react'
import { Route, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ModelRouterPolicy =
  | 'fastest'
  | 'cheapest'
  | 'balanced'
  | 'highest-quality'
  | 'local-only'

interface ModelRouterPolicySelectorProps {
  modelRouterPolicy: ModelRouterPolicy
  onModelRouterPolicyChange: (policy: ModelRouterPolicy) => void
}

export function ModelRouterPolicySelector({
  modelRouterPolicy,
  onModelRouterPolicyChange,
}: ModelRouterPolicySelectorProps) {
  const [isRouterOpen, setIsRouterOpen] = useState(false)
  const routerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (routerRef.current && !routerRef.current.contains(e.target as Node)) {
        setIsRouterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="space-y-1.5 bg-black/40 p-3 rounded-xl border border-white/[0.06]">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-white/85 flex items-center gap-1.5">
          <Route className="w-3.5 h-3.5 text-violet-400" />
          <span>Smart Model Router</span>
        </span>
      </div>

      <div ref={routerRef} className="relative">
        <button
          type="button"
          onClick={() => setIsRouterOpen(!isRouterOpen)}
          className="w-full bg-black/60 hover:bg-black/80 border border-white/[0.1] hover:border-violet-500/40 rounded-xl px-3 py-2 text-[11px] text-left flex items-center justify-between transition-all"
          aria-haspopup="listbox"
          aria-expanded={isRouterOpen}
          aria-label="Chính sách Smart Model Router"
        >
          <span className="font-medium text-white/90 truncate">
            {
              {
                balanced: 'Cân bằng',
                fastest: 'Nhanh nhất',
                cheapest: 'Tiết kiệm nhất',
                'highest-quality': 'Chất lượng cao',
                'local-only': 'Chỉ dùng local',
              }[modelRouterPolicy]
            }
          </span>
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-white/40 shrink-0 transition-transform duration-200',
              isRouterOpen && 'rotate-180 text-violet-400'
            )}
          />
        </button>

        {isRouterOpen && (
          <div
            role="listbox"
            aria-label="Chính sách Smart Model Router"
            className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#0c101d] border border-white/15 rounded-xl shadow-2xl backdrop-blur-2xl p-1.5 space-y-1 animate-fade-in"
          >
            {[
              { value: 'balanced', label: 'Cân bằng' },
              { value: 'fastest', label: 'Nhanh nhất' },
              { value: 'cheapest', label: 'Tiết kiệm nhất' },
              { value: 'highest-quality', label: 'Chất lượng cao' },
              { value: 'local-only', label: 'Chỉ dùng local' },
            ].map((option) => {
              const isSelected = option.value === modelRouterPolicy
              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onClick={() => {
                    onModelRouterPolicyChange(option.value as ModelRouterPolicy)
                    setIsRouterOpen(false)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onModelRouterPolicyChange(option.value as ModelRouterPolicy)
                      setIsRouterOpen(false)
                    }
                  }}
                  className={cn(
                    'p-2 rounded-lg cursor-pointer transition-colors flex items-center justify-between text-[11px]',
                    isSelected
                      ? 'bg-violet-600/20 text-white font-medium border border-violet-500/30'
                      : 'hover:bg-white/[0.06] text-white/75'
                  )}
                >
                  <span>{option.label}</span>
                  {isSelected && <Check className="w-3 h-3 text-violet-400 shrink-0" />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-[9.5px] text-white/40 pt-0.5">
        Tự chọn model theo tốc độ, chi phí và độ phức tạp của yêu cầu.
      </p>
    </div>
  )
}

