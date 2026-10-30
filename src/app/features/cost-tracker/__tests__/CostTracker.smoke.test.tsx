import '@/test/setupDom'
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { CostTracker } from '../CostTracker'
import { setIpcClient, resetIpcClient, MockIpcAdapter } from '@/infrastructure/ipc'
import { usageTrackerService } from '@/services/usage-tracker'

describe('CostTracker Screen Smoke Tests', () => {
  let mockIpc: MockIpcAdapter

  beforeEach(() => {
    localStorage.clear()
    mockIpc = new MockIpcAdapter()
    setIpcClient(mockIpc)
    usageTrackerService.resetLocalStatistics(true)
  })

  afterEach(() => {
    cleanup()
    resetIpcClient()
  })

  it('renders CostTracker header and top overview metric cards', async () => {
    let result: any
    await act(async () => {
      result = render(<CostTracker />)
    })

    expect(result.getByText('Quản Lý Chi Phí & Token API')).toBeDefined()
    expect(result.getByText('Ước tính chi phí')).toBeDefined()
    expect(result.getByText('Tổng Token Usage')).toBeDefined()
    expect(result.getByText('Prompt Caching')).toBeDefined()
    expect(result.getByText('Thời Lượng STT')).toBeDefined()
    expect(result.getByText('Hạn Mức Ngân Sách')).toBeDefined()
  })

  it('switches between navigation tabs smoothly', async () => {
    let result: any
    await act(async () => {
      result = render(<CostTracker />)
    })

    // Switch to Charts tab
    const chartsTab = result.getByText('Xu hướng ngày')
    await act(async () => {
      fireEvent.click(chartsTab)
    })
    expect(result.getByText('Biểu Đồ Xu Hướng Sử Dụng Theo Ngày')).toBeDefined()

    // Switch to Distribution tab
    const distTab = result.getByText('Phân bổ')
    await act(async () => {
      fireEvent.click(distTab)
    })
    expect(result.getByText(/Phân Bổ Tỷ Trọng/)).toBeDefined()

    // Switch to Budget tab
    const budgetTab = result.getByText('Ngân sách')
    await act(async () => {
      fireEvent.click(budgetTab)
    })
    expect(result.getByText(/Quản Lý Hạn Mức Ngân Sách Hàng Tháng/)).toBeDefined()

    // Switch to Pricing tab
    const pricingTab = result.getByText('Bảng giá mô hình')
    await act(async () => {
      fireEvent.click(pricingTab)
    })
    expect(result.getByText('Bảng Giá Model & Cấu Hình Chi Phí')).toBeDefined()

    // Switch to Logs tab
    const logsTab = result.getByText('Lịch sử sử dụng AI')
    await act(async () => {
      fireEvent.click(logsTab)
    })
    expect(result.getByText(/Lịch Sử Sử Dụng AI/)).toBeDefined()
  })

  it('opens and closes reset statistics confirmation modal', async () => {
    let result: any
    await act(async () => {
      result = render(<CostTracker />)
    })

    // Click trash button in header
    const trashBtn = result.container.querySelector('button[title="Đặt lại thống kê cục bộ"]')
    expect(trashBtn).toBeDefined()
    await act(async () => {
      fireEvent.click(trashBtn!)
    })

    // Modal should be visible
    expect(result.getByText('Xác nhận đặt lại thống kê?')).toBeDefined()

    // Click cancel button
    const cancelBtn = result.getByText('Hủy bỏ')
    await act(async () => {
      fireEvent.click(cancelBtn)
    })

    // Modal should be closed
    expect(result.queryByText('Xác nhận đặt lại thống kê?')).toBeNull()
  })

  it('seeds demo data successfully and updates record count', async () => {
    let result: any
    await act(async () => {
      result = render(<CostTracker />)
    })

    const seedBtn = result.getByText('Nạp demo')
    await act(async () => {
      fireEvent.click(seedBtn)
    })

    expect(result.getByText(/Đã tạo dữ liệu mẫu thành công!/)).toBeDefined()
  })
})

