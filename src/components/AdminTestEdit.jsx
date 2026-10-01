import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { extractQuestions, parseDuration, validateQuestions } from '../lib/testJson'
import { formatDate, fromLocalInput, toLocalInput } from '../lib/format'

// Administrator test nomini, davomiyligini, savollarini va (ixtiyoriy) qo'shimcha sozlamalarini tahrirlaydi.
export default function AdminTestEdit({ test, onBack, onSaved }) {
  const [title, setTitle] = useState(test.title)
  const [duration, setDuration] = useState(String(test.duration_minutes))
  const [json, setJson] = useState(JSON.stringify(test.questions_json, null, 2))
  const [shuffle, setShuffle] = useState(!!test.shuffle)
  const [leaderboard, setLeaderboard] = useState(!!test.show_leaderboard)
  const [opensAt, setOpensAt] = useState(toLocalInput(test.opens_at))
  const [closesAt, setClosesAt] = useState(toLocalInput(test.closes_at))
  const [attemptCount, setAttemptCount] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const hasExtras = shuffle || leaderboard

  useEffect(() => {
    // Bu testni allaqachon topshirgan talabalar bormi?
    supabase
      .from('attempts')
      .select('id', { count: 'exact', head: true })
      .eq('test_id', test.id)
      .then(({ count }) => setAttemptCount(count || 0))
  }, [test.id])

  async function handleSave(e) {
    e.preventDefault()
    setError('')

    const cleanTitle = title.trim()
    if (!cleanTitle) {
      setError('Test nomini kiriting')
      return
    }
    const minutes = parseDuration(duration)
    if (!minutes) {
      setError("Davomiylik musbat butun son (daqiqa) bo'lishi kerak")
      return
    }

    let parsed
    try {
      parsed = JSON.parse(json)
    } catch (err) {
      setError("JSON noto'g'ri: " + err.message)
      return
    }
    const questions = extractQuestions(parsed)
    try {
      validateQuestions(questions)
    } catch (err) {
      setError("Test formati noto'g'ri: " + err.message)
      return
    }

    const opens = fromLocalInput(opensAt)
    const closes = fromLocalInput(closesAt)
    if (opens && closes && new Date(closes) <= new Date(opens)) {
      setError("Yopilish vaqti ochilish vaqtidan keyin bo'lishi kerak")
      return
    }

    setSaving(true)
    const { data, error: updErr } = await supabase
      .from('tests')
      .update({
        title: cleanTitle,
        duration_minutes: minutes,
        questions_json: questions,
        shuffle,
        show_leaderboard: leaderboard,
        opens_at: opens,
        closes_at: closes,
        // Vaqt qo'yilgan bo'lsa, "Yopiq" test shu oraliqda ochilishi uchun "Ruxsat berilgan" ga o'tkaziladi
        ...((opens || closes) && test.access === 'locked' ? { access: 'allowed' } : {})
      })
      .eq('id', test.id)
      .select()
      .single()
    setSaving(false)
    if (updErr) {
      let msg = 'Saqlashda xatolik: ' + updErr.message
      if (/column|schema cache/i.test(updErr.message)) {
        msg += " (supabase/migration_v2.sql faylini SQL Editor'da bir marta ishga tushiring)"
      }
      setError(msg)
      return
    }
    onSaved(data)
  }

  return (
    <div>
      <button className="secondary-btn" onClick={onBack}>
        ← Testlarga qaytish
      </button>
      <h2>Testni tahrirlash</h2>
      {attemptCount > 0 && (
        <div className="banner banner-warn">
          Diqqat: bu testni {attemptCount} marta topshirishgan. Savollar sonini yoki tartibini o'zgartirsangiz, eski
          natijalarda javoblar noto'g'ri savol bilan ko'rinishi mumkin. Faqat matn xatolarini tuzatish xavfsiz.
        </div>
      )}
      {error && <div className="error">{error}</div>}
      <form className="form-card form-card-lg" onSubmit={handleSave}>
        <div className="import-row">
          <div>
            <label>Test nomi</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label>Davomiyligi (daqiqa)</label>
            <input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
        </div>

        <div className="schedule-box">
          <h3 className="card-title">Test ochiladigan vaqt</h3>
          <div className="import-row dates-row">
            <div>
              <label>Ochilish vaqti</label>
              <input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
            </div>
            <div>
              <label>Yopilish vaqti</label>
              <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
            </div>
          </div>
          {(opensAt || closesAt) && (
            <p className="schedule-summary">
              Test <strong>{opensAt ? formatDate(fromLocalInput(opensAt)) : 'hozirdan'}</strong> dan{' '}
              <strong>{closesAt ? formatDate(fromLocalInput(closesAt)) : 'cheksiz'}</strong> gacha ochiq bo'ladi.
            </p>
          )}
          <p className="muted">
            Masalan: ochilish 02.10.2026 10:00, yopilish 02.10.2026 12:00. Vaqt qo'ysangiz, test shu oraliqda
            avtomatik ochiladi (test "Yopiq" bo'lsa, saqlaganda "Ruxsat berilgan" ga o'tkaziladi). Vaqt qo'yilmasa,
            test faqat "Ruxsat berish" / "Yopish" tugmalari bilan boshqariladi. Yopilish vaqtida allaqachon
            boshlagan talaba testini tugatishda davom etadi.
          </p>
          {(opensAt || closesAt) && (
            <button
              type="button"
              className="secondary-btn small"
              onClick={() => {
                setOpensAt('')
                setClosesAt('')
              }}
            >
              Vaqtni tozalash
            </button>
          )}
        </div>

        <details className="format-help" open={hasExtras}>
          <summary>Qo'shimcha sozlamalar (ixtiyoriy)</summary>
          <div className="extras">
            <label className="check-line">
              <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
              <span>
                Savollar va variantlar tartibini har bir talaba uchun aralashtirish
                <small>Ko'chirib yozishning oldini olishga yordam beradi.</small>
              </span>
            </label>
            <label className="check-line">
              <input type="checkbox" checked={leaderboard} onChange={(e) => setLeaderboard(e.target.checked)} />
              <span>
                Talabalarga reytingni ko'rsatish (eng yaxshi 10 ta)
                <small>Talaba testni topshirgandan keyin natijalar sahifasida "Reyting" tugmasi chiqadi.</small>
              </span>
            </label>
          </div>
        </details>

        <label>Savollar (JSON)</label>
        <textarea rows={20} value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
        <div className="form-actions">
          <button type="button" className="secondary-btn" onClick={onBack}>
            Bekor qilish
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </form>
    </div>
  )
}
