import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import TakeTest from './TakeTest'

export default function StudentTests({ profile }) {
  const [tests, setTests] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTest, setActiveTest] = useState(null)

  useEffect(() => {
    if (!activeTest) loadTests()
  }, [activeTest])

  async function loadTests() {
    setLoading(true)
    // Talabaga faqat ruxsat berilgan testlar ko'rinadi
    const { data, error } = await supabase
      .from('tests')
      .select('*')
      .in('access', ['allowed', 'one_time'])
      .order('created_at', { ascending: false })
    if (error) {
      setError('Testlarni yuklashda xatolik: ' + error.message)
      setLoading(false)
      return
    }

    // Bir martalik testlar: talaba topshirgandan keyin u testni boshqa ko'rmaydi
    const { data: done, error: doneErr } = await supabase
      .from('attempts')
      .select('test_id')
      .eq('student_id', profile.id)
      .not('submitted_at', 'is', null)
    if (doneErr) {
      setError('Testlarni yuklashda xatolik: ' + doneErr.message)
      setLoading(false)
      return
    }
    const doneIds = new Set((done || []).map((x) => x.test_id))
    setTests(data.filter((t) => t.access !== 'one_time' || !doneIds.has(t.id)))
    setLoading(false)
  }

  if (activeTest) {
    return <TakeTest test={activeTest} profile={profile} onDone={() => setActiveTest(null)} />
  }

  return (
    <div>
      <h2>Mavjud testlar</h2>
      {error && <div className="error">{error}</div>}
      {loading ? (
        <p>Yuklanmoqda...</p>
      ) : (
        <div className="test-list">
          {tests.map((t) => (
            <div key={t.id} className="card">
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
              <button onClick={() => setActiveTest(t)}>Testni boshlash</button>
            </div>
          ))}
          {tests.length === 0 && <p>Hozircha testlar yo'q.</p>}
        </div>
      )}
    </div>
  )
}
