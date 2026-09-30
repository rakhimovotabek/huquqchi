// Sanani o'zbekcha ko'rinishda chiqarish: 29.09.2026 14:05
export function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Javob bo'sh (yoki faqat bo'shliqlardan iborat) ekanligini tekshiradi
export function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === ''
}
