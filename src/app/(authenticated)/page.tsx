import { Suspense } from 'react'
import { SearchPage } from '@/components/search/search-page'

export default function HomePage() {
  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <SearchPage />
    </Suspense>
  )
}

function SearchPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Search bar skeleton */}
      <div className="card-frame p-4">
        <div className="skeleton h-10 w-full rounded-md" />
      </div>

      {/* Filters skeleton */}
      <div className="card-frame p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-10 rounded-md" />
          ))}
        </div>
      </div>

      {/* Results skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="skeleton aspect-[488/680] rounded-lg" />
        ))}
      </div>
    </div>
  )
}
