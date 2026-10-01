import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { setStudentPassword } from '../lib/students'
import { formatDate } from '../lib/format'
import { deleteAttempts } from '../lib/deleteAttempts'
import { TrashIcon } from './Icons'
import AdminReviewAttempt from './AdminReviewAttempt'
import ReviewResult from './ReviewResult'

export default function AdminStudentProfile({ student, onBack }) {
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // { id, mode: 'grade' | 'view' }
  const [openAttempt, setOpenAttempt] = useState(null)

  // Parol bilan bog'liq holatlar
  const [pwShown, setPwShown] = useState(false)
  const [pwValue, setPwValue] = useState(null)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwNotice, setPwNotice] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!openAttempt) loadAttempts()
  }, [openAttempt])

  async function loadAttempts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('attempts')
      .select('*, tests(title)')
      .eq('student_id', student.id)
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: false })
    if (error) setError('Natijalarni yuklashda xatolik: ' + error.message)
    else setAttempts(data)
    setLoading(false)
  }

  async function removeAttempt(a) {
    const ok = window.confirm(
      `"${a.tests?.title}" natijasi o'chirilsinmi?\n\nBu qaytarib bo'lmaydi: natija va javoblar butunlay o'chadi, talabaning umumiy foizi qayta hisoblanadi.`
    )
    if (!ok) return
    setError('')
    try {
      await deleteAttempts([a.id])
      loadAttempts()
    } catch (err) {
      setError("O'chirishda xatolik: " + err.message)
    }
  }

  async function togglePassword() {
    setPwError('')
    setPwNotice('')
    if (pwShown) {
      setPwShown(false)
      return
    }
    setPwLoading(true)
    const { data, error } = await supabase
      .from('student_passwords')
      .select('password')
      .eq('student_id', student.id)
      .maybeSingle()
    setPwLoading(false)
    if (error) {
      setPwError(
        'Parolni yuklashda xatolik: ' +
          error.message +
          " (agar jadval topilmasa, supabase/migration_student_passwords.sql ni SQL Editor'da ishga tushiring)"
      )
      return
    }
    setPwValue(data ? data.password : null)
    setShowReset(!data) // paroli saqlanmagan bo'lsa, yangi parol o'rnatish formasini ochamiz
    setPwShown(true)
  }

  async function handleSetPassword(e) {
    e.preventDefault()
    setPwError('')
    setPwNotice('')
    if (newPassword.length < 6) {
      setPwError("Parol kamida 6 ta belgidan iborat bo'lishi kerak")
      return
    }
    setSaving(true)
    try {
      await setStudentPassword(student.id, newPassword)
      setPwValue(newPassword)
      setNewPassword('')
      setShowReset(false)
      setPwShown(true)
      setPwNotice('Parol yangilandi. Talabaga yangi parolni ayting.')
    } catch (err) {
      setPwError("Parolni o'zgartirishda xatolik: " + err.message)
    }
    setSaving(false)
  }

  if (openAttempt?.mode === 'grade') {
    return <AdminReviewAttempt attemptId={openAttempt.id} onBack={() => setOpenAttempt(null)} />
  }
  if (openAttempt?.mode === 'view') {
    return <ReviewResult attemptId={openAttempt.id} studentName={student.username} onBack={() => setOpenAttempt(null)} />
  }

  // Butun vaqt bo'yicha foiz: yakunlangan urinishlardagi to'g'ri javoblar / barcha savollar
  const completed = attempts.filter((a) => a.status === 'completed')
  const totalScore = completed.reduce((sum, a) => sum + (a.score || 0), 0)
  const totalQuestions = completed.reduce((sum, a) => sum + (a.total_questions || 0), 0)
  const overall = totalQuestions > 0 ? ((totalScore / totalQuestions) * 100).toFixed(1) : null
  const pendingCount = attempts.filter((a) => a.status === 'pending_review').length

  return (
    <div>
      <button onClick={onBack}>← Talabalarga qaytish</button>
      <h2>Talaba: {student.username}</h2>
      {error && <div className="error">{error}</div>}

      <div className="stat-grid">
        <div className="card stat-card">
          <div className="muted">Umumiy natija (butun vaqt)</div>
          <div className="stat-value">{overall !== null ? `${overall}%` : '—'}</div>
          {overall !== null && (
            <div className="muted">
              {totalScore} / {totalQuestions}
            </div>
          )}
        </div>
        <div className="card stat-card">
          <div className="muted">Yakunlangan testlar</div>
          <div className="stat-value">{completed.length}</div>
        </div>
        <div className="card stat-card">
          <div className="muted">Tekshiruvni kutmoqda</div>
          <div className="stat-value">{pendingCount}</div>
        </div>
      </div>

      <div className="card">
        <h3>Parol</h3>
        {pwError && <div className="error">{pwError}</div>}
        {pwNotice && <div className="success">{pwNotice}</div>}
        <div className="action-cell">
          <button className="secondary-btn" onClick={togglePassword} disabled={pwLoading}>
            {pwLoading ? 'Yuklanmoqda...' : pwShown ? 'Parolni yashirish' : "Parolni ko'rish"}
          </button>
          {pwShown && !showReset && (
            <button className="secondary-btn" onClick={() => setShowReset(true)}>
              Parolni o'zgartirish
            </button>
          )}
        </div>
        {pwShown && pwValue !== null && (
          <p>
            Foydalanuvchi nomi: <strong>{student.username}</strong>
            <br />
            Parol: <strong className="password-value">{pwValue}</strong>
          </p>
        )}
        {pwShown && pwValue === null && (
          <p className="muted">
            Bu talabaning paroli saqlanmagan (hisob parollarni saqlash qo'shilishidan oldin yaratilgan). Quyida yangi parol
            o'rnating, shundan keyin uni shu yerda ko'ra olasiz.
          </p>
        )}
        {pwShown && showReset && (
          <form className="inline-form" onSubmit={handleSetPassword}>
            <input
              type="text"
              placeholder="Yangi parol (kamida 6 belgi)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button type="submit" disabled={saving}>
              {saving ? 'Saqlanmoqda...' : "Parolni o'rnatish"}
            </button>
          </form>
        )}
      </div>

      <h3>Testlar va natijalar</h3>
      {loading ? (
        <p>Yuklanmoqda...</p>
      ) : (
        <div className="table-card">
        <div className="table-scroll">
        <table className="simple-table">
          <thead>
            <tr>
              <th>Test</th>
              <th>Ball</th>
              <th>Foiz</th>
              <th>Holat</th>
              <th>Sana</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((a) => {
              const done = a.status === 'completed'
              const pct = done && a.total_questions ? ((a.score / a.total_questions) * 100).toFixed(1) + '%' : '—'
              return (
                <tr key={a.id}>
                  <td>{a.tests?.title}</td>
                  <td>{done ? `${a.score} / ${a.total_questions}` : '—'}</td>
                  <td>{pct}</td>
                  <td>{done ? 'Yakunlangan' : 'Tekshiruvni kutmoqda'}</td>
                  <td>{formatDate(a.submitted_at)}</td>
                  <td>
                    <div className="action-cell">
                      {!done && <button onClick={() => setOpenAttempt({ id: a.id, mode: 'grade' })}>Baholash</button>}
                      <button className="secondary-btn" onClick={() => setOpenAttempt({ id: a.id, mode: 'view' })}>
                        Ko'rish
                      </button>
                      <button
                        className="icon-btn"
                        title="O'chirish"
                        aria-label="O'chirish"
                        onClick={() => removeAttempt(a)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {attempts.length === 0 && (
              <tr>
                <td colSpan="6">Bu talaba hali test topshirmagan</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        </div>
      )}
    </div>
  )
}
