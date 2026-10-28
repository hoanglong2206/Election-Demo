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
        className="w-full h-9 bg-black/60 hover:bg-black/80 border border-white/10 rounded-xl px-2.5 text-[11px] text-left flex items-center justify-between text-white"
      >
        <span className="truncate">{PROVIDER_NAMES[llmProvider] || llmProvider}</span>
        <ChevronDown className="w-3 h-3 text-white/40" />
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-44 z-50 bg-[#0c101d] border border-white/15 rounded-xl shadow-2xl p-1 space-y-0.5">
          {(['Auto', 'Google', 'OpenAI'] as LLMProviderOption[]).map((prov) => (
            <button
              key={prov}
              type="button"
              onClick={() => {
                onLlmProviderChange(prov)
                setIsOpen(false)
              }}
              className={cn(
                'w-full text-left px-2 py-1.5 rounded-lg text-[11px] flex items-center justify-between transition-colors',
                llmProvider === prov ? 'bg-violet-600/20 text-white' : 'text-white/70 hover:bg-white/5'
              )}
            >
              <span>{PROVIDER_NAMES[prov]}</span>
              {llmProvider === prov && <Check className="w-3 h-3 text-violet-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

