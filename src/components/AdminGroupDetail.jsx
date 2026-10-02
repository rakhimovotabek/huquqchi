import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/paged'
import { formatDate, percent } from '../lib/format'
import AccessModal from './AccessModal'
import AdminReviewAttempt from './AdminReviewAttempt'
import ReviewResult from './ReviewResult'
import { TrashIcon } from './Icons'

const barClass = (pct) => (pct < 50 ? 'low' : pct < 75 ? 'mid' : 'high')

// Bitta guruh: talabalar, testga ruxsat, o'rtacha natijalar (grafik) va so'nggi topshirishlar
export default function AdminGroupDetail({ group: initial, onBack }) {
  const [group, setGroup] = useState(initial)
  const [members, setMembers] = useState([])
  const [students, setStudents] = useState([])
  const [tests, setTests] = useState([])
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [openAttempt, setOpenAttempt] = useState(null) // { id, mode, studentName }

  const [addOpen, setAddOpen] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [addSel, setAddSel] = useState(() => new Set())

  const [testId, setTestId] = useState('')
  const [accessTargets, setAccessTargets] = useState(null)

  useEffect(() => {
    if (!openAttempt) load()
  }, [openAttempt])

  async function load() {
    setLoading(true)
    const [memRes, stRes, testRes] = await Promise.all([
      supabase.from('group_members').select('student_id, profiles(username)').eq('group_id', group.id),
      supabase.from('profiles').select('id, username').eq('role', 'student').order('username'),
      supabase.from('tests').select('*').order('created_at', { ascending: false })
    ])
    const firstErr = memRes.error || stRes.error || testRes.error
    if (firstErr) {
      setError('Yuklashda xatolik: ' + firstErr.message)
      setLoading(false)
      return
    }
    const list = (memRes.data || [])
      .map((m) => ({ id: m.student_id, username: m.profiles?.username || '?' }))
      .sort((a, b) => a.username.localeCompare(b.username))
    setMembers(list)
    setStudents(stRes.data || [])
    setTests(testRes.data || [])

    // Guruh a'zolarining topshirilgan urinishlari (50 tadan bo'lib so'raladi)
    const ids = list.map((m) => m.id)
    const all = []
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50)
      const { data, error } = await fetchAll(() =>
        supabase
          .from('attempts')
          .select('id, student_id, test_id, score, total_questions, status, submitted_at, tests(title)')
          .in('student_id', chunk)
          .not('submitted_at', 'is', null)
          .order('submitted_at', { ascending: false })
          .order('id')
      )
      if (error) {
        setError('Natijalarni yuklashda xatolik: ' + error.message)
        break
      }
      all.push(...data)
    }
    all.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
    setAttempts(all)
    setLoading(false)
  }

  async function addStudents() {
    const ids = Array.from(addSel)
    if (ids.length === 0) return
    setError('')
    const rows = ids.map((student_id) => ({ group_id: group.id, student_id }))
    const { error } = await supabase
      .from('group_members')
      .upsert(rows, { onConflict: 'group_id,student_id', ignoreDuplicates: true })
    if (error) return setError("Talabalarni qo'shishda xatolik: " + error.message)
    setNotice(`${ids.length} ta talaba guruhga qo'shildi.`)
    setAddSel(new Set())
    setAddQuery('')
    load()
  }

  async function removeStudent(m) {
    setError('')
    const { error } = await supabase.from('group_members').delete().eq('group_id', group.id).eq('student_id', m.id)
    if (error) return setError('Guruhdan chiqarishda xatolik: ' + error.message)
    setNotice(`${m.username} guruhdan chiqarildi.`)
    load()
  }

  async function renameGroup() {
    const next = window.prompt('Guruhning yangi nomi:', group.name)
    if (next === null) return
    const trimmed = next.trim()
    if (!trimmed || trimmed === group.name) return
    setError('')
    const { error } = await supabase.from('groups').update({ name: trimmed }).eq('id', group.id)
    if (error) {
      return setError(error.code === '23505' ? 'Bunday nomli guruh allaqachon bor' : 'Nomni o\'zgartirishda xatolik: ' + error.message)
    }
    setGroup({ ...group, name: trimmed })
  }

  async function removeGroup() {
    const ok = window.confirm(
      `"${group.name}" guruhi o'chirilsinmi?\n\nTalabalar o'chmaydi, faqat guruhdan chiqariladi. Shu guruhga ochilgan testlar yopiladi.`
    )
    if (!ok) return
    setError('')
    // Avval guruhga bog'langan testlar yopiladi, aks holda ular hammaga ochilib qolishi mumkin edi
    const { error: lockErr } = await supabase
      .from('tests')
      .update({ access: 'locked', group_id: null })
      .eq('group_id', group.id)
    if (lockErr) return setError('Testlarni yopishda xatolik: ' + lockErr.message)
    const { error } = await supabase.from('groups').delete().eq('id', group.id)
    if (error) return setError("Guruhni o'chirishda xatolik: " + error.message)
    onBack()
  }

  async function closeTest(t) {
    setError('')
    const { error } = await supabase.from('tests').update({ access: 'locked' }).eq('id', t.id)
    if (error) return setError('Testni yopishda xatolik: ' + error.message)
    setNotice(`"${t.title}" testi yopildi.`)
    load()
  }

  if (openAttempt?.mode === 'grade') {
    return <AdminReviewAttempt attemptId={openAttempt.id} onBack={() => setOpenAttempt(null)} />
  }
  if (openAttempt?.mode === 'view') {
    return (
      <ReviewResult attemptId={openAttempt.id} studentName={openAttempt.studentName} onBack={() => setOpenAttempt(null)} />
    )
  }

  // ---------- hisob-kitoblar ----------
  const nameById = new Map(members.map((m) => [m.id, m.username]))
  const completed = attempts.filter((a) => a.status === 'completed' && a.total_questions > 0)
  const sumScore = (arr) => arr.reduce((s, a) => s + (a.score || 0), 0)
  const sumTotal = (arr) => arr.reduce((s, a) => s + a.total_questions, 0)
  const groupPct = completed.length ? percent(sumScore(completed), sumTotal(completed)) : null
  const pendingCount = attempts.filter((a) => a.status === 'pending_review').length

  const perStudent = members
    .map((m) => {
      const mine = completed.filter((a) => a.student_id === m.id)
      return { id: m.id, username: m.username, count: mine.length, pct: mine.length ? percent(sumScore(mine), sumTotal(mine)) : null }
    })
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))

  const testMap = {}
  completed.forEach((a) => {
    const t = (testMap[a.test_id] ||= { title: a.tests?.title || 'Test', score: 0, total: 0, students: new Set() })
    t.score += a.score || 0
    t.total += a.total_questions
    t.students.add(a.student_id)
  })
  const perTest = Object.values(testMap)
    .map((t) => ({ title: t.title, pct: percent(t.score, t.total), students: t.students.size }))
    .sort((a, b) => b.pct - a.pct)

  const memberIds = new Set(members.map((m) => m.id))
  const q = addQuery.trim().toLowerCase()
  const candidates = students.filter((s) => !memberIds.has(s.id) && s.username.toLowerCase().includes(q))
  const groupTests = tests.filter((t) => t.group_id === group.id && t.access !== 'locked')
  const chosenTest = tests.find((t) => t.id === testId)

  function toggleAdd(id) {
    setAddSel((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div>
      <button onClick={onBack}>← Guruhlarga qaytish</button>
      <div className="list-head">
        <h2>Guruh: {group.name}</h2>
        <div className="action-cell">
          <button className="secondary-btn" onClick={renameGroup}>
            Nomini o'zgartirish
          </button>
          <button className="icon-btn" title="Guruhni o'chirish" aria-label="Guruhni o'chirish" onClick={removeGroup}>
            <TrashIcon />
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {notice && <div className="success">{notice}</div>}

      {loading ? (
        <p>Yuklanmoqda...</p>
      ) : (
        <>
          <div className="stat-grid">
            <div className="card stat-card">
              <div className="muted">Guruh o'rtacha natijasi</div>
              <div className="stat-value">{groupPct !== null ? `${groupPct}%` : '—'}</div>
            </div>
            <div className="card stat-card">
              <div className="muted">Talabalar</div>
              <div className="stat-value">{members.length}</div>
            </div>
            <div className="card stat-card">
              <div className="muted">Tekshiruvni kutmoqda</div>
              <div className="stat-value">{pendingCount}</div>
            </div>
          </div>

          <div className="card">
            <h3>Bu guruh uchun testga ruxsat berish</h3>
            <div className="inline-form">
              <select value={testId} onChange={(e) => setTestId(e.target.value)}>
                <option value="">Testni tanlang...</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <button
                disabled={!chosenTest}
                onClick={() => setAccessTargets([chosenTest])}
              >
                Ruxsat berish
              </button>
            </div>
            {groupTests.length > 0 && (
              <div className="group-tests">
                <p className="muted">Hozir bu guruhga ochiq testlar:</p>
                {groupTests.map((t) => (
                  <div key={t.id} className="group-test-row">
                    <span>
                      {t.title}
                      {(t.opens_at || t.closes_at) && (
                        <span className="chip">
                          {formatDate(t.opens_at) || '…'} → {formatDate(t.closes_at) || '…'}
                        </span>
                      )}
                      {t.access === 'one_time' && <span className="chip">Bir martalik</span>}
                    </span>
                    <span className="action-cell">
                      <button className="secondary-btn" onClick={() => setAccessTargets([t])}>
                        Sozlash
                      </button>
                      <button className="btn-red" onClick={() => closeTest(t)}>
                        Yopish
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="list-head">
              <h3>Talabalar ({members.length})</h3>
              <button className="secondary-btn" onClick={() => setAddOpen((v) => !v)}>
                {addOpen ? 'Yopish' : "+ Talaba qo'shish"}
              </button>
            </div>

            {addOpen && (
              <div className="add-panel">
                <input
                  type="search"
                  placeholder="Talabani qidirish..."
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                />
                <div className="add-list">
                  {candidates.slice(0, 100).map((s) => (
                    <label key={s.id} className="opt-row">
                      <input type="checkbox" checked={addSel.has(s.id)} onChange={() => toggleAdd(s.id)} />
                      <span>{s.username}</span>
                    </label>
                  ))}
                  {candidates.length === 0 && <p className="muted">Qo'shiladigan talaba topilmadi.</p>}
                </div>
                <div className="form-actions">
                  <button disabled={addSel.size === 0} onClick={addStudents}>
                    {addSel.size > 0 ? `${addSel.size} ta talabani qo'shish` : "Talabalarni qo'shish"}
                  </button>
                </div>
              </div>
            )}

            <div className="table-scroll">
              <table className="simple-table compact">
                <thead>
                  <tr>
                    <th>Talaba</th>
                    <th>Testlar</th>
                    <th>O'rtacha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {perStudent.map((s) => (
                    <tr key={s.id}>
                      <td>{s.username}</td>
                      <td>{s.count}</td>
                      <td>{s.pct !== null ? `${s.pct}%` : '—'}</td>
                      <td>
                        <div className="action-cell right">
                          <button
                            className="secondary-btn small"
                            onClick={() => removeStudent({ id: s.id, username: s.username })}
                          >
                            Chiqarish
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan="4" className="empty-cell">
                        Guruhda hali talabalar yo'q. "+ Talaba qo'shish" tugmasini bosing.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3>Talabalar o'rtacha natijasi</h3>
            {perStudent.some((s) => s.pct !== null) ? (
              <div className="weak-list">
                {perStudent
                  .filter((s) => s.pct !== null)
                  .map((s) => (
                    <div key={s.id} className="weak-row">
                      <div className="weak-head">
                        <span>{s.username}</span>
                        <strong>{s.pct}%</strong>
                      </div>
                      <div className="bar">
                        <div className={`bar-fill ${barClass(s.pct)}`} style={{ width: `${Math.max(2, s.pct)}%` }} />
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="muted">Hozircha yakunlangan natijalar yo'q.</p>
            )}
          </div>

          <div className="card">
            <h3>Testlar bo'yicha o'rtacha</h3>
            {perTest.length > 0 ? (
              <div className="weak-list">
                {perTest.map((t, i) => (
                  <div key={i} className="weak-row">
                    <div className="weak-head">
                      <span>
                        {t.title} <span className="muted">({t.students} ta talaba)</span>
                      </span>
                      <strong>{t.pct}%</strong>
                    </div>
                    <div className="bar">
                      <div className={`bar-fill ${barClass(t.pct)}`} style={{ width: `${Math.max(2, t.pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Hozircha yakunlangan natijalar yo'q.</p>
            )}
          </div>

          <h3>So'nggi topshirishlar</h3>
          <div className="table-card">
            <div className="table-scroll">
              <table className="simple-table">
                <thead>
                  <tr>
                    <th>Talaba</th>
                    <th>Test</th>
                    <th>Ball</th>
                    <th>Holat</th>
                    <th>Sana</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.slice(0, 10).map((a) => {
                    const done = a.status === 'completed'
                    return (
                      <tr key={a.id}>
                        <td>{nameById.get(a.student_id)}</td>
                        <td>{a.tests?.title}</td>
                        <td>{done ? `${a.score} / ${a.total_questions}` : '—'}</td>
                        <td>{done ? 'Yakunlangan' : 'Tekshiruvni kutmoqda'}</td>
                        <td>{formatDate(a.submitted_at)}</td>
                        <td>
                          <div className="action-cell">
                            {!done && (
                              <button onClick={() => setOpenAttempt({ id: a.id, mode: 'grade' })}>Baholash</button>
                            )}
                            <button
                              className="secondary-btn"
                              onClick={() => setOpenAttempt({ id: a.id, mode: 'view', studentName: nameById.get(a.student_id) })}
                            >
                              Ko'rish
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {attempts.length === 0 && (
                    <tr>
                      <td colSpan="6" className="empty-cell">
                        Guruh a'zolari hali test topshirmagan
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {accessTargets && (
        <AccessModal
          tests={accessTargets}
          groups={[group]}
          lockedGroup={group}
          onClose={() => setAccessTargets(null)}
          onSaved={(msg) => {
            setAccessTargets(null)
            setNotice(msg)
            setTestId('')
            load()
          }}
        />
      )}
    </div>
  )
}
