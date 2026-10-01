import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/paged'
import Leaderboard from './Leaderboard'

// Bitta test bo'yicha statistika: o'rtacha ball va eng ko'p xato qilingan savollar.
export default function AdminTestStats({ test, onBack }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState([])
  const [perQuestion, setPerQuestion] = useState([])
  const [showAll, setShowAll] = useState(false)
  const [showAnswers, setShowAnswers] = useState(true)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test.id])

  async function load() {
    setLoading(true)
    setError('')
    const { data: att, error: aErr } = await fetchAll(() =>
      supabase
        .from('attempts')
        .select('id, score, total_questions, status')
        .eq('test_id', test.id)
        .not('submitted_at', 'is', null)
        .order('id')
    )
    if (aErr) {
      setError('Statistikani yuklashda xatolik: ' + aErr.message)
      setLoading(false)
      return
    }
    const { data: ans, error: ansErr } = await fetchAll(() =>
      supabase
        .from('answers')
        .select('question_index, is_correct, answer, attempts!inner(test_id)')
        .eq('attempts.test_id', test.id)
        .order('id')
    )
    if (ansErr) {
      setError('Javoblarni yuklashda xatolik: ' + ansErr.message)
      setLoading(false)
      return
    }

    // Har bir savol: nechta talaba tekshirilgan javob berdi va nechtasi to'g'ri
    const stats = test.questions_json.map((q, i) => ({ i, q, right: 0, wrong: 0, skipped: 0 }))
    ans.forEach((a) => {
      const s = stats[a.question_index]
      if (!s || a.is_correct === null) return // hali tekshirilmagan ochiq javob
      if (a.is_correct) s.right++
      else if (a.answer === null || String(a.answer).trim() === '') s.skipped++
      else s.wrong++
    })
    const rows = stats
      .map((s) => {
        const n = s.right + s.wrong + s.skipped
        return { ...s, n, pct: n ? Math.round((s.right / n) * 100) : null }
      })
      .filter((s) => s.n > 0)
      .sort((a, b) => a.pct - b.pct || a.i - b.i)

    setAttempts(att)
    setPerQuestion(rows)
    setLoading(false)
  }

  const completed = attempts.filter((a) => a.status === 'completed' && a.total_questions > 0)
  const avg = completed.length
    ? completed.reduce((sum, a) => sum + a.score / a.total_questions, 0) / completed.length
    : null
  const best = completed.length ? Math.max(...completed.map((a) => a.score / a.total_questions)) : null
  const pending = attempts.filter((a) => a.status === 'pending_review').length
  const visible = showAll ? perQuestion : perQuestion.slice(0, 10)
  const pctByIndex = {}
  perQuestion.forEach((x) => {
    pctByIndex[x.i] = x.pct
  })

  return (
    <div>
      <button className="secondary-btn" onClick={onBack}>
        ← Testlarga qaytish
      </button>
      <h2>{test.title}</h2>
      {error && <div className="error">{error}</div>}
      {loading ? (
        <p>Yuklanmoqda...</p>
      ) : (
        <>
          {attempts.length === 0 && <div className="card">Bu testni hali hech kim topshirmagan.</div>}
          {attempts.length > 0 && (
            <>
          <div className="stat-grid">
            <div className="card stat-card">
              <div className="muted">Topshirishlar</div>
              <div className="stat-value">{attempts.length}</div>
              {pending > 0 && <div className="muted">{pending} tasi tekshiruvda</div>}
            </div>
            <div className="card stat-card">
              <div className="muted">O'rtacha natija</div>
              <div className="stat-value">{avg !== null ? `${Math.round(avg * 1000) / 10}%` : '—'}</div>
              <div className="muted">yakunlanganlar bo'yicha</div>
            </div>
            <div className="card stat-card">
              <div className="muted">Eng yuqori natija</div>
              <div className="stat-value">{best !== null ? `${Math.round(best * 1000) / 10}%` : '—'}</div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Eng qiyin savollar</h3>
            <p className="muted">
              To'g'ri javob berganlar ulushi bo'yicha, eng pasti birinchi. Bu savollarni darsda qayta tushuntirish
              foydali.
            </p>
            {perQuestion.length === 0 ? (
              <p className="muted">Tekshirilgan javoblar hali yo'q.</p>
            ) : (
              <div className="q-stat-list">
                {visible.map((s) => (
                  <div key={s.i} className="q-stat">
                    <div className="q-stat-head">
                      <span className="q-stat-num">{s.i + 1}-savol</span>
                      <span className="q-stat-text">{s.q.question}</span>
                      <span className="q-stat-pct">{s.pct}%</span>
                    </div>
                    <div className="bar">
                      <div
                        className={`bar-fill ${s.pct < 40 ? 'bar-red' : s.pct < 70 ? 'bar-amber' : 'bar-green'}`}
                        style={{ width: `${s.pct}%` }}
                      />
                    </div>
                    <div className="muted">
                      To'g'ri: {s.right} · Noto'g'ri: {s.wrong} · Bo'sh: {s.skipped}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {perQuestion.length > 10 && (
              <button className="secondary-btn" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Faqat 10 tasini ko‘rsatish' : `Hammasini ko'rsatish (${perQuestion.length})`}
              </button>
            )}
          </div>

          <div className="card">
            <h3 className="card-title">Reyting (eng yaxshi 10 ta)</h3>
            <Leaderboard testId={test.id} />
          </div>
            </>
          )}

          <div className="list-head">
            <h3>Savollar ({test.questions_json.length})</h3>
            <button className="secondary-btn small" onClick={() => setShowAnswers((v) => !v)}>
              {showAnswers ? 'Javoblarni yashirish' : "Javoblarni ko'rsatish"}
            </button>
          </div>
          {test.questions_json.map((q, i) => {
            const st = pctByIndex[i]
            return (
              <div key={i} className="card question-view">
                <div className="q-view-head">
                  <strong>{i + 1}-savol</strong>
                  {st !== undefined && <span className="chip">{st}% to'g'ri javob bergan</span>}
                </div>
                <p className="question-text">{q.question}</p>
                {q.type === 'mcq' ? (
                  <div className="options">
                    {q.options.map((opt, idx) => {
                      const isCorrect = showAnswers && idx === q.correctAnswer
                      return (
                        <div key={idx} className={`option preview-option${isCorrect ? ' option-correct' : ''}`}>
                          <span>{String.fromCharCode(65 + idx)}.</span>
                          <span className="question-text">{opt}</span>
                          {isCorrect && <strong> ✓ To'g'ri javob</strong>}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <>
                    <p className="muted">Ochiq savol (admin baholaydi)</p>
                    {showAnswers && q.correctAnswer && (
                      <p className="question-text">
                        <strong>Namunaviy javob:</strong> {q.correctAnswer}
                      </p>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
