import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Login from './Login'
import Diary from './Diary'
import FoodLibrary from './FoodLibrary'
import './App.css'

type Tab = 'diary' | 'foods'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checked, setChecked] = useState(false)
  const [tab, setTab] = useState<Tab>('diary')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecked(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!checked) return null
  if (!session) return <Login />

  return (
    <div className="app-shell">
      <nav className="top-nav">
        <a className="hub-link" href="https://tensedbomsie.github.io/SatoruHUB/" title="กลับไป Satoru HUB">
          🏠
        </a>
        <span className="brand">🍽️ Food Diary</span>
        <div className="nav-tabs">
          <button className={tab === 'diary' ? 'active' : ''} onClick={() => setTab('diary')}>
            Diary
          </button>
          <button className={tab === 'foods' ? 'active' : ''} onClick={() => setTab('foods')}>
            Foods
          </button>
        </div>
        <span className="spacer" />
        <span className="user-email">{session.user.email}</span>
        <button onClick={() => supabase.auth.signOut()}>ออกจากระบบ</button>
      </nav>
      <main className="app-main fade-in" key={tab}>
        {tab === 'diary' && <Diary session={session} />}
        {tab === 'foods' && <FoodLibrary session={session} />}
      </main>
    </div>
  )
}

export default App
