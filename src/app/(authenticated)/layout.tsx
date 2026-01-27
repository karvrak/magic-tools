import { redirect } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import { Header } from '@/components/layout/header'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const authenticated = await isAuthenticated()

  if (!authenticated) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
      
      {/* Footer - Guild Credits */}
      <footer className="border-t border-gold-700/20 py-6 bg-dungeon-900/50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Decorative runes */}
            <div className="flex items-center gap-2 text-gold-600/30 text-sm">
              <span>ᚠ</span>
              <span>◆</span>
              <span>ᚢ</span>
              <span>◆</span>
              <span>ᚦ</span>
            </div>
            
            {/* Credits */}
            <p className="text-center text-sm text-dungeon-400 font-body">
              Powered by{' '}
              <a
                href="https://scryfall.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold-500 hover:text-gold-400 transition-colors"
              >
                Scryfall
              </a>
              {' '}• Forged by{' '}
              <span className="font-medieval text-gold-600">magicTools</span>
              {' '}© {new Date().getFullYear()}
            </p>
            
            {/* Decorative runes */}
            <div className="flex items-center gap-2 text-gold-600/30 text-sm">
              <span>ᚨ</span>
              <span>◆</span>
              <span>ᚱ</span>
              <span>◆</span>
              <span>ᚲ</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
