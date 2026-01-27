'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Layers, Heart, Menu, X, LogOut, Scroll, Sparkles, HelpCircle, Swords, Zap, ChevronDown, Hammer, Check, Users, User, UsersRound, Archive, Package, ScrollText } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { QuickSearch } from '@/components/search/quick-search'
import { useQuickAdd } from '@/contexts/quick-add'
import { useActiveOwner } from '@/contexts/active-owner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const navItems = [
  { href: '/', label: 'Arcane Search', icon: Search, description: 'Explore the library', iconOnly: true },
  { href: '/decks', label: 'Spellbooks', icon: Layers, description: 'Your deck collection' },
  { href: '/sealed', label: 'Sealed', icon: Package, description: 'Limited format simulation' },
  { href: '/play', label: 'Multiplayer', icon: Users, description: 'Play with friends' },
  { href: '/battle', label: 'Arena', icon: Swords, description: 'Life counter & battles' },
  { href: '/matches', label: 'Historique', icon: ScrollText, description: 'Match history & stats' },
  { href: '/collection', label: 'Collection', icon: Archive, description: 'Cards & wishlist' },
  { href: '/help', label: 'Tome of Knowledge', icon: HelpCircle, description: 'Help & shortcuts' },
]

export function Header() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [quickAddDropdownOpen, setQuickAddDropdownOpen] = useState(false)
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false)
  const quickAddRef = useRef<HTMLDivElement>(null)
  const ownerRef = useRef<HTMLDivElement>(null)
  const { activeTarget, activeDeck, availableDecks, setActiveDeckById, setActiveCollection, isLoading: quickAddLoading, refreshDecks } = useQuickAdd()
  const { activeOwner, owners, setActiveOwnerById, isLoading: ownerLoading, refreshOwners } = useActiveOwner()

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickAddRef.current && !quickAddRef.current.contains(event.target as Node)) {
        setQuickAddDropdownOpen(false)
      }
      if (ownerRef.current && !ownerRef.current.contains(event.target as Node)) {
        setOwnerDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <header className="sticky top-0 z-50 border-b-2 border-gold-700/30 bg-dungeon-900/98 backdrop-blur-md">
      {/* Decorative top border with runes */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gold-600/50 to-transparent" />

      {/* Torch glow effects */}
      <div className="absolute top-0 left-8 w-24 h-16 bg-gradient-to-b from-orange-500/10 to-transparent pointer-events-none animate-torch" />
      <div className="absolute top-0 right-8 w-24 h-16 bg-gradient-to-b from-orange-500/10 to-transparent pointer-events-none animate-torch" style={{ animationDelay: '0.25s' }} />

      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo - Guild Emblem */}
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div
              className="relative"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Shield background */}
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-gold-500 via-gold-600 to-gold-700 flex items-center justify-center shadow-lg group-hover:shadow-magic-glow transition-shadow duration-300">
                {/* Inner emblem */}
                <div className="relative">
                  <Scroll className="w-6 h-6 text-dungeon-900" />
                  <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-dungeon-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              {/* Magical indicator */}
              <motion.div
                className="absolute -top-1 -right-1 w-3 h-3 bg-arcane-500 rounded-full"
                animate={{
                  scale: [1, 1.2, 1],
                  boxShadow: [
                    '0 0 5px rgba(168, 85, 247, 0.5)',
                    '0 0 15px rgba(168, 85, 247, 0.8)',
                    '0 0 5px rgba(168, 85, 247, 0.5)',
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>

            <div className="hidden sm:block">
              <span className="font-display text-xl text-gold-400 group-hover:text-gold-300 transition-colors tracking-wide">
                magicTools
              </span>
              <p className="text-xs text-dungeon-400 font-body -mt-0.5">
                Arcane Card Library
              </p>
            </div>
          </Link>

          {/* Desktop Nav - Tavern Menu Style */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item, index) => {
              const isActive = pathname === item.href
              return (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  {item.iconOnly ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={item.href}
                            className={cn(
                              'relative flex items-center justify-center w-10 h-10 rounded-md transition-all duration-300 group',
                              isActive
                                ? 'text-gold-300'
                                : 'text-parchment-400 hover:text-parchment-200'
                            )}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="nav-active"
                                className="absolute inset-0 bg-gold-600/15 border border-gold-600/30 rounded-md"
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              />
                            )}
                            <span className="absolute inset-0 bg-dungeon-700/0 group-hover:bg-dungeon-700/50 rounded-md transition-colors duration-300" />
                            <item.icon className={cn(
                              'w-5 h-5 relative z-10 transition-all duration-300',
                              isActive && 'text-gold-400',
                              !isActive && 'group-hover:text-gold-500'
                            )} />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>{item.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Link
                      href={item.href}
                      className={cn(
                        'relative flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 group',
                        isActive
                          ? 'text-gold-300'
                          : 'text-parchment-400 hover:text-parchment-200'
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="nav-active"
                          className="absolute inset-0 bg-gold-600/15 border border-gold-600/30 rounded-md"
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                      <span className="absolute inset-0 bg-dungeon-700/0 group-hover:bg-dungeon-700/50 rounded-md transition-colors duration-300" />
                      <item.icon className={cn(
                        'w-4 h-4 relative z-10 transition-all duration-300',
                        isActive && 'text-gold-400',
                        !isActive && 'group-hover:text-gold-500'
                      )} />
                      <span className="relative z-10">{item.label}</span>
                      {isActive && (
                        <motion.div
                          className="absolute -bottom-px left-1/2 w-8 h-0.5 bg-gold-500 rounded-full"
                          layoutId="nav-underline"
                          style={{ x: '-50%' }}
                        />
                      )}
                    </Link>
                  )}
                </motion.div>
              )
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Owner Selector - Desktop */}
            <div ref={ownerRef} className="relative hidden md:block">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        const willOpen = !ownerDropdownOpen
                        if (willOpen) {
                          refreshOwners()
                        }
                        setOwnerDropdownOpen(willOpen)
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-all",
                        "border border-gold-600/40 bg-gold-600/10",
                        "hover:bg-gold-600/20 hover:border-gold-500/50",
                        ownerDropdownOpen && "bg-gold-600/20 border-gold-500/50"
                      )}
                    >
                      {activeOwner ? (
                        <User className="w-3.5 h-3.5 text-gold-400" />
                      ) : (
                        <UsersRound className="w-3.5 h-3.5 text-gold-400" />
                      )}
                      <span
                        className="max-w-[80px] truncate"
                        style={{ color: activeOwner?.color || '#D4AF37' }}
                      >
                        {ownerLoading ? '...' : activeOwner?.name || 'Tous'}
                      </span>
                      <ChevronDown className={cn(
                        "w-3 h-3 text-gold-400 transition-transform",
                        ownerDropdownOpen && "rotate-180"
                      )} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Utilisateur actif</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Owner Dropdown */}
              <AnimatePresence>
                {ownerDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1 w-48 bg-dungeon-800 border border-dungeon-600 rounded-lg shadow-xl z-50 overflow-hidden"
                  >
                    <div className="p-2 border-b border-dungeon-700">
                      <p className="text-xs text-parchment-500 px-2">
                        Utilisateur actif
                      </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {/* Option "Tous" */}
                      <button
                        onClick={() => {
                          setActiveOwnerById(null)
                          setOwnerDropdownOpen(false)
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
                          !activeOwner
                            ? "bg-gold-600/20"
                            : "hover:bg-dungeon-700"
                        )}
                      >
                        <UsersRound className="w-3.5 h-3.5 text-gold-400 flex-shrink-0" />
                        <span className="text-sm flex-1 text-gold-400">
                          Tous
                        </span>
                        {!activeOwner && (
                          <Check className="w-4 h-4 text-gold-400 flex-shrink-0" />
                        )}
                      </button>

                      {/* Separator */}
                      {owners.length > 0 && (
                        <div className="border-t border-dungeon-700 my-1" />
                      )}

                      {/* Owners list */}
                      {owners.length === 0 ? (
                        <p className="text-sm text-parchment-500 text-center py-4">
                          Aucun utilisateur
                        </p>
                      ) : (
                        owners.map((owner) => (
                          <button
                            key={owner.id}
                            onClick={() => {
                              setActiveOwnerById(owner.id)
                              setOwnerDropdownOpen(false)
                            }}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
                              activeOwner?.id === owner.id
                                ? "bg-gold-600/20"
                                : "hover:bg-dungeon-700"
                            )}
                          >
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: owner.color }}
                            />
                            <span
                              className="text-sm flex-1 truncate"
                              style={{ color: owner.color }}
                            >
                              {owner.name}
                            </span>
                            {activeOwner?.id === owner.id && (
                              <Check className="w-4 h-4 text-gold-400 flex-shrink-0" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quick Add Deck Selector - Desktop */}
            <div ref={quickAddRef} className="relative hidden md:block">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        const willOpen = !quickAddDropdownOpen
                        if (willOpen) {
                          refreshDecks()
                        }
                        setQuickAddDropdownOpen(willOpen)
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-all",
                        "border border-arcane-600/40 bg-arcane-600/10",
                        "hover:bg-arcane-600/20 hover:border-arcane-500/50",
                        quickAddDropdownOpen && "bg-arcane-600/20 border-arcane-500/50"
                      )}
                    >
                      {activeTarget?.type === 'collection' ? (
                        <Archive className="w-3.5 h-3.5 text-arcane-400" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 text-arcane-400" />
                      )}
                      <span className="text-arcane-300 max-w-[100px] truncate">
                        {quickAddLoading
                          ? '...'
                          : activeTarget?.type === 'collection'
                            ? 'Collection'
                            : activeDeck?.name || 'Quick Add'}
                      </span>
                      <ChevronDown className={cn(
                        "w-3 h-3 text-arcane-400 transition-transform",
                        quickAddDropdownOpen && "rotate-180"
                      )} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Deck actif pour Quick Add <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-dungeon-700 rounded">A</kbd></p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Dropdown */}
              <AnimatePresence>
                {quickAddDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1 w-64 bg-dungeon-800 border border-dungeon-600 rounded-lg shadow-xl z-50 overflow-hidden"
                  >
                    <div className="p-2 border-b border-dungeon-700">
                      <p className="text-xs text-parchment-500 px-2">
                        Deck actif pour Quick Add
                        {activeOwner && (
                          <span className="ml-1" style={{ color: activeOwner.color }}>
                            ({activeOwner.name})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {/* Collection option */}
                      <button
                        onClick={() => {
                          setActiveCollection()
                          setQuickAddDropdownOpen(false)
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
                          activeTarget?.type === 'collection'
                            ? "bg-arcane-600/20 text-arcane-300"
                            : "text-parchment-300 hover:bg-dungeon-700"
                        )}
                      >
                        <Archive className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">Collection</p>
                          <p className="text-xs text-parchment-500">
                            Ajouter à ma collection
                          </p>
                        </div>
                        {activeTarget?.type === 'collection' && (
                          <Check className="w-4 h-4 text-arcane-400 flex-shrink-0" />
                        )}
                      </button>

                      {/* Separator */}
                      <div className="border-t border-dungeon-700 my-1" />

                      {/* Decks list */}
                      {availableDecks.length === 0 ? (
                        <p className="text-sm text-parchment-500 text-center py-4">
                          Aucun deck disponible
                          {activeOwner && (
                            <span className="block text-xs mt-1">
                              pour {activeOwner.name}
                            </span>
                          )}
                        </p>
                      ) : (
                        availableDecks.map((deck) => (
                          <button
                            key={deck.id}
                            onClick={() => {
                              setActiveDeckById(deck.id)
                              setQuickAddDropdownOpen(false)
                            }}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
                              activeTarget?.type === 'deck' && activeDeck?.id === deck.id
                                ? "bg-arcane-600/20 text-arcane-300"
                                : "text-parchment-300 hover:bg-dungeon-700"
                            )}
                          >
                            {deck.status === 'building' ? (
                              <Hammer className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{deck.name}</p>
                              <p className="text-xs text-parchment-500">
                                {deck.cardCount} cartes
                                {deck.format && <span className="ml-1">• {deck.format}</span>}
                              </p>
                            </div>
                            {activeTarget?.type === 'deck' && activeDeck?.id === deck.id && (
                              <Check className="w-4 h-4 text-arcane-400 flex-shrink-0" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                    <div className="p-2 border-t border-dungeon-700 bg-dungeon-850">
                      <Link
                        href="/decks"
                        onClick={() => setQuickAddDropdownOpen(false)}
                        className="flex items-center justify-center gap-2 w-full px-3 py-1.5 text-xs text-parchment-400 hover:text-parchment-200 transition-colors"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Gérer les decks
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Logout - Desktop */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="hidden md:flex text-parchment-400 hover:text-dragon-400 hover:bg-dragon-600/10"
                title="Leave the Tavern"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </motion.div>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => {
                const willOpen = !mobileMenuOpen
                if (willOpen) {
                  refreshDecks()
                  refreshOwners()
                }
                setMobileMenuOpen(willOpen)
              }}
            >
              <AnimatePresence mode="wait">
                {mobileMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Menu className="w-5 h-5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          </div>
        </div>

        {/* Mobile Nav - Scroll Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="md:hidden overflow-hidden"
            >
              <div className="py-4 border-t border-dungeon-700 space-y-1">
                {navItems.map((item, index) => {
                  const isActive = pathname === item.href
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          'flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-300',
                          isActive
                            ? 'bg-gold-600/15 border border-gold-600/30'
                            : 'hover:bg-dungeon-700/50'
                        )}
                      >
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          isActive
                            ? 'bg-gold-600/20 text-gold-400'
                            : 'bg-dungeon-700/50 text-parchment-400'
                        )}>
                          <item.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={cn(
                            'font-medieval text-sm',
                            isActive ? 'text-gold-400' : 'text-parchment-200'
                          )}>
                            {item.label}
                          </p>
                          <p className="text-xs text-dungeon-400">
                            {item.description}
                          </p>
                        </div>
                      </Link>
                    </motion.div>
                  )
                })}

                {/* Owner Selector - Mobile */}
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: navItems.length * 0.1 }}
                  className="px-4 py-2"
                >
                  <p className="text-xs text-parchment-500 mb-2 px-1">Utilisateur actif</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {/* Option "Tous" */}
                    <button
                      onClick={() => {
                        setActiveOwnerById(null)
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                        !activeOwner
                          ? "bg-gold-600/20 border border-gold-500/30"
                          : "hover:bg-dungeon-700/50"
                      )}
                    >
                      <UsersRound className="w-4 h-4 text-gold-400" />
                      <span className="text-sm text-gold-400">
                        Tous
                      </span>
                      {!activeOwner && (
                        <Check className="w-4 h-4 text-gold-400 ml-auto" />
                      )}
                    </button>

                    {owners.map((owner) => (
                      <button
                        key={owner.id}
                        onClick={() => {
                          setActiveOwnerById(owner.id)
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                          activeOwner?.id === owner.id
                            ? "bg-gold-600/20 border border-gold-500/30"
                            : "hover:bg-dungeon-700/50"
                        )}
                      >
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: owner.color }}
                        />
                        <span
                          className="text-sm truncate"
                          style={{ color: owner.color }}
                        >
                          {owner.name}
                        </span>
                        {activeOwner?.id === owner.id && (
                          <Check className="w-4 h-4 text-gold-400 ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>

                {/* Quick Add Deck - Mobile */}
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: (navItems.length + 1) * 0.1 }}
                  className="px-4 py-2"
                >
                  <p className="text-xs text-parchment-500 mb-2 px-1">
                    Quick Add - Cible active
                    {activeOwner && (
                      <span className="ml-1" style={{ color: activeOwner.color }}>
                        ({activeOwner.name})
                      </span>
                    )}
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {/* Collection option */}
                    <button
                      onClick={() => {
                        setActiveCollection()
                        setMobileMenuOpen(false)
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                        activeTarget?.type === 'collection'
                          ? "bg-arcane-600/20 border border-arcane-500/30"
                          : "hover:bg-dungeon-700/50"
                      )}
                    >
                      <Archive className="w-4 h-4 text-emerald-400" />
                      <span className={cn(
                        "text-sm",
                        activeTarget?.type === 'collection' ? "text-arcane-300" : "text-parchment-300"
                      )}>
                        Collection
                      </span>
                      {activeTarget?.type === 'collection' && (
                        <Check className="w-4 h-4 text-arcane-400 ml-auto" />
                      )}
                    </button>

                    {/* Separator */}
                    {availableDecks.length > 0 && (
                      <div className="border-t border-dungeon-700 my-1" />
                    )}

                    {/* Decks list */}
                    {availableDecks.slice(0, 5).map((deck) => (
                      <button
                        key={deck.id}
                        onClick={() => {
                          setActiveDeckById(deck.id)
                          setMobileMenuOpen(false)
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                          activeTarget?.type === 'deck' && activeDeck?.id === deck.id
                            ? "bg-arcane-600/20 border border-arcane-500/30"
                            : "hover:bg-dungeon-700/50"
                        )}
                      >
                        {deck.status === 'building' ? (
                          <Hammer className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-emerald-400" />
                        )}
                        <span className={cn(
                          "text-sm truncate",
                          activeTarget?.type === 'deck' && activeDeck?.id === deck.id ? "text-arcane-300" : "text-parchment-300"
                        )}>
                          {deck.name}
                        </span>
                        {activeTarget?.type === 'deck' && activeDeck?.id === deck.id && (
                          <Check className="w-4 h-4 text-arcane-400 ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>

                {/* Logout - Mobile */}
                <motion.button
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: (navItems.length + 2) * 0.1 }}
                  onClick={handleLogout}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-lg text-dragon-400 hover:bg-dragon-600/10 transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-dragon-600/20 flex items-center justify-center">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-medieval text-sm">Leave Tavern</p>
                    <p className="text-xs text-dungeon-400">End your session</p>
                  </div>
                </motion.button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Search Modal */}
      <QuickSearch />
    </header>
  )
}
