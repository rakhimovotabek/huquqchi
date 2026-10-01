import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import AdminTestPreview from './AdminTestPreview'
import AdminTestEdit from './AdminTestEdit'
import { TrashIcon, PencilIcon } from './Icons'
import { extractQuestions, parseDuration, readMeta, validateQuestions } from '../lib/testJson'

export default function AdminTests() {
  const [tests, setTests] = useState([])
  const [title, setTitle] = useState('')
  const [durationInput, setDurationInput] = useState('')
  const [json, setJson] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [previewTest, setPreviewTest] = useState(null)
  const [editTest, setEditTest] = useState(null)
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
    const questions = extractQuestions(parsed)
    try {
      validateQuestions(questions)
    } catch (err) {
      setError("Test formati noto'g'ri: " + err.message)
      return
    }
    const meta = readMeta(parsed)

    // Nom: maydon bo'sh bo'lsa, JSON ichidagi nom ishlatiladi
    const finalTitle = title.trim() || meta.title
    if (!finalTitle) {
      setError('Test nomini kiriting')
      return
    }

    // Davomiylik: maydon bo'sh bo'lsa, JSON ichidagi vaqt ishlatiladi
    let duration
    if (durationInput.trim() !== '') {
      duration = parseDuration(durationInput)
      if (!duration) {
        setError("Davomiylik musbat butun son (daqiqa) bo'lishi kerak")
        return
      }
    } else {
      duration = parseDuration(meta.duration)
      if (!duration) {
        setError("Davomiylikni kiriting yoki JSON ichida \"durationMinutes\" yozing")
        return
      }
    }
    setLoading(true)
    const { error } = await supabase.from('tests').insert({
      title: finalTitle,
      duration_minutes: duration,
      questions_json: questions,
      access: 'locked'
    })
    setLoading(false)
    if (error) {
      setError('Testni import qilishda xatolik: ' + error.message)
    } else {
      setTitle('')
      setDurationInput('')
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

  if (editTest) {
    return (
      <AdminTestEdit
        test={editTest}
        onBack={() => setEditTest(null)}
        onSaved={() => {
          setEditTest(null)
          setNotice("Test o'zgartirildi.")
          loadTests()
        }}
      />
    )
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
        <div className="import-row">
          <div>
            <label>Test nomi (bo'sh qoldirsangiz, JSON ichidagi nom olinadi)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label>Davomiyligi, daqiqa (bo'sh qoldirsangiz, JSON ichidagi vaqt olinadi)</label>
            <input
              type="number"
              min="1"
              value={durationInput}
              onChange={(e) => setDurationInput(e.target.value)}
              placeholder="masalan, 90"
            />
          </div>
        </div>
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
        <div className="table-scroll">
        <table className="simple-table tests-table">
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
                <td>
                  <div className="name-cell">
                    <button
                      className="icon-btn neutral"
                      title="Tahrirlash"
                      aria-label="Tahrirlash"
                      onClick={() => setEditTest(t)}
                    >
                      <PencilIcon />
                    </button>
                    <span>{t.title}</span>
                  </div>
                </td>
                <td>{t.duration_minutes} daqiqa</td>
                <td>{t.questions_json.length}</td>
                <td>
                  <span className={`badge badge-${t.access}`}>{accessLabel[t.access] || t.access}</span>
                </td>
                <td>
                  <div className="action-cell nowrap">
                    <button className="secondary-btn" onClick={() => setPreviewTest(t)}>
                      Ko'rish
                    </button>
                    {t.access !== 'allowed' && (
                      <button className="btn-green" onClick={() => setAccess(t.id, 'allowed')}>
                        Ruxsat berish
                      </button>
                    )}
                    {t.access !== 'one_time' && (
                      <button className="btn-amber" onClick={() => setAccess(t.id, 'one_time')}>
                        Bir martalik
                      </button>
                    )}
                    {t.access !== 'locked' && (
                      <button className="btn-red" onClick={() => setAccess(t.id, 'locked')}>
                        Yopish
                      </button>
                    )}
                    <button
                      className="icon-btn"
                      title="O'chirish"
                      aria-label="O'chirish"
                      onClick={() => handleDelete(t.id, t.title)}
                    >
                      <TrashIcon />
                    </button>
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
        </div>
      )}
    </div>
  )
}
