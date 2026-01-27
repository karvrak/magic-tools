'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Keyboard,
  BookOpen,
  Search,
  Layers,
  Heart,
  Coins,
  HelpCircle,
  MousePointer,
  Sparkles,
  ExternalLink,
  FlaskConical,
  Mountain,
  Target,
  TrendingUp,
  TrendingDown,
  Palette,
  RefreshCw,
  Database,
  DollarSign,
  Loader2,
  Archive,
  ArrowRightLeft
} from 'lucide-react'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/layout/page-transition'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

// Keyboard shortcuts configuration
type Shortcut = {
  key: string
  description: string
  icon: typeof Coins
  coming?: boolean
}

type ShortcutCategory = {
  category: string
  shortcuts: Shortcut[]
}

const keyboardShortcuts: ShortcutCategory[] = [
  {
    category: 'Global',
    shortcuts: [
      { key: 'P', description: 'Toggle price display on cards', icon: Coins },
      { key: 'H', description: 'Open this help page', icon: HelpCircle },
      { key: '?', description: 'Open this help page (alternative)', icon: HelpCircle },
    ]
  },
  {
    category: 'Search',
    shortcuts: [
      { key: '/', description: 'Quick search (modal) or focus search field if on search page', icon: Search },
      { key: 'Enter', description: 'Submit quick search (resets filters)', icon: Search },
      { key: 'Esc', description: 'Reset all filters and focus search (on search page)', icon: MousePointer },
    ]
  },
  {
    category: 'Card Modal',
    shortcuts: [
      { key: 'A', description: 'Quick Add: ajouter x1 au deck actif', icon: Sparkles },
      { key: '1-4', description: 'Quick Add: ajouter x1, x2, x3 ou x4', icon: Sparkles },
      { key: '←', description: 'Previous card in results', icon: MousePointer },
      { key: '→', description: 'Next card in results', icon: MousePointer },
    ]
  },
]

// Simulation stats documentation
const simulationStats = {
  basic: [
    {
      name: 'Terrains en main',
      icon: Mountain,
      description: 'Nombre moyen de terrains dans votre main de départ (7 cartes).',
      ideal: '2.5 - 3.0',
      tips: 'Un deck de 60 cartes avec 24 terrains aura en moyenne ~2.8 terrains par main.'
    },
    {
      name: 'Sorts en main',
      icon: Sparkles,
      description: 'Nombre moyen de non-terrains dans votre main, avec le coût de mana converti (CMC) moyen de ces sorts.',
      ideal: '4 - 5 sorts',
      tips: 'Un CMC moyen bas (< 2.5) indique un deck agressif, plus élevé (> 3.5) un deck contrôle.'
    },
    {
      name: 'Mains gardables',
      icon: Target,
      description: 'Pourcentage de mains contenant entre 2 et 4 terrains, considérées comme "gardables" sans mulligan.',
      ideal: '> 80%',
      tips: 'Si ce pourcentage est bas, ajustez votre ratio de terrains. Un deck avec trop peu de terrains aura beaucoup de mains "mana screw".'
    },
    {
      name: 'Jouable T1 / T2',
      icon: TrendingUp,
      description: 'Pourcentage de mains où vous avez au moins une carte jouable au tour 1 ou 2. Indique la consistance de vos premiers tours.',
      ideal: 'T1 > 60%, T2 > 85%',
      tips: 'Pour un deck aggro, visez T1 > 80%. Pour un deck contrôle, T2 > 90% est suffisant.'
    },
    {
      name: 'Mana Screw',
      icon: TrendingDown,
      description: 'Pourcentage de mains avec 0-1 terrain. Ces mains sont presque toujours des mulligans obligatoires.',
      ideal: '< 12%',
      tips: 'Un % élevé signifie que vous manquez de terrains. Considérez ajouter 1-2 terrains ou des MDFCs.'
    },
    {
      name: 'Mana Flood',
      icon: Mountain,
      description: 'Pourcentage de mains avec 5+ terrains. Ces mains manquent de menaces ou de réponses.',
      ideal: '< 10%',
      tips: 'Un % élevé signifie trop de terrains. Réduisez de 1-2 ou ajoutez des effets de draw.'
    },
  ],
  advanced: [
    {
      name: 'Mana réellement disponible',
      icon: Layers,
      description: 'Prend en compte les terrains qui arrivent engagés (tapped). Par exemple, un deck avec 4 Temples aura moins de mana T1 qu\'un deck full shocklands.',
      tips: 'Un écart important entre "terrains en main" et "mana disponible" indique trop de taplands.'
    },
    {
      name: 'Color Fixing',
      icon: Palette,
      description: 'Compare vos sources de mana coloré aux besoins de vos sorts. Le ratio idéal dépend de votre courbe de mana.',
      ideal: '> 40% par couleur',
      tips: 'Rouge: sources de {R} disponibles vs symboles {R} dans vos sorts. Si < 30%, vous aurez souvent des problèmes de couleurs.'
    },
    {
      name: '% bonnes couleurs T1/T2/T3',
      icon: Target,
      description: 'Pourcentage de mains où vous pouvez effectivement jouer vos sorts grâce à la bonne combinaison de couleurs.',
      ideal: 'T2 > 90%, T3 > 95%',
      tips: 'Un % faible T1 est normal pour un deck multicolore. Surveillez plutôt T2 et T3.'
    },
    {
      name: 'Répartition des terrains',
      icon: Mountain,
      description: 'Catégorise vos terrains : Basic, Fetch, Shock, Check, Fast, Tapland, MDFC, Bounce.',
      tips: 'Les Fetchlands comptent pour 0 mana le tour où ils sont joués mais permettent le color fixing.'
    },
  ]
}

// Documentation sections
const documentationSections = [
  {
    title: 'Quick Add ⚡',
    icon: Sparkles,
    description: 'Ajoutez des cartes à vos decks en un instant.',
    features: [
      'Survolez une carte → cliquez sur + (x1) ou survolez pour x2/x3/x4',
      'Dans le modal carte : boutons x1, x2, x3, x4 ou touches clavier',
      'Raccourcis : A = x1, ou directement 1, 2, 3, 4',
      'Le deck actif est visible dans le header (icône ⚡)',
      'Les decks "En construction" sont prioritaires',
      'Changez de deck actif via le menu dans le header',
    ]
  },
  {
    title: 'Arcane Search',
    icon: Search,
    description: 'The main search interface for exploring the MTG card library.',
    features: [
      'Search cards by name, text, type, and more',
      'Filter by color, rarity, set, and format',
      'Click on any card to see detailed information',
      'Add cards directly to your decks or wantlist',
    ]
  },
  {
    title: 'Spellbooks (Decks)',
    icon: Layers,
    description: 'Manage your deck collection with powerful tools.',
    features: [
      'Create and organize multiple decks',
      'View deck statistics (mana curve, card types)',
      'Switch between list and visual view modes',
      'Export decks in various formats (MTG Arena, MTGO)',
      'Click on cards to see full details',
    ]
  },
  {
    title: 'Quest Log (Wantlist)',
    icon: Heart,
    description: 'Track cards you want to acquire.',
    features: [
      'Add cards from search results',
      'Set priority levels (Urgent, Active, Side Quest)',
      'Track total value of your wantlist',
      'Quick links to Cardmarket and Scryfall',
    ]
  },
  {
    title: 'Price Display',
    icon: Coins,
    description: 'Card prices are fetched from Scryfall and displayed throughout the app.',
    features: [
      'Prices shown in EUR by default',
      'Toggle prices on/off with the P key or header button',
      'Prices appear on card thumbnails (bottom-left)',
      'Full price breakdown in card detail modal',
    ]
  },
]

export default function HelpPage() {
  const [syncing, setSyncing] = useState<'cards' | 'prices' | null>(null)
  const [migrating, setMigrating] = useState(false)
  const [migrationResult, setMigrationResult] = useState<{
    created: number
    updated: number
    totalCards: number
  } | null>(null)

  const handleMigrateDecksToCollection = async () => {
    if (migrating) return

    setMigrating(true)
    setMigrationResult(null)

    toast({
      title: 'Migration en cours...',
      description: 'Import des cartes de vos decks vers la collection.',
      variant: 'info',
    })

    try {
      const response = await fetch('/api/collection/migrate-from-decks', { method: 'POST' })
      const data = await response.json()

      if (response.ok && data.success) {
        setMigrationResult({
          created: data.created,
          updated: data.updated,
          totalCards: data.collectionStats?.reduce((sum: number, s: { totalCards: number }) => sum + s.totalCards, 0) || 0,
        })
        toast({
          title: 'Migration terminée!',
          description: `${data.created} nouvelles entrées, ${data.updated} mises à jour.`,
          variant: 'success',
        })
      } else {
        toast({
          title: 'Migration échouée',
          description: data.error || 'Une erreur est survenue.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Erreur',
        description: 'Erreur réseau. Veuillez réessayer.',
        variant: 'destructive',
      })
    } finally {
      setMigrating(false)
    }
  }

  const handleSync = async (type: 'cards' | 'prices') => {
    if (syncing) return

    const endpoint = type === 'cards' ? '/api/sync/cards' : '/api/sync/prices'
    const label = type === 'cards' ? 'Cards' : 'Prices'

    setSyncing(type)

    toast({
      title: `Syncing ${label}...`,
      description: 'This may take a few minutes. Please wait.',
      variant: 'info',
    })

    try {
      const response = await fetch(endpoint, { method: 'POST' })
      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: 'Sync Complete!',
          description: data.message || `${label} synchronized successfully.`,
          variant: 'success',
        })
      } else {
        toast({
          title: 'Sync Failed',
          description: data.error || `Failed to sync ${label.toLowerCase()}.`,
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Sync Error',
        description: 'Network error. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSyncing(null)
    }
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <FadeIn>
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <motion.div
              animate={{
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <BookOpen className="w-10 h-10 text-arcane-400" />
            </motion.div>
            <h1 className="font-display text-3xl text-gold-400">Tome of Knowledge</h1>
          </div>
          <p className="text-parchment-400 max-w-xl mx-auto">
            Welcome, adventurer! This ancient tome contains all the secrets of magicTools.
            Study well, for knowledge is the greatest power.
          </p>
        </div>
      </FadeIn>

      {/* Database Sync Section */}
      <FadeIn delay={0.05}>
        <section className="card-frame p-6 border-arcane-500/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-arcane-600/20 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-arcane-400" />
            </div>
            <div>
              <h2 className="font-medieval text-xl text-gold-400">Database Synchronization</h2>
              <p className="text-sm text-parchment-500">Keep your card data up to date</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {/* Sync Cards */}
            <div className="p-4 rounded-lg bg-dungeon-800/50 border border-dungeon-700/50">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-arcane-600/20 flex items-center justify-center flex-shrink-0">
                  <Database className="w-5 h-5 text-arcane-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-parchment-200">Sync Cards</h3>
                  <p className="text-xs text-parchment-500 mt-1">
                    Downloads the complete card database from Scryfall. This includes all card data, images, and metadata.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => handleSync('cards')}
                disabled={syncing !== null}
                className="w-full bg-arcane-600 hover:bg-arcane-500"
              >
                {syncing === 'cards' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing Cards...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 mr-2" />
                    Sync Cards Database
                  </>
                )}
              </Button>
              <p className="text-[10px] text-dungeon-500 mt-2 text-center italic">
                Takes 5-10 minutes - Run monthly or after new sets
              </p>
            </div>

            {/* Sync Prices */}
            <div className="p-4 rounded-lg bg-dungeon-800/50 border border-dungeon-700/50">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-nature-600/20 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-5 h-5 text-nature-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-parchment-200">Sync Prices</h3>
                  <p className="text-xs text-parchment-500 mt-1">
                    Updates card prices from Scryfall. Prices are in EUR and USD, including foil variants.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => handleSync('prices')}
                disabled={syncing !== null}
                variant="outline"
                className="w-full border-nature-600/50 hover:bg-nature-600/20 hover:border-nature-500"
              >
                {syncing === 'prices' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing Prices...
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4 mr-2" />
                    Sync Prices
                  </>
                )}
              </Button>
              <p className="text-[10px] text-dungeon-500 mt-2 text-center italic">
                Takes 1-2 minutes - Run weekly for accurate prices
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-dungeon-900/50 border border-dungeon-700/30">
            <p className="text-xs text-parchment-500">
              <span className="text-gold-400 font-medium">How it works:</span> magicTools uses Scryfall&apos;s bulk data API to keep your local database synchronized.
              Card data includes names, types, oracle text, and images. Prices are fetched separately and stored per card printing for accurate values.
            </p>
          </div>
        </section>
      </FadeIn>

      {/* Data Tools Section */}
      <FadeIn delay={0.07}>
        <section className="card-frame p-6 border-gold-500/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gold-600/20 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-gold-400" />
            </div>
            <div>
              <h2 className="font-medieval text-xl text-gold-400">Data Tools</h2>
              <p className="text-sm text-parchment-500">Manage your collection data</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-dungeon-800/50 border border-dungeon-700/50">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gold-600/20 flex items-center justify-center flex-shrink-0">
                <Archive className="w-5 h-5 text-gold-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-parchment-200">Import Decks → Collection</h3>
                <p className="text-xs text-parchment-500 mt-1">
                  Importe toutes les cartes de vos decks existants dans votre collection.
                  Les cartes sont ajoutées en condition Near Mint (NM), non-foil.
                  Si une carte existe déjà, la quantité est additionnée.
                </p>
              </div>
            </div>
            <Button
              onClick={handleMigrateDecksToCollection}
              disabled={migrating}
              className="w-full bg-gold-600 hover:bg-gold-500 text-dungeon-900"
            >
              {migrating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Migration en cours...
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4 mr-2" />
                  Importer les decks dans la collection
                </>
              )}
            </Button>
            {migrationResult && (
              <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm">
                <p className="text-green-400 font-medium">Migration réussie!</p>
                <p className="text-parchment-400 text-xs mt-1">
                  {migrationResult.created} nouvelles entrées créées, {migrationResult.updated} mises à jour.
                  Total: {migrationResult.totalCards} cartes dans la collection.
                </p>
              </div>
            )}
            <p className="text-[10px] text-dungeon-500 mt-2 text-center italic">
              Exécuter une seule fois pour initialiser la collection
            </p>
          </div>
        </section>
      </FadeIn>

      {/* Keyboard Shortcuts Section */}
      <FadeIn delay={0.1}>
        <section className="card-frame p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-arcane-600/20 flex items-center justify-center">
              <Keyboard className="w-5 h-5 text-arcane-400" />
            </div>
            <div>
              <h2 className="font-medieval text-xl text-gold-400">Keyboard Shortcuts</h2>
              <p className="text-sm text-parchment-500">Master these incantations for swift navigation</p>
            </div>
          </div>

          <StaggerContainer className="space-y-6">
            {keyboardShortcuts.map((category) => (
              <StaggerItem key={category.category}>
                <div>
                  <h3 className="text-sm font-semibold text-parchment-400 mb-3 uppercase tracking-wider">
                    {category.category}
                  </h3>
                  <div className="grid gap-2">
                    {category.shortcuts.map((shortcut) => (
                      <motion.div
                        key={shortcut.key}
                        className={`flex items-center gap-4 p-3 rounded-lg bg-dungeon-800/50 ${shortcut.coming ? 'opacity-50' : ''}`}
                        whileHover={{ x: 4 }}
                        transition={{ duration: 0.2 }}
                      >
                        <kbd className="px-3 py-1.5 text-sm font-mono bg-dungeon-700 border border-dungeon-600 rounded-md text-gold-400 min-w-[3rem] text-center">
                          {shortcut.key}
                        </kbd>
                        <shortcut.icon className="w-4 h-4 text-parchment-500" />
                        <span className="text-parchment-300 flex-1">{shortcut.description}</span>
                        {shortcut.coming && (
                          <span className="text-xs text-arcane-400 bg-arcane-600/20 px-2 py-1 rounded">
                            Coming Soon
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>
      </FadeIn>

      {/* Documentation Section */}
      <FadeIn delay={0.2}>
        <section className="card-frame p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gold-600/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-gold-400" />
            </div>
            <div>
              <h2 className="font-medieval text-xl text-gold-400">Features Guide</h2>
              <p className="text-sm text-parchment-500">Learn the ways of magicTools</p>
            </div>
          </div>

          <StaggerContainer className="grid gap-6 md:grid-cols-2">
            {documentationSections.map((section) => (
              <StaggerItem key={section.title}>
                <motion.div
                  className="p-4 rounded-lg bg-dungeon-800/30 border border-dungeon-700/50 h-full"
                  whileHover={{ borderColor: 'rgba(212, 164, 24, 0.3)' }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-dungeon-700/50 flex items-center justify-center">
                      <section.icon className="w-4 h-4 text-gold-400" />
                    </div>
                    <h3 className="font-medieval text-lg text-parchment-200">{section.title}</h3>
                  </div>
                  <p className="text-sm text-parchment-400 mb-3">{section.description}</p>
                  <ul className="space-y-1.5">
                    {section.features.map((feature, idx) => (
                      <li key={idx} className="text-sm text-parchment-500 flex items-start gap-2">
                        <span className="text-gold-600 mt-1">•</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>
      </FadeIn>

      {/* Simulation Stats Guide */}
      <FadeIn delay={0.3}>
        <section id="simulation-stats" className="card-frame p-6 scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-arcane-600/20 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-arcane-400" />
            </div>
            <div>
              <h2 className="font-medieval text-xl text-gold-400">Test Automatique (Simulation)</h2>
              <p className="text-sm text-parchment-500">Comprendre les statistiques de votre deck</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Intro */}
            <div className="p-4 rounded-lg bg-dungeon-800/30 border border-arcane-500/20">
              <p className="text-sm text-parchment-300">
                Le test automatique simule <span className="text-gold-400 font-medium">10 000 tirages</span> de votre deck 
                pour analyser sa consistance sur les 3 premiers tours. Il calcule la probabilité de bonnes mains de départ,
                le risque de mana screw/flood, et la disponibilité de vos couleurs.
              </p>
            </div>

            {/* Basic Stats */}
            <div>
              <h3 className="text-sm font-semibold text-parchment-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-dungeon-700 text-xs text-parchment-300">Base</span>
                Statistiques de base
              </h3>
              <div className="grid gap-3">
                {simulationStats.basic.map((stat) => (
                  <motion.div
                    key={stat.name}
                    className="p-3 rounded-lg bg-dungeon-800/50 border border-dungeon-700/50"
                    whileHover={{ borderColor: 'rgba(212, 164, 24, 0.3)' }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-dungeon-700/50 flex items-center justify-center flex-shrink-0">
                        <stat.icon className="w-4 h-4 text-gold-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="font-medium text-parchment-200">{stat.name}</h4>
                          {stat.ideal && (
                            <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400 whitespace-nowrap">
                              Idéal: {stat.ideal}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-parchment-400 mb-2">{stat.description}</p>
                        <p className="text-xs text-parchment-500 italic">💡 {stat.tips}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Advanced Stats */}
            <div>
              <h3 className="text-sm font-semibold text-parchment-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-arcane-500/30 text-xs text-arcane-400">Avancé</span>
                Statistiques avancées
              </h3>
              <div className="grid gap-3">
                {simulationStats.advanced.map((stat) => (
                  <motion.div
                    key={stat.name}
                    className="p-3 rounded-lg bg-dungeon-800/50 border border-arcane-500/20"
                    whileHover={{ borderColor: 'rgba(139, 92, 246, 0.4)' }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-arcane-500/20 flex items-center justify-center flex-shrink-0">
                        <stat.icon className="w-4 h-4 text-arcane-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="font-medium text-parchment-200">{stat.name}</h4>
                          {stat.ideal && (
                            <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400 whitespace-nowrap">
                              Idéal: {stat.ideal}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-parchment-400 mb-2">{stat.description}</p>
                        <p className="text-xs text-parchment-500 italic">💡 {stat.tips}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Distribution Chart Legend */}
            <div className="p-4 rounded-lg bg-dungeon-800/30">
              <h4 className="font-medium text-parchment-200 mb-3">Distribution des terrains (graphique)</h4>
              <p className="text-sm text-parchment-400 mb-3">
                Le graphique en barres montre la répartition du nombre de terrains dans les mains de départ :
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-dragon-500" />
                  <span className="text-parchment-400">0-1 terrain : <span className="text-dragon-400">Mana Screw</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500" />
                  <span className="text-parchment-400">2-4 terrains : <span className="text-green-400">Zone optimale</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-500" />
                  <span className="text-parchment-400">5-7 terrains : <span className="text-blue-400">Mana Flood</span></span>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="p-4 rounded-lg bg-gold-500/10 border border-gold-500/20">
              <h4 className="font-medium text-gold-400 mb-2">📊 Recommandations générales</h4>
              <ul className="space-y-1.5 text-sm text-parchment-400">
                <li className="flex items-start gap-2">
                  <span className="text-gold-600">•</span>
                  <span>Deck 60 cartes : <span className="text-parchment-200">23-26 terrains</span> selon la courbe</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gold-600">•</span>
                  <span>Deck Commander : <span className="text-parchment-200">35-38 terrains</span> + 8-12 ramp</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gold-600">•</span>
                  <span>Les MDFCs (Modal Double-Faced Cards) comptent comme demi-terrain</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gold-600">•</span>
                  <span>Le mode <span className="text-arcane-400">Avancé</span> est recommandé pour les decks multicolores</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* External Resources */}
      <FadeIn delay={0.4}>
        <section className="card-frame p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-dragon-600/20 flex items-center justify-center">
              <ExternalLink className="w-5 h-5 text-dragon-400" />
            </div>
            <div>
              <h2 className="font-medieval text-xl text-gold-400">External Resources</h2>
              <p className="text-sm text-parchment-500">Allied guilds and useful links</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href="https://scryfall.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-lg bg-dungeon-800/30 border border-dungeon-700/50 hover:border-gold-600/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <span className="text-lg">🔮</span>
              </div>
              <div className="flex-1">
                <p className="text-parchment-200 font-medium group-hover:text-gold-400 transition-colors">Scryfall</p>
                <p className="text-xs text-parchment-500">Card database & API provider</p>
              </div>
              <ExternalLink className="w-4 h-4 text-parchment-500 group-hover:text-gold-400 transition-colors" />
            </a>

            <a
              href="https://www.cardmarket.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-lg bg-dungeon-800/30 border border-dungeon-700/50 hover:border-gold-600/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-orange-600/20 flex items-center justify-center">
                <span className="text-lg">🛒</span>
              </div>
              <div className="flex-1">
                <p className="text-parchment-200 font-medium group-hover:text-gold-400 transition-colors">Cardmarket</p>
                <p className="text-xs text-parchment-500">European marketplace</p>
              </div>
              <ExternalLink className="w-4 h-4 text-parchment-500 group-hover:text-gold-400 transition-colors" />
            </a>
          </div>
        </section>
      </FadeIn>

      {/* Version Info */}
      <FadeIn delay={0.5}>
        <div className="text-center text-sm text-dungeon-500">
          <p>magicTools v1.0 • Built with ❤️ for the MTG community</p>
          <p className="mt-1">Data provided by Scryfall • Prices updated daily</p>
        </div>
      </FadeIn>
    </div>
  )
}
