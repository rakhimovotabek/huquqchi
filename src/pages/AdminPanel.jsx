import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useTabRoute } from '../lib/router'
import AdminStudents from '../components/AdminStudents'
import AdminTests from '../components/AdminTests'
import AdminResults from '../components/AdminResults'
import AdminGroups from '../components/AdminGroups'
import AdminViolations from '../components/AdminViolations'
import { APP_NAME } from '../lib/brand'

// Har bir bo'lim o'z manziliga ega: /talabalar, /testlar ... (sahifa yangilansa ham joyida qoladi)
const TABS = [
  { key: 'students', path: 'talabalar', label: 'Talabalar' },
  { key: 'tests', path: 'testlar', label: 'Testlar' },
  { key: 'groups', path: 'guruhlar', label: 'Guruhlar' },
  { key: 'violations', path: 'qoidabuzarlar', label: 'Qoidabuzarlar' },
  { key: 'results', path: 'natijalar', label: 'Natijalar' }
]

export default function AdminPanel({ profile, onLogout }) {
  const [tab, setTab] = useTabRoute(TABS)
  const [openCount, setOpenCount] = useState(0)

  // Hal qilinmagan bloklar soni (tab yonidagi qizil belgi)
  const refreshCount = useCallback(async () => {
    const { count } = await supabase
      .from('violations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
    setOpenCount(count || 0)
  }, [])

  useEffect(() => {
    refreshCount()
    const timer = setInterval(refreshCount, 8000)
    return () => clearInterval(timer)
  }, [refreshCount])

  return (
    <div>
      <header className="topbar">
        <span>
          {APP_NAME} — Admin paneli — {profile.username}
        </span>
        <button onClick={onLogout}>Chiqish</button>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'violations' && openCount > 0 && <span className="new-pill">{openCount}</span>}
          </button>
        ))}
      </nav>
      <main className="content content-wide">
        {tab === 'students' && <AdminStudents />}
        {tab === 'tests' && <AdminTests />}
        {tab === 'groups' && <AdminGroups />}
        {tab === 'violations' && <AdminViolations onChanged={refreshCount} />}
        {tab === 'results' && <AdminResults />}
      </main>
    </div>
  )
}
