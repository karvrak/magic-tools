'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function WantlistPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to collection page with wanted filter
    router.replace('/collection?filter=wanted')
  }, [router])

  return null
}
