import { useEffect, useRef } from 'react'

// Test paytida talaba boshqa yorliq, oyna yoki ilovaga o'tsa, onViolation(sabab) chaqiriladi.
// enabled=false bo'lsa (masalan, blok paytida) kuzatuv to'xtaydi; qayta yoqilganda 2 soniya "imtiyoz" bor.
export function useFocusGuard({ enabled, onViolation }) {
  const callback = useRef(onViolation)
  callback.current = onViolation

  useEffect(() => {
    if (!enabled) return undefined
    const armedAt = Date.now() + 2000
    let blurTimer = null

    const fire = (reason) => {
      if (Date.now() < armedAt) return
      callback.current(reason)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') fire('tab_hidden')
    }
    // Oyna fokusini yo'qotsa (boshqa oynaga o'tish). Qisqa fokus yo'qolishlar e'tiborga olinmasligi uchun 0.8 s kutamiz.
    const onBlur = () => {
      clearTimeout(blurTimer)
      blurTimer = setTimeout(() => {
        if (!document.hasFocus()) fire('window_blur')
      }, 800)
    }
    const onFocus = () => clearTimeout(blurTimer)

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      clearTimeout(blurTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled])
}
