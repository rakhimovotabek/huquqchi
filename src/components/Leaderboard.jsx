import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { percent } from '../lib/format'

// Test bo'yicha eng yaxshi natijalar (server funksiyasi test_leaderboard orqali).
export default function Leaderboard({ testId }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    supabase.rpc('test_leaderboard', { p_test_id: testId }).then(({ data, error }) => {
      if (!alive) return
      if (error) setError('Reytingni yuklashda xatolik: ' + error.message)
      else setRows(data || [])
    })
    return () => {
      alive = false
    }
  }, [testId])

  if (error) return <div className="error">{error}</div>
  if (!rows) return <p className="muted">Yuklanmoqda...</p>
  if (rows.length === 0) return <p className="muted">Hozircha reyting uchun yakunlangan natijalar yo'q.</p>

  return (
    <div className="table-scroll">
      <table className="simple-table compact">
        <thead>
          <tr>
            <th style={{ width: 56 }}>O'rin</th>
            <th>Talaba</th>
            <th>Ball</th>
            <th>Foiz</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rank + r.username} className={r.is_me ? 'row-me' : ''}>
              <td>{r.rank}</td>
              <td>
                {r.username}
                {r.is_me && <span className="chip chip-blue">Siz</span>}
              </td>
              <td>
                {r.score} / {r.total}
              </td>
              <td>{percent(r.score, r.total)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
