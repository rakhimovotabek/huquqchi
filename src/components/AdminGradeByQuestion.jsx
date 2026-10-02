import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/paged'
import { formatDate, isBlank } from '../lib/format'

// Savol bo'yicha tekshirish: bitta savol tanlanadi va barcha talabalarning shu savolga javobi birga ko'rinadi.
// Javob bermagan talabalar avtomatik "noto'g'ri" hisoblanadi.
export default function AdminGradeByQuestion({ onBack }) {
  const [tests, setTests] = useState([])
  const [testId, setTestId] = useState('')
  const [stats, setStats] = useState({}) // { [savol indeksi]: { total, pending } }
  const [qi, setQi] = useState(0)
  const [rows, setRows] = useState([])
  const [pendingOnly, setPendingOnly] = useState(false)
  const [loadingTests, setLoadingTests] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [finishedCount, setFinishedCount] = useState(0)
  const [error, setError] = useState('')

  const test = tests.find((t) => t.id === testId)
  const questions = test ? test.questions_json : []
  const q = questions[qi]

  useEffect(() => {
    supabase
      .from('tests')
      .select('id, title, questions_json, created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError('Testlarni yuklashda xatolik: ' + error.message)
        else setTests(data)
        setLoadingTests(false)
      })
  }, [])

  async function chooseTest(id) {
    setTestId(id)
    setStats({})
    setRows([])
    setQi(0)
    setFinishedCount(0)
    setError('')
    if (!id) return
    const t = tests.find((x) => x.id === id)
    const { data, error } = await fetchAll(() =>
      supabase
        .from('answers')
        .select('id, question_index, reviewed, attempts!inner(test_id)')
        .eq('attempts.test_id', id)
        .order('id')
    )
    if (error) return setError('Javoblarni yuklashda xatolik: ' + error.message)
    const s = {}
    data.forEach((a) => {
      const item = (s[a.question_index] ||= { total: 0, pending: 0 })
      item.total += 1
      if (!a.reviewed) item.pending += 1
    })
    setStats(s)
    // Tekshirilmagan javobi bor birinchi savoldan boshlaymiz
    const first = t.questions_json.findIndex((_, i) => s[i]?.pending > 0)
    setQi(first >= 0 ? first : 0)
    setPendingOnly(first >= 0)
  }

  // Tanlangan savol bo'yicha barcha javoblar
  useEffect(() => {
    if (!testId) return undefined
    let cancelled = false
    setLoadingRows(true)
    fetchAll(() =>
      supabase
        .from('answers')
        .select('id, answer, is_correct, reviewed, attempts!inner(id, test_id, submitted_at, profiles(username))')
        .eq('question_index', qi)
        .eq('attempts.test_id', testId)
        .order('id')
    ).then(({ data, error }) => {
      if (cancelled) return
      if (error) setError('Javoblarni yuklashda xatolik: ' + error.message)
      else {
        setError('')
        setRows(data)
      }
      setLoadingRows(false)
    })
    return () => {
      cancelled = true
    }
  }, [testId, qi])

  async function mark(row, correct) {
    setBusyId(row.id)
    setError('')
    const { data: finalized, error } = await supabase.rpc('grade_answer', { p_answer_id: row.id, p_correct: correct })
    setBusyId(null)
    if (error) {
      return setError('Bahoni saqlashda xatolik: ' + error.message + " (supabase/migration_v7.sql ishga tushirilganmi?)")
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_correct: correct, reviewed: true } : r)))
    if (!row.reviewed) {
      setStats((prev) => ({ ...prev, [qi]: { ...prev[qi], pending: Math.max(0, (prev[qi]?.pending || 1) - 1) } }))
    }
    if (finalized) setFinishedCount((n) => n + 1)
  }

  function nextPending() {
    const n = questions.length
    for (let step = 1; step <= n; step++) {
      const i = (qi + step) % n
      if (stats[i]?.pending > 0) return setQi(i)
    }
  }

  const name = (r) => r.attempts?.profiles?.username || '?'
  const answered = rows.filter((r) => !isBlank(r.answer)).sort((a, b) => name(a).localeCompare(name(b)))
  const blanks = rows.filter((r) => isBlank(r.answer)).sort((a, b) => name(a).localeCompare(name(b)))
  const pendingRows = answered.filter((r) => !r.reviewed)
  const shown = q?.type === 'open' && pendingOnly ? pendingRows : answered
  const totalPending = Object.values(stats).reduce((s, x) => s + x.pending, 0)

  return (
    <div>
      <button onClick={onBack}>← Natijalarga qaytish</button>
      <h2>Savol bo'yicha tekshirish</h2>
      {error && <div className="error">{error}</div>}
      {finishedCount > 0 && (
        <div className="success">{finishedCount} ta talabaning ishi to'liq tekshirildi, ularga "Yangi natija" xabari bordi.</div>
      )}

      <div className="card">
        <label>Test</label>
        <select value={testId} onChange={(e) => chooseTest(e.target.value)} disabled={loadingTests}>
          <option value="">{loadingTests ? 'Yuklanmoqda...' : 'Testni tanlang...'}</option>
          {tests.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        {test && (
          <p className="muted">
            {totalPending > 0
              ? `Tekshirilmagan javoblar: ${totalPending} ta.`
              : "Bu testda tekshirilmagan javob qolmagan."}
          </p>
        )}
      </div>

      {test && (
        <>
          <div className="card">
            <div className="q-grid">
              {questions.map((qq, i) => {
                const st = stats[i]
                const cls = qq.type === 'open' ? (st?.pending > 0 ? 'q-pending' : 'q-correct') : 'q-unanswered'
                return (
                  <button
                    key={i}
                    className={`q-cell ${cls}${i === qi ? ' q-current' : ''}`}
                    title={
                      qq.type === 'open'
                        ? `${i + 1}-savol: ${st?.pending || 0} ta tekshirilmagan`
                        : `${i + 1}-savol: test savoli (avtomatik)`
                    }
                    onClick={() => setQi(i)}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <div className="q-legend">
              <span>
                <i className="dot q-pending" /> Tekshirilmagan javoblar bor
              </span>
              <span>
                <i className="dot q-correct" /> Hammasi tekshirilgan
              </span>
              <span>
                <i className="dot q-unanswered" /> Test savoli (avtomatik)
              </span>
            </div>
          </div>

          {q && (
            <div className="card">
              <div className="q-view-head">
                <h3>
                  {qi + 1}-savol <span className="muted">/ {questions.length}</span>
                </h3>
                <div className="action-cell">
                  <button className="secondary-btn" disabled={qi === 0} onClick={() => setQi(qi - 1)}>
                    ← Oldingi
                  </button>
                  <button className="secondary-btn" disabled={qi >= questions.length - 1} onClick={() => setQi(qi + 1)}>
                    Keyingi →
                  </button>
                  <button disabled={totalPending === 0} onClick={nextPending}>
                    Keyingi tekshirilmagan
                  </button>
                </div>
              </div>

              <p className="question-text">{q.question}</p>

              {q.type === 'open' ? (
                !isBlank(q.correctAnswer) && (
                  <div className="banner">
                    <strong>Namunaviy javob:</strong> <span className="question-text">{q.correctAnswer}</span>
                  </div>
                )
              ) : (
                <div className="options">
                  {q.options.map((opt, j) => (
                    <div key={j} className={`option option-card${j === Number(q.correctAnswer) ? ' option-correct' : ''}`}>
                      <span className="question-text">{opt}</span>
                    </div>
                  ))}
                </div>
              )}

              {loadingRows ? (
                <p>Yuklanmoqda...</p>
              ) : (
                <>
                  <p className="muted">
                    Javob berganlar: {answered.length}
                    {q.type === 'open' && ` · Tekshirilmagan: ${pendingRows.length}`}
                    {` · Javob bermaganlar: ${blanks.length}`}
                  </p>

                  {q.type === 'open' && (
                    <label className="opt-row opt-block">
                      <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />
                      <span>Faqat tekshirilmaganlarni ko'rsatish</span>
                    </label>
                  )}

                  <div className="gq-list">
                    {shown.map((r) => (
                      <div key={r.id} className={`gq-row${q.type === 'open' && !r.reviewed ? ' gq-pending' : ''}`}>
                        <div className="gq-student">
                          <strong>{name(r)}</strong>
                          <span className="muted">{formatDate(r.attempts?.submitted_at)}</span>
                        </div>
                        <div className="gq-answer question-text">
                          {q.type === 'mcq' ? q.options[Number(r.answer)] ?? r.answer : r.answer}
                        </div>
                        {q.type === 'open' ? (
                          <div className="action-cell">
                            <button
                              className={r.reviewed && r.is_correct ? 'btn-green' : 'secondary-btn'}
                              disabled={busyId === r.id}
                              onClick={() => mark(r, true)}
                            >
                              To'g'ri
                            </button>
                            <button
                              className={r.reviewed && r.is_correct === false ? 'btn-red' : 'secondary-btn'}
                              disabled={busyId === r.id}
                              onClick={() => mark(r, false)}
                            >
                              Noto'g'ri
                            </button>
                          </div>
                        ) : (
                          <span className={r.is_correct ? 'gq-ok' : 'gq-bad'}>{r.is_correct ? "To'g'ri" : "Noto'g'ri"}</span>
                        )}
                      </div>
                    ))}
                    {shown.length === 0 && (
                      <p className="muted">
                        {q.type === 'open' && pendingOnly && answered.length > 0
                          ? "Bu savol bo'yicha hamma javob tekshirilgan."
                          : "Bu savolga hali javob yo'q."}
                      </p>
                    )}
                  </div>

                  {blanks.length > 0 && (
                    <div className="gq-blanks">
                      <p className="muted">Javob bermaganlar (avtomatik noto'g'ri): {blanks.length} ta</p>
                      <div className="chips">
                        {blanks.map((r) => (
                          <span key={r.id} className="chip">
                            {name(r)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
