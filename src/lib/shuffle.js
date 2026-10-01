// Urinish identifikatoriga bog'langan "aralashtirish": bir xil urinish uchun tartib doim bir xil
// (sahifa yangilansa ham savollar joyi o'zgarmaydi), turli talabalar uchun esa har xil.
function hashString(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededRandom(seedText) {
  return mulberry32(hashString(String(seedText)))
}

export function shuffled(array, rnd) {
  const a = array.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Test uchun tartib rejasi: [{ qi: asl savol indeksi, opts: [asl variant indekslari] | null }]
// Javoblar doim ASL indekslar bilan saqlanadi, shuning uchun natijalar ko'rinishi buzilmaydi.
export function buildPlan(questions, shuffleOn, seedText) {
  const base = questions.map((q, qi) => ({
    qi,
    opts: q.type === 'mcq' ? q.options.map((_, j) => j) : null
  }))
  if (!shuffleOn) return base
  const rnd = seededRandom(seedText)
  return shuffled(base, rnd).map((item) => ({
    qi: item.qi,
    opts: item.opts ? shuffled(item.opts, rnd) : null
  }))
}
