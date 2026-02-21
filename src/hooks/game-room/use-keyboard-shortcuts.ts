'use client'

import { useEffect } from 'react'

interface KeyboardActions {
  draw: () => void
  untapAll: () => void
  advancePhase: () => void
  endTurn: () => void
  shuffleLibrary: () => void
  createToken: () => void
  openGraveyard: () => void
  undo: () => void
  closeOverlays: () => void
  showHelp: () => void
}

/**
 * Global keyboard shortcut handler for game room interactions.
 * Shortcuts are disabled when focus is on an input or textarea.
 */
export function useKeyboardShortcuts(actions: KeyboardActions, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      // Don't fire shortcuts when typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key.toLowerCase()) {
        case 'd':
          actions.draw()
          break
        case 'u':
          actions.untapAll()
          break
        case ' ':
          e.preventDefault()
          actions.advancePhase()
          break
        case 'enter':
          actions.endTurn()
          break
        case 's':
          actions.shuffleLibrary()
          break
        case 't':
          actions.createToken()
          break
        case 'g':
          actions.openGraveyard()
          break
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            actions.undo()
          }
          break
        case 'escape':
          actions.closeOverlays()
          break
        case '?':
          actions.showHelp()
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [actions, enabled])
}
