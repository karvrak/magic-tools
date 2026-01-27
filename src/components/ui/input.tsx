'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'parchment'
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = 'default', ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false)

    if (variant === 'parchment') {
      return (
        <div className="relative">
          <input
            type={type}
            className={cn(
              'flex h-11 w-full rounded-sm px-4 py-2 text-sm',
              'bg-gradient-to-b from-amber-50 to-amber-100',
              'border-2 border-amber-700/40',
              'text-amber-950 placeholder:text-amber-700/50',
              'shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]',
              'focus:outline-none focus:border-amber-600',
              'focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),0_0_10px_rgba(212,164,24,0.3)]',
              'transition-all duration-300',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'font-body',
              className
            )}
            ref={ref}
            onFocus={(e) => {
              setIsFocused(true)
              props.onFocus?.(e)
            }}
            onBlur={(e) => {
              setIsFocused(false)
              props.onBlur?.(e)
            }}
            {...props}
          />
          {/* Ink well effect on focus */}
          {isFocused && (
            <motion.div
              className="absolute bottom-0 left-1/2 h-0.5 bg-amber-600 rounded-full"
              initial={{ width: 0, x: '-50%' }}
              animate={{ width: '80%' }}
              transition={{ duration: 0.3 }}
            />
          )}
        </div>
      )
    }

    return (
      <div className="relative group">
        <input
          type={type}
          className={cn(
            'flex h-11 w-full rounded-md px-4 py-2 text-sm',
            'bg-dungeon-800/80 backdrop-blur-sm',
            'border-2 border-dungeon-600',
            'text-parchment-200 placeholder:text-dungeon-400',
            'ring-offset-background',
            'focus:outline-none focus:border-gold-600',
            'focus:shadow-[0_0_15px_rgba(212,164,24,0.2),inset_0_0_20px_rgba(212,164,24,0.05)]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-all duration-300',
            'font-body',
            className
          )}
          ref={ref}
          onFocus={(e) => {
            setIsFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setIsFocused(false)
            props.onBlur?.(e)
          }}
          {...props}
        />
        {/* Magical glow on focus */}
        <div className={cn(
          'absolute inset-0 rounded-md pointer-events-none transition-opacity duration-300',
          'bg-gradient-to-r from-transparent via-gold-500/5 to-transparent',
          isFocused ? 'opacity-100' : 'opacity-0'
        )} />
        {/* Corner runes that appear on focus */}
        <motion.span
          className="absolute top-1 left-1 text-[8px] text-gold-600/0 font-medieval"
          animate={{ 
            opacity: isFocused ? 1 : 0,
            color: isFocused ? 'rgba(212, 164, 24, 0.4)' : 'rgba(212, 164, 24, 0)'
          }}
        >
          ᚠ
        </motion.span>
        <motion.span
          className="absolute top-1 right-1 text-[8px] text-gold-600/0 font-medieval"
          animate={{ 
            opacity: isFocused ? 1 : 0,
            color: isFocused ? 'rgba(212, 164, 24, 0.4)' : 'rgba(212, 164, 24, 0)'
          }}
        >
          ᚱ
        </motion.span>
      </div>
    )
  }
)
Input.displayName = 'Input'

// Search Input with integrated icon
interface SearchInputProps extends Omit<InputProps, 'type'> {
  icon?: React.ReactNode
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-dungeon-400 pointer-events-none">
            {icon}
          </div>
        )}
        <Input
          ref={ref}
          type="search"
          className={cn(icon && 'pl-10', className)}
          {...props}
        />
      </div>
    )
  }
)
SearchInput.displayName = 'SearchInput'

export { Input, SearchInput }
