import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'
import { gradeAnswers } from '../lib/grading'

const reasonText = {
  tab_hidden: "Boshqa yorliq yoki ilovaga o'tdi",
  window_blur: "Boshqa oynaga o'tdi"
}

const statusText = {
  resumed: 'Davom ettirildi',
  finished: 'Tugatildi'
}

function ago(value) {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (sec < 60) return 'hozirgina'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} daqiqa oldin`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} soat oldin`
  return formatDate(value)
}

// Test paytida oynadan chiqib ketgan talabalar: kodni tekshirib, davom ettirish yoki testni tugatish
export default function AdminViolations({ onChanged }) {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [autoAllow, setAutoAllow] = useState(false)

  useEffect(() => {
    load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [])

  async function load() {
    const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'auto_allow').maybeSingle()
    setAutoAllow(setting?.value === 'true')

    const { data, error } = await supabase
      .from('violations')
      .select('*, profiles(username), attempts(id, started_at, test_id, tests(title))')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      setError(
        "Yuklashda xatolik: " +
          error.message +
          " (supabase/migration_v6.sql faylini SQL Editor'da bir marta ishga tushiring)"
      )
    } else {
      setError('')
      setRows(data)
    }
    setLoading(false)
  }

  async function toggleAutoAllow() {
    const next = !autoAllow
    setError('')
    setNotice('')
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'auto_allow', value: String(next), updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) {
      return setError('Sozlamani saqlashda xatolik: ' + error.message + " (supabase/migration_v7.sql ishga tushirilganmi?)")
    }
    setAutoAllow(next)
  }

  async function resumeAll() {
    const list = rows.filter((r) => r.status === 'open')
    if (list.length === 0) return
    if (!window.confirm(`${list.length} ta bloklangan talabaning hammasi davom ettirilsinmi?`)) return
    setBusy('all')
    setError('')
    for (const v of list) {
      const { error } = await supabase.rpc('resume_violation', { p_violation_id: v.id })
      if (error) {
        setError('Davom ettirishda xatolik: ' + error.message)
        break
      }
    }
    setBusy(null)
    setNotice('Bloklangan talabalar davom ettirildi.')
    load()
    if (onChanged) onChanged()
  }

  async function resume(v) {
    setBusy(v.id)
    setError('')
    setNotice('')
    const { error } = await supabase.rpc('resume_violation', { p_violation_id: v.id })
    setBusy(null)
    if (error) return setError('Davom ettirishda xatolik: ' + error.message)
    setNotice(`${v.profiles?.username} testi davom ettirildi. Bloklangan vaqt unga qaytarildi.`)
    load()
    if (onChanged) onChanged()
  }

  async function finish(v) {
    const ok = window.confirm(
      `${v.profiles?.username} ning testi tugatilsinmi?\n\nU blokdan oldin bergan javoblari bilan topshirilgan hisoblanadi. Qaytarib bo'lmaydi.`
    )
    if (!ok) return
    setBusy(v.id)
    setError('')
    setNotice('')
    try {
      const attemptId = v.attempt_id
      const { data: attempt, error: aErr } = await supabase
        .from('attempts')
        .select('id, status')
        .eq('id', attemptId)
        .single()
      if (aErr) throw aErr

      if (attempt.status === 'in_progress') {
        const { data: test, error: tErr } = await supabase
          .from('tests')
          .select('questions_json')
          .eq('id', v.attempts.test_id)
          .single()
        if (tErr) throw tErr

        const { rows: answerRows, score, status } = gradeAnswers(test.questions_json, v.answers || {}, attemptId)

        // Qayta urinishda javoblar ikki marta yozilib ketmasligi uchun
        const { count } = await supabase
          .from('answers')
          .select('id', { count: 'exact', head: true })
          .eq('attempt_id', attemptId)
        if (!count) {
          const { error: insErr } = await supabase.from('answers').insert(answerRows)
          if (insErr) throw insErr
        }
        const { error: updErr } = await supabase
          .from('attempts')
          .update({ submitted_at: new Date().toISOString(), score, status, result_seen: false })
          .eq('id', attemptId)
          .eq('status', 'in_progress')
        if (updErr) throw updErr
      }

      const { error: vErr } = await supabase
        .from('violations')
        .update({ status: 'finished', resolved_at: new Date().toISOString() })
        .eq('id', v.id)
      if (vErr) throw vErr
      setNotice(`${v.profiles?.username} testi tugatildi.`)
    } catch (err) {
      setError('Testni tugatishda xatolik: ' + err.message)
    }
    setBusy(null)
    load()
    if (onChanged) onChanged()
  }

  // Har bir urinish uchun nechta marta chiqib ketgani
  const perAttempt = {}
  rows.forEach((r) => {
    perAttempt[r.attempt_id] = (perAttempt[r.attempt_id] || 0) + 1
  })
  const open = rows.filter((r) => r.status === 'open').sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const history = rows.filter((r) => r.status !== 'open').slice(0, 30)

  return (
    <div>
      <h2>Qoidabuzarlar</h2>
      <p className="muted">
        Test paytida boshqa oyna, yorliq yoki ilovaga o'tgan talabalar bloklanadi va ustozdan ruxsat so'rashi kerak.
        Siz uni davom ettirasiz yoki testini tugatasiz. Ro'yxat o'zi yangilanadi.
      </p>

      <div className={`card auto-card${autoAllow ? ' on' : ''}`}>
        <div>
          <strong>Avtomatik ruxsat: {autoAllow ? 'YOQILGAN' : "O'CHIRILGAN"}</strong>
          <div className="muted">
            {autoAllow
              ? "Talabalar bloklanmaydi. Oynadan chiqsalar, faqat \"qoidabuzarlik hisoblanadi\" degan ogohlantirish ko'rishadi va testni davom ettiradi."
              : "Talabalar oynadan chiqsa bloklanadi va ustozdan ruxsat so'rashi kerak."}
          </div>
        </div>
        <button className={autoAllow ? 'btn-red' : 'btn-green'} onClick={toggleAutoAllow}>
          {autoAllow ? "O'chirish" : 'Yoqish'}
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {notice && <div className="success">{notice}</div>}

      {loading ? (
        <p>Yuklanmoqda...</p>
      ) : (
        <>
          <div className="list-head">
            <h3>Kutayotganlar ({open.length})</h3>
            {open.length > 1 && (
              <button className="btn-green" disabled={busy === 'all'} onClick={resumeAll}>
                Hammasini davom ettirish
              </button>
            )}
          </div>
          {open.length === 0 ? (
            <div className="card">
              <p className="muted">Hozir hal qilinishi kerak bo'lgan blok yo'q.</p>
            </div>
          ) : (
            <div className="vio-list">
              {open.map((v) => (
                <div key={v.id} className="card vio-card">
                  <div className="vio-main">
                    <strong>{v.profiles?.username}</strong>
                    <div>{v.attempts?.tests?.title}</div>
                    <div className="muted">
                      {reasonText[v.reason] || 'Oynadan chiqdi'} · {ago(v.created_at)}
                      {perAttempt[v.attempt_id] > 1 && ` · bu testda ${perAttempt[v.attempt_id]}-marta`}
                    </div>
                  </div>
                  <div className="action-cell">
                    <button className="btn-green" disabled={busy === v.id} onClick={() => resume(v)}>
                      Davom ettirish
                    </button>
                    <button className="btn-red" disabled={busy === v.id} onClick={() => finish(v)}>
                      Tugatish
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3>So'nggi qarorlar</h3>
          <div className="table-card">
            <div className="table-scroll">
              <table className="simple-table compact">
                <thead>
                  <tr>
                    <th>Talaba</th>
                    <th>Test</th>
                    <th>Sabab</th>
                    <th>Qaror</th>
                    <th>Vaqt</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((v) => (
                    <tr key={v.id}>
                      <td>{v.profiles?.username}</td>
                      <td>{v.attempts?.tests?.title}</td>
                      <td>{reasonText[v.reason] || '—'}</td>
                      <td>{statusText[v.status]}</td>
                      <td>{formatDate(v.created_at)}</td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan="5" className="empty-cell">
                        Hozircha qarorlar yo'q
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
