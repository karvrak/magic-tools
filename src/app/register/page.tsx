'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Scroll, Sparkles, Lock, Mail, Shield, UserPlus } from 'lucide-react'
import { DiceLoaderInline } from '@/components/ui/dice-loader'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, confirmPassword }),
      })

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/')
          router.refresh()
        }, 1500)
      } else {
        const data = await res.json()
        setError(data.error || 'Registration failed. Please try again.')
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

        <motion.div
          className="absolute top-20 left-20 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div
          className="absolute top-20 right-20 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        />

        <div className="absolute bottom-0 left-1/4 w-1/2 h-64 bg-gradient-to-t from-arcane-600/10 to-transparent blur-2xl" />
      </div>

      {/* Register Card */}
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
                '0 0 20px rgba(168, 85, 247, 0.3)',
                '0 0 40px rgba(168, 85, 247, 0.5)',
                '0 0 20px rgba(168, 85, 247, 0.3)',
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-arcane-500 to-arcane-700 flex items-center justify-center border-4 border-dungeon-800">
              <UserPlus className="w-5 h-5 text-white" />
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
              Join the Guild
            </h1>
            <p className="text-parchment-400 text-sm font-body">
              Register your name in the Arcane Registry
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
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters..."
                required
                disabled={loading || success}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="flex items-center gap-2 text-parchment-300">
                <Lock className="w-4 h-4 text-gold-500" />
                <span className="font-medieval">Confirm Passphrase</span>
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your passphrase..."
                required
                disabled={loading || success}
              />
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
                  <span className="font-medieval text-nature-400">Success!</span> Welcome to the guild...
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit button */}
            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={loading || !email || !password || !confirmPassword || success}
            >
              {loading ? (
                <span className="flex items-center gap-3">
                  <DiceLoaderInline className="text-dungeon-900" />
                  Inscribing the runes...
                </span>
              ) : success ? (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                  Welcome, New Adventurer!
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Create Account
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

          {/* Login link */}
          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-gold-500 hover:text-gold-400 transition-colors font-medieval"
            >
              Already a member? Sign in
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
