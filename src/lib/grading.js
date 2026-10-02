import { isBlank } from './format'

// Talaba javoblarini tekshiradi. TakeTest (talaba topshirganda) va
// "Qoidabuzarlar" (admin testni tugatganda) shu funksiyadan foydalanadi.
// answers: { [savol indeksi]: javob }
export function gradeAnswers(questions, answers, attemptId) {
  let score = 0
  let hasOpenToReview = false

  const rows = questions.map((q, i) => {
    const studentAnswer = answers ? answers[i] : undefined
    const hasAnswer = !isBlank(studentAnswer)

    if (q.type === 'mcq') {
      const isCorrect = hasAnswer && Number(studentAnswer) === Number(q.correctAnswer)
      if (isCorrect) score++
      return {
        attempt_id: attemptId,
        question_index: i,
        answer: hasAnswer ? String(studentAnswer) : null,
        is_correct: isCorrect,
        reviewed: true
      }
    }

    // Ochiq savol: bo'sh qoldirilgan bo'lsa, admin ko'rmaydi, avtomatik "noto'g'ri" bo'ladi
    if (!hasAnswer) {
      return { attempt_id: attemptId, question_index: i, answer: null, is_correct: false, reviewed: true }
    }
    hasOpenToReview = true
    return {
      attempt_id: attemptId,
      question_index: i,
      answer: String(studentAnswer).trim(),
      is_correct: null,
      reviewed: false
    }
  })

  return { rows, score, status: hasOpenToReview ? 'pending_review' : 'completed' }
}
