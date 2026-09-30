import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isBlank } from '../lib/format'
import { useArrowKeys } from '../lib/useArrowKeys'
import QuestionNavigator from './QuestionNavigator'

// Talaba o'z natijasini, admin esa istalgan talabaning natijasini ko'rib chiqishi uchun ishlatiladi.
export default function ReviewResult({ attemptId, onBack, studentName }) {
  const [test, setTest] = useState(null)
  const [answers, setAnswers] = useState([])
  const [current, setCurrent] = useState(0)
  const [showNav, setShowNav] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [attemptId])

  const total = test ? test.questions_json.length : 0

  // Chap / o'ng strelka tugmalari bilan savollar orasida yurish
  useArrowKeys({
    enabled: !showNav && !!test,
    onLeft: () => setCurrent((c) => Math.max(0, c - 1)),
    onRight: () => setCurrent((c) => Math.min(total - 1, c + 1))
  })

  async function load() {
    setLoading(true)
    setError('')
    const { data: a, error: aErr } = await supabase.from('attempts').select('*').eq('id', attemptId).single()
    if (aErr || !a) {
      setError('Urinishni yuklashda xatolik: ' + (aErr?.message || ''))
      setLoading(false)
      return
    }
    const { data: t, error: tErr } = await supabase.from('tests').select('*').eq('id', a.test_id).single()
    if (tErr || !t) {
      setError('Testni yuklashda xatolik: ' + (tErr?.message || ''))
      setLoading(false)
      return
    }
    const { data: ans, error: ansErr } = await supabase
      .from('answers')
      .select('*')
      .eq('attempt_id', attemptId)
      .order('question_index')
    if (ansErr) {
      setError('Javoblarni yuklashda xatolik: ' + ansErr.message)
      setLoading(false)
      return
    }
    setTest(t)
    setAnswers(ans)
    setLoading(false)
  }

  // Har bir savol uchun holat: correct / incorrect / unanswered / pending
  function statusOf(i) {
    const q = test.questions_json[i]
    const a = answers.find((x) => x.question_index === i)
    if (isBlank(a?.answer)) return 'unanswered'
    if (q.type === 'open' && !a?.reviewed) return 'pending'
    return a?.is_correct ? 'correct' : 'incorrect'
  }

  if (loading) return <p>Yuklanmoqda...</p>
  if (error) return <div className="error">{error}</div>
  if (!test) return null

  const q = test.questions_json[current]
  const a = answers.find((x) => x.question_index === current)
  const studentAnswer = a?.answer

  const correctAnswerDisplay = q.type === 'mcq' ? q.options[q.correctAnswer] : q.correctAnswer
  const studentAnswerDisplay = q.type === 'mcq' ? (!isBlank(studentAnswer) ? q.options[Number(studentAnswer)] : null) : studentAnswer

  const status = statusOf(current)
  const resultText = {
    unanswered: 'Javob berilmagan',
    correct: "To'g'ri",
    incorrect: "Noto'g'ri",
    pending: 'Tekshiruvni kutmoqda'
  }[status]

  return (
    <div>
      <button onClick={onBack}>← Natijalarga qaytish</button>
      <h2>{test.title}</h2>
      {studentName && (
        <p>
          <strong>Talaba:</strong> {studentName}
        </p>
      )}
      <div className="test-header">
        <p>
          Savol {current + 1} / {test.questions_json.length}
        </p>
        <button className="secondary-btn" onClick={() => setShowNav(true)}>
          Barcha savollar
        </button>
      </div>
      <div className="card">
        <p className="question-text">{q.question}</p>
        <p className="question-text">
          <strong>{studentName ? 'Talaba javobi:' : 'Sizning javobingiz:'}</strong> {studentAnswerDisplay || "(javob yo'q)"}
        </p>
        {!isBlank(correctAnswerDisplay) && (
          <p className="question-text">
            <strong>To'g'ri javob:</strong> {correctAnswerDisplay}
          </p>
        )}
        <p className={status === 'correct' ? 'success' : status === 'incorrect' ? 'error' : ''}>{resultText}</p>
      </div>
      <div className="nav-buttons">
        <button disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
          Oldingi
        </button>
        <button disabled={current === test.questions_json.length - 1} onClick={() => setCurrent((c) => c + 1)}>
          Keyingi
        </button>
      </div>
      {showNav && (
        <QuestionNavigator
          total={test.questions_json.length}
          current={current}
          mode="review"
          statusOf={statusOf}
          onSelect={(i) => {
            setCurrent(i)
            setShowNav(false)
          }}
          onClose={() => setShowNav(false)}
        />
      )}
    </div>
  )
}
