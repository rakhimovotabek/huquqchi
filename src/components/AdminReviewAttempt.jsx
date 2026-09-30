import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isBlank } from '../lib/format'

export default function AdminReviewAttempt({ attemptId, onBack }) {
  const [attempt, setAttempt] = useState(null)
  const [test, setTest] = useState(null)
  const [answers, setAnswers] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [attemptId])

  // Barcha javoblar tekshirilgan bo'lsa, yakuniy ballni hisoblab saqlaydi
  async function finalizeIfDone(currentAnswers, currentAttempt) {
    if (currentAttempt.status === 'completed') return currentAttempt
    if (!currentAnswers.every((a) => a.reviewed)) return currentAttempt
    const score = currentAnswers.filter((a) => a.is_correct).length
    const { error: updErr } = await supabase.from('attempts').update({ score, status: 'completed' }).eq('id', attemptId)
    if (updErr) {
      setError('Yakuniy ballni saqlashda xatolik: ' + updErr.message)
      return currentAttempt
    }
    return { ...currentAttempt, score, status: 'completed' }
  }

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

    let currentAnswers = ans
    let currentAttempt = a

    // Bo'sh qoldirilgan ochiq javoblar adminga ko'rsatilmaydi va avtomatik "noto'g'ri" deb belgilanadi
    const blankIds = currentAnswers
      .filter((x) => t.questions_json[x.question_index]?.type === 'open' && isBlank(x.answer) && !x.reviewed)
      .map((x) => x.id)

    if (blankIds.length > 0) {
      const { error: blankErr } = await supabase
        .from('answers')
        .update({ is_correct: false, reviewed: true })
        .in('id', blankIds)
      if (blankErr) {
        setError("Bo'sh javoblarni belgilashda xatolik: " + blankErr.message)
      } else {
        currentAnswers = currentAnswers.map((x) => (blankIds.includes(x.id) ? { ...x, is_correct: false, reviewed: true } : x))
      }
    }

    currentAttempt = await finalizeIfDone(currentAnswers, currentAttempt)

    setAttempt(currentAttempt)
    setTest(t)
    setAnswers(currentAnswers)
    setLoading(false)
  }

  async function markAnswer(answerId, isCorrect) {
    setSaving(true)
    setError('')
    const { error } = await supabase.from('answers').update({ is_correct: isCorrect, reviewed: true }).eq('id', answerId)
    if (error) {
      setError('Bahoni saqlashda xatolik: ' + error.message)
      setSaving(false)
      return
    }
    const updatedAnswers = answers.map((a) => (a.id === answerId ? { ...a, is_correct: isCorrect, reviewed: true } : a))
    setAnswers(updatedAnswers)
    const updatedAttempt = await finalizeIfDone(updatedAnswers, attempt)
    setAttempt(updatedAttempt)
    setSaving(false)
  }

  if (loading) return <p>Yuklanmoqda...</p>
  if (error && !test) return <div className="error">{error}</div>
  if (!test || !attempt) return null

  // Faqat javob yozilgan ochiq savollar ko'rsatiladi
  const visibleAnswers = answers.filter(
    (a) => test.questions_json[a.question_index]?.type === 'open' && !isBlank(a.answer)
  )

  return (
    <div>
      <button onClick={onBack}>← Natijalarga qaytish</button>
      <h2>Baholash: {test.title}</h2>
      {error && <div className="error">{error}</div>}
      {attempt.status === 'completed' && (
        <p className="success">
          Tekshiruv yakunlandi. Yakuniy ball: {attempt.score} / {attempt.total_questions}
        </p>
      )}
      {visibleAnswers.map((a) => {
        const q = test.questions_json[a.question_index]
        return (
          <div key={a.id} className="card">
            <p className="question-text">
              <strong>{a.question_index + 1}-savol.</strong> {q.question}
            </p>
            <p className="question-text">Talaba javobi: {a.answer}</p>
            {!isBlank(q.correctAnswer) && <p className="muted question-text">Namunaviy javob: {q.correctAnswer}</p>}
            {a.reviewed ? (
              <p>Belgilangan: {a.is_correct ? "To'g'ri" : "Noto'g'ri"}</p>
            ) : (
              <div className="button-row">
                <button disabled={saving} onClick={() => markAnswer(a.id, true)}>
                  To'g'ri
                </button>
                <button disabled={saving} onClick={() => markAnswer(a.id, false)}>
                  Noto'g'ri
                </button>
              </div>
            )}
          </div>
        )
      })}
      {visibleAnswers.length === 0 && <p>Baholash uchun ochiq javoblar yo'q.</p>}
    </div>
  )
}
