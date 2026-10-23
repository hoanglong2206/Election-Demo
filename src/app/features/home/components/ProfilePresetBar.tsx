import { useState, useRef, useEffect } from 'react'
import {
  ChevronDown,
  Plus,
  Edit2,
  Copy,
  Trash2,
  FileText,
  Check,
  Server,
  Code,
  Cloud,
  Terminal,
  Cpu,
  Briefcase,
  Layers,
  MoreHorizontal,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProfilePreset } from '../../../services/profile-preset'

interface ProfilePresetBarProps {
  activeProfile?: ProfilePreset | null
  allProfiles: ProfilePreset[]
  onSelectProfile: (id: string) => void
  onCreateProfile: () => void
  onEditProfile: (preset: ProfilePreset) => void
  onDuplicateProfile: (id: string) => void
  onDeleteProfile: (preset: ProfilePreset) => void
  onOpenImportExport: () => void
}

const ICON_MAP = {
  server: Server,
  code: Code,
  cloud: Cloud,
  terminal: Terminal,
  cpu: Cpu,
  briefcase: Briefcase,
}

const COLOR_MAP = {
  violet: { bg: 'bg-violet-500/15', border: 'border-violet-500/30', text: 'text-violet-300' },
  sky: { bg: 'bg-sky-500/15', border: 'border-sky-500/30', text: 'text-sky-300' },
  emerald: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-300' },
  amber: { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-300' },
  rose: { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-300' },
  indigo: { bg: 'bg-indigo-500/15', border: 'border-indigo-500/30', text: 'text-indigo-300' },
}

export function ProfilePresetBar({
  activeProfile,
  allProfiles,
  onSelectProfile,
  onCreateProfile,
  onEditProfile,
  onDuplicateProfile,
  onDeleteProfile,
  onOpenImportExport,
}: ProfilePresetBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const ActiveIconComp = (activeProfile?.icon && ICON_MAP[activeProfile.icon]) || Briefcase
  const activeColor = (activeProfile?.color && COLOR_MAP[activeProfile.color]) || COLOR_MAP.violet

  return (
    <div className="w-full flex items-center justify-between gap-2 p-1.5 px-2 rounded-lg bg-black/40 border border-white/[0.08] min-w-0">
      {/* Left: Active Preset Selector Dropdown */}
      <div className="relative min-w-0 flex-1 max-w-[160px] sm:max-w-[200px]" ref={dropdownRef}>
        <button
          type="button"
          id="btn-profile-preset-dropdown"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={cn(
            'w-full flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border shadow-sm min-w-0',
            activeProfile ? cn(activeColor.bg, activeColor.border) : 'bg-white/5 border-white/10 text-white/60',
            'hover:bg-white/10'
          )}
          title={activeProfile?.name || 'Chọn profile'}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
            <div className={cn('w-4 h-4 rounded flex items-center justify-center shrink-0 border', activeProfile ? cn(activeColor.bg, activeColor.border) : 'bg-white/5 border-white/10')}>
              <ActiveIconComp className={cn('w-2.5 h-2.5 shrink-0', activeProfile ? activeColor.text : 'text-white/40')} />
            </div>
            <span className="font-semibold text-white/95 truncate text-left min-w-0 flex-1">
              {activeProfile?.name || 'Chưa chọn Profile'}
            </span>

            {activeProfile?.role ? (
              <Badge
                variant="outline"
                className="text-[9px] px-1 py-0 h-3.5 border-white/15 bg-white/5 text-white/70 font-normal shrink-0 max-w-[80px] truncate"
              >
                {activeProfile.role}
              </Badge>
            ) : (
              <span className="text-[9.5px] text-white/40 shrink-0 font-normal">
                (Trống)
              </span>
            )}
          </div>

          <ChevronDown className={cn('w-3.5 h-3.5 text-white/40 shrink-0 transition-transform duration-200', dropdownOpen && 'rotate-180')} />
        </button>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div className="absolute left-0 top-full mt-1.5 w-[260px] sm:w-[280px] max-h-64 bg-zinc-950/95 border border-white/15 rounded-xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden flex flex-col animate-fade-in text-[11px]">
            <div className="p-2 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
              <span className="text-[10px] font-medium text-white/60 flex items-center gap-1.5 min-w-0 truncate">
                <Layers className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <span className="truncate">Hồ sơ ({allProfiles.length})</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false)
                  onCreateProfile()
                }}
                className="text-[10px] text-violet-300 hover:text-white flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 transition-colors shrink-0"
              >
                <Plus className="w-3 h-3" />
                <span>Tạo mới</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-1.5 space-y-1 custom-scrollbar">
              {allProfiles.length === 0 ? (
                <div className="py-6 px-4 text-center space-y-2">
                  <p className="text-[11px] text-white/50">Chưa có profile phỏng vấn nào.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false)
                      onCreateProfile()
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-[10.5px] font-medium transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tạo Profile mới</span>
                  </button>
                </div>
              ) : (
                allProfiles.map((p) => {
                  const ItemIcon = (p.icon && ICON_MAP[p.icon]) || Briefcase
                  const itemColor = (p.color && COLOR_MAP[p.color]) || COLOR_MAP.violet
                  const isItemActive = activeProfile ? p.id === activeProfile.id : false

                  return (
                    <div
                      key={p.id}
                      className={cn(
                        'group flex items-center justify-between p-2 rounded-lg transition-all cursor-pointer border',
                        isItemActive
                          ? 'bg-violet-600/20 border-violet-500/30 text-white shadow-sm'
                          : 'border-transparent hover:bg-white/[0.06] text-white/70 hover:text-white'
                      )}
                      onClick={() => {
                        onSelectProfile(p.id)
                        setDropdownOpen(false)
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={cn('w-6 h-6 rounded-md flex items-center justify-center shrink-0 border', itemColor.bg, itemColor.border)}>
                          <ItemIcon className={cn('w-3.5 h-3.5', itemColor.text)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-[11px] truncate text-white/95" title={p.name}>
                              {p.name}
                            </span>
                            {isItemActive && (
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            )}
                          </div>
                          <span className="text-[9.5px] text-white/45 block truncate">
                            {p.role || 'Chưa có role'}{p.companyName ? ` • ${p.companyName}` : ''} ({p.keywords?.length || 0} kw)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setDropdownOpen(false)
                            onEditProfile(p)
                          }}
                          className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                          title="Chỉnh sửa profile này"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onDuplicateProfile(p.id)
                            setDropdownOpen(false)
                          }}
                          className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                          title="Nhân bản profile này"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {allProfiles.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setDropdownOpen(false)
                              onDeleteProfile(p)
                            }}
                            className="p-1 rounded hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-colors"
                            title="Xóa profile này"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="p-2 border-t border-white/[0.08] flex items-center justify-between text-[9.5px] text-white/40 bg-white/[0.01]">
              <span className="truncate pr-1">Chuyển đổi 1-click</span>
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false)
                  onOpenImportExport()
                }}
                className="text-violet-300 hover:text-white flex items-center gap-1 transition-colors shrink-0 whitespace-nowrap"
              >
                <FileText className="w-3 h-3" />
                <span>Backup JSON</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Quick Action Buttons */}
      <div className="flex items-center gap-1.5 text-[10.5px] shrink-0">
        <Button
          type="button"
          id="btn-create-profile"
          size="sm"
          onClick={onCreateProfile}
          className="h-6 px-2.5 text-[10.5px] bg-violet-600 hover:bg-violet-500 text-white font-medium flex items-center gap-1 whitespace-nowrap shrink-0 shadow-sm transition-all"
          title="Tạo thêm bộ hồ sơ / role phỏng vấn mới"
        >
          <Plus className="w-3 h-3 shrink-0" />
          <span>Tạo mới</span>
        </Button>

        {activeProfile && (
          <div className="relative" ref={moreMenuRef}>
            <Button
              type="button"
              id="btn-profile-more-menu"
              variant="outline"
              size="sm"
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className={cn(
                'h-6 w-6 p-0 border-white/10 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center shrink-0 transition-colors',
                moreMenuOpen && 'bg-white/15 text-white'
              )}
              title="Tùy chọn khác cho profile này"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>

            {moreMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-zinc-950/95 border border-white/15 rounded-xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden flex flex-col animate-fade-in p-1 text-[11px]">
                <div className="px-2.5 py-1.5 text-[10px] font-medium text-white/50 border-b border-white/[0.06] mb-0.5 truncate">
                  Tùy chọn: {activeProfile.name}
                </div>

                <button
                  type="button"
                  id="btn-edit-active-profile"
                  onClick={() => {
                    setMoreMenuOpen(false)
                    onEditProfile(activeProfile)
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors text-left"
                >
                  <Edit2 className="w-3 h-3 text-violet-400 shrink-0" />
                  <span>Chỉnh sửa thông tin</span>
                </button>

                <button
                  type="button"
                  id="btn-duplicate-active-profile"
                  onClick={() => {
                    setMoreMenuOpen(false)
                    onDuplicateProfile(activeProfile.id)
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors text-left"
                >
                  <Copy className="w-3 h-3 text-sky-400 shrink-0" />
                  <span>Nhân bản profile</span>
                </button>

                <button
                  type="button"
                  id="btn-import-export-profiles"
                  onClick={() => {
                    setMoreMenuOpen(false)
                    onOpenImportExport()
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors text-left"
                >
                  <FileText className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>Sao lưu / Phục hồi JSON</span>
                </button>

                {allProfiles.length > 1 && (
                  <>
                    <div className="my-1 border-t border-white/[0.06]" />
                    <button
                      type="button"
                      id="btn-delete-active-profile"
                      onClick={() => {
                        setMoreMenuOpen(false)
                        onDeleteProfile(activeProfile)
                      }}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 transition-colors text-left"
                    >
                      <Trash2 className="w-3 h-3 text-rose-400 shrink-0" />
                      <span>Xóa profile này</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

