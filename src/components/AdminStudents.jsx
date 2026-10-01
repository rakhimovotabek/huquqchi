import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/paged'
import { createStudentAccount } from '../lib/students'
import AdminStudentProfile from './AdminStudentProfile'
import { TrashIcon } from './Icons'

export default function AdminStudents() {
  const [students, setStudents] = useState([])
  const [tests, setTests] = useState([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [openStudent, setOpenStudent] = useState(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [grantTestId, setGrantTestId] = useState('')
  const [hasAccess, setHasAccess] = useState(() => new Set())
  const [working, setWorking] = useState(false)

  useEffect(() => {
    loadStudents()
    loadTests()
  }, [])

  // Tanlangan test uchun kimlarda ruxsat borligini ko'rsatamiz
  useEffect(() => {
    loadAccessFor(grantTestId)
  }, [grantTestId])

  async function loadStudents() {
    setListLoading(true)
    const { data, error } = await fetchAll(() =>
      supabase.from('profiles').select('*').eq('role', 'student').order('username')
    )
    if (error) setError('Talabalarni yuklashda xatolik: ' + error.message)
    else setStudents(data)
    setListLoading(false)
  }

  async function loadTests() {
    const { data } = await supabase.from('tests').select('id, title, access').order('created_at', { ascending: false })
    setTests(data || [])
  }

  async function loadAccessFor(testId) {
    if (!testId) {
      setHasAccess(new Set())
      return
    }
    const { data } = await fetchAll(() =>
      supabase.from('test_access').select('student_id').eq('test_id', testId).order('student_id')
    )
    setHasAccess(new Set((data || []).map((r) => r.student_id)))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createStudentAccount(username, password)
      setUsername('')
      setPassword('')
      await loadStudents()
    } catch (err) {
      setError('Talabani yaratishda xatolik: ' + err.message)
    }
    setLoading(false)
  }

  async function handleDelete(id, uname) {
    if (!confirm(`"${uname}" talabasi o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.`)) return
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) setError("Talabani o'chirishda xatolik: " + error.message)
    else {
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      loadStudents()
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? students.filter((s) => s.username.toLowerCase().includes(q)) : students
  }, [students, query])

  const allChecked = filtered.length > 0 && filtered.every((s) => selected.has(s.id))
  const grantTest = tests.find((t) => t.id === grantTestId)

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allChecked) filtered.forEach((s) => next.delete(s.id))
      else filtered.forEach((s) => next.add(s.id))
      return next
    })
  }

  async function handleGrant() {
    setError('')
    setNotice('')
    if (!grantTest) {
      setError('Avval testni tanlang')
      return
    }
    const ids = Array.from(selected)
    if (grantTest.access === 'allowed' || grantTest.access === 'one_time') {
      const ok = confirm(
        `"${grantTest.title}" testi hozir barcha talabalarga ochiq. Uni faqat tanlangan talabalarga cheklaymizmi?`
      )
      if (!ok) return
    }
    setWorking(true)
    const rows = ids.map((student_id) => ({ test_id: grantTest.id, student_id }))
    const { error: insErr } = await supabase
      .from('test_access')
      .upsert(rows, { onConflict: 'test_id,student_id', ignoreDuplicates: true })
    if (insErr) {
      setWorking(false)
      setError('Ruxsat berishda xatolik: ' + insErr.message + " (supabase/migration_v2.sql ishga tushirilganmi?)")
      return
    }
    if (grantTest.access !== 'selected') {
      const { error: updErr } = await supabase.from('tests').update({ access: 'selected' }).eq('id', grantTest.id)
      if (updErr) {
        setWorking(false)
        setError("Test holatini o'zgartirishda xatolik: " + updErr.message)
        return
      }
    }
    setWorking(false)
    setNotice(`"${grantTest.title}" testiga ${ids.length} ta talabaga ruxsat berildi.`)
    setSelected(new Set())
    loadTests()
    loadAccessFor(grantTest.id)
  }

  async function handleRevoke() {
    setError('')
    setNotice('')
    if (!grantTest) {
      setError('Avval testni tanlang')
      return
    }
    const ids = Array.from(selected)
    setWorking(true)
    const { error: delErr } = await supabase
      .from('test_access')
      .delete()
      .eq('test_id', grantTest.id)
      .in('student_id', ids)
    setWorking(false)
    if (delErr) {
      setError('Ruxsatni olib tashlashda xatolik: ' + delErr.message)
      return
    }
    setNotice(`${ids.length} ta talabadan "${grantTest.title}" testiga ruxsat olib tashlandi.`)
    setSelected(new Set())
    loadAccessFor(grantTest.id)
  }

  if (openStudent) {
    return <AdminStudentProfile student={openStudent} onBack={() => setOpenStudent(null)} />
  }

  const accessText = { locked: 'Yopiq', allowed: 'Hammaga ochiq', one_time: 'Bir martalik', selected: 'Tanlanganlarga' }

  return (
    <div>
      <h2>Talabalar</h2>
      {error && <div className="error">{error}</div>}
      {notice && <div className="success">{notice}</div>}

      <form className="form-card" onSubmit={handleCreate}>
        <h3 className="card-title">Yangi talaba</h3>
        <div className="inline-form">
          <input placeholder="Foydalanuvchi nomi" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input placeholder="Parol" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" disabled={loading}>
            {loading ? 'Saqlanmoqda...' : 'Talabani saqlash'}
          </button>
        </div>
      </form>

      <div className="list-head">
        <h3>Talabalar ro'yxati</h3>
        <input
          className="search-input"
          type="search"
          placeholder="Talabani qidirish..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <strong>{selected.size} ta talaba tanlandi</strong>
          <div className="action-cell">
            <select className="bulk-select" value={grantTestId} onChange={(e) => setGrantTestId(e.target.value)}>
              <option value="">Testni tanlang...</option>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({accessText[t.access] || t.access})
                </option>
              ))}
            </select>
            <button className="btn-green" disabled={working || !grantTestId} onClick={handleGrant}>
              Testga ruxsat berish
            </button>
            <button className="btn-red" disabled={working || !grantTestId} onClick={handleRevoke}>
              Ruxsatni olib tashlash
            </button>
            <button className="secondary-btn" onClick={() => setSelected(new Set())}>
              Bekor qilish
            </button>
          </div>
        </div>
      )}

      {listLoading ? (
        <p>Yuklanmoqda...</p>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="simple-table">
              <thead>
                <tr>
                  <th className="check-col">
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Hammasini tanlash" />
                  </th>
                  <th>Foydalanuvchi nomi</th>
                  <th>{grantTest ? `"${grantTest.title}" testi` : ''}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className={selected.has(s.id) ? 'row-selected' : ''}>
                    <td className="check-col">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggleOne(s.id)}
                        aria-label={`${s.username} ni tanlash`}
                      />
                    </td>
                    <td>
                      <button className="link-btn" onClick={() => setOpenStudent(s)}>
                        {s.username}
                      </button>
                    </td>
                    <td>
                      {grantTest && hasAccess.has(s.id) && <span className="badge badge-allowed">Ruxsat bor</span>}
                    </td>
                    <td>
                      <div className="action-cell right">
                        <button className="secondary-btn" onClick={() => setOpenStudent(s)}>
                          Profil
                        </button>
                        <button
                          className="icon-btn"
                          title="O'chirish"
                          aria-label="O'chirish"
                          onClick={() => handleDelete(s.id, s.username)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="4" className="empty-cell">
                      {students.length === 0 ? "Hozircha talabalar yo'q" : 'Qidiruvga mos talaba topilmadi'}
                    </td>
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
