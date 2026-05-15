'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Props {
  // Identifiant stable utilisé pour persister l'état ouvert/fermé en localStorage.
  // ex: "deck-rail:tags-stats". Doit être unique par instance.
  storageKey: string
  title: string
  icon?: ReactNode
  // État initial si rien n'est sauvegardé en localStorage. Si fourni, prend le pas.
  defaultOpen?: boolean
  // Compteur optionnel affiché à droite du titre (ex: nombre de tags actifs).
  badge?: string | number
  // Actions optionnelles affichées dans le header (ex: bouton "Gérer"). Ne togglent pas l'ouverture.
  headerActions?: ReactNode
  // Si true, le contenu n'est monté qu'à la première ouverture (lazy mount).
  // Important pour les panneaux qui font de gros fetchs (IA, simulation).
  lazyMount?: boolean
  children: ReactNode
  className?: string
}

// Section foldable utilisée dans le side-rail de la page deck.
// Persiste son état (open/closed) par utilisateur via localStorage.
// lazyMount permet de différer le rendu du contenu lourd jusqu'à la 1re ouverture.
//
// Volontairement plate (pas de card-frame imbriqué) pour ne pas surcharger
// visuellement quand le contenu est lui-même déjà une carte.
export function CollapsibleModule({
  storageKey,
  title,
  icon,
  defaultOpen = false,
  badge,
  headerActions,
  lazyMount = false,
  children,
  className,
}: Props) {
  const [open, setOpen] = useState<boolean>(defaultOpen)
  const [hasMounted, setHasMounted] = useState<boolean>(!lazyMount || defaultOpen)

  // Hydrate depuis localStorage côté client uniquement (évite mismatch SSR).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored !== null) {
        const v = stored === 'true'
        setOpen(v)
        if (v) setHasMounted(true)
      }
    } catch {
      // localStorage indisponible (mode privé strict) : on garde defaultOpen.
    }
  }, [storageKey])

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(storageKey, String(next))
      } catch {
        /* noop */
      }
      if (next) setHasMounted(true)
      return next
    })
  }

  return (
    <div className={cn('rounded-lg border border-dungeon-700/60 bg-dungeon-900/40 overflow-hidden', className)}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors',
          'hover:bg-dungeon-800/60',
          open && 'bg-dungeon-800/40'
        )}
        aria-expanded={open}
      >
        {icon && <span className="text-gold-400 shrink-0">{icon}</span>}
        <h3 className="font-medieval text-sm text-gold-400 flex-1 truncate">{title}</h3>
        {badge !== undefined && badge !== null && badge !== '' && badge !== 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-arcane-700/40 text-arcane-200 font-medium shrink-0">
            {badge}
          </span>
        )}
        {headerActions && (
          <span
            className="shrink-0 flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {headerActions}
          </span>
        )}
        <ChevronDown
          className={cn(
            'w-4 h-4 text-parchment-400 transition-transform shrink-0',
            open && 'rotate-180'
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden border-t border-dungeon-700/60 bg-dungeon-900/20"
          >
            <div className="p-2">{hasMounted ? children : null}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
