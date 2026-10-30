import { useEffect, useState, type CSSProperties, type ReactElement } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configured, supabase } from './lib/supabase'
import { DataProvider, useData } from './lib/data'
import { hm, nowHM, ymd } from './lib/dates'
import { doneIdsOn, isDue } from './lib/logic'
import { useReminders } from './lib/reminders'
import { useNow } from './lib/useNow'
import type { Habit } from './lib/types'
import { FxLayer, IcCoach, IcGift, IcPath, IcToday, IcUser, Toasts } from './components/ui'
import HabitForm from './components/HabitForm'
import Auth from './screens/Auth'
import Onboarding from './screens/Onboarding'
import Today from './screens/Today'
import Path from './screens/Path'
import Coach from './screens/Coach'
import Rewards from './screens/Rewards'
import Settings from './screens/Settings'

type Tab = 'today' | 'path' | 'coach' | 'rewards' | 'profile'

function Shell() {
  const { profile, habits, logs } = useData()
  useReminders(habits, logs, profile)
  const now = useNow()
  const [tab, setTab] = useState<Tab>('today')
  const [form, setForm] = useState<{ habit?: Habit } | null>(null)

  if (!profile.onboarded) return <Onboarding />

  const today = ymd(now)
  const done = doneIdsOn(logs, today)
  const nowT = nowHM(now)
  const overdue = habits.filter((h) => isDue(h, today) && h.reminder_time && hm(h.reminder_time) <= nowT && !done.has(h.id)).length

  const tabs: { id: Tab; label: string; icon: ReactElement }[] = [
    { id: 'today', label: 'Сегодня', icon: <IcToday /> },
    { id: 'path', label: 'Путь', icon: <IcPath /> },
    { id: 'coach', label: 'Коуч', icon: <IcCoach /> },
    { id: 'rewards', label: 'Награды', icon: <IcGift /> },
    { id: 'profile', label: 'Профиль', icon: <IcUser /> },
  ]

  const openNew = () => setForm({})
  const openEdit = (h: Habit) => setForm({ habit: h })

  return (
    <div className="app">
      <div className="ambient" aria-hidden="true"><i /><i /></div>
      <main>
        {tab === 'today' && <Today onAdd={openNew} onEdit={openEdit} />}
        {tab === 'path' && <Path onAdd={openNew} onEdit={openEdit} />}
        {tab === 'coach' && <Coach />}
        {tab === 'rewards' && <Rewards />}
        {tab === 'profile' && <Settings />}
      </main>
      <nav className="tabbar" aria-label="Основная навигация" style={{ '--n': tabs.findIndex((t) => t.id === tab) } as CSSProperties}>
        <span className="pill" aria-hidden="true" />
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <span className="ico">
              {t.icon}
              {t.id === 'today' && overdue > 0 && <em className="badge" aria-label={`Ждут: ${overdue}`}>{overdue}</em>}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      {form && <HabitForm habit={form.habit} onClose={() => setForm(null)} />}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    if (!configured) return
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!configured) {
    return (
      <div className="splash col">
        <p className="center">Не заданы переменные окружения.<br />Скопируй <code>.env.example</code> в <code>.env</code> и укажи данные проекта Supabase.</p>
      </div>
    )
  }

  return (
    <>
      {session === undefined ? (
        <div className="splash"><div className="spinner" aria-label="Загрузка" /></div>
      ) : session === null ? (
        <Auth />
      ) : (
        <DataProvider key={session.user.id} userId={session.user.id} email={session.user.email ?? ''}>
          <Shell />
        </DataProvider>
      )}
      <Toasts />
      <FxLayer />
    </>
  )
}
