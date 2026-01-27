import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/cards/[id]/versions - Get all versions of a card (same oracleId)
// Includes all art variants with their individual prices
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // First, get the card to find its oracleId
    const card = await prisma.card.findUnique({
      where: { id },
      select: { oracleId: true, illustrationId: true },
    })

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    // Get all versions with the same oracleId, including art variant info and prices
    const versions = await prisma.card.findMany({
      where: {
        oracleId: card.oracleId,
      },
      select: {
        id: true,
        name: true,
        printedName: true,
        setCode: true,
        setName: true,
        collectorNumber: true,
        rarity: true,
        illustrationId: true,
        imageSmall: true,
        imageNormal: true,
        imageLarge: true,
        imageArtCrop: true,
        // Back face images for double-faced cards
        imageNormalBack: true,
        imageLargeBack: true,
        lang: true,
        layout: true,
        // Art variant detection fields
        isPromo: true,
        isBooster: true,
        frameEffects: true,
        isFullArt: true,
        isTextless: true,
        isVariation: true,
        // Card-specific prices
        priceEur: true,
        priceEurFoil: true,
        priceUsd: true,
        priceUsdFoil: true,
      },
      orderBy: [
        // Show booster/regular cards first, then promos and special versions
        { isBooster: 'desc' },
        { isPromo: 'asc' },
        { releasedAt: 'desc' },
        { setCode: 'asc' },
      ],
    })

    // Group by unique illustration to avoid duplicates, but keep all unique arts
    const seenIllustrations = new Set<string>()
    const finalVersions: typeof versions = []

    for (const version of versions) {
      // Create a unique key combining illustration and frame style
      // This ensures we show both normal and showcase versions of the same illustration
      const frameKey = version.frameEffects?.sort().join('-') || 'normal'
      const illustrationKey = `${version.illustrationId || version.id}-${frameKey}-${version.isPromo ? 'promo' : 'regular'}`

      if (!seenIllustrations.has(illustrationKey)) {
        seenIllustrations.add(illustrationKey)
        finalVersions.push(version)
      }
    }

    // Fallback: For versions without prices, try to get prices from EN version of same set
    // or from CardPrice table as last resort
    const versionsWithoutPrices = finalVersions.filter(
      v => v.priceEur === null && v.priceUsd === null
    )

    if (versionsWithoutPrices.length > 0) {
      // 1. Get price fallbacks from EN versions that might still exist (in deck/wantlist)
      const fallbackPrices = await prisma.$queryRaw<Array<{
        setCode: string
        collectorNumber: string
        priceEur: number | null
        priceUsd: number | null
        priceEurFoil: number | null
        priceUsdFoil: number | null
      }>>`
        SELECT DISTINCT ON (c."setCode", c."collectorNumber")
          c."setCode",
          c."collectorNumber",
          c."priceEur",
          c."priceUsd",
          c."priceEurFoil",
          c."priceUsdFoil"
        FROM "Card" c
        WHERE c."oracleId" = ${card.oracleId}
          AND c.lang = 'en'
          AND (c."priceEur" IS NOT NULL OR c."priceUsd" IS NOT NULL)
        ORDER BY c."setCode", c."collectorNumber", c."priceEur" DESC NULLS LAST
      `

      // Create a lookup map for EN prices by set+collector
      const priceMap = new Map<string, typeof fallbackPrices[0]>()
      for (const price of fallbackPrices) {
        priceMap.set(`${price.setCode}-${price.collectorNumber}`, price)
      }

      // Apply fallback prices to versions that don't have them
      for (const version of finalVersions) {
        if (version.priceEur === null && version.priceUsd === null) {
          const fallback = priceMap.get(`${version.setCode}-${version.collectorNumber}`)
          if (fallback) {
            version.priceEur = fallback.priceEur
            version.priceUsd = fallback.priceUsd
            version.priceEurFoil = fallback.priceEurFoil
            version.priceUsdFoil = fallback.priceUsdFoil
          }
        }
      }

      // 2. Last resort: use CardPrice table (one price per oracleId)
      // This applies the same reference price to all versions without individual prices
      const stillWithoutPrices = finalVersions.filter(
        v => v.priceEur === null && v.priceUsd === null
      )

      if (stillWithoutPrices.length > 0) {
        const cardPrice = await prisma.cardPrice.findUnique({
          where: { oracleId: card.oracleId },
        })

        if (cardPrice && (cardPrice.eur !== null || cardPrice.usd !== null)) {
          for (const version of finalVersions) {
            if (version.priceEur === null && version.priceUsd === null) {
              version.priceEur = cardPrice.eur
              version.priceUsd = cardPrice.usd
              version.priceEurFoil = cardPrice.eurFoil
              version.priceUsdFoil = cardPrice.usdFoil
            }
          }
        }
      }
    }

    // Compute which version is the "base" art (first booster, non-promo, normal frame)
    const baseVersion = finalVersions.find(v => 
      v.isBooster && 
      !v.isPromo && 
      !v.isVariation &&
      (!v.frameEffects || v.frameEffects.length === 0 || 
       !v.frameEffects.some(f => ['showcase', 'extendedart', 'borderless', 'etched'].includes(f)))
    )

    return NextResponse.json({
      currentId: id,
      currentIllustrationId: card.illustrationId,
      baseVersionId: baseVersion?.id || finalVersions[0]?.id,
      versions: finalVersions,
      totalVersions: finalVersions.length,
    })
  } catch (error) {
    console.error('Error fetching card versions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch card versions' },
      { status: 500 }
    )
  }
}
