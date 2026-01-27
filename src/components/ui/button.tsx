'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-dungeon-900 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary - Golden Seal Button
        default: [
          'relative overflow-hidden font-medieval tracking-wide',
          'bg-gradient-to-b from-gold-500 via-gold-600 to-gold-700',
          'text-dungeon-900 font-semibold',
          'border border-gold-800/50',
          'shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.3)]',
          'hover:from-gold-400 hover:via-gold-500 hover:to-gold-600',
          'hover:shadow-[0_4px_12px_rgba(212,164,24,0.4),inset_0_1px_0_rgba(255,255,255,0.4)]',
          'active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]',
        ],
        // Destructive - Dragon Fire
        destructive: [
          'relative overflow-hidden font-medieval',
          'bg-gradient-to-b from-dragon-600 via-dragon-700 to-dragon-800',
          'text-white font-semibold',
          'border border-dragon-900/50',
          'shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]',
          'hover:from-dragon-500 hover:via-dragon-600 hover:to-dragon-700',
          'hover:shadow-[0_4px_12px_rgba(220,38,38,0.4)]',
        ],
        // Outline - Etched Border
        outline: [
          'border-2 border-gold-600/60 bg-transparent',
          'text-gold-400 font-medieval',
          'hover:bg-gold-600/10 hover:border-gold-500',
          'hover:text-gold-300 hover:shadow-[0_0_15px_rgba(212,164,24,0.2)]',
        ],
        // Secondary - Stone Button
        secondary: [
          'bg-gradient-to-b from-dungeon-600 to-dungeon-700',
          'text-parchment-200',
          'border border-dungeon-500/50',
          'shadow-[0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]',
          'hover:from-dungeon-500 hover:to-dungeon-600',
          'hover:text-parchment-100',
        ],
        // Ghost - Ethereal
        ghost: [
          'text-parchment-300',
          'hover:bg-dungeon-700/50 hover:text-parchment-100',
          'hover:shadow-[inset_0_0_20px_rgba(212,164,24,0.05)]',
        ],
        // Link - Magical Text
        link: [
          'text-gold-400 underline-offset-4',
          'hover:underline hover:text-gold-300',
          'hover:drop-shadow-[0_0_8px_rgba(212,164,24,0.4)]',
        ],
        // Arcane - Purple Magic
        arcane: [
          'relative overflow-hidden font-medieval',
          'bg-gradient-to-b from-arcane-600 via-arcane-700 to-arcane-800',
          'text-white font-semibold',
          'border border-arcane-900/50',
          'shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]',
          'hover:from-arcane-500 hover:via-arcane-600 hover:to-arcane-700',
          'hover:shadow-[0_4px_12px_rgba(123,44,191,0.4)]',
        ],
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-md px-8 text-base',
        xl: 'h-14 rounded-lg px-10 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {/* Shimmer effect for primary/arcane buttons */}
        {(variant === 'default' || variant === 'arcane' || variant === 'destructive') && (
          <span 
            className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
              transform: 'translateX(-100%)',
              animation: 'none',
            }}
          />
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

// Animated Button with Framer Motion
interface AnimatedButtonProps extends Omit<HTMLMotionProps<"button">, 'ref'>, VariantProps<typeof buttonVariants> {}

const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ className, variant, size, children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        {...props}
      >
        {children}
      </motion.button>
    )
  }
)
AnimatedButton.displayName = 'AnimatedButton'

// Parchment Button - Special D&D style
interface ParchmentButtonProps extends ButtonProps {
  corners?: boolean
}

const ParchmentButton = React.forwardRef<HTMLButtonElement, ParchmentButtonProps>(
  ({ className, children, corners = true, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'relative px-6 py-3 font-medieval tracking-wide text-amber-950',
          'bg-gradient-to-b from-amber-100 via-amber-200 to-amber-300',
          'border-2 border-amber-600/60 rounded-sm',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_2px_4px_rgba(0,0,0,0.2)]',
          'hover:from-amber-50 hover:via-amber-100 hover:to-amber-200',
          'hover:shadow-[0_0_15px_rgba(212,164,24,0.3)]',
          'active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]',
          'transition-all duration-300',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      >
        {/* Corner rivets */}
        {corners && (
          <>
            <span className="absolute top-1.5 left-1.5 w-2 h-2 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full shadow-inner" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full shadow-inner" />
            <span className="absolute bottom-1.5 left-1.5 w-2 h-2 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full shadow-inner" />
            <span className="absolute bottom-1.5 right-1.5 w-2 h-2 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full shadow-inner" />
          </>
        )}
        <span className="relative z-10">{children}</span>
      </button>
    )
  }
)
ParchmentButton.displayName = 'ParchmentButton'

export { Button, AnimatedButton, ParchmentButton, buttonVariants }
