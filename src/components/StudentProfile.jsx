import { useEffect, useState } from 'react'
import { supabase, verifyPassword } from '../lib/supabase'
import { formatDate, percent } from '../lib/format'

// Talabaning profili: umumiy o'zlashtirish, natijalar grafigi, eng zaif testlar va parolni o'zgartirish.
export default function StudentProfile({ profile }) {
  const [attempts, setAttempts] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('attempts')
      .select('id, test_id, score, total_questions, submitted_at, tests(title)')
      .eq('student_id', profile.id)
      .eq('status', 'completed')
      .order('submitted_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) setError('Yuklashda xatolik: ' + error.message)
        else setAttempts((data || []).filter((a) => a.total_questions > 0))
      })
  }, [profile.id])

  return (
    <div>
      <h2>Profil: {profile.username}</h2>
      {error && <div className="error">{error}</div>}
      {!attempts ? <p>Yuklanmoqda...</p> : <Progress attempts={attempts} />}
      <ChangePassword profile={profile} />
    </div>
  )
}

function Progress({ attempts }) {
  if (attempts.length === 0) {
    return (
      <div className="card">
        <h3>Mening o'sishim</h3>
        <p className="muted">Hozircha yakunlangan natijalar yo'q. Test topshirganingizdan keyin shu yerda ko'rinadi.</p>
      </div>
    )
  }

  const totalScore = attempts.reduce((s, a) => s + (a.score || 0), 0)
  const totalQ = attempts.reduce((s, a) => s + a.total_questions, 0)
  const overall = percent(totalScore, totalQ)

  const points = attempts.map((a) => ({
    pct: percent(a.score || 0, a.total_questions),
    label: `${a.tests?.title || ''} — ${formatDate(a.submitted_at)}`
  }))

  // Har bir test bo'yicha o'rtacha foiz; eng pastlari "zaif" hisoblanadi
  const byTest = {}
  attempts.forEach((a) => {
    const t = (byTest[a.test_id] ||= { title: a.tests?.title || 'Test', score: 0, total: 0, count: 0 })
    t.score += a.score || 0
    t.total += a.total_questions
    t.count += 1
  })
  const weakest = Object.values(byTest)
    .map((t) => ({ ...t, pct: percent(t.score, t.total) }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5)

  return (
    <>
      <div className="stat-grid">
        <div className="card stat-card">
          <span className="muted">Umumiy natija</span>
          <div className="stat-value">{overall}%</div>
          <span className="muted">
            {totalScore} / {totalQ} to'g'ri javob
          </span>
        </div>
        <div className="card stat-card">
          <span className="muted">Yakunlangan urinishlar</span>
          <div className="stat-value">{attempts.length}</div>
          <span className="muted">{Object.keys(byTest).length} ta turli test</span>
        </div>
      </div>

      <div className="card">
        <h3>Natijalar dinamikasi</h3>
        <LineChart points={points} />
      </div>

      <div className="card">
        <h3>Eng zaif testlar</h3>
        <div className="weak-list">
          {weakest.map((t, i) => (
            <div key={i} className="weak-row">
              <div className="weak-head">
                <span>{t.title}</span>
                <strong>{t.pct}%</strong>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${Math.max(2, t.pct)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="muted">Bir necha marta topshirilgan testlar uchun o'rtacha foiz olinadi.</p>
      </div>
    </>
  )
}

// Oddiy SVG chiziqli grafik (tashqi kutubxonasiz)
function LineChart({ points }) {
  const W = 600
  const H = 200
  const padL = 34
  const padR = 14
  const padT = 14
  const padB = 24
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const x = (i) => (points.length === 1 ? padL + innerW / 2 : padL + (i / (points.length - 1)) * innerW)
  const y = (p) => padT + innerH - (p / 100) * innerH
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`).join(' ')

  return (
    <svg className="line-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Natijalar grafigi">
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="#e5e7eb" strokeWidth="1" />
          <text x={padL - 6} y={y(g) + 4} textAnchor="end" fontSize="11" fill="#6b7280">
            {g}%
          </text>
        </g>
      ))}
      {points.length > 1 && <path d={path} fill="none" stroke="#1e40af" strokeWidth="2.5" strokeLinejoin="round" />}
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.pct)} r="4" fill="#1e40af">
          <title>{`${p.pct}% — ${p.label}`}</title>
        </circle>
      ))}
      <text x={padL} y={H - 6} fontSize="11" fill="#6b7280">
        eski
      </text>
      <text x={W - padR} y={H - 6} textAnchor="end" fontSize="11" fill="#6b7280">
        yangi
      </text>
    </svg>
  )
}

function ChangePassword({ profile }) {
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setDone(false)
    if (newPw.length < 6) return setError("Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak")
    if (newPw !== newPw2) return setError('Yangi parollar bir xil emas')
    if (newPw === oldPw) return setError("Yangi parol eskisidan farq qilishi kerak")

    setSaving(true)
    const ok = await verifyPassword(profile.username, oldPw)
    if (!ok) {
      setSaving(false)
      return setError("Joriy parol noto'g'ri")
    }
    const { error: updErr } = await supabase.auth.updateUser({ password: newPw })
    if (updErr) {
      setSaving(false)
      return setError("Parolni o'zgartirishda xatolik: " + updErr.message)
    }
    // Administrator ko'radigan parolni ham yangilaymiz
    const { error: syncErr } = await supabase.rpc('save_my_password', { p_password: newPw })
    setSaving(false)
    if (syncErr) {
      setError("Parol o'zgardi, lekin administrator ko'radigan nusxa yangilanmadi: " + syncErr.message)
      return
    }
    setOldPw('')
    setNewPw('')
    setNewPw2('')
    setDone(true)
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h3 className="card-title">Parolni o'zgartirish</h3>
      {error && <div className="error">{error}</div>}
      {done && <div className="success">Parol o'zgartirildi. Keyingi safar yangi parol bilan kirasiz.</div>}
      <label>Joriy parol</label>
      <input type="password" autoComplete="current-password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
      <label>Yangi parol</label>
      <input type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
      <label>Yangi parolni takrorlang</label>
      <input type="password" autoComplete="new-password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} />
      <div className="form-actions">
        <button type="submit" disabled={saving || !oldPw || !newPw || !newPw2}>
          {saving ? 'Saqlanmoqda...' : 'Parolni saqlash'}
        </button>
      </div>
    </form>
  )
}
