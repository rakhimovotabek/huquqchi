import { useState } from 'react'
import AdminStudents from '../components/AdminStudents'
import AdminTests from '../components/AdminTests'
import AdminResults from '../components/AdminResults'
import { APP_NAME } from '../lib/brand'

export default function AdminPanel({ profile, onLogout }) {
  const [tab, setTab] = useState('students')

  return (
    <div>
      <header className="topbar">
        <span>
          {APP_NAME} — Admin paneli — {profile.username}
        </span>
        <button onClick={onLogout}>Chiqish</button>
      </header>
      <nav className="tabs">
        <button className={tab === 'students' ? 'active' : ''} onClick={() => setTab('students')}>
          Talabalar
        </button>
        <button className={tab === 'tests' ? 'active' : ''} onClick={() => setTab('tests')}>
          Testlar
        </button>
        <button className={tab === 'results' ? 'active' : ''} onClick={() => setTab('results')}>
          Natijalar
        </button>
      </nav>
      <main className="content content-wide">
        {tab === 'students' && <AdminStudents />}
        {tab === 'tests' && <AdminTests />}
        {tab === 'results' && <AdminResults />}
      </main>
    </div>
  )
}
