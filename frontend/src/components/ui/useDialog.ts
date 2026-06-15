import { useEffect, useRef } from 'react'

/**
 * Accessible modal-dialog behavior for a panel element:
 * - moves focus into the panel on open (first focusable, else the panel itself),
 * - traps Tab within the panel,
 * - closes on Escape,
 * - restores focus to the previously focused element on unmount.
 *
 * Attach the returned ref to the dialog panel and give it role="dialog",
 * aria-modal="true", an accessible name, and tabIndex={-1}.
 */
export function useDialog<T extends HTMLElement>(onClose: () => void) {
  const panelRef = useRef<T>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current

    const focusable = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => el.offsetParent !== null || el === panel)
        : []

    // Respect an autoFocus'd field that already grabbed focus; otherwise focus
    // the first focusable (or the panel itself).
    if (!panel || !panel.contains(document.activeElement)) {
      ;(focusable()[0] ?? panel)?.focus()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key === 'Tab' && panel) {
        const items = focusable()
        if (items.length === 0) {
          e.preventDefault()
          panel.focus()
          return
        }
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || active === panel)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      previouslyFocused?.focus?.()
    }
  }, [])

  return panelRef
}
