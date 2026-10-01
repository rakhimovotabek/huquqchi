import { useState } from 'react'
import { isBlank } from '../lib/format'

// Xatolar ustida ishlash: faqat noto'g'ri yoki javobsiz qolgan savollar qayta beriladi.
// Hech narsa bazaga yozilmaydi va rasmiy natijaga ta'sir qilmaydi.
export default function PracticeMistakes({ questions, wrongIdx, onBack }) {
  const [queue, setQueue] = useState(wrongIdx) // hozirgi davrada ishlanayotgan savollar (asl indekslar)
  const [pos, setPos] = useState(0)
  const [pick, setPick] = useState(null) // mcq: tanlangan variant
  const [text, setText] = useState('') // open: yozilgan javob
  const [checked, setChecked] = useState(false)
  const [missed, setMissed] = useState([]) // shu davrada yana xato qilinganlar
  const [round, setRound] = useState(1)
  const [correctCount, setCorrectCount] = useState(0)

  const finished = pos >= queue.length

  if (finished) {
    return (
      <div>
        <button onClick={onBack}>← Natijaga qaytish</button>
        <h2>Mashq yakunlandi</h2>
        <div className="card">
          <p className="stat-value">
            {correctCount} / {queue.length}
          </p>
          <p>{round}-urinishda to'g'ri javoblar.</p>
          {missed.length === 0 ? (
            <p className="success">Barakalla! Barcha xato qilingan savollarni to'g'ri yechdingiz.</p>
          ) : (
            <p className="muted">Yana {missed.length} ta savol xato qoldi.</p>
          )}
          <p className="muted">Bu mashq faqat o'qish uchun: rasmiy natijangiz o'zgarmaydi.</p>
          <div className="form-actions">
            {missed.length > 0 && (
              <button
                onClick={() => {
                  setQueue(missed)
                  setMissed([])
                  setPos(0)
                  setRound((r) => r + 1)
                  setCorrectCount(0)
                  setPick(null)
                  setText('')
                  setChecked(false)
                }}
              >
                Qolgan xatolarni qayta ishlash
              </button>
            )}
            <button className="secondary-btn" onClick={onBack}>
              Tugatish
            </button>
          </div>
        </div>
      </div>
    )
  }

  const qi = queue[pos]
  const q = questions[qi]

  function next(wasCorrect) {
    if (wasCorrect) setCorrectCount((c) => c + 1)
    else setMissed((m) => [...m, qi])
    setPos((p) => p + 1)
    setPick(null)
    setText('')
    setChecked(false)
  }

  const mcqCorrect = q.type === 'mcq' && pick !== null && Number(pick) === Number(q.correctAnswer)

  return (
    <div>
      <button onClick={onBack}>← Natijaga qaytish</button>
      <h2>Xatolarni qayta ishlash</h2>
      <p className="muted">
        Savol {pos + 1} / {queue.length} (asl raqami: {qi + 1}). Natija saqlanmaydi.
      </p>

      <div className="card">
        <p className="question-text">{q.question}</p>
        {q.type === 'mcq' ? (
          <div className="options">
            {q.options.map((opt, j) => {
              let cls = 'option option-card'
              if (checked && j === Number(q.correctAnswer)) cls += ' option-correct'
              else if (checked && j === pick) cls += ' option-wrong'
              else if (!checked && j === pick) cls += ' selected'
              return (
                <label key={j} className={cls}>
                  <input type="radio" disabled={checked} checked={pick === j} onChange={() => setPick(j)} />
                  <span className="question-text">{opt}</span>
                </label>
              )
            })}
          </div>
        ) : (
          <textarea
            rows={5}
            placeholder="Javobingizni yozing..."
            value={text}
            disabled={checked}
            onChange={(e) => setText(e.target.value)}
          />
        )}

        {checked && q.type === 'mcq' && (
          <p className={mcqCorrect ? 'success' : 'error'}>{mcqCorrect ? "To'g'ri!" : "Noto'g'ri. To'g'ri javob yashil rangda."}</p>
        )}
        {checked && q.type === 'open' && (
          <div className="banner">
            {!isBlank(q.correctAnswer) ? (
              <>
                <strong>Namunaviy javob:</strong> <span className="question-text">{q.correctAnswer}</span>
              </>
            ) : (
              <span>Bu savol uchun namunaviy javob kiritilmagan. O'z javobingizni o'qituvchi bilan tekshiring.</span>
            )}
          </div>
        )}
      </div>

      <div className="nav-buttons">
        {!checked && q.type === 'mcq' && (
          <button disabled={pick === null} onClick={() => setChecked(true)}>
            Tekshirish
          </button>
        )}
        {!checked && q.type === 'open' && <button onClick={() => setChecked(true)}>Javobni ko'rsatish</button>}
        {checked && q.type === 'mcq' && <button onClick={() => next(mcqCorrect)}>Keyingi</button>}
        {checked && q.type === 'open' && (
          <>
            <button className="btn-green" onClick={() => next(true)}>
              To'g'ri yozgan edim
            </button>
            <button className="btn-red" onClick={() => next(false)}>
              Xato qildim
            </button>
          </>
        )}
      </div>
    </div>
  )
}
