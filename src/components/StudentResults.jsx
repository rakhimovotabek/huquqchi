import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'
import ReviewResult from './ReviewResult'
import Leaderboard from './Leaderboard'

export default function StudentResults({ profile, onSeen }) {
  const [attempts, setAttempts] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [openAttempt, setOpenAttempt] = useState(null)
  const [boardFor, setBoardFor] = useState(null) // { testId, title }

  useEffect(() => {
    if (!openAttempt) loadResults()
  }, [openAttempt])

  async function loadResults() {
    setLoading(true)
    const { data, error } = await supabase
      .from('attempts')
      .select('*, tests(title, show_leaderboard)')
      .eq('student_id', profile.id)
      .not('submitted_at', 'is', null)
      .order('created_at', { ascending: false })
    if (error) setError('Natijalarni yuklashda xatolik: ' + error.message)
    else setAttempts(data)
    setLoading(false)
  }

  async function openResult(a) {
    setOpenAttempt(a.id)
    if (a.result_seen === false) {
      await supabase.from('attempts').update({ result_seen: true }).eq('id', a.id)
      if (onSeen) onSeen()
    }
  }

  if (openAttempt) {
    return <ReviewResult attemptId={openAttempt} onBack={() => setOpenAttempt(null)} />
  }

  return (
    <div>
      <h2>Mening natijalarim</h2>
      {error && <div className="error">{error}</div>}
      {loading ? (
        <p>Yuklanmoqda...</p>
      ) : (
        <div className="test-list">
          {attempts.map((a) => {
            const pct = a.status === 'completed' && a.total_questions ? ((a.score / a.total_questions) * 100).toFixed(1) : null
            return (
              <div key={a.id} className="card">
                <h3>
                  {a.tests?.title}
                  {a.status === 'completed' && a.result_seen === false && <span className="new-pill">Yangi natija</span>}
                </h3>
                {a.status === 'completed' ? (
                  <>
                    <p>
                      {a.score} / {a.total_questions} ({pct}%)
                    </p>
                    <p>Yakunlangan</p>
                    <div className="action-cell">
                      <button onClick={() => openResult(a)}>Ko'rib chiqish</button>
                      {a.tests?.show_leaderboard && (
                        <button
                          className="secondary-btn"
                          onClick={() => setBoardFor({ testId: a.test_id, title: a.tests?.title })}
                        >
                          Reyting
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <p>Tekshiruvni kutmoqda</p>
                )}
                <p className="muted">{formatDate(a.submitted_at)}</p>
              </div>
            )
          })}
          {attempts.length === 0 && <p>Hozircha natijalar yo'q.</p>}
        </div>
      )}
      {boardFor && (
        <div className="modal-backdrop" onClick={() => setBoardFor(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Reyting: {boardFor.title}</h3>
              <button className="modal-close" onClick={() => setBoardFor(null)} aria-label="Yopish">
                ✕
              </button>
            </div>
            <Leaderboard testId={boardFor.testId} />
            <p className="muted">Har bir talabaning eng yaxshi natijasi hisobga olinadi.</p>
          </div>
        </div>
      )}
    </div>
  )
}
