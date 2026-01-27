'use client'

import * as React from 'react'
import * as ToastPrimitives from '@radix-ui/react-toast'
import { cva, type VariantProps } from 'class-variance-authority'
import { X, Scroll, Skull, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]',
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  [
    'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-lg p-4 pr-8 shadow-dungeon',
    'border-2',
    'transition-all duration-300',
    'data-[swipe=cancel]:translate-x-0',
    'data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]',
    'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
    'data-[swipe=move]:transition-none',
    'data-[state=open]:animate-seal-break',
    'data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-80',
    'data-[state=closed]:slide-out-to-right-full',
  ].join(' '),
  {
    variants: {
      variant: {
        // Default - Guild Message (parchment style)
        default: [
          'bg-gradient-to-r from-dungeon-800 to-dungeon-800/95',
          'border-gold-700/50',
          'text-parchment-200',
          'shadow-[0_4px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(212,164,24,0.1)]',
        ],
        // Destructive - Dragon's Warning
        destructive: [
          'bg-gradient-to-r from-dragon-900 to-dragon-900/95',
          'border-dragon-600/60',
          'text-dragon-100',
          'shadow-[0_4px_20px_rgba(220,38,38,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]',
        ],
        // Success - Quest Complete
        success: [
          'bg-gradient-to-r from-nature-900 to-nature-900/95',
          'border-nature-600/60',
          'text-nature-100',
          'shadow-[0_4px_20px_rgba(34,197,94,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]',
        ],
        // Warning - Caution Ahead
        warning: [
          'bg-gradient-to-r from-amber-900 to-amber-900/95',
          'border-amber-600/60',
          'text-amber-100',
          'shadow-[0_4px_20px_rgba(245,158,11,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]',
        ],
        // Info - Sage's Knowledge
        info: [
          'bg-gradient-to-r from-arcane-900 to-arcane-900/95',
          'border-arcane-600/60',
          'text-arcane-100',
          'shadow-[0_4px_20px_rgba(123,44,191,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]',
        ],
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const variantIcons: Record<string, React.ReactNode> = {
  default: <Scroll className="w-5 h-5 text-gold-500" />,
  destructive: <Skull className="w-5 h-5 text-dragon-400" />,
  success: <CheckCircle2 className="w-5 h-5 text-nature-400" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
  info: <Info className="w-5 h-5 text-arcane-400" />,
}

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant = 'default', children, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      {/* Decorative seal/wax effect */}
      <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gradient-to-br from-gold-500 to-gold-700 shadow-lg opacity-80" />
      
      {/* Icon */}
      <div className="flex-shrink-0">
        {variantIcons[variant || 'default']}
      </div>
      
      {/* Content */}
      <div className="flex-1 ml-1">
        {children}
      </div>
      
      {/* Decorative corner runes */}
      <span className="absolute top-1 right-8 text-[8px] text-gold-600/30 font-medieval">ᚠ</span>
      <span className="absolute bottom-1 left-6 text-[8px] text-gold-600/30 font-medieval">ᚱ</span>
    </ToastPrimitives.Root>
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      'inline-flex h-8 shrink-0 items-center justify-center rounded-md',
      'border border-gold-600/60 bg-gold-600/10',
      'px-3 text-sm font-medieval text-gold-400',
      'ring-offset-background transition-all duration-200',
      'hover:bg-gold-600/20 hover:text-gold-300',
      'focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'absolute right-2 top-2 rounded-md p-1',
      'text-parchment-500 opacity-0',
      'transition-all duration-200',
      'hover:text-parchment-200 hover:bg-dungeon-700/50',
      'focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-gold-500/50',
      'group-hover:opacity-100',
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn(
      'text-sm font-medieval font-semibold tracking-wide',
      className
    )}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('text-sm opacity-90 font-body', className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
