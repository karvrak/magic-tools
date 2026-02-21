import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number | null | undefined, currency: 'EUR' | 'USD' = 'EUR'): string {
  if (price === null || price === undefined) return 'N/A'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(price)
}

/**
 * Interface for price data
 */
export interface PriceData {
  eur?: number | null
  eurFoil?: number | null
  usd?: number | null
  usdFoil?: number | null
}

/**
 * Get the best available price (prefers EUR, falls back to USD)
 * Returns { value, currency } or null if no price available
 */
export function getBestPrice(
  prices: PriceData | null | undefined,
  preferFoil: boolean = false
): { value: number; currency: 'EUR' | 'USD' } | null {
  if (!prices) return null

  if (preferFoil) {
    if (prices.eurFoil != null) return { value: prices.eurFoil, currency: 'EUR' }
    if (prices.usdFoil != null) return { value: prices.usdFoil, currency: 'USD' }
  }

  if (prices.eur != null) return { value: prices.eur, currency: 'EUR' }
  if (prices.usd != null) return { value: prices.usd, currency: 'USD' }

  // Fallback to foil prices if no regular price
  if (prices.eurFoil != null) return { value: prices.eurFoil, currency: 'EUR' }
  if (prices.usdFoil != null) return { value: prices.usdFoil, currency: 'USD' }

  return null
}

/**
 * Format the best available price with currency indicator
 */
export function formatBestPrice(
  prices: PriceData | null | undefined,
  preferFoil: boolean = false
): string {
  const best = getBestPrice(prices, preferFoil)
  if (!best) return 'N/A'
  return formatPrice(best.value, best.currency)
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function getRarityColor(rarity: string): string {
  switch (rarity.toLowerCase()) {
    case 'common':
      return 'text-dungeon-400'
    case 'uncommon':
      return 'text-gray-300'
    case 'rare':
      return 'text-gold-400'
    case 'mythic':
      return 'text-dragon-500'
    default:
      return 'text-dungeon-300'
  }
}

export function getManaSymbolUrl(symbol: string): string {
  // Scryfall mana symbol URL
  const cleanSymbol = symbol.replace(/[{}]/g, '').toUpperCase()
  return `https://svgs.scryfall.io/card-symbols/${cleanSymbol}.svg`
}

export function parseManaSymbols(manaCost: string | null | undefined): string[] {
  if (!manaCost) return []
  const matches = manaCost.match(/\{[^}]+\}/g)
  return matches || []
}
