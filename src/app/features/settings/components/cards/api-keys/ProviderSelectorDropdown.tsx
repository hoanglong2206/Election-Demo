import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PROVIDER_NAMES, type LLMProviderOption } from '../../../types'

interface ProviderSelectorDropdownProps {
  llmProvider: LLMProviderOption
  onLlmProviderChange: (provider: LLMProviderOption) => void
}

export function ProviderSelectorDropdown({
  llmProvider,
  onLlmProviderChange,
}: ProviderSelectorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={menuRef} className="relative w-36 shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'w-full h-9 bg-black/50 hover:bg-black/70 border border-white/10 hover:border-violet-500/40 rounded-xl px-2.5 text-[11px] text-left flex items-center justify-between text-white transition-all duration-200 select-none cursor-pointer active:scale-[0.99] shadow-inner',
          isOpen && 'border-violet-500/60 ring-2 ring-violet-500/25'
        )}
      >
        <span className="truncate">{PROVIDER_NAMES[llmProvider] || llmProvider}</span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-white/40 shrink-0 transition-transform duration-200 ease-out',
            isOpen && 'rotate-180 text-violet-400'
          )}
        />
      </button>
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-1.5 w-44 z-50 bg-[#0c101d]/95 backdrop-blur-2xl border border-white/15 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.08)] p-1 space-y-0.5 animate-in fade-in zoom-in-95 duration-150 ease-out"
        >
          {(['Auto', 'Google', 'OpenAI'] as LLMProviderOption[]).map((prov) => (
            <button
              key={prov}
              type="button"
              role="option"
              aria-selected={llmProvider === prov}
              onClick={() => {
                onLlmProviderChange(prov)
                setIsOpen(false)
              }}
              className={cn(
                'w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all duration-150 select-none cursor-pointer',
                llmProvider === prov
                  ? 'bg-violet-600/25 text-violet-200 border border-violet-500/35 font-medium shadow-sm'
                  : 'text-white/80 hover:bg-white/[0.08] hover:text-white'
              )}
            >
              <span>{PROVIDER_NAMES[prov]}</span>
              {llmProvider === prov && <Check className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

