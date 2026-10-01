import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createStudentAccount } from '../lib/students'
import AdminStudentProfile from './AdminStudentProfile'
import { TrashIcon } from './Icons'

export default function AdminStudents() {
  const [students, setStudents] = useState([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [openStudent, setOpenStudent] = useState(null)

  useEffect(() => {
    loadStudents()
  }, [])

  async function loadStudents() {
    setListLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').eq('role', 'student').order('username')
    if (error) setError('Talabalarni yuklashda xatolik: ' + error.message)
    else setStudents(data)
    setListLoading(false)
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
    else loadStudents()
  }

  if (openStudent) {
    return <AdminStudentProfile student={openStudent} onBack={() => setOpenStudent(null)} />
  }

  return (
    <div>
      <h2>Talabalar</h2>
      {error && <div className="error">{error}</div>}
      <form className="inline-form" onSubmit={handleCreate}>
        <input placeholder="Foydalanuvchi nomi" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input placeholder="Parol" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit" disabled={loading}>
          {loading ? 'Saqlanmoqda...' : 'Talabani saqlash'}
        </button>
      </form>
      {listLoading ? (
        <p>Yuklanmoqda...</p>
      ) : (
        <table className="simple-table">
          <thead>
            <tr>
              <th>Foydalanuvchi nomi</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>
                  <button className="link-btn" onClick={() => setOpenStudent(s)}>
                    {s.username}
                  </button>
                </td>
                <td>
                  <div className="action-cell">
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
            {students.length === 0 && (
              <tr>
                <td colSpan="2">Hozircha talabalar yo'q</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
