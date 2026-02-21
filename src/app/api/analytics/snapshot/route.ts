import { NextResponse } from 'next/server'
import { generateAllSnapshots } from '@/lib/analytics/generate-snapshot'

// POST /api/analytics/snapshot - Manually trigger snapshot generation
export async function POST() {
  try {
    const results = await generateAllSnapshots()

    return NextResponse.json({
      success: true,
      snapshots: results.length,
    })
  } catch (error) {
    console.error('Error generating snapshots:', error)
    return NextResponse.json(
      { error: 'Failed to generate snapshots' },
      { status: 500 }
    )
  }
}
