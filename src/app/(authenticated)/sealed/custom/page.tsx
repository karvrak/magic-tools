'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Upload,
  Trash2,
  ArrowLeft,
  Package,
  Sparkles,
  FileArchive,
  Check,
  AlertTriangle,
  Share2,
  LinkIcon,
  Unlink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CustomSet {
  setCode: string
  setName: string
  total: number
  commons: number
  uncommons: number
  rares: number
  mythics: number
}

interface UploadResult {
  success: boolean
  setCode: string
  setName: string
  stats: {
    total: number
    inserted: number
    commons: number
    uncommons: number
    rares: number
    mythics: number
    tokens: number
    images: number
  }
}

export default function CustomSetsPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [setName, setSetName] = useState('')
  const [setCode, setSetCode] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [deletingSet, setDeletingSet] = useState<string | null>(null)
  const [sharingSet, setSharingSet] = useState<string | null>(null)
  const [shareToast, setShareToast] = useState<string | null>(null)

  // Fetch existing custom sets
  const { data: customSets, isLoading } = useQuery({
    queryKey: ['custom-sets'],
    queryFn: async () => {
      const res = await fetch('/api/custom-sets')
      if (!res.ok) throw new Error('Failed to fetch custom sets')
      return res.json() as Promise<{ sets: CustomSet[] }>
    },
  })

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !setName) throw new Error('Missing file or set name')

      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('setName', setName)
      if (setCode) formData.append('setCode', setCode.startsWith('cus_') ? setCode : `cus_${setCode}`)

      const res = await fetch('/api/custom-sets/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Upload failed')
      }

      return res.json() as Promise<UploadResult>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-sets'] })
      queryClient.invalidateQueries({ queryKey: ['sealed-sets'] })
      setSetName('')
      setSetCode('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch(`/api/custom-sets?setCode=${encodeURIComponent(code)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Delete failed')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-sets'] })
      queryClient.invalidateQueries({ queryKey: ['sealed-sets'] })
      setDeletingSet(null)
    },
  })

  // Fetch share tokens for all custom sets
  const { data: shareTokens } = useQuery({
    queryKey: ['custom-sets-shares'],
    queryFn: async () => {
      if (!customSets?.sets?.length) return {}
      const results: Record<string, string | null> = {}
      await Promise.all(
        customSets.sets.map(async (set) => {
          const res = await fetch(`/api/custom-sets/${encodeURIComponent(set.setCode)}/share`)
          if (res.ok) {
            const data = await res.json()
            results[set.setCode] = data.shareToken
          }
        })
      )
      return results
    },
    enabled: !!customSets?.sets?.length,
  })

  // Share mutation
  const shareMutation = useMutation({
    mutationFn: async (setCode: string) => {
      const res = await fetch(`/api/custom-sets/${encodeURIComponent(setCode)}/share`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to share')
      return res.json() as Promise<{ shareToken: string }>
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['custom-sets-shares'] })
      const url = `${window.location.origin}/shared/custom/${data.shareToken}`
      navigator.clipboard.writeText(url)
      setShareToast('Link copied!')
      setTimeout(() => setShareToast(null), 2000)
    },
  })

  // Unshare mutation
  const unshareMutation = useMutation({
    mutationFn: async (setCode: string) => {
      const res = await fetch(`/api/custom-sets/${encodeURIComponent(setCode)}/share`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to unshare')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-sets-shares'] })
      setSharingSet(null)
    },
  })

  const handleShareClick = (setCode: string) => {
    const token = shareTokens?.[setCode]
    if (token) {
      // Already shared — copy link
      const url = `${window.location.origin}/shared/custom/${token}`
      navigator.clipboard.writeText(url)
      setShareToast('Link copied!')
      setTimeout(() => setShareToast(null), 2000)
    } else {
      // Not shared yet — generate token
      shareMutation.mutate(setCode)
    }
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-6">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-dungeon-900/95 backdrop-blur-sm border-b border-dungeon-700 px-3 py-3 lg:px-6 lg:py-4">
        <div className="flex items-center gap-3">
          <Link href="/sealed" className="text-parchment-400 hover:text-parchment-200 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Package className="w-6 h-6 text-purple-400 flex-shrink-0" />
          <h1 className="font-medieval text-xl lg:text-2xl text-gold-400">Custom Sets</h1>
        </div>
      </div>

      <div className="px-3 py-4 lg:px-6 max-w-2xl mx-auto space-y-6">
        {/* Upload Form */}
        <div className="card-frame p-4 lg:p-6">
          <h2 className="font-medieval text-lg text-gold-400 mb-4">Upload a Custom Set</h2>
          <p className="text-parchment-500 text-sm mb-4">
            Upload a ZIP archive containing the HTML file and card images (JPG) from your set creator.
          </p>

          <div className="space-y-4">
            {/* Set Name */}
            <div>
              <label className="block text-parchment-300 text-sm font-medium mb-1">
                Set Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                placeholder="e.g. My Custom Set"
                className="w-full bg-dungeon-800 border border-dungeon-600 rounded-lg px-3 py-2 text-parchment-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>

            {/* Set Code (optional) */}
            <div>
              <label className="block text-parchment-300 text-sm font-medium mb-1">
                Set Code <span className="text-parchment-600 text-xs">(optional)</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-parchment-500 text-sm">cus_</span>
                <input
                  type="text"
                  value={setCode.replace(/^cus_/, '')}
                  onChange={(e) => setSetCode(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                  placeholder="auto-generated"
                  maxLength={20}
                  className="flex-1 bg-dungeon-800 border border-dungeon-600 rounded-lg px-3 py-2 text-parchment-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
              </div>
              <p className="text-parchment-600 text-xs mt-1">
                A unique code will be generated if left empty.
              </p>
            </div>

            {/* File Selection */}
            <div>
              <label className="block text-parchment-300 text-sm font-medium mb-1">
                ZIP Archive <span className="text-red-400">*</span>
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  selectedFile
                    ? "border-green-600/50 bg-green-900/10"
                    : "border-dungeon-600 hover:border-dungeon-400 bg-dungeon-800/50"
                )}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileArchive className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 text-sm font-medium">{selectedFile.name}</span>
                    <span className="text-parchment-600 text-xs">
                      ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 text-parchment-600 mx-auto mb-2" />
                    <p className="text-parchment-400 text-sm">Click to select a ZIP file</p>
                    <p className="text-parchment-600 text-xs mt-1">Max 100 MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </div>

            {/* Upload Button */}
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={!setName || !selectedFile || uploadMutation.isPending}
              className="w-full btn-primary"
            >
              {uploadMutation.isPending ? (
                <>
                  <Sparkles className="w-5 h-5 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Set
                </>
              )}
            </Button>

            {/* Upload Success */}
            {uploadMutation.isSuccess && uploadMutation.data && (
              <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-medium text-sm">Upload successful!</span>
                </div>
                <div className="text-parchment-400 text-xs space-y-1">
                  <p>Set: <span className="text-parchment-200">{uploadMutation.data.setName}</span> ({uploadMutation.data.setCode})</p>
                  <p>{uploadMutation.data.stats.inserted} cards imported ({uploadMutation.data.stats.images} images)</p>
                  <p className="text-parchment-500">
                    {uploadMutation.data.stats.commons}C / {uploadMutation.data.stats.uncommons}U / {uploadMutation.data.stats.rares}R / {uploadMutation.data.stats.mythics}M
                    {uploadMutation.data.stats.tokens > 0 && ` + ${uploadMutation.data.stats.tokens} tokens`}
                  </p>
                </div>
              </div>
            )}

            {/* Upload Error */}
            {uploadMutation.isError && (
              <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <span className="text-red-400 text-sm">{uploadMutation.error?.message}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Existing Custom Sets */}
        <div className="card-frame p-4 lg:p-6">
          <h2 className="font-medieval text-lg text-gold-400 mb-4">Your Custom Sets</h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Sparkles className="w-5 h-5 text-gold-400 animate-pulse" />
              <span className="ml-2 text-parchment-400 text-sm">Loading...</span>
            </div>
          ) : !customSets?.sets?.length ? (
            <p className="text-parchment-500 text-sm text-center py-6">
              No custom sets uploaded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {customSets.sets.map((set) => (
                <div
                  key={set.setCode}
                  className="flex items-center justify-between p-3 rounded-lg bg-dungeon-800/50 border border-dungeon-700"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <span className="text-parchment-200 font-medium text-sm truncate">
                        {set.setName}
                      </span>
                      <span className="text-parchment-600 text-xs flex-shrink-0">
                        ({set.setCode})
                      </span>
                    </div>
                    <div className="text-parchment-500 text-xs mt-1 ml-6">
                      {set.total} cards &mdash;{' '}
                      <span className="text-gray-500">{set.commons}C</span>{' '}
                      <span className="text-gray-300">{set.uncommons}U</span>{' '}
                      <span className="text-yellow-400">{set.rares}R</span>{' '}
                      <span className="text-orange-400">{set.mythics}M</span>
                    </div>
                  </div>

                  {deletingSet === set.setCode ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingSet(null)}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteMutation.mutate(set.setCode)}
                        disabled={deleteMutation.isPending}
                        className="text-xs"
                      >
                        {deleteMutation.isPending ? 'Deleting...' : 'Confirm'}
                      </Button>
                    </div>
                  ) : sharingSet === set.setCode ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSharingSet(null)}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => unshareMutation.mutate(set.setCode)}
                        disabled={unshareMutation.isPending}
                        className="text-xs"
                      >
                        <Unlink className="w-3 h-3 mr-1" />
                        {unshareMutation.isPending ? 'Revoking...' : 'Revoke link'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleShareClick(set.setCode)}
                        disabled={shareMutation.isPending}
                        className={cn(
                          "p-2 transition-colors",
                          shareTokens?.[set.setCode]
                            ? "text-green-400 hover:text-green-300"
                            : "text-parchment-600 hover:text-parchment-300"
                        )}
                        title={shareTokens?.[set.setCode] ? "Copy share link" : "Share set"}
                      >
                        {shareTokens?.[set.setCode] ? (
                          <LinkIcon className="w-4 h-4" />
                        ) : (
                          <Share2 className="w-4 h-4" />
                        )}
                      </button>
                      {shareTokens?.[set.setCode] && (
                        <button
                          onClick={() => setSharingSet(set.setCode)}
                          className="p-2 text-parchment-600 hover:text-red-400 transition-colors"
                          title="Revoke share link"
                        >
                          <Unlink className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setDeletingSet(set.setCode)}
                        className="p-2 text-parchment-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Share Toast */}
        {shareToast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-green-900/90 border border-green-600/50 text-green-300 px-4 py-2 rounded-lg text-sm font-medium shadow-lg backdrop-blur-sm z-50 flex items-center gap-2">
            <Check className="w-4 h-4" />
            {shareToast}
          </div>
        )}
      </div>
    </div>
  )
}
