import { useEffect } from 'react'

// Barcha savollar oynasi.
// statusOf(i) qaytaradi: 'answered' | 'unanswered' | 'correct' | 'incorrect' | 'pending'
// mode: 'test' (yashil / oq) yoki 'review' (yashil / qizil / oq)
export default function QuestionNavigator({ total, current, mode, statusOf, onSelect, onClose }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const items = Array.from({ length: total }, (_, i) => ({ i, status: statusOf(i) }))
  const hasPending = mode === 'review' && items.some((x) => x.status === 'pending')

  const statusLabel = {
    answered: 'javob berilgan',
    unanswered: 'javob berilmagan',
    correct: "to'g'ri",
    incorrect: "noto'g'ri",
    pending: 'tekshiruvda'
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Barcha savollar</h3>
          <button className="modal-close" onClick={onClose} aria-label="Yopish">
            ✕
          </button>
        </div>
        <div className="q-grid">
          {items.map(({ i, status }) => (
            <button
              key={i}
              className={`q-cell q-${status}${i === current ? ' q-current' : ''}`}
              title={`${i + 1}-savol: ${statusLabel[status]}`}
              onClick={() => onSelect(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="q-legend">
          {mode === 'test' ? (
            <>
              <span>
                <i className="dot q-answered" /> Javob berilgan
              </span>
              <span>
                <i className="dot q-unanswered" /> Javob berilmagan
              </span>
            </>
          ) : (
            <>
              <span>
                <i className="dot q-correct" /> To'g'ri
              </span>
              <span>
                <i className="dot q-incorrect" /> Noto'g'ri
              </span>
              <span>
                <i className="dot q-unanswered" /> Javob berilmagan
              </span>
              {hasPending && (
                <span>
                  <i className="dot q-pending" /> Tekshiruvda
                </span>
              )}
            </>
          )}
          <span>
            <i className="dot q-unanswered q-current" /> Joriy savol
          </span>
        </div>
      </div>
    </div>
  )
}
