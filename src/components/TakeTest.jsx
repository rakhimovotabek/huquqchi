import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isBlank } from '../lib/format'
import { useArrowKeys } from '../lib/useArrowKeys'
import QuestionNavigator from './QuestionNavigator'

export default function TakeTest({ test, profile, onDone }) {
  const [attempt, setAttempt] = useState(null)
  const [answers, setAnswers] = useState({})
  const [current, setCurrent] = useState(0)
  const [remaining, setRemaining] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showNav, setShowNav] = useState(false)
  const submittedRef = useRef(false)

  const questions = test.questions_json

  // Chap / o'ng strelka tugmalari bilan savollar orasida yurish
  useArrowKeys({
    enabled: !showNav,
    onLeft: () => setCurrent((c) => Math.max(0, c - 1)),
    onRight: () => setCurrent((c) => Math.min(questions.length - 1, c + 1))
  })

  useEffect(() => {
    initAttempt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!attempt) return
    const tick = () => {
      const startedAt = new Date(attempt.started_at).getTime()
      const elapsedSec = (Date.now() - startedAt) / 1000
      const remainingSec = Math.max(0, test.duration_minutes * 60 - elapsedSec)
      setRemaining(remainingSec)
      if (remainingSec <= 0 && !submittedRef.current) {
        submittedRef.current = true
        doSubmit()
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  async function initAttempt() {
    setLoading(true)
    setError('')
    const { data: existing, error: findErr } = await supabase
      .from('attempts')
      .select('*')
      .eq('student_id', profile.id)
      .eq('test_id', test.id)
      .eq('status', 'in_progress')
      .maybeSingle()

    if (findErr) {
      setError('Urinishni yuklashda xatolik: ' + findErr.message)
      setLoading(false)
      return
    }

    if (existing) {
      setAttempt(existing)
      setLoading(false)
      return
    }

    const { data: created, error: createErr } = await supabase
      .from('attempts')
      .insert({
        student_id: profile.id,
        test_id: test.id,
        started_at: new Date().toISOString(),
        status: 'in_progress',
        total_questions: questions.length
      })
      .select()
      .single()

    if (createErr) {
      setError('Testni boshlashda xatolik: ' + createErr.message)
      setLoading(false)
      return
    }
    setAttempt(created)
    setLoading(false)
  }

  function setAnswer(value) {
    setAnswers((prev) => ({ ...prev, [current]: value }))
  }

  async function doSubmit() {
    if (!attempt || submitting) return
    setSubmitting(true)
    setError('')

    let mcqScore = 0
    let hasOpenToReview = false

    const rows = questions.map((q, i) => {
      const studentAnswer = answers[i]
      const hasAnswer = !isBlank(studentAnswer)
      if (q.type === 'mcq') {
        const isCorrect = hasAnswer && Number(studentAnswer) === Number(q.correctAnswer)
        if (isCorrect) mcqScore++
        return {
          attempt_id: attempt.id,
          question_index: i,
          answer: hasAnswer ? String(studentAnswer) : null,
          is_correct: isCorrect,
          reviewed: true
        }
      }
      // Ochiq savol: bo'sh qoldirilgan bo'lsa admin ko'rmaydi, avtomatik "noto'g'ri" bo'ladi
      if (!hasAnswer) {
        return {
          attempt_id: attempt.id,
          question_index: i,
          answer: null,
          is_correct: false,
          reviewed: true
        }
      }
      hasOpenToReview = true
      return {
        attempt_id: attempt.id,
        question_index: i,
        answer: String(studentAnswer).trim(),
        is_correct: null,
        reviewed: false
      }
    })

    const { error: ansErr } = await supabase.from('answers').insert(rows)
    if (ansErr) {
      setError('Testni topshirishda xatolik: ' + ansErr.message)
      setSubmitting(false)
      submittedRef.current = false
      return
    }

    const status = hasOpenToReview ? 'pending_review' : 'completed'
    const { error: updErr } = await supabase
      .from('attempts')
      .update({ submitted_at: new Date().toISOString(), score: mcqScore, status })
      .eq('id', attempt.id)

    setSubmitting(false)
    if (updErr) {
      setError('Topshirishni yakunlashda xatolik: ' + updErr.message)
      return
    }
    onDone()
  }

  function handleSubmitClick() {
    if (test.access === 'one_time') {
      const ok = confirm("Bu bir martalik test. Topshirgandan keyin uni qayta topshira olmaysiz. Topshirasizmi?")
      if (!ok) return
    }
    doSubmit()
  }

  if (loading) return <p>Test yuklanmoqda...</p>
  if (error && !attempt) return <div className="error">{error}</div>
  if (!attempt) return null

  const q = questions[current]
  const minutes = remaining !== null ? Math.floor(remaining / 60) : Math.floor(test.duration_minutes)
  const seconds = remaining !== null ? Math.floor(remaining % 60) : 0

  return (
    <div>
      <div className="test-header">
        <h2>{test.title}</h2>
        <div className="header-actions">
          <button className="secondary-btn" onClick={() => setShowNav(true)}>
            Barcha savollar
          </button>
          <div className="timer">
            Qolgan vaqt: {minutes}:{String(seconds).padStart(2, '0')}
          </div>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <p>
        Savol {current + 1} / {questions.length}
      </p>
      <div className="card">
        <p className="question-text">{q.question}</p>
        {q.type === 'mcq' ? (
          <div className="options">
            {q.options.map((opt, idx) => (
              <label key={idx} className="option">
                <input type="radio" name={`q${current}`} checked={answers[current] === idx} onChange={() => setAnswer(idx)} />
                {opt}
              </label>
            ))}
          </div>
        ) : (
          <textarea
            rows={5}
            placeholder="Javobingizni yozing..."
            value={answers[current] || ''}
            onChange={(e) => setAnswer(e.target.value)}
          />
        )}
      </div>
      <div className="nav-buttons">
        <button disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
          Oldingi
        </button>
        {current < questions.length - 1 ? (
          <button onClick={() => setCurrent((c) => c + 1)}>Keyingi</button>
        ) : (
          <button disabled={submitting} onClick={handleSubmitClick}>
            {submitting ? 'Topshirilmoqda...' : 'Topshirish'}
          </button>
        )}
      </div>
      {showNav && (
        <QuestionNavigator
          total={questions.length}
          current={current}
          mode="test"
          statusOf={(i) => (isBlank(answers[i]) ? 'unanswered' : 'answered')}
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
