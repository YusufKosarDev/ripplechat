import { forwardRef } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

type Size = 'sm' | 'md'

// Token-based field styling. Visible focus: accent border + soft accent ring.
// Uses `focus:` (not focus-visible) since text fields should show focus on
// click too. `inputSize` avoids clashing with the native HTML `size` attribute.
// forwardRef so callers can focus()/measure the element (e.g. the composer).
const fieldBase =
  'w-full rounded-lg border border-control bg-surface text-sm text-fg transition placeholder:text-fg-faint outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'

const fieldSize: Record<Size, string> = {
  sm: 'px-2.5 py-1',
  md: 'px-3 py-2',
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputSize?: Size
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ inputSize = 'md', className = '', ...props }, ref) => (
    <input ref={ref} className={`${fieldBase} ${fieldSize[inputSize]} ${className}`} {...props} />
  ),
)
Input.displayName = 'Input'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  inputSize?: Size
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ inputSize = 'md', className = '', ...props }, ref) => (
    <textarea ref={ref} className={`${fieldBase} resize-none ${fieldSize[inputSize]} ${className}`} {...props} />
  ),
)
Textarea.displayName = 'Textarea'
