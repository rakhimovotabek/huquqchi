import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate, fromLocalInput, toLocalInput } from '../lib/format'

// "Ruxsat berish" oynasi: kimga, aralashtirish, vaqt oralig'i va bir martalik.
// tests: o'zgartiriladigan testlar (1 ta yoki bir nechta)
// lockedGroup: guruh sahifasidan ochilganda shu guruh qotirib qo'yiladi
export default function AccessModal({ tests, groups = [], lockedGroup = null, onClose, onSaved }) {
  const single = tests.length === 1 ? tests[0] : null

  const [who, setWho] = useState(() => {
    if (lockedGroup) return 'group'
    if (single?.access === 'selected') return 'selected'
    if (single?.group_id) return 'group'
    return 'all'
  })
  const [groupId, setGroupId] = useState(lockedGroup?.id || single?.group_id || '')
  const [shuffle, setShuffle] = useState(single ? !!single.shuffle : tests.every((t) => t.shuffle))
  const [oneTime, setOneTime] = useState(single ? single.access === 'one_time' : false)
  const [opensAt, setOpensAt] = useState(single ? toLocalInput(single.opens_at) : '')
  const [closesAt, setClosesAt] = useState(single ? toLocalInput(single.closes_at) : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const opens = fromLocalInput(opensAt)
  const closes = fromLocalInput(closesAt)
  const groupName = groups.find((g) => g.id === groupId)?.name || ''
  const wasOpenToAll = single && ['allowed', 'one_time'].includes(single.access) && !single.group_id

  async function save(e) {
    e.preventDefault()
    setError('')
    if (who === 'group' && !groupId) return setError('Guruhni tanlang')
    if (opens && closes && new Date(closes) <= new Date(opens)) {
      return setError("Yopilish vaqti ochilish vaqtidan keyin bo'lishi kerak")
    }
    if (closes && new Date(closes) <= new Date()) {
      return setError("Yopilish vaqti o'tib ketgan. Kelajakdagi vaqtni tanlang")
    }

    setSaving(true)
    const access = who === 'selected' ? 'selected' : oneTime ? 'one_time' : 'allowed'
    const { error: err } = await supabase
      .from('tests')
      .update({
        access,
        group_id: who === 'group' ? groupId : null,
        shuffle,
        opens_at: opens,
        closes_at: closes
      })
      .in(
        'id',
        tests.map((t) => t.id)
      )
    setSaving(false)
    if (err) {
      return setError('Saqlashda xatolik: ' + err.message + " (supabase/migration_v5.sql ishga tushirilganmi?)")
    }
    const what = single ? `"${single.title}" testi` : `${tests.length} ta test`
    const target = who === 'group' ? `"${groupName}" guruhi uchun` : who === 'selected' ? 'tanlangan talabalar uchun' : 'barcha talabalar uchun'
    onSaved(`${what} ${target} ochildi.`)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="modal-head">
          <h3>Ruxsat berish</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Yopish">
            ✕
          </button>
        </div>

        <p className="muted">{single ? single.title : `${tests.length} ta test tanlandi`}</p>
        {error && <div className="error">{error}</div>}

        <label>Kim uchun?</label>
        {lockedGroup ? (
          <p>
            <strong>{lockedGroup.name}</strong> guruhi
          </p>
        ) : (
          <div className="opt-list">
            <label className="opt-row">
              <input type="radio" name="who" checked={who === 'all'} onChange={() => setWho('all')} />
              <span>Barcha talabalar</span>
            </label>
            <label className="opt-row">
              <input type="radio" name="who" checked={who === 'group'} onChange={() => setWho('group')} />
              <span>Faqat bitta guruh</span>
            </label>
            {who === 'group' && (
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">Guruhni tanlang...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
            {single?.access === 'selected' && (
              <label className="opt-row">
                <input type="radio" name="who" checked={who === 'selected'} onChange={() => setWho('selected')} />
                <span>Tanlangan talabalar (Talabalar bo'limida belgilanganlar)</span>
              </label>
            )}
          </div>
        )}
        {who === 'group' && wasOpenToAll && (
          <div className="warn-note">
            Diqqat: bu test hozir barcha talabalarga ochiq. Saqlasangiz, u faqat tanlangan guruhga ochiq bo'ladi.
          </div>
        )}

        <label className="opt-row opt-block">
          <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
          <span>
            Savollar va variantlarni aralashtirish
            <small className="muted"> — har bir talabaga turli tartibda</small>
          </span>
        </label>

        {who !== 'selected' && (
          <label className="opt-row opt-block">
            <input type="checkbox" checked={oneTime} onChange={(e) => setOneTime(e.target.checked)} />
            <span>
              Bir martalik
              <small className="muted"> — har bir talaba testni faqat bir marta topshiradi</small>
            </span>
          </label>
        )}

        <label>Vaqt oralig'i (ixtiyoriy)</label>
        <div className="import-row dates-row">
          <div>
            <label>Ochilish</label>
            <input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
          </div>
          <div>
            <label>Yopilish</label>
            <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </div>
        </div>
        <p className="schedule-summary">
          {opens || closes
            ? `Test ${opens ? formatDate(opens) : 'hozirdan'} dan ${closes ? formatDate(closes) : 'Yopish bosilguncha'} gacha ochiq bo'ladi.`
            : "Vaqt qo'yilmasa, test siz \"Yopish\" tugmasini bosguncha ochiq turadi."}
        </p>

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Saqlanmoqda...' : 'Ruxsat berish'}
          </button>
          <button type="button" className="secondary-btn" onClick={onClose}>
            Bekor qilish
          </button>
        </div>
      </form>
    </div>
  )
}
