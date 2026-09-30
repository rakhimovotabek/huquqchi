import { useEffect, useRef } from 'react'

// Chap / o'ng strelka tugmalari bilan savollar orasida yurish.
// Matn yozilayotgan maydonlarda (textarea, matn kiritish) ishlamaydi,
// chunki u yerda strelkalar kursorni siljitadi.
export function useArrowKeys({ onLeft, onRight, enabled = true }) {
  const handlers = useRef({ onLeft, onRight })
  handlers.current = { onLeft, onRight }

  useEffect(() => {
    if (!enabled) return
    function onKeyDown(e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const el = e.target
      const tag = el?.tagName
      const isTextField =
        tag === 'TEXTAREA' ||
        el?.isContentEditable ||
        (tag === 'INPUT' && !['radio', 'checkbox', 'button', 'submit'].includes(el.type))
      if (isTextField) return
      // Radio tugmalarda strelka variantni o'zgartirib yubormasligi uchun
      e.preventDefault()
      if (e.key === 'ArrowLeft') handlers.current.onLeft?.()
      else handlers.current.onRight?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
