'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface UseCameraOptions {
  facingMode?: 'environment' | 'user'
  width?: number
  height?: number
}

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  isReady: boolean
  error: string | null
  startCamera: () => Promise<void>
  stopCamera: () => void
  captureFrame: () => string | null
  captureCardNameArea: () => string | null
  switchCamera: () => void
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const {
    facingMode: initialFacingMode = 'environment',
    width = 1280,
    height = 720,
  } = options

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(initialFacingMode)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsReady(false)
  }, [])

  const startCamera = useCallback(async () => {
    setError(null)

    // Check if camera API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera API not available. Please use HTTPS or localhost.')
      return
    }

    // Stop existing stream
    stopCamera()

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: width },
          height: { ideal: height },
        },
        audio: false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsReady(true)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera'

      if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
        setError('Camera permission denied. Please allow camera access.')
      } else if (errorMessage.includes('NotFoundError') || errorMessage.includes('DevicesNotFoundError')) {
        setError('No camera found on this device.')
      } else if (errorMessage.includes('NotReadableError') || errorMessage.includes('TrackStartError')) {
        setError('Camera is in use by another application.')
      } else {
        setError(`Camera error: ${errorMessage}`)
      }

      console.error('Camera error:', err)
    }
  }, [facingMode, width, height, stopCamera])

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current || !isReady) {
      return null
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      return null
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw the video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Return as data URL (JPEG for smaller size)
    return canvas.toDataURL('image/jpeg', 0.8)
  }, [isReady])

  /**
   * Capture only the card name area (top portion) with image preprocessing
   * for better OCR accuracy
   */
  const captureCardNameArea = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current || !isReady) {
      return null
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      return null
    }

    // Calculate the card frame area (centered, 85% width, aspect ratio 63:88)
    const frameWidthPercent = 0.85
    const cardAspectRatio = 63 / 88

    const frameWidth = video.videoWidth * frameWidthPercent
    const frameHeight = frameWidth / cardAspectRatio
    const frameX = (video.videoWidth - frameWidth) / 2
    const frameY = (video.videoHeight - frameHeight) / 2

    // Card name is in the top 15% of the card
    const nameAreaHeight = frameHeight * 0.15
    const nameAreaY = frameY

    // Capture with some padding and scale up for better OCR
    const padding = 10
    const captureX = Math.max(0, frameX - padding)
    const captureY = Math.max(0, nameAreaY - padding)
    const captureWidth = Math.min(frameWidth + padding * 2, video.videoWidth - captureX)
    const captureHeight = Math.min(nameAreaHeight + padding * 2, video.videoHeight - captureY)

    // Scale up for better OCR (minimum 400px height)
    const scale = Math.max(2, 400 / captureHeight)
    canvas.width = Math.round(captureWidth * scale)
    canvas.height = Math.round(captureHeight * scale)

    // Draw the cropped area scaled up
    ctx.drawImage(
      video,
      captureX, captureY, captureWidth, captureHeight,
      0, 0, canvas.width, canvas.height
    )

    // Apply image preprocessing for better OCR
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // Convert to grayscale and increase contrast
    for (let i = 0; i < data.length; i += 4) {
      // Grayscale conversion
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114

      // Increase contrast (stretch histogram)
      let enhanced = (gray - 128) * 1.5 + 128
      enhanced = Math.max(0, Math.min(255, enhanced))

      // Apply threshold for cleaner text
      const threshold = 140
      const final = enhanced < threshold ? 0 : 255

      data[i] = final     // R
      data[i + 1] = final // G
      data[i + 2] = final // B
      // Alpha stays the same
    }

    ctx.putImageData(imageData, 0, 0)

    // Return as PNG for lossless quality
    return canvas.toDataURL('image/png')
  }, [isReady])

  const switchCamera = useCallback(() => {
    setFacingMode((current) => (current === 'environment' ? 'user' : 'environment'))
  }, [])

  // Restart camera when facing mode changes
  useEffect(() => {
    if (isReady) {
      startCamera()
    }
  }, [facingMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return {
    videoRef,
    canvasRef,
    isReady,
    error,
    startCamera,
    stopCamera,
    captureFrame,
    captureCardNameArea,
    switchCamera,
  }
}
