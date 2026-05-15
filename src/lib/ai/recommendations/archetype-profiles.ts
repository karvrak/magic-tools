import type { CardRole } from '../types'

/**
 * Profils de "deck ideal" par archetype, en nombre de slots cibles
 * pour chaque role canonique. Utilise pour la gap detection.
 *
 * Ces nombres sont des heuristiques tirees des conventions deckbuilding
 * EDH (EDHREC) et Vintage (cEDH/Vintage staples). Elles servent de point
 * de depart: le LLM de re-ranking peut les nuancer en fonction du deck reel.
 *
 * Format: { [role]: { min, ideal, max } }
 *   - min: en dessous = gap critique
 *   - ideal: cible pour un deck equilibre
 *   - max: au dessus = redondance probable
 *
 * Le `default` profile s'applique aux archetypes inconnus ou non detectes.
 */

export interface RoleTarget {
  min: number
  ideal: number
  max: number
}

export type ArchetypeProfile = Partial<Record<CardRole, RoleTarget>>

const COMMANDER_DEFAULT: ArchetypeProfile = {
  ramp: { min: 8, ideal: 10, max: 13 },
  mana_fixing: { min: 0, ideal: 2, max: 6 },
  draw: { min: 8, ideal: 10, max: 13 },
  removal: { min: 5, ideal: 8, max: 10 },
  sweeper: { min: 2, ideal: 3, max: 5 },
  protection: { min: 1, ideal: 3, max: 6 },
  finisher: { min: 1, ideal: 3, max: 6 },
  recursion: { min: 0, ideal: 2, max: 5 },
  tutor: { min: 0, ideal: 1, max: 6 },
}

const COMMANDER_STAX: ArchetypeProfile = {
  ramp: { min: 5, ideal: 7, max: 10 },
  mana_fixing: { min: 0, ideal: 1, max: 4 },
  draw: { min: 5, ideal: 8, max: 12 },
  removal: { min: 4, ideal: 6, max: 9 },
  sweeper: { min: 1, ideal: 2, max: 4 },
  lock_piece: { min: 6, ideal: 10, max: 14 },
  hate_piece: { min: 4, ideal: 6, max: 10 },
  protection: { min: 1, ideal: 3, max: 6 },
  finisher: { min: 1, ideal: 2, max: 4 },
}

const COMMANDER_STORM: ArchetypeProfile = {
  ramp: { min: 8, ideal: 12, max: 16 },
  mana_fixing: { min: 0, ideal: 2, max: 5 },
  draw: { min: 14, ideal: 18, max: 22 },
  tutor: { min: 4, ideal: 8, max: 12 },
  removal: { min: 3, ideal: 5, max: 8 },
  protection: { min: 4, ideal: 6, max: 10 },
  finisher: { min: 1, ideal: 2, max: 4 },
}

const COMMANDER_VOLTRON: ArchetypeProfile = {
  ramp: { min: 8, ideal: 10, max: 13 },
  draw: { min: 7, ideal: 10, max: 12 },
  removal: { min: 6, ideal: 9, max: 12 },
  sweeper: { min: 1, ideal: 2, max: 3 },
  protection: { min: 8, ideal: 12, max: 16 }, // equipments / auras / hexproof
  finisher: { min: 0, ideal: 1, max: 3 },
}

const COMMANDER_REANIMATOR: ArchetypeProfile = {
  ramp: { min: 6, ideal: 8, max: 11 },
  draw: { min: 6, ideal: 9, max: 12 },
  removal: { min: 5, ideal: 7, max: 10 },
  sweeper: { min: 1, ideal: 2, max: 4 },
  recursion: { min: 6, ideal: 10, max: 14 },
  finisher: { min: 4, ideal: 7, max: 10 }, // big creatures to reanimate
  tutor: { min: 2, ideal: 4, max: 8 },
}

const COMMANDER_COMBO: ArchetypeProfile = {
  ramp: { min: 8, ideal: 11, max: 14 },
  draw: { min: 10, ideal: 14, max: 18 },
  tutor: { min: 6, ideal: 10, max: 14 },
  removal: { min: 4, ideal: 6, max: 9 },
  protection: { min: 4, ideal: 6, max: 10 },
  counter: { min: 0, ideal: 4, max: 10 },
  finisher: { min: 1, ideal: 2, max: 4 },
}

const COMMANDER_CONTROL: ArchetypeProfile = {
  ramp: { min: 7, ideal: 10, max: 13 },
  draw: { min: 10, ideal: 14, max: 18 },
  removal: { min: 8, ideal: 12, max: 16 },
  sweeper: { min: 3, ideal: 5, max: 7 },
  counter: { min: 4, ideal: 8, max: 12 },
  protection: { min: 1, ideal: 3, max: 6 },
  finisher: { min: 1, ideal: 2, max: 4 },
}

const VINTAGE_DEFAULT: ArchetypeProfile = {
  ramp: { min: 0, ideal: 4, max: 8 }, // Moxen, Lotus, Sol Ring, Mana Crypt
  removal: { min: 4, ideal: 6, max: 10 },
  draw: { min: 4, ideal: 8, max: 12 },
  counter: { min: 4, ideal: 8, max: 12 },
  threat: { min: 4, ideal: 8, max: 14 },
  tutor: { min: 0, ideal: 4, max: 10 },
}

const VINTAGE_SHOPS: ArchetypeProfile = {
  ramp: { min: 8, ideal: 12, max: 16 }, // mishras workshop, sphere ramp
  threat: { min: 8, ideal: 14, max: 20 },
  lock_piece: { min: 6, ideal: 10, max: 14 },
  hate_piece: { min: 4, ideal: 6, max: 10 },
  removal: { min: 0, ideal: 2, max: 6 },
}

const VINTAGE_DOOMSDAY: ArchetypeProfile = {
  ramp: { min: 4, ideal: 6, max: 8 },
  draw: { min: 8, ideal: 12, max: 16 },
  counter: { min: 8, ideal: 12, max: 16 },
  tutor: { min: 4, ideal: 6, max: 10 },
  threat: { min: 0, ideal: 2, max: 4 },
}

const VINTAGE_DREDGE: ArchetypeProfile = {
  threat: { min: 8, ideal: 12, max: 18 },
  recursion: { min: 6, ideal: 10, max: 14 },
  draw: { min: 6, ideal: 10, max: 14 }, // looters / dredgers
  hate_piece: { min: 0, ideal: 2, max: 6 },
}

const VINTAGE_PARADOXICAL: ArchetypeProfile = {
  ramp: { min: 8, ideal: 12, max: 16 }, // moxen
  draw: { min: 10, ideal: 16, max: 22 },
  tutor: { min: 4, ideal: 6, max: 10 },
  counter: { min: 6, ideal: 8, max: 12 },
  threat: { min: 0, ideal: 2, max: 4 },
}

/**
 * Map archetype slug -> profile.
 * Lookup case-insensitive sur la cle.
 */
export function getArchetypeProfile(args: {
  format: 'commander' | 'vintage'
  archetype: string | null
}): ArchetypeProfile {
  const fmt = args.format
  const slug = (args.archetype ?? '').toLowerCase().trim()
  if (fmt === 'commander') {
    switch (slug) {
      case 'stax':
      case 'prison':
        return COMMANDER_STAX
      case 'storm':
      case 'spellslinger':
        return COMMANDER_STORM
      case 'voltron':
        return COMMANDER_VOLTRON
      case 'reanimator':
      case 'aristocrats':
        return COMMANDER_REANIMATOR
      case 'combo':
        return COMMANDER_COMBO
      case 'control':
        return COMMANDER_CONTROL
      default:
        return COMMANDER_DEFAULT
    }
  }
  // Vintage
  switch (slug) {
    case 'shops':
    case 'workshops':
      return VINTAGE_SHOPS
    case 'doomsday':
      return VINTAGE_DOOMSDAY
    case 'dredge':
      return VINTAGE_DREDGE
    case 'paradoxical_outcome':
    case 'painter':
      return VINTAGE_PARADOXICAL
    default:
      return VINTAGE_DEFAULT
  }
}
