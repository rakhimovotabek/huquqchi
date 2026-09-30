import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'
import AdminReviewAttempt from './AdminReviewAttempt'
import ReviewResult from './ReviewResult'

export default function AdminResults() {
  const [attempts, setAttempts] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  // { id, mode: 'grade' | 'view', studentName }
  const [openAttempt, setOpenAttempt] = useState(null)

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

  return (
    <div>
      <h2>Natijalar</h2>
      {error && <div className="error">{error}</div>}
      {loading ? (
        <p>Yuklanmoqda...</p>
      ) : (
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
            {attempts.map((a) => (
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
            {attempts.length === 0 && (
              <tr>
                <td colSpan="6">Hozircha natijalar yo'q</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
