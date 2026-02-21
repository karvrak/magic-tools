'use client'

import { toast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'

const UNDO_TIMEOUT_MS = 5000

interface PerformWithUndoOptions {
  /** The destructive action to execute */
  action: () => Promise<void>
  /** How to reverse the action if the user clicks Undo */
  undoAction: () => Promise<void>
  /** Toast title shown after the action succeeds */
  successMessage: string
  /** Toast title shown after a successful undo */
  undoMessage: string
}

/**
 * Hook that provides a function to execute destructive actions
 * with a toast-based undo mechanism.
 *
 * After the action completes, a toast with an "Undo" button is shown
 * for 5 seconds. Clicking it triggers the reverse action.
 */
export function useUndoAction() {
  const performWithUndo = async ({
    action,
    undoAction,
    successMessage,
    undoMessage,
  }: PerformWithUndoOptions) => {
    try {
      await action()

      const { dismiss } = toast({
        title: successMessage,
        action: (
          <ToastAction
            altText="Undo this action"
            onClick={async () => {
              try {
                await undoAction()
                toast({
                  title: undoMessage,
                  variant: 'success',
                })
              } catch {
                toast({
                  title: 'Undo failed',
                  description: 'Could not reverse the action.',
                  variant: 'destructive',
                })
              }
            }}
          >
            Undo
          </ToastAction>
        ),
      })

      // Auto-dismiss after the undo window closes
      setTimeout(() => {
        dismiss()
      }, UNDO_TIMEOUT_MS)
    } catch {
      toast({
        title: 'Action failed',
        description: 'Something went wrong.',
        variant: 'destructive',
      })
      throw new Error('Action failed')
    }
  }

  return { performWithUndo }
}
