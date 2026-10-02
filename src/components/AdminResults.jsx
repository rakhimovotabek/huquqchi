import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'
import { deleteAttempts } from '../lib/deleteAttempts'
import { TrashIcon } from './Icons'
import AdminReviewAttempt from './AdminReviewAttempt'
import ReviewResult from './ReviewResult'
import AdminGradeByQuestion from './AdminGradeByQuestion'

export default function AdminResults() {
  const [attempts, setAttempts] = useState([])
  const [allTests, setAllTests] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [byQuestion, setByQuestion] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  // { id, mode: 'grade' | 'view', studentName }
  const [openAttempt, setOpenAttempt] = useState(null)

  // Filtr: test, talaba nomi, sana oralig'i
  const [filterOpen, setFilterOpen] = useState(false)
  const [fTest, setFTest] = useState('')
  const [fStudent, setFStudent] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')

  useEffect(() => {
    if (!openAttempt && !byQuestion) loadAttempts()
  }, [openAttempt, byQuestion])

  async function loadAttempts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('attempts')
      .select('*, profiles(username), tests(title)')
      .not('submitted_at', 'is', null)
      .order('created_at', { ascending: false })
    if (error) setError('Natijalarni yuklashda xatolik: ' + error.message)
    else setAttempts(data)

    // Filtr uchun barcha testlar (yopiq va bir martalik testlar ham)
    const { data: testRows } = await supabase.from('tests').select('id, title, access')
    if (testRows) setAllTests(testRows)
    setLoading(false)
  }

  async function removeAttempts(ids, label) {
    if (ids.length === 0) return
    const ok = window.confirm(
      `${label} o'chirilsinmi?\n\nBu qaytarib bo'lmaydi: natija va javoblar butunlay o'chadi, talabaning umumiy foizi va reyting qayta hisoblanadi.`
    )
    if (!ok) return
    setError('')
    setNotice('')
    try {
      const n = await deleteAttempts(ids)
      setNotice(`${n} ta natija o'chirildi.`)
      setSelected(new Set())
      loadAttempts()
    } catch (err) {
      setError("O'chirishda xatolik: " + err.message)
    }
  }

  if (byQuestion) {
    return <AdminGradeByQuestion onBack={() => setByQuestion(false)} />
  }

  if (openAttempt?.mode === 'grade') {
    return <AdminReviewAttempt attemptId={openAttempt.id} onBack={() => setOpenAttempt(null)} />
  }

  if (openAttempt?.mode === 'view') {
    return (
      <ReviewResult
        attemptId={openAttempt.id}
        studentName={openAttempt.studentName}
        onBack={() => setOpenAttempt(null)}
      />
    )
  }

  // Filtr uchun testlar ro'yxati (barcha testlar)
  const accessText = { locked: 'Yopiq', allowed: 'Ruxsat berilgan', one_time: 'Bir martalik' }
  const optionMap = new Map()
  attempts.filter((a) => a.test_id).forEach((a) => optionMap.set(a.test_id, a.tests?.title || "Noma'lum test"))
  allTests.forEach((t) => optionMap.set(t.id, `${t.title} (${accessText[t.access] || t.access})`))
  const testOptions = Array.from(optionMap.entries()).sort((x, y) => String(x[1]).localeCompare(String(y[1])))

  const fromDate = fFrom ? new Date(fFrom + 'T00:00:00') : null
  const toDate = fTo ? new Date(fTo + 'T23:59:59.999') : null
  const nameQuery = fStudent.trim().toLowerCase()

  const filtered = attempts.filter((a) => {
    if (fTest && a.test_id !== fTest) return false
    if (nameQuery && !(a.profiles?.username || '').toLowerCase().includes(nameQuery)) return false
    const when = a.submitted_at ? new Date(a.submitted_at) : null
    if (fromDate && (!when || when < fromDate)) return false
    if (toDate && (!when || when > toDate)) return false
    return true
  })

  const activeFilters = [fTest, nameQuery, fFrom, fTo].filter(Boolean).length

  // Faqat ko'rinib turgan (filtrdan o'tgan) natijalar tanlanadi
  const visibleIds = filtered.map((a) => a.id)
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const selectedCount = visibleIds.filter((id) => selected.has(id)).length

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(visibleIds))
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearFilters() {
    setFTest('')
    setFStudent('')
    setFFrom('')
    setFTo('')
  }

  return (
    <div>
      <h2>Natijalar</h2>
      {error && <div className="error">{error}</div>}
      {notice && <div className="success">{notice}</div>}
      <div className="action-cell">
        <button onClick={() => setByQuestion(true)}>Savol bo'yicha tekshirish</button>
        <button className="secondary-btn" onClick={() => setFilterOpen((v) => !v)}>
          Filtr{activeFilters > 0 ? ` (${activeFilters})` : ''}
        </button>
        {activeFilters > 0 && (
          <button className="secondary-btn" onClick={clearFilters}>
            Filtrni tozalash
          </button>
        )}
      </div>
      {filterOpen && (
        <div className="card filter-panel">
          <div className="filter-grid">
            <div>
              <label>Test</label>
              <select value={fTest} onChange={(e) => setFTest(e.target.value)}>
                <option value="">Barcha testlar</option>
                {testOptions.map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Talaba nomi</label>
              <input
                placeholder="Talabani qidirish..."
                value={fStudent}
                onChange={(e) => setFStudent(e.target.value)}
              />
            </div>
            <div>
              <label>Sana (dan)</label>
              <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
            </div>
            <div>
              <label>Sana (gacha)</label>
              <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
            </div>
          </div>
        </div>
      )}
      {!loading && activeFilters > 0 && (
        <p className="muted">
          Topildi: {filtered.length} / {attempts.length}
        </p>
      )}
      {selectedCount > 0 && (
        <div className="bulk-bar">
          <strong>{selectedCount} ta natija tanlandi</strong>
          <div className="action-cell">
            <button
              className="btn-red"
              onClick={() => removeAttempts(visibleIds.filter((id) => selected.has(id)), `${selectedCount} ta natija`)}
            >
              Tanlanganlarni o'chirish
            </button>
            <button className="secondary-btn" onClick={() => setSelected(new Set())}>
              Bekor qilish
            </button>
          </div>
        </div>
      )}
      {loading ? (
        <p>Yuklanmoqda...</p>
      ) : (
        <div className="table-card">
        <div className="table-scroll">
        <table className="simple-table">
          <thead>
            <tr>
              <th className="check-col">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Hammasini tanlash" />
              </th>
              <th>Talaba</th>
              <th>Test</th>
              <th>Ball</th>
              <th>Holat</th>
              <th>Sana</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className={selected.has(a.id) ? 'row-selected' : ''}>
                <td className="check-col">
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={() => toggleOne(a.id)}
                    aria-label="Natijani tanlash"
                  />
                </td>
                <td>{a.profiles?.username}</td>
                <td>{a.tests?.title}</td>
                <td>{a.status === 'completed' ? `${a.score} / ${a.total_questions}` : '—'}</td>
                <td>{a.status === 'pending_review' ? 'Tekshiruvni kutmoqda' : 'Yakunlangan'}</td>
                <td>{formatDate(a.submitted_at)}</td>
                <td>
                  <div className="action-cell">
                    {a.status === 'pending_review' && (
                      <button onClick={() => setOpenAttempt({ id: a.id, mode: 'grade' })}>Baholash</button>
                    )}
                    <button
                      className="secondary-btn"
                      onClick={() => setOpenAttempt({ id: a.id, mode: 'view', studentName: a.profiles?.username })}
                    >
                      Ko'rish
                    </button>
                    <button
                      className="icon-btn"
                      title="O'chirish"
                      aria-label="O'chirish"
                      onClick={() => removeAttempts([a.id], `${a.profiles?.username} ning \"${a.tests?.title}\" natijasi`)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="7">
                  {attempts.length === 0 ? "Hozircha natijalar yo'q" : 'Filtrga mos natija topilmadi'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        </div>
      )}
    </div>
  )
}
