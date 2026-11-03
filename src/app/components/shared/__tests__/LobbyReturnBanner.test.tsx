import '@/test/setupDom'
import { describe, it, expect, mock, afterEach } from 'bun:test'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { LobbyReturnBanner } from '../LobbyReturnBanner'

describe('LobbyReturnBanner Component', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders correctly with title and readiness badge', () => {
    const onReturn = mock(() => {})
    const onDismiss = mock(() => {})

    const result = render(
      <LobbyReturnBanner
        onReturnToLobby={onReturn}
        onDismiss={onDismiss}
        readinessScore={75}
      />
    )

    expect(result.getByText(/Đang hiệu chuẩn thực chiến từ Sảnh Chờ/i)).toBeDefined()
    expect(result.getByText(/Sẵn sàng: 75%/i)).toBeDefined()
    expect(result.getByText(/✓ Hoàn tất & Quay lại Sảnh chờ/i)).toBeDefined()
  })

  it('triggers onReturnToLobby callback when return button is clicked', () => {
    const onReturn = mock(() => {})

    const result = render(
      <LobbyReturnBanner
        onReturnToLobby={onReturn}
      />
    )

    const returnBtn = result.getByRole('button', { name: /✓ Hoàn tất & Quay lại Sảnh chờ/i })
    fireEvent.click(returnBtn)

    expect(onReturn).toHaveBeenCalledTimes(1)
  })

  it('triggers onDismiss callback when close button is clicked', () => {
    const onReturn = mock(() => {})
    const onDismiss = mock(() => {})

    const result = render(
      <LobbyReturnBanner
        onReturnToLobby={onReturn}
        onDismiss={onDismiss}
      />
    )

    const closeBtn = result.getByTitle('Đóng thanh điều hướng')
    fireEvent.click(closeBtn)

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
