// Test JSON'ini o'qish va tekshirish yordamchilari (import va tahrirlash uchun umumiy).

// Ikkala nomlanishni ham qabul qiladi: testTitle/durationMinutes va title/duration
export function readMeta(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { title: '', duration: NaN }
  const title = parsed.testTitle ?? parsed.title ?? ''
  const duration = Number(parsed.durationMinutes ?? parsed.duration)
  return { title: String(title || '').trim(), duration }
}

// JSON ichidan savollar ro'yxatini oladi (obyekt ichidagi "questions" yoki to'g'ridan-to'g'ri massiv)
export function extractQuestions(parsed) {
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') return parsed.questions
  return undefined
}

// Savollar to'g'ri tuzilganini tekshiradi. Xato bo'lsa Error tashlaydi.
export function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('"questions" bo\'sh bo\'lmagan massiv bo\'lishi kerak')
  }
  questions.forEach((q, i) => {
    if (!q || typeof q !== 'object') throw new Error(`${i + 1}-savol: noto'g'ri format`)
    if (!q.question || typeof q.question !== 'string') {
      throw new Error(`${i + 1}-savol: "question" matni yo'q`)
    }
    if (q.type === 'mcq') {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new Error(`${i + 1}-savol: test savoli uchun kamida 2 ta "options" kerak`)
      }
      if (!Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
        throw new Error(`${i + 1}-savol: "correctAnswer" to'g'ri variant indeksi bo'lishi kerak (0 dan boshlanadi)`)
      }
    } else if (q.type === 'open') {
      if (q.correctAnswer !== undefined && q.correctAnswer !== null && typeof q.correctAnswer !== 'string') {
        throw new Error(`${i + 1}-savol: ochiq savolda "correctAnswer" matn bo'lishi kerak`)
      }
    } else {
      throw new Error(`${i + 1}-savol: "type" faqat "mcq" yoki "open" bo'lishi mumkin`)
    }
  })
}

// Davomiylikni tekshiradi: musbat butun son (daqiqa)
export function parseDuration(value) {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}
