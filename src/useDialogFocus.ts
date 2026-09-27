import { useEffect, useRef } from 'react'

const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useDialogFocus(open: boolean, selector: string) {
  const selectorRef = useRef(selector)
  selectorRef.current = selector

  useEffect(() => {
    if (!open) return
    const dialog = document.querySelector<HTMLElement>(selectorRef.current)
    if (!dialog) return
    const target = dialog
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusable = () => Array.from(target.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => element.getClientRects().length > 0)
    ;(focusable()[0] || target).focus()

    function trapFocus(event: KeyboardEvent) {
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) { event.preventDefault(); target.focus(); return }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || !target.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !target.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    target.addEventListener('keydown', trapFocus)
    return () => {
      target.removeEventListener('keydown', trapFocus)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [open])

}
