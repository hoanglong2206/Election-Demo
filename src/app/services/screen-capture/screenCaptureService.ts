import type { CapturedImageInfo, CroppedImageInfo, CropRect } from './types'
import { capturePort } from '@/infrastructure/ipc'

export class ScreenCaptureService {
  /**
   * Checks whether native Electron desktop capture is available.
   */
  public isNativeAvailable(): boolean {
    return capturePort.isAvailable
  }

  /**
   * Captures screen using native Electron API when available,
   * falling back to Web standard getDisplayMedia when running in browser.
   */
  public async captureScreen(
    options: { sourceType?: 'screen' | 'window'; sourceId?: string } = {},
  ): Promise<CapturedImageInfo> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Quá thời gian chụp màn hình (timeout 8s). Vui lòng thử lại.')),
        8000
      )
    )

    return await Promise.race([this._executeCapture(options), timeoutPromise])
  }

  private async _executeCapture(options: { sourceType?: 'screen' | 'window'; sourceId?: string }): Promise<CapturedImageInfo> {
    // 1. Native Electron Desktop Capture (No user prompts, instant high-res)
    if (this.isNativeAvailable()) {
      try {
        const nativeTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Native capture timeout sau 4.5s')), 4500)
        )
        const res = await Promise.race([capturePort.captureScreen(options), nativeTimeout])
        if (
          res &&
          res.success &&
          typeof res.dataUrl === 'string' &&
          res.dataUrl.length > 500 &&
          (res.width || 0) > 0 &&
          (res.height || 0) > 0
        ) {
          return {
            dataUrl: res.dataUrl,
            width: res.width || 1920,
            height: res.height || 1080,
            source: 'native_electron',
            capturedAt: Date.now(),
          }
        }
        if (res && res.error) {
          throw new Error(res.error)
        }
        throw new Error('Dữ liệu ảnh chụp từ Native Electron rỗng hoặc không hợp lệ.')
      } catch (_nativeErr: any) {
        // Fall back to browser getDisplayMedia if in dev browser environment
      }
    }

    // 2. Browser standard getDisplayMedia fallback
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('Môi trường hiện tại không hỗ trợ API chụp màn hình.')
    }

    let stream: MediaStream | null = null
    let tempVideo: HTMLVideoElement | null = null
    try {
      const getMediaTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('getDisplayMedia timeout sau 5s')), 5000)
      )

      stream = await Promise.race([
        navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'monitor',
          },
          audio: false,
        }),
        getMediaTimeout,
      ])

      const track = stream.getVideoTracks()[0]
      if (!track) {
        throw new Error('Không tìm thấy luồng hình ảnh màn hình.')
      }

      // Method A: ImageCapture API (Synchronous hardware frame grab, instant & no video tag needed)
      if (typeof (window as any).ImageCapture === 'function') {
        try {
          const imageCapture = new (window as any).ImageCapture(track)
          const bitmap: ImageBitmap = await imageCapture.grabFrame()
          const width = bitmap.width || 1920
          const height = bitmap.height || 1080

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(bitmap, 0, 0)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
            canvas.width = 0
            canvas.height = 0
            bitmap.close?.()
            if (dataUrl && dataUrl.length > 500) {
              return {
                dataUrl,
                width,
                height,
                source: 'browser_display_media',
                capturedAt: Date.now(),
              }
            }
          }
        } catch (imgCapErr) {
          console.warn('[ScreenCaptureService] ImageCapture.grabFrame fallback to video:', imgCapErr)
        }
      }

      // Method B: Offscreen Video Element Fallback
      tempVideo = document.createElement('video')
      tempVideo.muted = true
      tempVideo.playsInline = true
      tempVideo.style.position = 'fixed'
      tempVideo.style.left = '-9999px'
      tempVideo.style.opacity = '0'
      tempVideo.style.pointerEvents = 'none'
      document.body.appendChild(tempVideo)
      tempVideo.srcObject = stream

      await new Promise<void>((resolve, reject) => {
        if (!tempVideo) return resolve()
        tempVideo.onloadedmetadata = () => {
          tempVideo?.play().then(resolve).catch(reject)
        }
        tempVideo.onerror = () => reject(new Error('Lỗi load video stream màn hình.'))
        setTimeout(() => resolve(), 1200) // Timeout fallback
      })

      const width = tempVideo.videoWidth || 1920
      const height = tempVideo.videoHeight || 1080

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('Không thể khởi tạo 2D canvas context.')
      }

      ctx.drawImage(tempVideo, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9)

      canvas.width = 0
      canvas.height = 0

      if (!dataUrl || dataUrl.length < 500) {
        throw new Error('Không thể trích xuất khung hình màn hình hợp lệ.')
      }

      return {
        dataUrl,
        width,
        height,
        source: 'browser_display_media',
        capturedAt: Date.now(),
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        throw new Error('Bạn đã hủy hoặc từ chối cấp quyền chụp màn hình.')
      }
      throw new Error(`Lỗi chụp màn hình: ${err?.message || 'Không xác định'}`)
    } finally {
      if (tempVideo) {
        try {
          tempVideo.pause()
          tempVideo.srcObject = null
          tempVideo.remove()
        } catch {}
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }
    }
  }

  /**
   * Crops the selected marquee area from full screenshot and compresses
   * to high-efficiency JPEG (max ~1400px width/height) to reduce latency and token cost.
   */
  public async cropAndCompress(
    sourceDataUrl: string,
    cropRect: CropRect,
    options?: {
      maxWidth?: number
      maxHeight?: number
      quality?: number
    }
  ): Promise<CroppedImageInfo> {
    const maxWidth = options?.maxWidth ?? 1400
    const maxHeight = options?.maxHeight ?? 1400
    const quality = options?.quality ?? 0.88

    return new Promise<CroppedImageInfo>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        try {
          // Clamp crop rectangle to image bounds
          const imgWidth = img.naturalWidth || img.width
          const imgHeight = img.naturalHeight || img.height

          const sx = Math.max(0, Math.min(imgWidth - 10, Math.round(cropRect.x)))
          const sy = Math.max(0, Math.min(imgHeight - 10, Math.round(cropRect.y)))
          const sWidth = Math.max(10, Math.min(imgWidth - sx, Math.round(cropRect.width)))
          const sHeight = Math.max(10, Math.min(imgHeight - sy, Math.round(cropRect.height)))

          // Scale down if cropped region is excessively large
          let destWidth = sWidth
          let destHeight = sHeight

          if (destWidth > maxWidth || destHeight > maxHeight) {
            const ratio = Math.min(maxWidth / destWidth, maxHeight / destHeight)
            destWidth = Math.round(destWidth * ratio)
            destHeight = Math.round(destHeight * ratio)
          }

          const canvas = document.createElement('canvas')
          canvas.width = destWidth
          canvas.height = destHeight
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            throw new Error('Không thể tạo canvas context để crop ảnh.')
          }

          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, destWidth, destHeight)

          const mimeType = 'image/jpeg'
          const croppedDataUrl = canvas.toDataURL(mimeType, quality)
          const base64 = croppedDataUrl.replace(/^data:image\/[a-z]+;base64,/, '')
          const sizeBytes = Math.round((base64.length * 3) / 4)

          // Immediate memory cleanup
          canvas.width = 0
          canvas.height = 0
          img.src = ''

          resolve({
            dataUrl: croppedDataUrl,
            base64,
            mimeType,
            width: destWidth,
            height: destHeight,
            sizeBytes,
          })
        } catch (err) {
          reject(err)
        }
      }

      img.onerror = () => {
        reject(new Error('Không thể tải dữ liệu ảnh chụp để cắt vùng chọn.'))
      }

      img.src = sourceDataUrl
    })
  }

  /**
   * Dereferences large base64 strings and canvas elements to assist V8 GC.
   */
  public releaseMemory(dataUrlOrInfo?: string | Partial<CroppedImageInfo | CapturedImageInfo>): void {
    if (!dataUrlOrInfo) return
    const url = typeof dataUrlOrInfo === 'string' ? dataUrlOrInfo : dataUrlOrInfo.dataUrl
    if (url && url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url)
      } catch {}
    }
  }

  public cleanMemory(info?: Partial<CroppedImageInfo | CapturedImageInfo>): void {
    this.releaseMemory(info)
  }
}

export const screenCaptureService = new ScreenCaptureService()
