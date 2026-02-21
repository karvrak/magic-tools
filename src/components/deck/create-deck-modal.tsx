'use client'

import { useState } from 'react'
import {
  BookOpen,
  Crown,
  Upload,
  ChevronDown,
  ChevronUp,
  Hammer,
  Sparkles,
  Lock,
} from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FORMATS } from '@/types/search'
import { cn } from '@/lib/utils'
import type { Owner, DeckStatus } from './types'

interface CreateDeckModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  owners: Owner[] | undefined
  defaultOwner: Owner | undefined
  onCreateDeck: (data: {
    name: string
    format: string
    description: string
    ownerId: string
    status: DeckStatus
    decklist: string
  }) => void
  isCreating: boolean
  isImporting: boolean
}

export function CreateDeckModal({
  open,
  onOpenChange,
  owners,
  defaultOwner,
  onCreateDeck,
  isCreating,
  isImporting,
}: CreateDeckModalProps) {
  const [name, setName] = useState('')
  const [format, setFormat] = useState('')
  const [description, setDescription] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [status, setStatus] = useState<DeckStatus>('building')
  const [showImportSection, setShowImportSection] = useState(false)
  const [decklist, setDecklist] = useState('')

  const handleSubmit = () => {
    if (!name.trim()) return
    onCreateDeck({
      name,
      format,
      description,
      ownerId: ownerId || defaultOwner?.id || '',
      status,
      decklist,
    })
  }

  const resetForm = () => {
    setName('')
    setFormat('')
    setDescription('')
    setOwnerId('')
    setStatus('building')
    setShowImportSection(false)
    setDecklist('')
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-arcane-500" />
            Bind New Spellbook
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="font-medieval">Grimoire Name</Label>
            <Input
              id="name"
              placeholder="Name your spellbook..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner" className="font-medieval">Owner</Label>
            <Select
              value={ownerId || defaultOwner?.id || ''}
              onValueChange={setOwnerId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                {owners?.map((owner) => (
                  <SelectItem key={owner.id} value={owner.id}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: owner.color }}
                      />
                      {owner.name}
                      {owner.isDefault && (
                        <Crown className="w-3 h-3 text-gold-500 ml-1" />
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="format" className="font-medieval">Magical Format (optional)</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Format</SelectItem>
                {FORMATS.map((fmt) => (
                  <SelectItem key={fmt.code} value={fmt.code}>
                    {fmt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="font-medieval">Description (optional)</Label>
            <Input
              id="description"
              placeholder="Describe the purpose of this grimoire..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="font-medieval">Initial Status</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('building')}
                className={cn(
                  "p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                  status === 'building'
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-dungeon-600 hover:border-dungeon-500"
                )}
              >
                <Hammer className={cn("w-5 h-5", status === 'building' ? "text-amber-400" : "text-parchment-400")} />
                <span className={cn("text-xs", status === 'building' ? "text-amber-400" : "text-parchment-400")}>Building</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={cn(
                  "p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                  status === 'active'
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-dungeon-600 hover:border-dungeon-500"
                )}
              >
                <Sparkles className={cn("w-5 h-5", status === 'active' ? "text-emerald-400" : "text-parchment-400")} />
                <span className={cn("text-xs", status === 'active' ? "text-emerald-400" : "text-parchment-400")}>Active</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus('locked')}
                className={cn(
                  "p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                  status === 'locked'
                    ? "border-slate-500 bg-slate-500/10"
                    : "border-dungeon-600 hover:border-dungeon-500"
                )}
              >
                <Lock className={cn("w-5 h-5", status === 'locked' ? "text-slate-400" : "text-parchment-400")} />
                <span className={cn("text-xs", status === 'locked' ? "text-slate-400" : "text-parchment-400")}>Locked</span>
              </button>
            </div>
            <p className="text-xs text-parchment-500">
              {status === 'building' && "Building: Prioritized in add-to-deck, excluded from total value"}
              {status === 'active' && "Active: Normal deck, included in total value"}
              {status === 'locked' && "Locked: Hidden from add-to-deck dropdown"}
            </p>
          </div>

          {/* Import Decklist Section */}
          <div className="border-t border-dungeon-600 pt-4">
            <button
              type="button"
              onClick={() => setShowImportSection(!showImportSection)}
              className="flex items-center gap-2 text-sm text-parchment-400 hover:text-parchment-200 transition-colors w-full"
            >
              <Upload className="w-4 h-4" />
              <span className="font-medieval">Import Decklist (optional)</span>
              {showImportSection ? (
                <ChevronUp className="w-4 h-4 ml-auto" />
              ) : (
                <ChevronDown className="w-4 h-4 ml-auto" />
              )}
            </button>

            {showImportSection && (
              <div className="mt-3 space-y-2">
                <textarea
                  placeholder={"Paste your decklist here...\n\nFormat examples:\n4 Lightning Bolt\n2x Counterspell\n\n// Sideboard\n2 Negate"}
                  value={decklist}
                  onChange={(e) => setDecklist(e.target.value)}
                  className="w-full h-32 px-3 py-2 text-sm bg-dungeon-800 border border-dungeon-600 rounded-lg text-parchment-200 placeholder:text-dungeon-500 focus:outline-none focus:border-arcane-500 resize-none font-mono"
                />
                <p className="text-xs text-parchment-500">
                  Format: &quot;4 Card Name&quot; or &quot;4x Card Name&quot;. Use &quot;// Sideboard&quot; for sideboard cards.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="arcane"
            onClick={handleSubmit}
            disabled={!name.trim() || isCreating || isImporting}
          >
            {isCreating
              ? 'Binding...'
              : isImporting
                ? 'Importing cards...'
                : decklist.trim()
                  ? 'Create & Import'
                  : 'Bind Spellbook'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
