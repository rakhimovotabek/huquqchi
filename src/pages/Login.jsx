import { useState } from 'react'
import { supabase, usernameToEmail } from '../lib/supabase'
import { APP_NAME } from '../lib/brand'

export default function Login({ errorFromApp }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password) {
      setError('Foydalanuvchi nomi va parolni kiriting')
      return
    }
    setLoading(true)
    const email = usernameToEmail(username)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError("Foydalanuvchi nomi yoki parol noto'g'ri")
  }

  return (
    <div className="center-screen">
      <form className="card login-card" onSubmit={handleLogin}>
        <h1>{APP_NAME}</h1>
        {(error || errorFromApp) && <div className="error">{error || errorFromApp}</div>}
        <label>Foydalanuvchi nomi</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        <label>Parol</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit" disabled={loading}>
          {loading ? 'Kirilmoqda...' : 'Kirish'}
        </button>
      </form>
    </div>
  )
}
