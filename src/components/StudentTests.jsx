import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'
import TakeTest from './TakeTest'

export default function StudentTests({ profile }) {
  const [tests, setTests] = useState([])
  const [resumeIds, setResumeIds] = useState(() => new Set())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTest, setActiveTest] = useState(null)

  useEffect(() => {
    if (!activeTest) loadTests()
  }, [activeTest])

  async function loadTests() {
    setLoading(true)
    // Talabaga faqat ruxsat berilgan testlar ko'rinadi ("selected" testlarni baza faqat tanlanganlarga qaytaradi)
    const { data, error } = await supabase
      .from('tests')
      .select('*')
      .in('access', ['allowed', 'one_time', 'selected'])
      .order('created_at', { ascending: false })
    if (error) {
      setError('Testlarni yuklashda xatolik: ' + error.message)
      setLoading(false)
      return
    }

    const { data: mine, error: mineErr } = await supabase
      .from('attempts')
      .select('test_id, status, submitted_at')
      .eq('student_id', profile.id)
    if (mineErr) {
      setError('Testlarni yuklashda xatolik: ' + mineErr.message)
      setLoading(false)
      return
    }
    const doneIds = new Set((mine || []).filter((x) => x.submitted_at).map((x) => x.test_id))
    const running = new Set((mine || []).filter((x) => x.status === 'in_progress').map((x) => x.test_id))
    setResumeIds(running)

    const now = Date.now()
    setTests(
      data.filter((t) => {
        // Bir martalik testlar: talaba topshirgandan keyin u testni boshqa ko'rmaydi
        if (t.access === 'one_time' && doneIds.has(t.id)) return false
        // Vaqti o'tib ketgan testlar yashiriladi (boshlab qo'ygan talaba bundan mustasno)
        if (t.closes_at && new Date(t.closes_at).getTime() <= now && !running.has(t.id)) return false
        return true
      })
    )
    setLoading(false)
  }

  if (activeTest) {
    return <TakeTest test={activeTest} profile={profile} onDone={() => setActiveTest(null)} />
  }

  const now = Date.now()

  return (
    <div>
      <h2>Mavjud testlar</h2>
      {error && <div className="error">{error}</div>}
      {loading ? (
        <p>Yuklanmoqda...</p>
      ) : (
        <div className="test-list">
          {tests.map((t) => {
            const resume = resumeIds.has(t.id)
            const notYet = !resume && t.opens_at && new Date(t.opens_at).getTime() > now
            return (
              <div key={t.id} className="card test-card">
                <h3>{t.title}</h3>
                <p>
                  {t.duration_minutes} daqiqa — {t.questions_json.length} ta savol
                </p>
                {t.access === 'one_time' && (
                  <p>
                    <span className="badge badge-one_time">Bir martalik test</span>
                    <span className="muted"> — faqat bir marta topshirish mumkin</span>
                  </p>
                )}
                {notYet && <p className="muted">Test {formatDate(t.opens_at)} da ochiladi.</p>}
                {!notYet && t.closes_at && !resume && (
                  <p className="muted">Test {formatDate(t.closes_at)} gacha ochiq.</p>
                )}
                {resume && <p className="muted">Siz bu testni boshlagansiz. Davom ettirishingiz mumkin.</p>}
                <button disabled={notYet} onClick={() => setActiveTest(t)}>
                  {notYet ? 'Hali ochilmagan' : resume ? 'Davom ettirish' : 'Testni boshlash'}
                </button>
              </div>
            )
          })}
          {tests.length === 0 && <p>Hozircha testlar yo'q.</p>}
        </div>
      )}
    </div>
  )
}
