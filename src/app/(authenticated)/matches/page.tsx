'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  FileSpreadsheet,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  Trophy,
  Swords,
  BarChart3,
  ChevronRight,
  Loader2,
  Search,
  X
} from 'lucide-react'
import Link from 'next/link'
import readXlsxFile from 'read-excel-file'

interface Match {
  id: string
  playedAt: string
  deck1Name: string
  deck1Id: string | null
  deck1: { id: string; name: string; coverImage: string | null } | null
  score1: number
  deck2Name: string
  deck2Id: string | null
  deck2: { id: string; name: string; coverImage: string | null } | null
  score2: number
  notes: string | null
  importBatchId: string | null
}

interface ImportResult {
  success: boolean
  imported: number
  errors: number
  errorDetails: { row: number; error: string }[]
  batchId: string
}

export default function MatchesPage() {
  const queryClient = useQueryClient()
  const [isDragging, setIsDragging] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)
  const limit = 50

  // Fetch matches
  const { data, isLoading } = useQuery({
    queryKey: ['matches', searchQuery, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchQuery) params.set('deckName', searchQuery)
      params.set('limit', String(limit))
      params.set('offset', String(page * limit))
      const res = await fetch(`/api/matches?${params}`)
      if (!res.ok) throw new Error('Failed to fetch matches')
      return res.json() as Promise<{ matches: Match[]; total: number }>
    },
  })

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (matches: Record<string, unknown>[]) => {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches }),
      })
      if (!res.ok) throw new Error('Failed to import matches')
      return res.json() as Promise<ImportResult>
    },
    onSuccess: (result) => {
      setImportResult(result)
      queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
  })

  // Delete all mutation
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/matches?all=true', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete matches')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      setImportResult(null)
    },
  })

  // Handle file drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (!file) return

    await processFile(file)
  }, [])

  // Handle file select
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    await processFile(file)
    e.target.value = '' // Reset input
  }, [])

  // Process Excel file
  const processFile = async (file: File) => {
    try {
      const rows = await readXlsxFile(file, { dateFormat: 'yyyy-mm-dd' })

      if (rows.length < 2) {
        throw new Error('File is empty or has no data rows')
      }

      // First row is header
      const headers = rows[0].map(h =>
        String(h || '').toLowerCase().trim().replace(/\s+/g, '')
      )

      // Convert rows to objects with normalized keys
      const normalizedData = rows.slice(1).map(row => {
        const obj: Record<string, unknown> = {}
        headers.forEach((header, index) => {
          obj[header] = row[index]
        })
        return obj
      })

      importMutation.mutate(normalizedData)
    } catch (error) {
      console.error('Error processing file:', error)
      setImportResult({
        success: false,
        imported: 0,
        errors: 1,
        errorDetails: [{ row: 0, error: 'Failed to parse Excel file' }],
        batchId: '',
      })
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-dungeon-900 via-dungeon-800 to-dungeon-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-cinzel font-bold text-gold-400">
              Historique des Parties
            </h1>
            <p className="text-parchment-400 mt-1">
              {data?.total ?? 0} parties enregistrees
            </p>
          </div>
          <Link
            href="/matches/stats"
            className="flex items-center gap-2 px-4 py-2 bg-arcane-600 hover:bg-arcane-500 text-white rounded-lg transition-colors"
          >
            <BarChart3 className="w-5 h-5" />
            Voir les Stats
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Import Zone */}
        <div className="mb-8">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
              isDragging
                ? 'border-gold-400 bg-gold-400/10'
                : 'border-dungeon-600 hover:border-dungeon-500 bg-dungeon-800/50'
            }`}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            <div className="flex flex-col items-center gap-4">
              {importMutation.isPending ? (
                <>
                  <Loader2 className="w-12 h-12 text-gold-400 animate-spin" />
                  <p className="text-parchment-300">Import en cours...</p>
                </>
              ) : (
                <>
                  <div className={`p-4 rounded-full ${isDragging ? 'bg-gold-400/20' : 'bg-dungeon-700'}`}>
                    {isDragging ? (
                      <FileSpreadsheet className="w-12 h-12 text-gold-400" />
                    ) : (
                      <Upload className="w-12 h-12 text-parchment-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-lg text-parchment-200">
                      Glisse ton fichier Excel ici
                    </p>
                    <p className="text-sm text-parchment-500 mt-1">
                      ou clique pour selectionner (formats: .xlsx, .xls, .csv)
                    </p>
                  </div>
                  <div className="text-xs text-parchment-600 bg-dungeon-900/50 px-4 py-2 rounded-lg">
                    Colonnes attendues: <span className="text-parchment-400">date</span>,{' '}
                    <span className="text-parchment-400">deck1</span>,{' '}
                    <span className="text-parchment-400">deck2</span>,{' '}
                    <span className="text-parchment-400">score1</span>,{' '}
                    <span className="text-parchment-400">score2</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Import Result */}
          <AnimatePresence>
            {importResult && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`mt-4 p-4 rounded-lg ${
                  importResult.errors === 0
                    ? 'bg-nature-900/50 border border-nature-700'
                    : importResult.imported > 0
                    ? 'bg-gold-900/50 border border-gold-700'
                    : 'bg-dragon-900/50 border border-dragon-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  {importResult.errors === 0 ? (
                    <CheckCircle className="w-5 h-5 text-nature-400 flex-shrink-0 mt-0.5" />
                  ) : importResult.imported > 0 ? (
                    <AlertTriangle className="w-5 h-5 text-gold-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-dragon-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-parchment-200">
                      <span className="font-semibold text-nature-400">{importResult.imported}</span> parties importees
                      {importResult.errors > 0 && (
                        <span className="text-dragon-400 ml-2">
                          ({importResult.errors} erreurs)
                        </span>
                      )}
                    </p>
                    {importResult.errorDetails.length > 0 && (
                      <ul className="mt-2 text-sm text-parchment-500">
                        {importResult.errorDetails.map((err, i) => (
                          <li key={i}>Ligne {err.row}: {err.error}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    onClick={() => setImportResult(null)}
                    className="text-parchment-500 hover:text-parchment-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-parchment-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(0)
              }}
              placeholder="Rechercher un deck..."
              className="w-full pl-10 pr-4 py-2 bg-dungeon-800 border border-dungeon-600 rounded-lg text-parchment-200 placeholder-parchment-600 focus:outline-none focus:border-gold-500"
            />
          </div>

          {(data?.total ?? 0) > 0 && (
            <button
              onClick={() => {
                if (confirm('Supprimer TOUTES les parties ? Cette action est irreversible.')) {
                  deleteAllMutation.mutate()
                }
              }}
              disabled={deleteAllMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-dragon-600/20 hover:bg-dragon-600/40 text-dragon-400 rounded-lg transition-colors"
            >
              {deleteAllMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Tout supprimer
            </button>
          )}
        </div>

        {/* Match List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
          </div>
        ) : (data?.matches?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-parchment-500">
            <Swords className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-xl">Aucune partie enregistree</p>
            <p className="text-sm mt-2">Importe ton fichier Excel pour commencer</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {data?.matches.map((match, index) => (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="bg-dungeon-800/80 border border-dungeon-700 rounded-lg p-4 hover:bg-dungeon-800 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Date */}
                    <div className="flex items-center gap-2 text-parchment-500 w-28 flex-shrink-0">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">{formatDate(match.playedAt)}</span>
                    </div>

                    {/* Deck 1 */}
                    <div className="flex-1 text-right">
                      <span className={`font-medium ${
                        match.score1 > match.score2 ? 'text-nature-400' : 'text-parchment-300'
                      }`}>
                        {match.deck1Name}
                      </span>
                    </div>

                    {/* Score */}
                    <div className="flex items-center gap-2 px-4">
                      <span className={`text-2xl font-bold ${
                        match.score1 > match.score2 ? 'text-nature-400' : 'text-parchment-500'
                      }`}>
                        {match.score1}
                      </span>
                      <Swords className="w-5 h-5 text-dungeon-500" />
                      <span className={`text-2xl font-bold ${
                        match.score2 > match.score1 ? 'text-nature-400' : 'text-parchment-500'
                      }`}>
                        {match.score2}
                      </span>
                    </div>

                    {/* Deck 2 */}
                    <div className="flex-1">
                      <span className={`font-medium ${
                        match.score2 > match.score1 ? 'text-nature-400' : 'text-parchment-300'
                      }`}>
                        {match.deck2Name}
                      </span>
                    </div>

                    {/* Result indicator */}
                    <div className="w-8 flex-shrink-0">
                      {match.score1 > match.score2 ? (
                        <Trophy className="w-5 h-5 text-gold-400" />
                      ) : match.score1 < match.score2 ? (
                        <Trophy className="w-5 h-5 text-dungeon-600" />
                      ) : (
                        <span className="text-parchment-600 text-sm">Egal</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 bg-dungeon-700 hover:bg-dungeon-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-parchment-300"
                >
                  Precedent
                </button>
                <span className="text-parchment-500 px-4">
                  Page {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 bg-dungeon-700 hover:bg-dungeon-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-parchment-300"
                >
                  Suivant
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
