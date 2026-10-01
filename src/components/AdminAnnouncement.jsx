import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'

// Administrator qisqa e'lon yozadi; talabalar uni "Testlar" sahifasi tepasida ko'radi.
export default function AdminAnnouncement() {
  const [current, setCurrent] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) {
      setError(
        "E'lonlarni yuklashda xatolik: " +
          error.message +
          " (supabase/migration_v3.sql faylini SQL Editor'da bir marta ishga tushiring)"
      )
      return
    }
    setCurrent(data?.[0] || null)
  }

  async function publish(e) {
    e.preventDefault()
    const text = message.trim()
    if (!text) return
    setSaving(true)
    setError('')
    // Eski e'lon o'chiriladi, yangisi qo'yiladi
    const { error: offErr } = await supabase.from('announcements').update({ active: false }).eq('active', true)
    if (offErr) {
      setSaving(false)
      return setError('Saqlashda xatolik: ' + offErr.message)
    }
    const { error: insErr } = await supabase.from('announcements').insert({ message: text })
    setSaving(false)
    if (insErr) return setError('Saqlashda xatolik: ' + insErr.message)
    setMessage('')
    load()
  }

  async function remove() {
    setError('')
    const { error } = await supabase.from('announcements').update({ active: false }).eq('active', true)
    if (error) return setError('Olib tashlashda xatolik: ' + error.message)
    setCurrent(null)
  }

  return (
    <form className="form-card" onSubmit={publish}>
      <h3 className="card-title">E'lon</h3>
      {error && <div className="error">{error}</div>}
      {current ? (
        <div className="banner dismissible">
          <span>
            <strong>Hozirgi e'lon:</strong> <span className="question-text">{current.message}</span>
            <br />
            <span className="muted">{formatDate(current.created_at)}</span>
          </span>
          <button type="button" className="secondary-btn small" onClick={remove}>
            Olib tashlash
          </button>
        </div>
      ) : (
        <p className="muted">Hozir faol e'lon yo'q.</p>
      )}
      <label>Yangi e'lon</label>
      <input
        value={message}
        maxLength={300}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Masalan: Ertaga soat 10:00 da test bo'ladi"
      />
      <div className="form-actions">
        <button type="submit" disabled={saving || !message.trim()}>
          {saving ? 'Joylanmoqda...' : "E'lonni joylash"}
        </button>
      </div>
    </form>
  )
}
