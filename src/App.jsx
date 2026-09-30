import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import AdminPanel from './pages/AdminPanel'
import StudentPanel from './pages/StudentPanel'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session) {
        loadProfile(data.session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) {
        loadProfile(newSession.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function loadProfile(userId) {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (error || !data) {
      setError("Bu hisob uchun profil topilmadi. Administrator bilan bog'laning.")
      await supabase.auth.signOut()
      setProfile(null)
      setSession(null)
    } else {
      setProfile(data)
      setError('')
    }
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }

  if (loading) {
    return <div className="center-screen">Yuklanmoqda...</div>
  }

  if (!session || !profile) {
    return <Login errorFromApp={error} />
  }

  if (profile.role === 'admin') {
    return <AdminPanel profile={profile} onLogout={handleLogout} />
  }

  return <StudentPanel profile={profile} onLogout={handleLogout} />
}
