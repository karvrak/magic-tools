import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/toaster'
import { QueryProvider } from '@/components/providers/query-provider'
import { UserPreferencesProvider } from '@/contexts/user-preferences'
import { ActiveOwnerProvider } from '@/contexts/active-owner'
import { QuickAddProvider } from '@/contexts/quick-add'
import './globals.css'

export const metadata: Metadata = {
  title: 'magicTools - Your MTG Companion',
  description: 'Search cards, build decks, manage your wantlist. Powered by Scryfall.',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <QueryProvider>
          <UserPreferencesProvider>
            <ActiveOwnerProvider>
              <QuickAddProvider>
                {children}
                <Toaster />
              </QuickAddProvider>
            </ActiveOwnerProvider>
          </UserPreferencesProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
