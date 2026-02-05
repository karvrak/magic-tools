'use client'

import { RefObject } from 'react'
import { cn } from '@/lib/utils'
import { Camera, AlertCircle, Loader2 } from 'lucide-react'

interface CameraViewProps {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  isReady: boolean
  isProcessing: boolean
  ocrProgress: number
  error: string | null
}

export function CameraView({
  videoRef,
  canvasRef,
  isReady,
  isProcessing,
  ocrProgress,
  error,
}: CameraViewProps) {
  return (
    <div className="relative flex-1 min-h-[300px] bg-black">
      {/* Video feed */}
      <video
        ref={videoRef}
        className={cn(
          'absolute inset-0 w-full h-full object-cover',
          !isReady && 'opacity-0'
        )}
        playsInline
        muted
        autoPlay
      />

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Loading state */}
      {!isReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-arcane-400 mx-auto mb-3" />
            <p className="text-parchment-400 text-sm">Initializing camera...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="text-center max-w-xs">
            <AlertCircle className="w-10 h-10 text-dragon-400 mx-auto mb-3" />
            <p className="text-dragon-300 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Frame guide overlay */}
      {isReady && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Guide frame for card positioning */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                'relative w-[85%] max-w-[300px] aspect-[63/88] border-2 rounded-lg transition-colors',
                isProcessing
                  ? 'border-arcane-400 shadow-lg shadow-arcane-500/30'
                  : 'border-gold-500/70'
              )}
            >
              {/* Corner markers */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-gold-400 rounded-tl" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-gold-400 rounded-tr" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-gold-400 rounded-bl" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-gold-400 rounded-br" />

              {/* Name zone indicator (top 15% of card) */}
              <div
                className={cn(
                  'absolute top-0 left-0 right-0 h-[15%] border-b transition-colors',
                  isProcessing ? 'border-arcane-400/50 bg-arcane-500/10' : 'border-gold-500/30'
                )}
              />

              {/* Processing indicator */}
              {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-arcane-400 mx-auto mb-2" />
                    {ocrProgress > 0 && (
                      <p className="text-arcane-300 text-xs">{ocrProgress}%</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Instructions */}
          {!isProcessing && (
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <p className="text-parchment-300 text-xs bg-black/50 inline-block px-3 py-1 rounded-full">
                Place the card name within the frame
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
