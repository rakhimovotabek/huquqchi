import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import AdminTestPreview from './AdminTestPreview'

// Ikkala nomlanishni ham qabul qiladi: testTitle/durationMinutes va title/duration
function readMeta(parsed) {
  const title = parsed.testTitle ?? parsed.title ?? ''
  const duration = Number(parsed.durationMinutes ?? parsed.duration)
  return { title: String(title || '').trim(), duration }
}

function validateTestJson(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error("JSON obyekt bo'lishi kerak")
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error('"questions" bo\'sh bo\'lmagan massiv bo\'lishi kerak')
  }
  const { duration } = readMeta(parsed)
  if (!duration || duration <= 0) throw new Error('"durationMinutes" musbat son bo\'lishi kerak')

  parsed.questions.forEach((q, i) => {
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

  return duration
}

export default function AdminTests() {
  const [tests, setTests] = useState([])
  const [title, setTitle] = useState('')
  const [json, setJson] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [previewTest, setPreviewTest] = useState(null)
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)

  useEffect(() => {
    loadTests()
  }, [])

  async function loadTests() {
    setListLoading(true)
    const { data, error } = await supabase.from('tests').select('*').order('created_at', { ascending: false })
    if (error) setError('Testlarni yuklashda xatolik: ' + error.message)
    else setTests(data)
    setListLoading(false)
  }

  async function handleImport(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    let parsed
    try {
      parsed = JSON.parse(json)
    } catch (err) {
      setError("JSON noto'g'ri: " + err.message)
      return
    }
    let duration
    try {
      duration = validateTestJson(parsed)
    } catch (err) {
      setError("Test formati noto'g'ri: " + err.message)
      return
    }
    // Nom maydoni bo'sh bo'lsa, JSON ichidagi nom ishlatiladi
    const finalTitle = title.trim() || readMeta(parsed).title
    if (!finalTitle) {
      setError('Test nomini kiriting')
      return
    }
    setLoading(true)
    const { error } = await supabase.from('tests').insert({
      title: finalTitle,
      duration_minutes: duration,
      questions_json: parsed.questions,
      access: 'locked'
    })
    setLoading(false)
    if (error) {
      setError('Testni import qilishda xatolik: ' + error.message)
    } else {
      setTitle('')
      setJson('')
      setNotice("Test import qilindi. U hozircha yopiq — talabalarga ko'rsatish uchun \"Ruxsat berish\" tugmasini bosing.")
      loadTests()
    }
  }

  const accessLabel = { locked: 'Yopiq', allowed: 'Ruxsat berilgan', one_time: 'Bir martalik' }

  async function setAccess(id, access) {
    setError('')
    setNotice('')
    const { error } = await supabase.from('tests').update({ access }).eq('id', id)
    if (error) {
      setError("Ruxsatni o'zgartirishda xatolik: " + error.message)
      return
    }
    setTests((prev) => prev.map((t) => (t.id === id ? { ...t, access } : t)))
  }

  async function handleDelete(id, t) {
    if (!confirm(`"${t}" testi o'chirilsinmi? Bu test bo'yicha mavjud natijalar bazada qoladi.`)) return
    const { error } = await supabase.from('tests').delete().eq('id', id)
    if (error) setError("Testni o'chirishda xatolik: " + error.message)
    else loadTests()
  }

  if (previewTest) {
    return <AdminTestPreview test={previewTest} onBack={() => setPreviewTest(null)} />
  }

  return (
    <div>
      <h2>Testlar</h2>
      {error && <div className="error">{error}</div>}
      {notice && <div className="success">{notice}</div>}
      <form className="stack-form" onSubmit={handleImport}>
        <label>Test nomi (bo'sh qoldirsangiz, JSON ichidagi nom olinadi)</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
        <label>Test JSON</label>
        <textarea
          rows={12}
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder='{"testTitle": "...", "durationMinutes": 30, "questions": [...]}'
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Import qilinmoqda...' : 'Testni import qilish'}
        </button>
      </form>

      <h3>Mavjud testlar</h3>
      {listLoading ? (
        <p>Yuklanmoqda...</p>
      ) : (
        <table className="simple-table">
          <thead>
            <tr>
              <th>Nomi</th>
              <th>Davomiyligi</th>
              <th>Savollar</th>
              <th>Holati</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t) => (
              <tr key={t.id}>
                <td>{t.title}</td>
                <td>{t.duration_minutes} daqiqa</td>
                <td>{t.questions_json.length}</td>
                <td>
                  <span className={`badge badge-${t.access}`}>{accessLabel[t.access] || t.access}</span>
                </td>
                <td>
                  <div className="action-cell">
                    <button className="secondary-btn" onClick={() => setPreviewTest(t)}>
                      Ko'rish
                    </button>
                    {t.access !== 'allowed' && <button onClick={() => setAccess(t.id, 'allowed')}>Ruxsat berish</button>}
                    {t.access !== 'one_time' && (
                      <button className="secondary-btn" onClick={() => setAccess(t.id, 'one_time')}>
                        Bir martalik
                      </button>
                    )}
                    {t.access !== 'locked' && (
                      <button className="secondary-btn" onClick={() => setAccess(t.id, 'locked')}>
                        Yopish
                      </button>
                    )}
                    <button onClick={() => handleDelete(t.id, t.title)}>O'chirish</button>
                  </div>
                </td>
              </tr>
            ))}
            {tests.length === 0 && (
              <tr>
                <td colSpan="5">Hozircha testlar yo'q</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
