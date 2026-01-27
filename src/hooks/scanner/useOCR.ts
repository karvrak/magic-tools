'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createWorker, Worker, RecognizeResult } from 'tesseract.js'
import { OCRResult } from '@/types/scanner'

interface UseOCROptions {
  language?: string
}

interface UseOCRReturn {
  isLoading: boolean
  isReady: boolean
  progress: number
  error: string | null
  recognize: (imageData: string) => Promise<OCRResult | null>
  extractCardName: (imageData: string) => Promise<string | null>
}

/**
 * Hook for OCR text recognition using Tesseract.js
 * Optimized for reading MTG card names
 */
export function useOCR(options: UseOCROptions = {}): UseOCRReturn {
  const { language = 'eng' } = options

  const workerRef = useRef<Worker | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Initialize worker
  const initWorker = useCallback(async () => {
    if (workerRef.current) return

    setIsLoading(true)
    setError(null)

    try {
      const worker = await createWorker(language, 1, {
        logger: (info) => {
          if (info.status === 'recognizing text') {
            setProgress(Math.round(info.progress * 100))
          }
        },
      })

      // Configure for better card name recognition
      // PSM 7 = Treat image as single text line
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789éèêëàâäùûüïîôöç\' -,.',
      })

      workerRef.current = worker
      setIsReady(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize OCR'
      setError(errorMessage)
      console.error('OCR init error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [language])

  // Initialize on mount
  useEffect(() => {
    initWorker()

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [initWorker])

  /**
   * Recognize text from an image
   */
  const recognize = useCallback(async (imageData: string): Promise<OCRResult | null> => {
    if (!workerRef.current) {
      await initWorker()
    }

    if (!workerRef.current) {
      setError('OCR worker not initialized')
      return null
    }

    try {
      setProgress(0)
      const result: RecognizeResult = await workerRef.current.recognize(imageData)

      // Cast to any to handle tesseract.js type variations
      const data = result.data as {
        text: string
        confidence: number
        words?: Array<{
          text: string
          confidence: number
          bbox: { x0: number; y0: number; x1: number; y1: number }
        }>
      }

      const ocrResult: OCRResult = {
        text: data.text.trim(),
        confidence: data.confidence,
        words: (data.words || []).map((word) => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox,
        })),
      }

      return ocrResult
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'OCR recognition failed'
      setError(errorMessage)
      console.error('OCR error:', err)
      return null
    }
  }, [initWorker])

  /**
   * Extract the card name from an image
   * Focuses on the top portion of the card where the name is located
   */
  const extractCardName = useCallback(async (imageData: string): Promise<string | null> => {
    const result = await recognize(imageData)

    if (!result || !result.text) {
      return null
    }

    // Clean and process the OCR text
    let text = result.text
      // Remove common OCR artifacts
      .replace(/[|\\\/\[\]{}()<>]/g, '')
      .replace(/[_=+*#@!$%^&]/g, '')
      // Normalize quotes
      .replace(/[''`´]/g, "'")
      // Normalize dashes
      .replace(/[—–]/g, '-')
      // Fix common OCR mistakes
      .replace(/[0O](?=[a-z])/gi, 'O') // 0 that should be O
      .replace(/(?<=[a-z])[0](?=[a-z])/gi, 'o') // 0 in middle of word
      .replace(/[1l](?=[a-z]{2,})/gi, 'l') // 1 that should be l
      .replace(/\s+/g, ' ')
      .trim()

    // The card name is typically in the first line
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length >= 3) // At least 3 chars

    if (lines.length === 0) {
      return null
    }

    // Get the longest meaningful line (usually the card name)
    let cardName = lines.reduce((longest, line) => {
      // Skip lines that look like mana costs or garbage
      if (/^[\d{}WUBRG\s]+$/.test(line)) return longest
      if (/^\d+$/.test(line)) return longest
      // Prefer longer lines but not excessively long
      if (line.length > longest.length && line.length < 40) return line
      return longest
    }, lines[0])

    // Final cleanup
    cardName = cardName
      .replace(/^[^a-zA-Zéèêëàâäùûüïîôöç]+/, '') // Remove leading non-letters
      .replace(/[^a-zA-Zéèêëàâäùûüïîôöç\s'-]+$/, '') // Remove trailing garbage
      .trim()

    return cardName.length >= 3 ? cardName : null
  }, [recognize])

  return {
    isLoading,
    isReady,
    progress,
    error,
    recognize,
    extractCardName,
  }
}
