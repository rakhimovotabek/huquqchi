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

// <input type="datetime-local"> qiymati <-> ISO (bazaga saqlash uchun)
export function toLocalInput(value) {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(value) {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export function percent(score, total) {
  if (!total) return 0
  return Math.round((score / total) * 1000) / 10
}
