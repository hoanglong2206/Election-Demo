export type * from './ports'
export { ElectronIpcAdapter } from './electronAdapter'
export { MockIpcAdapter } from './mockAdapter'

import type {
  IIpcClient,
  IWindowPort,
  ICapturePort,
  IWhisperPort,
  ISessionsPort,
  IUsagePort,
  ICredentialsPort,
} from './ports'
import { ElectronIpcAdapter } from './electronAdapter'

let activeClient: IIpcClient = new ElectronIpcAdapter()

export function getIpcClient(): IIpcClient {
  return activeClient
}

export function setIpcClient(client: IIpcClient): void {
  activeClient = client
}

export function resetIpcClient(): void {
  activeClient = new ElectronIpcAdapter()
}

function createPortProxy<T extends object>(getPort: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const targetPort = getPort()
      const value = Reflect.get(targetPort, prop, receiver)
      if (typeof value === 'function') {
        return value.bind(targetPort)
      }
      return value
    },
  })
}

export const windowPort: IWindowPort = createPortProxy(() => getIpcClient().window)
export const capturePort: ICapturePort = createPortProxy(() => getIpcClient().capture)
export const whisperPort: IWhisperPort = createPortProxy(() => getIpcClient().whisper)
export const sessionsPort: ISessionsPort = createPortProxy(() => getIpcClient().sessions)
export const usagePort: IUsagePort = createPortProxy(() => getIpcClient().usage)
export const credentialsPort: ICredentialsPort = createPortProxy(() => getIpcClient().credentials)

