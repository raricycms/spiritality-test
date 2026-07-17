/**
 * useKeyboard — listens for digit / Enter / Esc / arrow keys globally.
 *
 * Forwards a single keyCode-equivalent event to onAction. Disabled when the
 * active element is a form input.
 */

import { useEffect } from 'react'

export function useKeyboard(handler) {
  useEffect(() => {
    function onKey(e) {
      const tag = (e.target && e.target.tagName) || ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) {
        return
      }
      const key = e.key
      if (/^[1-5]$/.test(key)) {
        e.preventDefault()
        handler({ type: 'digit', value: parseInt(key, 10), event: e })
      } else if (key === 'Enter') {
        e.preventDefault()
        handler({ type: 'enter', event: e })
      } else if (key === 'Backspace' || key === 'Escape') {
        handler({ type: 'clear', event: e })
      } else if (key === 'ArrowRight' || key === ' ') {
        handler({ type: 'next', event: e })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handler])
}
