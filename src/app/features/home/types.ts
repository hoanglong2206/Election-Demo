import type { ViewState } from '../../components/layout/Layout'
import type { AppMode } from '../../types/electron.d'

export interface HomeProps {
  onViewChange: (v: ViewState) => void
  mode: AppMode
  onModeChange: (m: AppMode) => void
}
