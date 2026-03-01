'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Swords, Shield, Scroll, Sparkles, Lock, Mail } from 'lucide-react'
import { DiceLoaderInline } from '@/components/ui/dice-loader'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/')
          router.refresh()
        }, 1500)
      } else {
        setError('The ancient seal rejects your credentials. Try again, adventurer.')
      }
    } catch {
      setError('The magical connection has been severed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Animated background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Arcane circles */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-arcane-600/20"
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-gold-600/20"
          animate={{ rotate: -360 }}
          transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-arcane-600/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />

        {/* Floating runes */}
        {['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ'].map((rune, i) => (
          <motion.span
            key={i}
            className="absolute text-2xl text-gold-600/30"
            style={{
              top: `${15 + (i * 10)}%`,
              left: `${10 + (i % 4) * 25}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.2, 0.5, 0.2],
              textShadow: [
                '0 0 10px transparent',
                '0 0 20px rgba(212, 164, 24, 0.5)',
                '0 0 10px transparent',
              ],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.3,
            }}
          >
            {rune}
          </motion.span>
        ))}

        {/* Torch glows */}
        <motion.div
          className="absolute top-20 left-20 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div
          className="absolute top-20 right-20 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        />

        {/* Arcane glow at bottom */}
        <div className="absolute bottom-0 left-1/4 w-1/2 h-64 bg-gradient-to-t from-arcane-600/10 to-transparent blur-2xl" />
      </div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="card-frame-ornate p-8">
          {/* Magical seal at top */}
          <motion.div
            className="absolute -top-6 left-1/2 -translate-x-1/2"
            animate={{
              boxShadow: [
                '0 0 20px rgba(212, 164, 24, 0.3)',
                '0 0 40px rgba(212, 164, 24, 0.5)',
                '0 0 20px rgba(212, 164, 24, 0.3)',
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center border-4 border-dungeon-800">
              <Lock className="w-5 h-5 text-dungeon-900" />
            </div>
          </motion.div>

          {/* Header */}
          <div className="text-center mb-8 pt-4">
            <motion.div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-gold-500 via-gold-600 to-gold-700 mb-4 shadow-lg"
              animate={{
                boxShadow: [
                  '0 0 20px rgba(212, 164, 24, 0.3)',
                  '0 0 40px rgba(212, 164, 24, 0.5)',
                  '0 0 20px rgba(212, 164, 24, 0.3)',
                ]
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Scroll className="w-10 h-10 text-dungeon-900" />
            </motion.div>

            <h1 className="font-display text-3xl text-gold-400 mb-2 text-glow">
              magicTools
            </h1>
            <p className="text-parchment-400 text-sm font-body">
              Speak the ancient words to enter the Arcane Library
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2 text-parchment-300">
                <Mail className="w-4 h-4 text-gold-500" />
                <span className="font-medieval">Arcane Address</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mage@arcane-library.com"
                required
                autoFocus
                disabled={loading || success}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2 text-parchment-300">
                <Shield className="w-4 h-4 text-gold-500" />
                <span className="font-medieval">Secret Passphrase</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Whisper the ancient words..."
                  required
                  disabled={loading || success}
                  className="pr-10"
                />
                <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dungeon-500" />
              </div>
            </div>

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 rounded-md bg-dragon-900/50 border border-dragon-700 text-dragon-300 text-sm font-body">
                    <span className="font-medieval text-dragon-400">Failed!</span> {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success message */}
            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3 rounded-md bg-nature-900/50 border border-nature-700 text-nature-300 text-sm font-body text-center"
                >
                  <span className="font-medieval text-nature-400">Success!</span> The gates are opening...
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit button */}
            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={loading || !email || !password || success}
            >
              {loading ? (
                <span className="flex items-center gap-3">
                  <DiceLoaderInline className="text-dungeon-900" />
                  Consulting the oracles...
                </span>
              ) : success ? (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                  Welcome, Adventurer!
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Swords className="w-5 h-5" />
                  Enter the Dungeon
                </span>
              )}
            </Button>
          </form>

          {/* Decorative divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dungeon-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-dungeon-800 px-4 text-dungeon-500 font-medieval">
                or
              </span>
            </div>
          </div>

          {/* Register link */}
          <div className="text-center">
            <Link
              href="/register"
              className="text-sm text-gold-500 hover:text-gold-400 transition-colors font-medieval"
            >
              New here? Create an account
            </Link>
          </div>

          {/* Footer */}
          <div className="text-center mt-6">
            <p className="text-xs text-dungeon-500 font-body">
              Powered by{' '}
              <a
                href="https://scryfall.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold-600 hover:text-gold-500 transition-colors"
              >
                Scryfall
              </a>
              {' '}• Forged for adventurers
            </p>
          </div>
        </div>

        {/* Bottom decorative element */}
        <motion.div
          className="flex justify-center mt-6 gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {['ᚠ', '◇', 'ᚢ', '◇', 'ᚦ', '◇', 'ᚨ', '◇', 'ᚱ'].map((char, i) => (
            <motion.span
              key={i}
              className="text-gold-600/30 text-sm"
              animate={{
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            >
              {char}
            </motion.span>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}
