import fs from 'node:fs'
import os from 'node:os'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function getElectronApp(): any {
  try {
    const electron = require('electron')
    if (electron && typeof electron === 'object' && electron.app) {
      return electron.app
    }
    return null
  } catch {
    return null
  }
}

export type GpuBackendType = 'cuda' | 'vulkan' | 'openvino' | 'directml' | 'cpu'

export interface WhisperGpuInfo {
  isGpuAvailable: boolean
  isAccelerated: boolean
  backend: GpuBackendType
  deviceName?: string
  vramMb?: number
  fallbackReason?: string
}

export interface GpuLaunchConfig {
  gpuInfo: WhisperGpuInfo
  threadCount: number
  extraArgs: string[]
}

/**
 * Inspects binDir for ggml backend dynamic libraries.
 */
export function detectBackendDlls(binDir: string): {
  hasCuda: boolean
  hasVulkan: boolean
  hasOpenVino: boolean
  hasDirectMl: boolean
} {
  try {
    if (!fs.existsSync(binDir)) {
      return { hasCuda: false, hasVulkan: false, hasOpenVino: false, hasDirectMl: false }
    }
    const files = fs.readdirSync(binDir).map((f) => f.toLowerCase())
    return {
      hasCuda: files.some((f) => f.includes('cuda') || f.includes('cublas')),
      hasVulkan: files.some((f) => f.includes('vulkan')),
      hasOpenVino: files.some((f) => f.includes('openvino')),
      hasDirectMl: files.some((f) => f.includes('directml')),
    }
  } catch {
    return { hasCuda: false, hasVulkan: false, hasOpenVino: false, hasDirectMl: false }
  }
}

/**
 * Queries system / Electron for GPU hardware devices.
 */
export async function detectSystemGpu(): Promise<{
  hasHardwareGpu: boolean
  deviceName?: string
  vendor?: string
}> {
  const electronApp = getElectronApp()
  if (electronApp && typeof electronApp.getGPUInfo === 'function') {
    try {
      const info = await electronApp.getGPUInfo('basic')
      const gpus: any[] = info?.gpuDevice || []
      const primaryGpu = gpus.find((g: any) => g.active) || gpus[0]
      if (primaryGpu) {
        // Look up vendor
        let vendor = 'Unknown'
        if (primaryGpu.vendorId === 0x10de) vendor = 'NVIDIA'
        else if (primaryGpu.vendorId === 0x1002) vendor = 'AMD'
        else if (primaryGpu.vendorId === 0x8086) vendor = 'Intel'

        const deviceName = primaryGpu.description || `${vendor} GPU`
        return {
          hasHardwareGpu: true,
          deviceName,
          vendor,
        }
      }
    } catch {
      // Graceful fallback if getGPUInfo fails or runs in headless / unit-test mode
    }
  }

  // Fallback: check Windows OS environment variables or basic heuristic
  const isWindows = process.platform === 'win32'
  if (isWindows && (process.env.CUDA_PATH || process.env.VULKAN_SDK)) {
    return {
      hasHardwareGpu: true,
      deviceName: process.env.CUDA_PATH ? 'NVIDIA CUDA GPU' : 'Vulkan-compatible GPU',
    }
  }

  return {
    hasHardwareGpu: false,
  }
}

/**
 * Computes optimal launch configuration and thread allocation for whisper-server.
 *
 * Strategy:
 * - If GPU available & backend DLL present:
 *   - Use GPU backend (CUDA / Vulkan / OpenVINO).
 *   - Enable Flash Attention (-fa).
 *   - Lower CPU threads to 2 to minimize CPU utilization and system heat.
 * - If CPU mode:
 *   - Use adaptive thread count: min(4, max(2, floor(cpuCount / 2))) so it never saturates 100% cores.
 *   - Pass -ng (--no-gpu) to prevent unnecessary backend probing.
 */
export async function resolveWhisperGpuConfig(
  binDir: string,
  options?: { forceCpu?: boolean; cpuCount?: number }
): Promise<GpuLaunchConfig> {
  const cpuCount = options?.cpuCount ?? (os.cpus()?.length || 4)
  const adaptiveCpuThreads = Math.min(4, Math.max(2, Math.floor(cpuCount / 2)))

  if (options?.forceCpu) {
    return {
      gpuInfo: {
        isGpuAvailable: false,
        isAccelerated: false,
        backend: 'cpu',
        fallbackReason: 'CPU mode manually selected or enforced by watchdog fallback',
      },
      threadCount: adaptiveCpuThreads,
      extraArgs: ['-ng'],
    }
  }

  const dlls = detectBackendDlls(binDir)
  const sysGpu = await detectSystemGpu()

  // 1. CUDA Backend (Highest performance for NVIDIA)
  if (dlls.hasCuda && (sysGpu.vendor === 'NVIDIA' || !sysGpu.hasHardwareGpu)) {
    return {
      gpuInfo: {
        isGpuAvailable: true,
        isAccelerated: true,
        backend: 'cuda',
        deviceName: sysGpu.deviceName || 'NVIDIA GPU (CUDA)',
      },
      threadCount: 2,
      extraArgs: ['-dev', '0', '-fa'],
    }
  }

  // 2. Vulkan Backend (Universal cross-vendor: NVIDIA, AMD, Intel)
  if (dlls.hasVulkan) {
    return {
      gpuInfo: {
        isGpuAvailable: true,
        isAccelerated: true,
        backend: 'vulkan',
        deviceName: sysGpu.deviceName || 'Vulkan GPU Device',
      },
      threadCount: 2,
      extraArgs: ['-dev', '0', '-fa'],
    }
  }

  // 3. OpenVINO Backend (Intel Arc / Iris Xe / Core Ultra NPU)
  if (dlls.hasOpenVino) {
    return {
      gpuInfo: {
        isGpuAvailable: true,
        isAccelerated: true,
        backend: 'openvino',
        deviceName: sysGpu.deviceName || 'OpenVINO Accelerator',
      },
      threadCount: 2,
      extraArgs: ['-oved', 'GPU', '-fa'],
    }
  }

  // 4. DirectML Backend
  if (dlls.hasDirectMl) {
    return {
      gpuInfo: {
        isGpuAvailable: true,
        isAccelerated: true,
        backend: 'directml',
        deviceName: sysGpu.deviceName || 'DirectML GPU Device',
      },
      threadCount: 2,
      extraArgs: ['-dev', '0', '-fa'],
    }
  }

  // 5. Fallback to CPU with adaptive thread limit
  return {
    gpuInfo: {
      isGpuAvailable: sysGpu.hasHardwareGpu,
      isAccelerated: false,
      backend: 'cpu',
      deviceName: sysGpu.deviceName,
      fallbackReason: sysGpu.hasHardwareGpu
        ? 'Card đồ họa được phát hiện nhưng thiếu DLL backend (ggml-vulkan.dll hoặc ggml-cuda.dll) trong resources/bin'
        : 'Không phát hiện GPU chuyên dụng; vận hành trên CPU đa luồng AVX2',
    },
    threadCount: adaptiveCpuThreads,
    extraArgs: ['-ng'],
  }
}
