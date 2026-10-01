import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'
import AdminReviewAttempt from './AdminReviewAttempt'
import ReviewResult from './ReviewResult'

export default function AdminResults() {
  const [attempts, setAttempts] = useState([])
  const [allTests, setAllTests] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  // { id, mode: 'grade' | 'view', studentName }
  const [openAttempt, setOpenAttempt] = useState(null)

  // Filtr: test, talaba nomi, sana oralig'i
  const [filterOpen, setFilterOpen] = useState(false)
  const [fTest, setFTest] = useState('')
  const [fStudent, setFStudent] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')

  useEffect(() => {
    if (!openAttempt) loadAttempts()
  }, [openAttempt])

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
      <div className="action-cell">
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
      {loading ? (
        <p>Yuklanmoqda...</p>
      ) : (
        <div className="table-card">
        <div className="table-scroll">
        <table className="simple-table">
          <thead>
            <tr>
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
              <tr key={a.id}>
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
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="6">
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
