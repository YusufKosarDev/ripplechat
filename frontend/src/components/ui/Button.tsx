import type { ButtonHTMLAttributes } from 'react'
import { focusRing } from './focusRing'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

// Variants map onto the Tur 2 design tokens (brand / surface / control / danger).
const variantClass: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover',
  secondary: 'border border-control text-fg-muted hover:border-control-hover hover:text-fg',
  ghost: 'text-fg-muted hover:bg-surface-muted hover:text-fg',
  danger: 'border border-red-500/50 text-danger hover:bg-red-500/10',
}

const sizeClass: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

// Defaults to type="button" so a Button inside a <form> never submits by
// accident — pass type="submit" explicitly for the form's submit action.
export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:pointer-events-none disabled:opacity-60 ${focusRing} ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...props}
    />
  )
}
