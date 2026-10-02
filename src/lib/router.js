import { useEffect, useState } from 'react'

// Juda oddiy "router": har bir bo'lim o'z manziliga ega (/talabalar, /natijalar ...),
// shuning uchun sahifa yangilansa ham foydalanuvchi o'sha bo'limda qoladi.

export function navigate(path, { replace = false } = {}) {
  if (window.location.pathname === path) return
  window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function usePath() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const onChange = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onChange)
    return () => window.removeEventListener('popstate', onChange)
  }, [])
  return path
}

// tabs: [{ key, path, label }]. Qaytaradi: [joriy bo'lim kaliti, bo'limga o'tish funksiyasi]
// Noma'lum manzil (masalan "/") bo'lsa, birinchi bo'limga o'tkaziladi.
export function useTabRoute(tabs) {
  const path = usePath().replace(/\/+$/, '')
  const current = tabs.find((t) => `/${t.path}` === path)

  useEffect(() => {
    if (!current) navigate(`/${tabs[0].path}`, { replace: true })
  }, [current, tabs])

  const key = (current || tabs[0]).key
  const go = (k) => {
    const t = tabs.find((x) => x.key === k)
    if (t) navigate(`/${t.path}`)
  }
  return [key, go]
}
