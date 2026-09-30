import { useState } from 'react'
import StudentTests from '../components/StudentTests'
import StudentResults from '../components/StudentResults'
import { APP_NAME } from '../lib/brand'

export default function StudentPanel({ profile, onLogout }) {
  const [tab, setTab] = useState('tests')

  return (
    <div>
      <header className="topbar">
        <span>
          {APP_NAME} — {profile.username}
        </span>
        <button onClick={onLogout}>Chiqish</button>
      </header>
      <nav className="tabs">
        <button className={tab === 'tests' ? 'active' : ''} onClick={() => setTab('tests')}>
          Testlar
        </button>
        <button className={tab === 'results' ? 'active' : ''} onClick={() => setTab('results')}>
          Natijalar
        </button>
      </nav>
      <main className="content">
        {tab === 'tests' && <StudentTests profile={profile} />}
        {tab === 'results' && <StudentResults profile={profile} />}
      </main>
    </div>
  )
}
