import { NextResponse } from 'next/server'
import { syncPrices, getLastPriceSync } from '@/lib/scryfall/sync-prices'

export async function POST() {
  try {
    console.log('[API] Manual price sync triggered')
    const result = await syncPrices()

    if (result.success) {
      return NextResponse.json({
        ...result,
        message: `Synchronized ${result.recordsProcessed} prices in ${Math.round(result.durationMs / 1000)}s`,
      })
    } else {
      return NextResponse.json(
        {
          ...result,
          message: 'Sync failed',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[API] Price sync error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const lastSync = await getLastPriceSync()
    return NextResponse.json({
      lastSync: lastSync
        ? {
            createdAt: lastSync.createdAt,
            recordsProcessed: lastSync.recordsProcessed,
            durationMs: lastSync.durationMs,
          }
        : null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}
