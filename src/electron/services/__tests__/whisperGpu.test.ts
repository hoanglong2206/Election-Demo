import { describe, it, expect } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  detectBackendDlls,
  resolveWhisperGpuConfig,
} from '../whisper/gpuDetector'
import { WhisperProcessManager } from '../whisper/whisperProcessManager'

describe('Whisper GPU Acceleration & Capability Detection', () => {
  it('detectBackendDlls accurately identifies presence of backend libraries', () => {
    const tempDir = path.join(os.tmpdir(), `whisper_gpu_test_${Date.now()}`)
    fs.mkdirSync(tempDir, { recursive: true })

    try {
      // 1. Initially empty directory
      let dlls = detectBackendDlls(tempDir)
      expect(dlls.hasCuda).toBe(false)
      expect(dlls.hasVulkan).toBe(false)
      expect(dlls.hasOpenVino).toBe(false)

      // 2. Add Vulkan DLL
      fs.writeFileSync(path.join(tempDir, 'ggml-vulkan.dll'), 'dummy')
      dlls = detectBackendDlls(tempDir)
      expect(dlls.hasVulkan).toBe(true)
      expect(dlls.hasCuda).toBe(false)

      // 3. Add CUDA DLL
      fs.writeFileSync(path.join(tempDir, 'ggml-cuda.dll'), 'dummy')
      dlls = detectBackendDlls(tempDir)
      expect(dlls.hasCuda).toBe(true)
      expect(dlls.hasVulkan).toBe(true)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('resolveWhisperGpuConfig selects Vulkan with low threads and Flash Attention when Vulkan DLL exists', async () => {
    const tempDir = path.join(os.tmpdir(), `whisper_vulkan_test_${Date.now()}`)
    fs.mkdirSync(tempDir, { recursive: true })
    fs.writeFileSync(path.join(tempDir, 'ggml-vulkan.dll'), 'dummy')

    try {
      const config = await resolveWhisperGpuConfig(tempDir, { cpuCount: 8 })
      expect(config.gpuInfo.isAccelerated).toBe(true)
      expect(config.gpuInfo.backend).toBe('vulkan')
      expect(config.threadCount).toBe(2)
      expect(config.extraArgs).toEqual(['-dev', '0', '-fa'])
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('resolveWhisperGpuConfig enforces adaptive CPU thread limit and -ng when forceCpu is true', async () => {
    const tempDir = path.join(os.tmpdir(), `whisper_cpu_test_${Date.now()}`)
    fs.mkdirSync(tempDir, { recursive: true })
    // Even if CUDA DLL exists in folder...
    fs.writeFileSync(path.join(tempDir, 'ggml-cuda.dll'), 'dummy')

    try {
      // 8 CPU cores -> max 50% = 4 threads
      const config8 = await resolveWhisperGpuConfig(tempDir, { forceCpu: true, cpuCount: 8 })
      expect(config8.gpuInfo.isAccelerated).toBe(false)
      expect(config8.gpuInfo.backend).toBe('cpu')
      expect(config8.threadCount).toBe(4)
      expect(config8.extraArgs).toContain('-ng')

      // 16 CPU cores -> capped at 4 threads to prevent thermal noise
      const config16 = await resolveWhisperGpuConfig(tempDir, { forceCpu: true, cpuCount: 16 })
      expect(config16.threadCount).toBe(4)

      // 2 CPU cores -> floor is 2 threads
      const config2 = await resolveWhisperGpuConfig(tempDir, { forceCpu: true, cpuCount: 2 })
      expect(config2.threadCount).toBe(2)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('resolveWhisperGpuConfig falls back cleanly to CPU with explanatory reason when no GPU DLLs exist', async () => {
    const emptyDir = path.join(os.tmpdir(), `whisper_empty_dir_${Date.now()}`)
    fs.mkdirSync(emptyDir, { recursive: true })

    try {
      const config = await resolveWhisperGpuConfig(emptyDir, { cpuCount: 6 })
      expect(config.gpuInfo.isAccelerated).toBe(false)
      expect(config.gpuInfo.backend).toBe('cpu')
      expect(config.extraArgs).toContain('-ng')
      expect(config.gpuInfo.fallbackReason).toBeDefined()
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true })
    }
  })

  it('WhisperProcessManager getStatus exposes GPU info in status payload', () => {
    const manager = new WhisperProcessManager()
    const status = manager.getStatus()

    expect(status.gpu).toBeDefined()
    expect(status.gpu?.backend).toBeDefined()
    expect(typeof status.gpu?.isAccelerated).toBe('boolean')
    expect(status.telemetry).toBeDefined()
  })
})

