import { useState, useEffect, useMemo } from 'react'
import {
  Coins,
  Plus,
  Trash2,
  CheckCircle2,
  Search,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CustomSelect } from '@/components/ui/custom-select'
import { NumberInput } from '@/components/ui/number-input'
import { cn } from '@/lib/utils'
import { pricingRegistry, type ModelPricingRule } from '@/services/usage-tracker'
import { modelRegistryService, type DiscoveredModel } from '@/services/ai-model/model-registry'

export function ModelPricingConfigCard() {
  const [pricingRules, setPricingRules] = useState<ModelPricingRule[]>(() =>
    pricingRegistry.getAllRules()
  )
  const [pricingModels, setPricingModels] = useState<DiscoveredModel[]>(() =>
    modelRegistryService.getModels()
  )
  const [pricingModelKey, setPricingModelKey] = useState('')
  const [inputPrice, setInputPrice] = useState('')
  const [outputPrice, setOutputPrice] = useState('')
  const [audioPrice, setAudioPrice] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    const refreshPricingRules = () => setPricingRules(pricingRegistry.getAllRules())
    const refreshAvailableModels = () => setPricingModels(modelRegistryService.getModels())
    window.addEventListener('pricing-rules-updated', refreshPricingRules)
    window.addEventListener('ai-models-updated', refreshAvailableModels)
    return () => {
      window.removeEventListener('pricing-rules-updated', refreshPricingRules)
      window.removeEventListener('ai-models-updated', refreshAvailableModels)
    }
  }, [])

  const selectedPricingModel = pricingModels.find(
    (model) => `${model.provider}::${model.id}` === pricingModelKey
  )

  const handleSavePricing = () => {
    const input = inputPrice.trim() ? Number(inputPrice) : 0
    const output = outputPrice.trim() ? Number(outputPrice) : 0
    const audio = audioPrice.trim() ? Number(audioPrice) : undefined

    if (
      !selectedPricingModel ||
      !Number.isFinite(input) ||
      !Number.isFinite(output) ||
      input < 0 ||
      output < 0 ||
      (audio !== undefined && (!Number.isFinite(audio) || audio < 0)) ||
      (inputPrice.trim() === '' && outputPrice.trim() === '' && audio === undefined)
    )
      return

    pricingRegistry.registerRule({
      provider: selectedPricingModel.provider,
      modelMatch: selectedPricingModel.id,
      inputPerMillionTokens: input,
      outputPerMillionTokens: output,
      perMinuteAudioUsd: audio,
    })

    setPricingModelKey('')
    setInputPrice('')
    setOutputPrice('')
    setAudioPrice('')
    setPricingRules(pricingRegistry.getAllRules())
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2500)
  }

  const handleDeleteRule = (provider: string, modelMatch: string) => {
    pricingRegistry.removePricing(provider, modelMatch)
    setPricingRules(pricingRegistry.getAllRules())
  }

  // Filter rules by query
  const filteredRules = pricingRules.filter((r) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      r.provider.toLowerCase().includes(q) ||
      r.modelMatch.toLowerCase().includes(q)
    )
  })

  const modelOptions = useMemo(() => {
    return pricingModels.map((m) => ({
      value: `${m.provider}::${m.id}`,
      label: m.displayName || m.id,
      subLabel: m.id,
      badge: m.provider,
    }))
  }, [pricingModels])

  return (
    <Card className="bg-white/[0.03] border-white/[0.08] shadow-none p-4 relative overflow-hidden">
      <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-black/40 border border-white/[0.08] flex items-center justify-center shrink-0">
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-[13px] text-white/90 font-semibold flex items-center gap-2">
              <span>Bảng Giá Model & Cấu Hình Chi Phí</span>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border font-mono bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                {pricingRules.length} quy tắc
              </Badge>
            </CardTitle>
            <p className="text-[10px] text-white/40 mt-0.5">
              Giá token mặc định ($/1M tokens) và audio ($/phút) để ước tính chi phí API
            </p>
          </div>
        </div>

        {isSaved && (
          <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] animate-fade-in font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Đã lưu giá thành công!</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0 pt-4 space-y-4">
        {/* Form: Add/Edit Price */}
        <div className="bg-black/30 border border-white/[0.06] rounded-xl p-3 space-y-2.5">
          <div className="text-[11px] font-medium text-white/80 flex items-center justify-between">
            <span>Thiết lập giá cho Model AI</span>
            <span className="text-[9.5px] text-white/40">
              {pricingModels.length} model khả dụng từ Registry
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div>
              <label className="text-[10px] text-white/50 block mb-1">
                Chọn Model:
              </label>
              <CustomSelect
                value={pricingModelKey}
                onChange={setPricingModelKey}
                options={modelOptions}
                placeholder={pricingModels.length ? '-- Chọn model cần định giá --' : 'Chưa có model'}
                disabled={pricingModels.length === 0}
                searchable
                searchPlaceholder="Tìm kiếm tên model hoặc ID..."
                themeColor="emerald"
                triggerClassName="h-7 text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] text-white/50 block mb-1">
                Input ($ / 1M tokens):
              </label>
              <NumberInput
                min={0}
                step={0.01}
                value={inputPrice}
                onChange={setInputPrice}
                prefix="$"
                placeholder="0.15"
              />
            </div>

            <div>
              <label className="text-[10px] text-white/50 block mb-1">
                Output ($ / 1M tokens):
              </label>
              <NumberInput
                min={0}
                step={0.01}
                value={outputPrice}
                onChange={setOutputPrice}
                prefix="$"
                placeholder="0.60"
              />
            </div>

            <div>
              <label className="text-[10px] text-white/50 block mb-1">
                Audio ($ / phút STT):
              </label>
              <NumberInput
                min={0}
                step={0.001}
                value={audioPrice}
                onChange={setAudioPrice}
                prefix="$"
                placeholder="0.006"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="sm"
              onClick={handleSavePricing}
              disabled={!selectedPricingModel}
              className="h-7 px-3 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-1 rounded-lg transition-all disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Lưu Quy Tắc Giá</span>
            </Button>
          </div>
        </div>

        {/* Rules Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-white/70">
              Danh sách quy tắc giá hiện tại ({filteredRules.length})
            </span>

            <div className="relative w-48">
              <Search className="w-3 h-3 absolute left-2 top-1/2 transform -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Tìm model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg pl-7 pr-2 py-0.5 text-[10.5px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/25"
              />
            </div>
          </div>

          <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-black/20">
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-white/[0.03] text-white/40 border-b border-white/[0.06] sticky top-0 text-[10px] uppercase font-mono">
                  <tr>
                    <th className="py-2 px-3">Nhà Cung Cấp</th>
                    <th className="py-2 px-3">Model</th>
                    <th className="py-2 px-3">Input / 1M</th>
                    <th className="py-2 px-3">Output / 1M</th>
                    <th className="py-2 px-3">Audio / Phút</th>
                    <th className="py-2 px-3">Nguồn</th>
                    <th className="py-2 px-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-white/40 text-xs">
                        Không tìm thấy quy tắc giá phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredRules.map((rule) => (
                      <tr
                        key={`${rule.provider}:${rule.modelMatch}`}
                        className="hover:bg-white/[0.02] transition-colors font-mono text-[10.5px]"
                      >
                        <td className="py-1.5 px-3 font-sans font-medium text-white/90">
                          {rule.provider}
                        </td>
                        <td className="py-1.5 px-3 text-cyan-300 font-semibold truncate max-w-[150px]">
                          {rule.modelMatch}
                        </td>
                        <td className="py-1.5 px-3 text-white/70">
                          ${rule.inputPerMillionTokens}
                        </td>
                        <td className="py-1.5 px-3 text-white/70">
                          ${rule.outputPerMillionTokens}
                        </td>
                        <td className="py-1.5 px-3 text-white/50">
                          {rule.perMinuteAudioUsd !== undefined
                            ? `$${rule.perMinuteAudioUsd}`
                            : '---'}
                        </td>
                        <td className="py-1.5 px-3 font-sans">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[8.5px] px-1 py-0 border',
                              rule.source === 'model'
                                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
                                : 'bg-violet-500/10 text-violet-300 border-violet-500/20'
                            )}
                          >
                            {rule.source === 'model' ? 'Registry' : 'Tùy chỉnh'}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-3 text-right font-sans">
                          {rule.source !== 'model' ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteRule(rule.provider, rule.modelMatch)}
                              className="text-rose-400/70 hover:text-rose-300 text-[10px] p-1 rounded hover:bg-rose-500/10 transition-colors"
                              title="Xóa quy tắc tùy chỉnh"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-white/20 text-[10px]">Mặc định</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

