import type { ProfilePreset } from '@/services/profile-preset'

export type ProfileIcon = 'code' | 'server' | 'cloud' | 'terminal' | 'cpu' | 'briefcase'
export type ProfileColor = 'violet' | 'emerald' | 'sky' | 'amber' | 'rose' | 'indigo'

export interface ProfileFormState {
  name: string
  role: string
  companyName: string
  jobDescription: string
  resumeContext: string
  customInstructions: string
  keywords: string[]
  newKeywordInput: string
  icon: ProfileIcon
  color: ProfileColor
  error: string | null
  isSubmitting: boolean
}

export const initialProfileFormState: ProfileFormState = {
  name: '',
  role: '',
  companyName: '',
  jobDescription: '',
  resumeContext: '',
  customInstructions: '',
  keywords: [],
  newKeywordInput: '',
  icon: 'server',
  color: 'violet',
  error: null,
  isSubmitting: false,
}

export type ProfileFormAction =
  | { type: 'RESET'; preset?: ProfilePreset | null }
  | { type: 'SET_FIELD'; field: keyof Omit<ProfileFormState, 'keywords' | 'error' | 'isSubmitting'>; value: string }
  | { type: 'SET_KEYWORDS'; keywords: string[] }
  | { type: 'ADD_KEYWORD'; keyword: string }
  | { type: 'REMOVE_KEYWORD'; keyword: string }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_SUBMITTING'; isSubmitting: boolean }

export function profileFormReducer(state: ProfileFormState, action: ProfileFormAction): ProfileFormState {
  switch (action.type) {
    case 'RESET': {
      if (action.preset) {
        return {
          ...initialProfileFormState,
          name: action.preset.name,
          role: action.preset.role,
          companyName: action.preset.companyName || '',
          jobDescription: action.preset.jobDescription,
          resumeContext: action.preset.resumeContext,
          customInstructions: action.preset.customInstructions || '',
          keywords: action.preset.keywords || [],
          icon: (action.preset.icon as ProfileIcon) || 'server',
          color: (action.preset.color as ProfileColor) || 'violet',
        }
      }
      return { ...initialProfileFormState }
    }
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value }
    case 'SET_KEYWORDS':
      return { ...state, keywords: action.keywords }
    case 'ADD_KEYWORD': {
      const trimmed = action.keyword.trim()
      if (!trimmed || state.keywords.some((k) => k.toLowerCase() === trimmed.toLowerCase())) {
        return state
      }
      return {
        ...state,
        keywords: [...state.keywords, trimmed],
        newKeywordInput: '',
      }
    }
    case 'REMOVE_KEYWORD':
      return {
        ...state,
        keywords: state.keywords.filter((k) => k.toLowerCase() !== action.keyword.toLowerCase()),
      }
    case 'SET_ERROR':
      return { ...state, error: action.error }
    case 'SET_SUBMITTING':
      return { ...state, isSubmitting: action.isSubmitting }
    default:
      return state
  }
}
