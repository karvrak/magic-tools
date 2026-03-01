import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data', 'custom-sets')

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params

    if (!pathSegments || pathSegments.length < 2) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    // Sanitize path segments to prevent directory traversal
    for (const segment of pathSegments) {
      if (segment.includes('..') || segment.includes('/') || segment.includes('\\')) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
      }
    }

    const filePath = path.join(DATA_DIR, ...pathSegments)

    // Ensure the resolved path is still within DATA_DIR
    const resolvedPath = path.resolve(filePath)
    if (!resolvedPath.startsWith(path.resolve(DATA_DIR))) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    const fileBuffer = await readFile(filePath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving custom set image:', error)
    return NextResponse.json({ error: 'Failed to serve image' }, { status: 500 })
  }
}
