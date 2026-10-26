import { useEffect } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Keeps keyboard focus inside a dialog, restores it on close, locks Escape. */
export function useFocusTrap(
  ref: React.RefObject<HTMLElement>,
  active: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!active) return
    const node = ref.current
    if (!node) return
    const previous = document.activeElement as HTMLElement | null

    const focusFirst = () => {
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
      const target = items.find((item) => item.offsetParent !== null) ?? node
      target.focus({ preventScroll: true })
    }
    const timer = window.setTimeout(focusFirst, 40)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (item) => item.offsetParent !== null,
      )
      if (!items.length) {
        e.preventDefault()
        node.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      node.removeEventListener('keydown', onKeyDown)
      previous?.focus?.({ preventScroll: true })
    }
  }, [active, onClose, ref])
}

export function useBodyLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [locked])
}
