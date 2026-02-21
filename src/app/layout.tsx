import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/toaster'
import { QueryProvider } from '@/components/providers/query-provider'
import { UserPreferencesProvider } from '@/contexts/user-preferences'
import { ActiveOwnerProvider } from '@/contexts/active-owner'
import { QuickAddProvider } from '@/contexts/quick-add'
import './globals.css'

export const metadata: Metadata = {
  title: 'magicTools - Your MTG Companion',
  description: 'Search cards, build decks, manage your collection. Powered by Scryfall.',
  manifest: '/manifest.json',
  themeColor: '#D4AF37',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'magicTools',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192x192.png',
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
