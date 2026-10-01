import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { extractQuestions, parseDuration, validateQuestions } from '../lib/testJson'

// Administrator test nomini, davomiyligini va savollarini tahrirlaydi.
export default function AdminTestEdit({ test, onBack, onSaved }) {
  const [title, setTitle] = useState(test.title)
  const [duration, setDuration] = useState(String(test.duration_minutes))
  const [json, setJson] = useState(JSON.stringify(test.questions_json, null, 2))
  const [attemptCount, setAttemptCount] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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

    setSaving(true)
    const { data, error: updErr } = await supabase
      .from('tests')
      .update({ title: cleanTitle, duration_minutes: minutes, questions_json: questions })
      .eq('id', test.id)
      .select()
      .single()
    setSaving(false)
    if (updErr) {
      setError('Saqlashda xatolik: ' + updErr.message)
      return
    }
    onSaved(data)
  }

  return (
    <div>
      <button onClick={onBack}>← Testlarga qaytish</button>
      <h2>Testni tahrirlash</h2>
      {attemptCount > 0 && (
        <div className="banner banner-warn">
          Diqqat: bu testni {attemptCount} marta topshirishgan. Savollar sonini yoki tartibini o'zgartirsangiz, eski
          natijalarda javoblar noto'g'ri savol bilan ko'rinishi mumkin. Faqat matn xatolarini tuzatish xavfsiz.
        </div>
      )}
      {error && <div className="error">{error}</div>}
      <form className="stack-form" onSubmit={handleSave}>
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
        <label>Savollar (JSON)</label>
        <textarea rows={22} value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
        <div className="button-row">
          <button type="submit" disabled={saving}>
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
          <button type="button" className="secondary-btn" onClick={onBack}>
            Bekor qilish
          </button>
        </div>
      </form>
    </div>
  )
}
