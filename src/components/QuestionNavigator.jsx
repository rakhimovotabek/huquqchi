import { useEffect } from 'react'

// Barcha savollar oynasi.
// statusOf(i) qaytaradi: 'answered' | 'unanswered' | 'correct' | 'incorrect' | 'pending'
// mode: 'test' (yashil / oq), 'review' (yashil / qizil / oq) yoki 'preview' (admin ko'rib chiqishi, rangsiz)
export default function QuestionNavigator({ total, current, mode, statusOf, flaggedOf, onSelect, onClose }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const items = Array.from({ length: total }, (_, i) => ({ i, status: statusOf(i), flagged: flaggedOf ? flaggedOf(i) : false }))
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
          {items.map(({ i, status, flagged }) => (
            <button
              key={i}
              className={`q-cell q-${status}${i === current ? ' q-current' : ''}${flagged ? ' q-flagged' : ''}`}
              title={`${i + 1}-savol: ${statusLabel[status]}${flagged ? " (qayta ko'rish uchun belgilangan)" : ''}`}
              onClick={() => onSelect(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="q-legend">
          {mode === 'preview' ? null : mode === 'test' ? (
            <>
              <span>
                <i className="dot q-answered" /> Javob berilgan
              </span>
              <span>
                <i className="dot q-unanswered" /> Javob berilmagan
              </span>
              {flaggedOf && (
                <span>
                  <i className="dot q-unanswered q-flagged" /> Belgilangan
                </span>
              )}
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
