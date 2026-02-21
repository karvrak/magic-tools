'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { OWNER_COLORS } from './types'

interface AddOwnerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateOwner: (data: { name: string; color: string }) => void
  isCreating: boolean
}

export function AddOwnerModal({
  open,
  onOpenChange,
  onCreateOwner,
  isCreating,
}: AddOwnerModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#D4AF37')

  const handleSubmit = () => {
    if (!name.trim()) return
    onCreateOwner({ name: name.trim(), color })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName('')
      setColor('#D4AF37')
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-arcane-500" />
            Add New Owner
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="ownerName" className="font-medieval">Owner Name</Label>
            <Input
              id="ownerName"
              placeholder="Enter owner name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label className="font-medieval">Color</Label>
            <div className="grid grid-cols-4 gap-2">
              {OWNER_COLORS.map((ownerColor) => (
                <button
                  key={ownerColor.value}
                  onClick={() => setColor(ownerColor.value)}
                  className={cn(
                    "p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                    color === ownerColor.value
                      ? "border-gold-500 bg-dungeon-700"
                      : "border-dungeon-600 hover:border-dungeon-500"
                  )}
                >
                  <span
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: ownerColor.value }}
                  />
                  <span className="text-xs text-parchment-400">{ownerColor.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 rounded-lg bg-dungeon-800 border border-dungeon-600">
            <p className="text-sm text-parchment-400 mb-2">Preview:</p>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dungeon-900/80 border border-opacity-50"
              style={{
                color,
                borderColor: color,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              {name || 'Owner Name'}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="arcane"
            onClick={handleSubmit}
            disabled={!name.trim() || isCreating}
          >
            {isCreating ? 'Adding...' : 'Add Owner'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
