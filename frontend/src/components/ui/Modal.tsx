import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './Modal.css'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Accessible description id, when the body opens with a summary paragraph. */
  describedBy?: string
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/**
 * The project's first dialog primitive. Everything that needed one until now
 * used window.confirm (5 call sites) or inline <details>, so this is deliberately
 * generic rather than About-specific.
 *
 * Behaviour: Esc and backdrop click close it; focus moves in on open and returns
 * to the trigger on close; Tab is trapped inside; background scroll is locked.
 */
export default function Modal({ open, onClose, title, children, describedBy }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null

    // Lock background scroll without shifting the layout when a scrollbar exists.
    const { overflow, paddingRight } = document.body.style
    const gap = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (gap > 0) document.body.style.paddingRight = `${gap}px`

    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return

      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      )
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault()
        lastItem.focus()
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
      previouslyFocused.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={describedBy}
        ref={panelRef}
        tabIndex={-1}
      >
        <header className="modal-header">
          <h2 id="modal-title" className="modal-title">{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
