import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../../common'
import { getUsageStorageService, type UsageStorageService } from '../../services/usage'

let activeUsageStorageService: UsageStorageService | null = null

export function getActiveUsageStorageService(): UsageStorageService | null {
  return activeUsageStorageService
}

export function registerUsageHandlers(): void {
  const usageStorage = getUsageStorageService()
  activeUsageStorageService = usageStorage

  ipcMain.handle(IPC_CHANNELS.USAGE.APPEND, (_event, batch: any[]) => {
    return usageStorage.append(batch)
  })

  ipcMain.handle(IPC_CHANNELS.USAGE.QUERY, (_event, params: any) => {
    return usageStorage.query(params)
  })

  ipcMain.handle(IPC_CHANNELS.USAGE.MIGRATE, (_event, records: any[]) => {
    return usageStorage.migrate(records)
  })

  ipcMain.handle(IPC_CHANNELS.USAGE.GET_RECENT, (_event, limit?: number) => {
    return usageStorage.getRecentRecords(limit)
  })

  ipcMain.handle(IPC_CHANNELS.USAGE.LOAD_CURRENT_MONTH, () => {
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return usageStorage.readMonthRecords(ym)
  })

  ipcMain.handle(IPC_CHANNELS.USAGE.RESET, () => {
    return usageStorage.resetAll()
  })
}
