export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import prisma from '@/lib/prisma'
import { parseCustomSetHtml } from '@/lib/custom-set-parser'
import { uploadCustomSetSchema } from '@/lib/validations'
import { normalizeForSearch } from '@/lib/scryfall/bulk-download'
import crypto from 'crypto'

const DATA_DIR = path.join(process.cwd(), 'data', 'custom-sets')

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const setName = formData.get('setName') as string | null
    const setCodeInput = formData.get('setCode') as string | null

    // Validate inputs
    const validation = uploadCustomSetSchema.safeParse({ setName, setCode: setCodeInput })
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    if (!file) {
      return NextResponse.json({ error: 'ZIP file is required' }, { status: 400 })
    }

    // Validate file type
    if (!file.name.endsWith('.zip')) {
      return NextResponse.json({ error: 'File must be a ZIP archive' }, { status: 400 })
    }

    // Limit file size (100MB)
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 })
    }

    // Generate set code if not provided
    const setCode = validation.data.setCode || `cus_${crypto.randomBytes(4).toString('hex')}`

    // Check if set code already exists
    const existingCard = await prisma.card.findFirst({
      where: { setCode },
    })
    if (existingCard) {
      return NextResponse.json(
        { error: `Set code "${setCode}" already exists. Choose a different code or delete the existing set first.` },
        { status: 409 }
      )
    }

    // Read ZIP file
    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    // Find HTML file in ZIP
    let htmlContent: string | null = null
    let htmlPath: string | null = null
    const imageFiles = new Map<string, JSZip.JSZipObject>()

    for (const [filePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue

      const fileName = path.basename(filePath).toLowerCase()

      if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
        htmlContent = await zipEntry.async('string')
        htmlPath = filePath
      } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png')) {
        imageFiles.set(fileName, zipEntry)
      }
    }

    if (!htmlContent) {
      return NextResponse.json(
        { error: 'No HTML file found in the ZIP archive' },
        { status: 400 }
      )
    }

    // Parse HTML to extract card data
    const parsedCards = parseCustomSetHtml(htmlContent)

    if (parsedCards.length === 0) {
      return NextResponse.json(
        { error: 'No cards found in the HTML file. Make sure the HTML contains <li class="card"> elements.' },
        { status: 400 }
      )
    }

    // Create image storage directory
    const setDir = path.join(DATA_DIR, setCode)
    await mkdir(setDir, { recursive: true })

    // Save HTML source for debugging
    await writeFile(path.join(setDir, '_source.html'), htmlContent, 'utf-8')

    // Save images from ZIP
    let imagesSaved = 0
    for (const [fileName, zipEntry] of imageFiles) {
      const imageBuffer = await zipEntry.async('nodebuffer')
      const imagePath = path.join(setDir, fileName)
      await writeFile(imagePath, imageBuffer)
      imagesSaved++
    }

    // Also check for images in subdirectories of the ZIP
    for (const [filePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue
      const fileName = path.basename(filePath).toLowerCase()
      if ((fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png')) && !imageFiles.has(fileName)) {
        const imageBuffer = await zipEntry.async('nodebuffer')
        const imagePath = path.join(setDir, fileName)
        await writeFile(imagePath, imageBuffer)
        imagesSaved++
      }
    }

    // Prepare card records for database insertion
    const cardRecords = parsedCards.map((card) => {
      const cardId = `${setCode}_${String(card.index).padStart(4, '0')}`
      const imageFileName = card.imageFileName || `card${card.index}.jpg`

      return {
        id: cardId,
        oracleId: cardId, // Unique per custom card
        name: card.name,
        printedName: card.name,
        nameNormalized: normalizeForSearch(card.name),
        lang: 'fr',
        layout: 'normal',
        manaCost: card.manaCost,
        cmc: card.cmc,
        typeLine: card.typeLine,
        printedTypeLine: card.typeLine,
        oracleText: card.oracleText,
        printedText: card.oracleText,
        colors: card.colors,
        colorIdentity: card.colorIdentity,
        keywords: [],
        setCode,
        setName: validation.data.setName,
        collectorNumber: card.collectorNumber,
        rarity: card.rarity,
        imageNormal: `/api/custom-sets/images/${setCode}/${imageFileName}`,
        imageLarge: `/api/custom-sets/images/${setCode}/${imageFileName}`,
        imageSmall: `/api/custom-sets/images/${setCode}/${imageFileName}`,
        power: card.power,
        toughness: card.toughness,
        legalities: {},
        games: ['paper'],
        isBooster: card.isBooster,
        isPromo: false,
        frameEffects: [],
        isFullArt: false,
        isTextless: false,
        isVariation: false,
      }
    })

    // Insert cards in database
    const result = await prisma.card.createMany({
      data: cardRecords,
      skipDuplicates: true,
    })

    // Count cards by rarity for response
    const stats = {
      total: parsedCards.length,
      inserted: result.count,
      commons: parsedCards.filter(c => c.rarity === 'common' && c.isBooster).length,
      uncommons: parsedCards.filter(c => c.rarity === 'uncommon' && c.isBooster).length,
      rares: parsedCards.filter(c => c.rarity === 'rare' && c.isBooster).length,
      mythics: parsedCards.filter(c => c.rarity === 'mythic' && c.isBooster).length,
      tokens: parsedCards.filter(c => !c.isBooster).length,
      images: imagesSaved,
    }

    return NextResponse.json({
      success: true,
      setCode,
      setName: validation.data.setName,
      stats,
    })
  } catch (error) {
    console.error('Custom set upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload custom set', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
