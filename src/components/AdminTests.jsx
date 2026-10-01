import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/paged'
import { formatDate } from '../lib/format'
import AdminTestPreview from './AdminTestPreview'
import AdminTestEdit from './AdminTestEdit'
import AdminTestStats from './AdminTestStats'
import { TrashIcon, PencilIcon } from './Icons'
import { extractQuestions, parseDuration, readMeta, validateQuestions } from '../lib/testJson'

const SAMPLE_JSON = `{
  "testTitle": "Namuna test",
  "durationMinutes": 30,
  "questions": [
    {
      "type": "mcq",
      "question": "2 + 2 nechiga teng?",
      "options": ["3", "4", "5", "6"],
      "correctAnswer": 1
    },
    {
      "type": "open",
      "question": "Poytaxtlarni yozing:\\n1. Tojikiston\\n2. Turkiya",
      "correctAnswer": "Dushanbe, Anqara (ixtiyoriy namunaviy javob)"
    }
  ]
}`

const accessLabel = {
  locked: 'Yopiq',
  allowed: 'Ruxsat berilgan',
  one_time: 'Bir martalik',
  selected: 'Tanlanganlarga'
}

export default function AdminTests() {
  const [tests, setTests] = useState([])
  const [accessCounts, setAccessCounts] = useState({})
  const [title, setTitle] = useState('')
  const [durationInput, setDurationInput] = useState('')
  const [json, setJson] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [previewTest, setPreviewTest] = useState(null)
  const [editTest, setEditTest] = useState(null)
  const [statsTest, setStatsTest] = useState(null)
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set())

  useEffect(() => {
    loadTests()
  }, [])

  async function loadTests() {
    setListLoading(true)
    const { data, error } = await supabase.from('tests').select('*').order('created_at', { ascending: false })
    if (error) setError('Testlarni yuklashda xatolik: ' + error.message)
    else setTests(data)

    // Tanlangan talabalar soni (faqat "Tanlanganlarga" testlar uchun ko'rsatiladi)
    const { data: rows } = await fetchAll(() =>
      supabase.from('test_access').select('test_id, student_id').order('test_id').order('student_id')
    )
    const counts = {}
    ;(rows || []).forEach((r) => {
      counts[r.test_id] = (counts[r.test_id] || 0) + 1
    })
    setAccessCounts(counts)
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
        setError('Davomiylikni kiriting yoki JSON ichida "durationMinutes" yozing')
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
      setNotice('Test import qilindi. U hozircha yopiq — talabalarga ko\'rsatish uchun "Ruxsat berish" tugmasini bosing.')
      loadTests()
    }
  }

  async function setAccess(ids, access) {
    setError('')
    setNotice('')
    const { error } = await supabase.from('tests').update({ access }).in('id', ids)
    if (error) {
      setError("Ruxsatni o'zgartirishda xatolik: " + error.message)
      return false
    }
    setTests((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, access } : t)))
    return true
  }

  async function bulkAccess(access) {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    if (await setAccess(ids, access)) {
      setNotice(`${ids.length} ta test: "${accessLabel[access]}" holatiga o'tkazildi.`)
      setSelected(new Set())
    }
  }

  async function handleDelete(id, t) {
    if (!confirm(`"${t}" testi o'chirilsinmi? Bu test bo'yicha mavjud natijalar bazada qoladi.`)) return
    const { error } = await supabase.from('tests').delete().eq('id', id)
    if (error) setError("Testni o'chirishda xatolik: " + error.message)
    else {
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      loadTests()
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? tests.filter((t) => t.title.toLowerCase().includes(q)) : tests
  }, [tests, query])

  const allChecked = filtered.length > 0 && filtered.every((t) => selected.has(t.id))

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allChecked) filtered.forEach((t) => next.delete(t.id))
      else filtered.forEach((t) => next.add(t.id))
      return next
    })
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

  if (statsTest) {
    return <AdminTestStats test={statsTest} onBack={() => setStatsTest(null)} />
  }

  return (
    <div>
      <h2>Testlar</h2>
      {error && <div className="error">{error}</div>}
      {notice && <div className="success">{notice}</div>}

      <form className="form-card" onSubmit={handleImport}>
        <h3 className="card-title">Yangi test qo'shish</h3>
        <div className="import-row">
          <div>
            <label>Test nomi</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bo'sh bo'lsa, JSON'dagi nom" />
          </div>
          <div>
            <label>Davomiyligi (daqiqa)</label>
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
          rows={8}
          value={json}
          onChange={(e) => setJson(e.target.value)}
          spellCheck={false}
          placeholder='{"testTitle": "...", "durationMinutes": 30, "questions": [...]}'
        />
        <details className="format-help">
          <summary>Format namunasi</summary>
          <pre>{SAMPLE_JSON}</pre>
          <p className="muted">
            <code>mcq</code> — test savoli (<code>correctAnswer</code> to'g'ri variantning raqami, 0 dan boshlanadi).{' '}
            <code>open</code> — ochiq savol (admin baholaydi). Nom va davomiylik maydonlari bo'sh bo'lsa, JSON ichidagisi
            olinadi.
          </p>
          <button type="button" className="secondary-btn small" onClick={() => setJson(SAMPLE_JSON)}>
            Namunani JSON maydoniga qo'yish
          </button>
        </details>
        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading ? 'Import qilinmoqda...' : 'Testni import qilish'}
          </button>
        </div>
      </form>

      <div className="list-head">
        <h3>Mavjud testlar</h3>
        <input
          className="search-input"
          type="search"
          placeholder="Test nomi bo'yicha qidirish..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <strong>{selected.size} ta test tanlandi</strong>
          <div className="action-cell">
            <button className="btn-green" onClick={() => bulkAccess('allowed')}>
              Ruxsat berish
            </button>
            <button className="btn-amber" onClick={() => bulkAccess('one_time')}>
              Bir martalik
            </button>
            <button className="btn-red" onClick={() => bulkAccess('locked')}>
              Yopish
            </button>
            <button className="secondary-btn" onClick={() => setSelected(new Set())}>
              Bekor qilish
            </button>
          </div>
        </div>
      )}

      {listLoading ? (
        <p>Yuklanmoqda...</p>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="simple-table tests-table">
              <thead>
                <tr>
                  <th className="check-col">
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Hammasini tanlash" />
                  </th>
                  <th>Nomi</th>
                  <th>Davomiyligi</th>
                  <th>Savollar</th>
                  <th>Holati</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className={selected.has(t.id) ? 'row-selected' : ''}>
                    <td className="check-col">
                      <input
                        type="checkbox"
                        checked={selected.has(t.id)}
                        onChange={() => toggleOne(t.id)}
                        aria-label={`${t.title} ni tanlash`}
                      />
                    </td>
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
                        <div>
                          <div className="test-title">{t.title}</div>
                          {(t.opens_at || t.closes_at || t.shuffle || t.show_leaderboard) && (
                            <div className="chips">
                              {(t.opens_at || t.closes_at) && (
                                <span className="chip">
                                  {formatDate(t.opens_at) || '…'} → {formatDate(t.closes_at) || '…'}
                                </span>
                              )}
                              {t.shuffle && <span className="chip">Aralashtirilgan</span>}
                              {t.show_leaderboard && <span className="chip">Reyting</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{t.duration_minutes} daqiqa</td>
                    <td>{t.questions_json.length}</td>
                    <td>
                      <span className={`badge badge-${t.access}`}>
                        {accessLabel[t.access] || t.access}
                        {t.access === 'selected' ? ` · ${accessCounts[t.id] || 0}` : ''}
                      </span>
                    </td>
                    <td>
                      <div className="action-cell">
                        <button className="secondary-btn" onClick={() => setPreviewTest(t)}>
                          Ko'rish
                        </button>
                        <button className="secondary-btn" onClick={() => setStatsTest(t)}>
                          Statistika
                        </button>
                        {t.access !== 'allowed' && (
                          <button className="btn-green" onClick={() => setAccess([t.id], 'allowed')}>
                            Ruxsat berish
                          </button>
                        )}
                        {t.access !== 'one_time' && (
                          <button className="btn-amber" onClick={() => setAccess([t.id], 'one_time')}>
                            Bir martalik
                          </button>
                        )}
                        {t.access !== 'locked' && (
                          <button className="btn-red" onClick={() => setAccess([t.id], 'locked')}>
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
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-cell">
                      {tests.length === 0 ? "Hozircha testlar yo'q" : 'Qidiruvga mos test topilmadi'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="muted hint">
        "Tanlanganlarga" holati: Talabalar bo'limida talabalarni belgilab, testni tanlang va "Ruxsat berish" bosing.
      </p>
    </div>
  )
}
