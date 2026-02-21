import { describe, it, expect } from 'vitest'
import {
  createDeckSchema,
  updateDeckSchema,
  addDeckCardSchema,
  addCollectionItemSchema,
  updateCollectionItemSchema,
  addWantlistItemSchema,
  createOwnerSchema,
  createTagSchema,
  scannerOcrSchema,
  scannerMatchSchema,
  importDecklistSchema,
  bulkCollectionSchema,
  loginSchema,
} from '@/lib/validations'

// ============================================
// createDeckSchema
// ============================================

describe('createDeckSchema', () => {
  it('accepts a valid deck with only name', () => {
    const result = createDeckSchema.safeParse({ name: 'My Deck' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('My Deck')
    }
  })

  it('trims the deck name', () => {
    const result = createDeckSchema.safeParse({ name: '  Spaced Out  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Spaced Out')
    }
  })

  it('rejects an empty name', () => {
    const result = createDeckSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing name', () => {
    const result = createDeckSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = createDeckSchema.safeParse({
      name: 'Test',
      description: 'A description',
      format: 'standard',
      ownerId: 'owner-123',
      status: 'building',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status values', () => {
    const result = createDeckSchema.safeParse({
      name: 'Test',
      status: 'invalid_status',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid status values', () => {
    for (const status of ['building', 'active', 'locked']) {
      const result = createDeckSchema.safeParse({ name: 'Test', status })
      expect(result.success).toBe(true)
    }
  })
})

// ============================================
// updateDeckSchema
// ============================================

describe('updateDeckSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    const result = updateDeckSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects an empty name string', () => {
    const result = updateDeckSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('accepts tagIds as string array', () => {
    const result = updateDeckSchema.safeParse({ tagIds: ['tag-1', 'tag-2'] })
    expect(result.success).toBe(true)
  })
})

// ============================================
// addDeckCardSchema
// ============================================

describe('addDeckCardSchema', () => {
  it('accepts valid input', () => {
    const result = addDeckCardSchema.safeParse({
      cardId: 'card-123',
      quantity: 4,
      category: 'mainboard',
    })
    expect(result.success).toBe(true)
  })

  it('defaults quantity to 1', () => {
    const result = addDeckCardSchema.safeParse({ cardId: 'card-123' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.quantity).toBe(1)
    }
  })

  it('rejects quantity of 0', () => {
    const result = addDeckCardSchema.safeParse({
      cardId: 'card-123',
      quantity: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative quantity', () => {
    const result = addDeckCardSchema.safeParse({
      cardId: 'card-123',
      quantity: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing cardId', () => {
    const result = addDeckCardSchema.safeParse({ quantity: 1 })
    expect(result.success).toBe(false)
  })
})

// ============================================
// addCollectionItemSchema
// ============================================

describe('addCollectionItemSchema', () => {
  it('accepts valid input with defaults', () => {
    const result = addCollectionItemSchema.safeParse({ cardId: 'card-1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.quantity).toBe(1)
      expect(result.data.condition).toBe('nm')
      expect(result.data.isFoil).toBe(false)
    }
  })

  it('accepts all valid conditions', () => {
    for (const condition of ['nm', 'lp', 'mp', 'hp', 'dmg']) {
      const result = addCollectionItemSchema.safeParse({
        cardId: 'card-1',
        condition,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid condition', () => {
    const result = addCollectionItemSchema.safeParse({
      cardId: 'card-1',
      condition: 'excellent',
    })
    expect(result.success).toBe(false)
  })

  it('rejects quantity less than 1', () => {
    const result = addCollectionItemSchema.safeParse({
      cardId: 'card-1',
      quantity: 0,
    })
    expect(result.success).toBe(false)
  })
})

// ============================================
// updateCollectionItemSchema
// ============================================

describe('updateCollectionItemSchema', () => {
  it('requires an id', () => {
    const result = updateCollectionItemSchema.safeParse({ quantity: 5 })
    expect(result.success).toBe(false)
  })

  it('accepts valid partial update', () => {
    const result = updateCollectionItemSchema.safeParse({
      id: 'item-1',
      condition: 'lp',
    })
    expect(result.success).toBe(true)
  })
})

// ============================================
// addWantlistItemSchema
// ============================================

describe('addWantlistItemSchema', () => {
  it('defaults priority to medium', () => {
    const result = addWantlistItemSchema.safeParse({ cardId: 'card-1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe('medium')
    }
  })

  it('accepts all valid priorities', () => {
    for (const priority of ['low', 'medium', 'high']) {
      const result = addWantlistItemSchema.safeParse({
        cardId: 'card-1',
        priority,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid priority', () => {
    const result = addWantlistItemSchema.safeParse({
      cardId: 'card-1',
      priority: 'urgent',
    })
    expect(result.success).toBe(false)
  })
})

// ============================================
// createOwnerSchema
// ============================================

describe('createOwnerSchema', () => {
  it('accepts a valid name', () => {
    const result = createOwnerSchema.safeParse({ name: 'John' })
    expect(result.success).toBe(true)
  })

  it('trims the name', () => {
    const result = createOwnerSchema.safeParse({ name: '  Alice  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Alice')
    }
  })

  it('rejects empty name', () => {
    const result = createOwnerSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})

// ============================================
// createTagSchema
// ============================================

describe('createTagSchema', () => {
  it('accepts a valid tag name', () => {
    const result = createTagSchema.safeParse({ name: 'aggro' })
    expect(result.success).toBe(true)
  })

  it('rejects a name longer than 30 chars', () => {
    const result = createTagSchema.safeParse({ name: 'a'.repeat(31) })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = createTagSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})

// ============================================
// scannerOcrSchema / scannerMatchSchema
// ============================================

describe('scannerOcrSchema', () => {
  it('rejects missing image', () => {
    const result = scannerOcrSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('accepts a base64 image string', () => {
    const result = scannerOcrSchema.safeParse({
      image: 'data:image/png;base64,abc123',
    })
    expect(result.success).toBe(true)
  })
})

describe('scannerMatchSchema', () => {
  it('rejects empty texts array', () => {
    const result = scannerMatchSchema.safeParse({ texts: [] })
    expect(result.success).toBe(false)
  })

  it('accepts non-empty texts array', () => {
    const result = scannerMatchSchema.safeParse({
      texts: ['Lightning Bolt', 'Counterspell'],
    })
    expect(result.success).toBe(true)
  })
})

// ============================================
// importDecklistSchema
// ============================================

describe('importDecklistSchema', () => {
  it('rejects empty decklist', () => {
    const result = importDecklistSchema.safeParse({ decklist: '' })
    expect(result.success).toBe(false)
  })

  it('accepts non-empty decklist', () => {
    const result = importDecklistSchema.safeParse({
      decklist: '4 Lightning Bolt\n4 Mountain',
    })
    expect(result.success).toBe(true)
  })
})

// ============================================
// bulkCollectionSchema
// ============================================

describe('bulkCollectionSchema', () => {
  it('rejects empty items array', () => {
    const result = bulkCollectionSchema.safeParse({ items: [] })
    expect(result.success).toBe(false)
  })

  it('accepts valid bulk items with defaults', () => {
    const result = bulkCollectionSchema.safeParse({
      items: [{ cardId: 'card-1' }, { cardId: 'card-2', quantity: 3 }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items[0].quantity).toBe(1)
      expect(result.data.items[0].condition).toBe('nm')
      expect(result.data.items[1].quantity).toBe(3)
    }
  })
})

// ============================================
// loginSchema
// ============================================

describe('loginSchema', () => {
  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ password: '' })
    expect(result.success).toBe(false)
  })

  it('accepts a non-empty password', () => {
    const result = loginSchema.safeParse({ password: 'secret' })
    expect(result.success).toBe(true)
  })
})
