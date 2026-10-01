import { useState } from 'react'
import { isBlank } from '../lib/format'
import { useArrowKeys } from '../lib/useArrowKeys'
import QuestionNavigator from './QuestionNavigator'

// Administrator testni talaba hisobisiz ko'rib chiqadi.
// Hech narsa yechilmaydi va hech narsa bazaga saqlanmaydi.
export default function AdminTestPreview({ test, onBack }) {
  const questions = test.questions_json
  const [current, setCurrent] = useState(0)
  const [showNav, setShowNav] = useState(false)
  const [showAnswers, setShowAnswers] = useState(true)

  useArrowKeys({
    enabled: !showNav,
    onLeft: () => setCurrent((c) => Math.max(0, c - 1)),
    onRight: () => setCurrent((c) => Math.min(questions.length - 1, c + 1))
  })

  const q = questions[current]

  return (
    <div>
      <button onClick={onBack}>← Testlarga qaytish</button>
      <h2>{test.title}</h2>
      <div className="banner">
        Ko'rib chiqish rejimi: bu yerda test yechilmaydi va hech narsa saqlanmaydi.
        <br />
        {test.duration_minutes} daqiqa — {questions.length} ta savol
      </div>

      <div className="test-header">
        <p>
          Savol {current + 1} / {questions.length}
        </p>
        <div className="header-actions">
          <button className="secondary-btn" onClick={() => setShowAnswers((v) => !v)}>
            {showAnswers ? "Javoblarni yashirish (talaba ko'rinishi)" : "Javoblarni ko'rsatish"}
          </button>
          <button className="secondary-btn" onClick={() => setShowNav(true)}>
            Barcha savollar
          </button>
        </div>
      </div>

      <div className="card">
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
          <div>
            <p className="muted">Ochiq savol — talaba javobni o'zi yozadi.</p>
            {showAnswers &&
              (!isBlank(q.correctAnswer) ? (
                <p className="question-text option-correct preview-option">
                  <strong>Namunaviy javob:</strong> {q.correctAnswer}
                </p>
              ) : (
                <p className="muted">Namunaviy javob kiritilmagan (javobni administrator baholaydi).</p>
              ))}
          </div>
        )}
      </div>

      <div className="nav-buttons">
        <button disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
          Oldingi
        </button>
        <button disabled={current === questions.length - 1} onClick={() => setCurrent((c) => c + 1)}>
          Keyingi
        </button>
      </div>

      {showNav && (
        <QuestionNavigator
          total={questions.length}
          current={current}
          mode="preview"
          statusOf={() => 'unanswered'}
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
