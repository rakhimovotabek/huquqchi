import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/paged'
import AdminGroupDetail from './AdminGroupDetail'

// Guruhlar ro'yxati va yangi guruh yaratish
export default function AdminGroups() {
  const [groups, setGroups] = useState([])
  const [counts, setCounts] = useState({})
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [openGroup, setOpenGroup] = useState(null)

  useEffect(() => {
    if (!openGroup) load()
  }, [openGroup])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('groups').select('*').order('name')
    if (error) {
      setError(
        'Guruhlarni yuklashda xatolik: ' +
          error.message +
          " (supabase/migration_v5.sql faylini SQL Editor'da bir marta ishga tushiring)"
      )
      setLoading(false)
      return
    }
    setGroups(data)
    const { data: rows } = await fetchAll(() =>
      supabase.from('group_members').select('group_id, student_id').order('group_id').order('student_id')
    )
    const c = {}
    ;(rows || []).forEach((r) => {
      c[r.group_id] = (c[r.group_id] || 0) + 1
    })
    setCounts(c)
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setError('')
    setSaving(true)
    const { data, error } = await supabase.from('groups').insert({ name: trimmed }).select().single()
    setSaving(false)
    if (error) {
      setError(error.code === '23505' ? 'Bunday nomli guruh allaqachon bor' : 'Guruh yaratishda xatolik: ' + error.message)
      return
    }
    setName('')
    setOpenGroup(data) // yaratilgach darrov ochiladi, talabalarni qo'shish mumkin
  }

  if (openGroup) {
    return <AdminGroupDetail group={openGroup} onBack={() => setOpenGroup(null)} />
  }

  return (
    <div>
      <h2>Guruhlar</h2>
      {error && <div className="error">{error}</div>}

      <form className="form-card" onSubmit={handleCreate}>
        <h3 className="card-title">+ Yangi guruh</h3>
        <div className="inline-form">
          <input
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Guruh nomi, masalan: Guruh 1"
          />
          <button type="submit" disabled={saving || !name.trim()}>
            {saving ? 'Yaratilmoqda...' : 'Guruh yaratish'}
          </button>
        </div>
      </form>

      <h3>Yaratilgan guruhlar</h3>
      {loading ? (
        <p>Yuklanmoqda...</p>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="simple-table">
              <thead>
                <tr>
                  <th>Guruh</th>
                  <th>Talabalar</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <button className="link-btn test-title" onClick={() => setOpenGroup(g)}>
                        {g.name}
                      </button>
                    </td>
                    <td>{counts[g.id] || 0} ta</td>
                  </tr>
                ))}
                {groups.length === 0 && (
                  <tr>
                    <td colSpan="2" className="empty-cell">
                      Hozircha guruhlar yo'q. Yuqorida birinchi guruhni yarating.
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
