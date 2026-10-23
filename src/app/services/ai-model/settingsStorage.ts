import { settingsManager } from '../settings'

export function getSavedVADThreshold(): string {
  return String(settingsManager.get('vadThreshold') ?? '0.8')
}

export function saveVADThreshold(val: string): void {
  const num = parseFloat(val)
  settingsManager.set('vadThreshold', isNaN(num) ? 0.8 : num)
}

export function getSavedResponseLanguage(): string {
  return settingsManager.get('responseLang') || 'bilingual'
}

export function saveResponseLanguage(val: string): void {
  settingsManager.set('responseLang', val)
}

export function getAutoPersonalize(): boolean {
  return settingsManager.get('autoPersonalize')
}

export function saveAutoPersonalize(enabled: boolean): void {
  settingsManager.set('autoPersonalize', enabled)
}
