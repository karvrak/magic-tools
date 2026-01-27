import { NextResponse } from 'next/server'
import { initCronJobs, isCronInitialized } from '@/lib/cron'

// This endpoint initializes the cron jobs
// It should be called once when the server starts
// In production, you might want to call this from a startup script

export async function GET() {
  try {
    if (isCronInitialized()) {
      return NextResponse.json({
        message: 'Cron jobs already initialized',
        initialized: true,
      })
    }

    initCronJobs()

    return NextResponse.json({
      message: 'Cron jobs initialized successfully',
      initialized: true,
      schedule: {
        prices: 'Daily at 10:00 AM (Europe/Paris)',
        cards: 'Sunday at 3:00 AM (Europe/Paris)',
      },
    })
  } catch (error) {
    console.error('Failed to initialize cron jobs:', error)
    return NextResponse.json(
      {
        error: 'Failed to initialize cron jobs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
