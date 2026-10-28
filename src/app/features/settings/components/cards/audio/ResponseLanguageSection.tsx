import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResponseLanguageSectionProps {
  responseLang: string
  onResponseLangChange: (val: string) => void
}

export function ResponseLanguageSection({
  responseLang,
  onResponseLangChange,
}: ResponseLanguageSectionProps) {
  return (
    <div className="space-y-1.5 bg-black/40 p-3 rounded-xl border border-white/[0.06]">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-white/85 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-violet-400" />
          <span>Ngôn ngữ phản hồi của AI:</span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 pt-0.5">
        {[
          {
            val: 'bilingual',
            label: 'Song ngữ',
            sub: 'EN + VI song song',
          },
          { val: 'en', label: 'Tiếng Anh', sub: 'Chỉ English' },
          { val: 'vi', label: 'Tiếng Việt', sub: 'Chỉ Vietnamese' },
        ].map((item) => (
          <button
            key={item.val}
            type="button"
            onClick={() => onResponseLangChange(item.val)}
            className={cn(
              'py-1.5 px-2 rounded-lg text-center transition-all flex flex-col items-center justify-center border',
              responseLang === item.val
                ? 'bg-violet-600/25 border-violet-500/50 text-white shadow-sm'
                : 'bg-white/[0.02] border-white/[0.05] text-white/60 hover:bg-white/[0.05] hover:text-white'
            )}
          >
            <span className="text-[11px] font-bold">{item.label}</span>
            <span className="text-[8.5px] opacity-60 leading-tight">{item.sub}</span>
          </button>
        ))}
      </div>

      <p className="text-[9.5px] text-white/40 pt-0.5">
        AI sẽ gợi ý câu trả lời tương ứng theo đúng định dạng ngôn ngữ bạn mong muốn.
      </p>
    </div>
  )
}

