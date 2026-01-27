import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // D&D Campaign Color Palette
        parchment: {
          50: '#fefdfb',
          100: '#fdf9f0',
          200: '#f9f0dc',
          300: '#f3e4c3',
          400: '#e8d4a4',
          500: '#d4b896',
          600: '#b89b78',
          700: '#8b7355',
          800: '#5c4d3d',
          900: '#3d3228',
        },
        dragon: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#dc2626',
          600: '#b91c1c',
          700: '#991b1b',
          800: '#7f1d1d',
          900: '#450a0a',
        },
        dungeon: {
          50: '#f8fafc',
          100: '#e2e8f0',
          200: '#cbd5e1',
          300: '#94a3b8',
          400: '#64748b',
          500: '#475569',
          600: '#334155',
          700: '#1e293b',
          800: '#0f172a',
          900: '#020617',
          950: '#010409',
        },
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#d4a418',
          600: '#b8860b',
          700: '#92400e',
          800: '#78350f',
          900: '#451a03',
        },
        arcane: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7b2cbf',
          800: '#6b21a8',
          900: '#581c87',
        },
        nature: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // MTG Mana colors
        mana: {
          white: '#f9fafb',
          blue: '#3b82f6',
          black: '#1f2937',
          red: '#ef4444',
          green: '#22c55e',
          colorless: '#9ca3af',
          multi: '#d4a418',
        },
        // Shadcn compatibility
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        display: ['Cinzel Decorative', 'Cinzel', 'serif'],
        medieval: ['Cinzel', 'serif'],
        body: ['Crimson Pro', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        // D&D Scale - more dramatic
        'quest-title': ['clamp(2rem, 5vw, 3.5rem)', { lineHeight: '1.1', letterSpacing: '0.05em' }],
        'section-header': ['clamp(1.25rem, 3vw, 1.75rem)', { lineHeight: '1.2', letterSpacing: '0.02em' }],
      },
      backgroundImage: {
        'parchment-texture': "url('/textures/parchment-pattern.svg')",
        'stone-texture': "url('/textures/stone-pattern.svg')",
        'rune-border': "url('/textures/rune-border.svg')",
        'dragon-gradient': 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 50%, #991b1b 100%)',
        'dungeon-gradient': 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
        'gold-shimmer': 'linear-gradient(90deg, #b8860b 0%, #fcd34d 25%, #d4a418 50%, #fcd34d 75%, #b8860b 100%)',
        'arcane-gradient': 'linear-gradient(135deg, #581c87 0%, #7b2cbf 50%, #a855f7 100%)',
        'torch-gradient': 'radial-gradient(ellipse at center, #FF6B35 0%, #E85D04 40%, transparent 70%)',
      },
      boxShadow: {
        'inner-glow': 'inset 0 0 20px rgba(212, 164, 24, 0.3)',
        'inner-glow-arcane': 'inset 0 0 20px rgba(123, 44, 191, 0.3)',
        'card-hover': '0 0 30px rgba(212, 164, 24, 0.4), 0 10px 40px rgba(0, 0, 0, 0.3)',
        'dungeon': '0 4px 20px rgba(0, 0, 0, 0.5)',
        'parchment': 'inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 4px rgba(0,0,0,0.2)',
        'embossed': 'inset 0 2px 4px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.2)',
        'magic-glow': '0 0 20px rgba(212, 164, 24, 0.4), 0 0 40px rgba(212, 164, 24, 0.2)',
        'arcane-glow': '0 0 20px rgba(123, 44, 191, 0.4), 0 0 40px rgba(123, 44, 191, 0.2)',
        'fire-glow': '0 0 20px rgba(232, 93, 4, 0.4), 0 0 40px rgba(232, 93, 4, 0.2)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        'parchment': '2px 8px 2px 8px',
      },
      animation: {
        'shimmer': 'shimmer 3s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'torch-flicker': 'torch-flicker 0.5s ease-in-out infinite',
        'rune-glow': 'rune-glow 1.5s ease-in-out infinite',
        'page-turn': 'page-turn 0.6s ease-out forwards',
        'seal-break': 'seal-break 0.4s ease-out forwards',
        'dice-roll': 'dice-roll 1s ease-out',
        'arcane-spin': 'arcane-spin 2s linear infinite',
        'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(212, 164, 24, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(212, 164, 24, 0.6)' },
        },
        'glow-pulse': {
          '0%, 100%': { 
            boxShadow: '0 0 5px rgba(212, 164, 24, 0.3)',
            filter: 'brightness(1)',
          },
          '50%': { 
            boxShadow: '0 0 25px rgba(212, 164, 24, 0.6)',
            filter: 'brightness(1.1)',
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'torch-flicker': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '25%': { opacity: '0.9', filter: 'brightness(0.95)' },
          '50%': { opacity: '0.85', filter: 'brightness(0.9)' },
          '75%': { opacity: '0.95', filter: 'brightness(1.05)' },
        },
        'rune-glow': {
          '0%, 100%': { 
            opacity: '0.3',
            textShadow: '0 0 5px transparent',
          },
          '50%': { 
            opacity: '1',
            textShadow: '0 0 20px rgba(212, 164, 24, 0.8)',
          },
        },
        'page-turn': {
          '0%': { 
            transform: 'perspective(1000px) rotateY(-90deg)',
            opacity: '0',
          },
          '100%': { 
            transform: 'perspective(1000px) rotateY(0)',
            opacity: '1',
          },
        },
        'seal-break': {
          '0%': { transform: 'scale(1.3)', opacity: '0' },
          '50%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'dice-roll': {
          '0%': { 
            transform: 'rotate(0deg) scale(0.5)',
            opacity: '0',
          },
          '50%': { transform: 'rotate(360deg) scale(1.2)' },
          '100%': { 
            transform: 'rotate(720deg) scale(1)',
            opacity: '1',
          },
        },
        'arcane-spin': {
          '0%': { transform: 'rotate(0deg)', filter: 'hue-rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)', filter: 'hue-rotate(360deg)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth-out': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
