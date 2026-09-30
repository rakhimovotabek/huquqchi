import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'
import ReviewResult from './ReviewResult'

export default function StudentResults({ profile }) {
  const [attempts, setAttempts] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [openAttempt, setOpenAttempt] = useState(null)

  useEffect(() => {
    if (!openAttempt) loadResults()
  }, [openAttempt])

  async function loadResults() {
    setLoading(true)
    const { data, error } = await supabase
      .from('attempts')
      .select('*, tests(title)')
      .eq('student_id', profile.id)
      .not('submitted_at', 'is', null)
      .order('created_at', { ascending: false })
    if (error) setError('Natijalarni yuklashda xatolik: ' + error.message)
    else setAttempts(data)
    setLoading(false)
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
                <h3>{a.tests?.title}</h3>
                {a.status === 'completed' ? (
                  <>
                    <p>
                      {a.score} / {a.total_questions} ({pct}%)
                    </p>
                    <p>Yakunlangan</p>
                    <button onClick={() => setOpenAttempt(a.id)}>Ko'rib chiqish</button>
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
    </div>
  )
}
