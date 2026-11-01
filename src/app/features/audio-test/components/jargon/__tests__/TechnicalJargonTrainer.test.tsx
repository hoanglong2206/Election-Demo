import '@/test/setupDom'
import { describe, it, expect, afterEach } from 'bun:test'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { TechnicalJargonTrainer } from '../TechnicalJargonTrainer'
import { getSavedMeetingContext } from '@/services/meeting-context'

describe('TechnicalJargonTrainer', () => {
  afterEach(() => {
    cleanup()
    if (typeof localStorage !== 'undefined') localStorage.clear()
  })

  it('renders default jargon keywords list and count', async () => {
    let result: any
    await act(async () => {
      result = render(<TechnicalJargonTrainer />)
    })

    expect(result.getByText(/Huấn Luyện Từ Vựng Chuyên Ngành/i)).toBeDefined()
    expect(result.getByText('Kubernetes')).toBeDefined()
    expect(result.getByText('PostgreSQL')).toBeDefined()
    expect(result.getByText('OAuth2')).toBeDefined()
  })

  it('adds keyword via quick preset and syncs to meeting context', async () => {
    let result: any
    await act(async () => {
      result = render(<TechnicalJargonTrainer />)
    })

    const quickBtn = result.getByText('+Prometheus')
    await act(async () => {
      fireEvent.click(quickBtn)
    })

    expect(result.getByText('Prometheus')).toBeDefined()

    // Click Sync button
    const syncBtn = result.getByText(/Ghim vào Bộ nhớ STT Cuộc họp/i)
    await act(async () => {
      fireEvent.click(syncBtn)
    })

    expect(result.getByText(/Đã ghim vào Whisper!/i)).toBeDefined()
    const saved = getSavedMeetingContext().keywords
    expect(saved).toContain('Prometheus')
  })

  it('removes a keyword when clicking X button', async () => {
    let result: any
    await act(async () => {
      result = render(<TechnicalJargonTrainer />)
    })

    expect(result.getByText('Kubernetes')).toBeDefined()
    const removeBtn = result.getByTitle('Xóa Kubernetes')
    await act(async () => {
      fireEvent.click(removeBtn)
    })

    expect(result.queryByText('Kubernetes')).toBeNull()
  })
})
