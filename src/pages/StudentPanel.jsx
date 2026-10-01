import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import StudentTests from '../components/StudentTests'
import StudentResults from '../components/StudentResults'
import StudentProfile from '../components/StudentProfile'
import { UserIcon } from '../components/Icons'
import { APP_NAME } from '../lib/brand'

export default function StudentPanel({ profile, onLogout }) {
  const [tab, setTab] = useState('tests')
  const [newCount, setNewCount] = useState(0)

  // Yangi (talaba hali ochmagan) baholangan natijalar soni
  const refreshNew = useCallback(async () => {
    const { count } = await supabase
      .from('attempts')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', profile.id)
      .eq('status', 'completed')
      .eq('result_seen', false)
    setNewCount(count || 0)
  }, [profile.id])

  useEffect(() => {
    refreshNew()
  }, [tab, refreshNew])

  useEffect(() => {
    window.addEventListener('focus', refreshNew)
    return () => window.removeEventListener('focus', refreshNew)
  }, [refreshNew])

  return (
    <div>
      <header className="topbar">
        <span>{APP_NAME}</span>
        <div className="topbar-actions">
          <button
            className={`profile-btn${tab === 'profile' ? ' active' : ''}`}
            onClick={() => setTab('profile')}
            aria-label="Profil"
            title="Profil"
          >
            <UserIcon />
            <span className="profile-name">{profile.username}</span>
          </button>
          <button onClick={onLogout}>Chiqish</button>
        </div>
      </header>
      <nav className="tabs">
        <button className={tab === 'tests' ? 'active' : ''} onClick={() => setTab('tests')}>
          Testlar
        </button>
        <button className={tab === 'results' ? 'active' : ''} onClick={() => setTab('results')}>
          Natijalar
          {newCount > 0 && <span className="new-pill">Yangi natija</span>}
        </button>
      </nav>
      <main className="content">
        {tab === 'tests' && (
          <StudentTests profile={profile} newCount={newCount} onOpenResults={() => setTab('results')} />
        )}
        {tab === 'results' && <StudentResults profile={profile} onSeen={refreshNew} />}
        {tab === 'profile' && <StudentProfile profile={profile} />}
      </main>
    </div>
  )
}
