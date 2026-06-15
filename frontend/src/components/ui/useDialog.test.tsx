import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDialog } from './useDialog'

function TestDialog({ onClose }: { onClose: () => void }) {
  const ref = useDialog<HTMLDivElement>(onClose)
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Test" tabIndex={-1}>
      <button>İlk</button>
      <button onClick={onClose}>Kapat</button>
    </div>
  )
}

describe('useDialog', () => {
  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<TestDialog onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('moves focus into the dialog on open', () => {
    const onClose = vi.fn()
    render(<TestDialog onClose={onClose} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('restores focus to the trigger on close', () => {
    const onClose = vi.fn()
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    const { unmount } = render(<TestDialog onClose={onClose} />)
    unmount()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
})
