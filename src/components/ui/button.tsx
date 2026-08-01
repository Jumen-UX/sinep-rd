import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'border border-[var(--primary)] bg-[var(--primary)] text-white shadow-[var(--shadow-sm)] hover:border-[var(--primary-hover)] hover:bg-[var(--primary-hover)]',
        secondary:
          'border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)] hover:bg-[var(--surface-subtle)]',
        outline:
          'border border-[var(--border-strong)] bg-transparent text-[var(--text)] hover:bg-[var(--surface-subtle)]',
        ghost:
          'border border-transparent text-[var(--text)] hover:bg-[var(--surface-muted)]',
        destructive:
          'border border-[var(--danger)] bg-[var(--danger)] text-white hover:brightness-95',
        link:
          'h-auto rounded-none p-0 text-[var(--primary)] underline-offset-4 hover:underline active:translate-y-0',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-9 px-4 text-xs',
        lg: 'h-12 px-7 text-base',
        icon: 'size-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
    loadingLabel?: string
  }

function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  disabled,
  loading = false,
  loadingLabel = 'Procesando…',
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  const isNativeButton = !asChild

  return (
    <Comp
      data-slot="button"
      data-loading={loading ? 'true' : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      type={isNativeButton ? (type ?? 'button') : undefined}
      disabled={isNativeButton ? (disabled || loading) : undefined}
      aria-busy={loading || undefined}
      aria-disabled={!isNativeButton && (disabled || loading) ? true : undefined}
      {...props}
    >
      {loading && isNativeButton ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
        />
      ) : null}
      {loading && isNativeButton ? loadingLabel : children}
    </Comp>
  )
}

export { Button, buttonVariants, type ButtonProps }
