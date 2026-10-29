import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { errMsg, supabase } from './supabase'
import { addDays, ymd } from './dates'
import { buildPlan, starterHabits } from './plan'
import { toast } from './toast'
import type { Goal, Habit, Log, Note, PlanItem, Profile } from './types'

export type HabitInput = Partial<Omit<Habit, 'id' | 'user_id' | 'created_at'>> & { title: string }
export interface GoalInput {
  horizon: 30 | 90
  area: string | null
  text: string
}

export interface DataState {
  userId: string
  email: string
  profile: Profile
  goals: Goal[]
  habits: Habit[]
  logs: Log[]
  plan: PlanItem[]
  notes: Note[]
  saveProfile: (patch: Partial<Profile>) => Promise<boolean>
  completeOnboarding: (patch: Partial<Profile>, goals: GoalInput[], good: string[], quit: string[]) => Promise<boolean>
  addGoal: (g: GoalInput) => Promise<void>
  deleteGoal: (id: string) => Promise<void>
  saveHabit: (input: HabitInput, id?: string) => Promise<Habit | null>
  deleteHabit: (id: string) => Promise<void>
  toggleLog: (habit: Habit, date: string) => Promise<void>
  togglePlan: (id: string) => Promise<void>
  extendPlan: () => Promise<void>
  addNote: (body: string) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  exportAll: () => Record<string, unknown>
  deleteAllData: () => Promise<boolean>
  deleteAccount: () => Promise<boolean>
}

const Ctx = createContext<DataState | null>(null)

export function useData(): DataState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useData вне DataProvider')
  return v
}

const HABIT_COLS = '*'
const LOG_COLS = 'id,habit_id,log_date,done,value'

export function DataProvider({ userId, email, children }: { userId: string; email: string; children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<Log[]>([])
  const [plan, setPlan] = useState<PlanItem[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [p, g, h, l, pl, n] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('goals').select('id,horizon,area,text').order('created_at'),
        supabase.from('habits').select(HABIT_COLS).order('created_at'),
        supabase.from('habit_logs').select(LOG_COLS).gte('log_date', addDays(ymd(), -200)).limit(5000),
        supabase.from('plan_items').select('id,day_number,title,area,done').order('day_number').order('created_at'),
        supabase.from('notes').select('id,note_date,body,created_at').order('created_at', { ascending: false }).limit(20),
      ])
      for (const r of [p, g, h, l, pl, n]) if (r.error) throw r.error
      let prof = p.data as Profile | null
      if (!prof) {
        const ins = await supabase.from('profiles').insert({ user_id: userId }).select('*').single()
        if (ins.error) throw ins.error
        prof = ins.data as Profile
      }
      setProfile(prof)
      setGoals((g.data ?? []) as Goal[])
      setHabits((h.data ?? []) as Habit[])
      setLogs((l.data ?? []) as Log[])
      setPlan((pl.data ?? []) as PlanItem[])
      setNotes((n.data ?? []) as Note[])
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <div className="splash"><div className="spinner" aria-label="Загрузка" /></div>
  if (error || !profile) {
    return (
      <div className="splash col">
        <p className="muted center">Не удалось загрузить данные.<br />{error}</p>
        <button className="btn" onClick={() => { setLoading(true); void load() }}>Повторить</button>
        <button className="btn ghost" onClick={() => void supabase.auth.signOut()}>Выйти</button>
      </div>
    )
  }

  const prof: Profile = profile

  const saveProfile: DataState['saveProfile'] = async (patch) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select('*')
      .single()
    if (error) {
      toast(errMsg(error), 'err')
      return false
    }
    setProfile(data as Profile)
    return true
  }

  const completeOnboarding: DataState['completeOnboarding'] = async (patch, goalsIn, good, quit) => {
    try {
      const areas = patch.focus_areas ?? []
      const minutes = patch.daily_minutes ?? 20
      const up = await supabase
        .from('profiles')
        .update({ ...patch, onboarded: true, consent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('user_id', userId)
      if (up.error) throw up.error

      if (goalsIn.length) {
        const r = await supabase.from('goals').insert(goalsIn.map((g) => ({ ...g, user_id: userId })))
        if (r.error) throw r.error
      }

      const goodTitles = good.slice(0, 5)
      const starters = goodTitles.length < 3 ? starterHabits(areas, minutes, 3 - goodTitles.length) : []
      const rows = [
        ...goodTitles.map((title) => ({ title, kind: 'good' })),
        ...starters.map((s) => ({ title: s.title, kind: 'good', reason: s.why })),
        ...quit.slice(0, 3).map((title) => ({ title, kind: 'quit' })),
      ].map((r) => ({ ...r, user_id: userId }))
      if (rows.length) {
        const r = await supabase.from('habits').insert(rows)
        if (r.error) throw r.error
      }

      const items = buildPlan(areas, minutes, 1, 7).map((i) => ({ ...i, user_id: userId }))
      const r2 = await supabase.from('plan_items').insert(items)
      if (r2.error) throw r2.error

      await load()
      return true
    } catch (e) {
      toast(errMsg(e), 'err')
      return false
    }
  }

  const addGoal: DataState['addGoal'] = async (g) => {
    const { data, error } = await supabase
      .from('goals')
      .insert({ ...g, user_id: userId })
      .select('id,horizon,area,text')
      .single()
    if (error) return void toast(errMsg(error), 'err')
    setGoals((p) => [...p, data as Goal])
  }

  const deleteGoal: DataState['deleteGoal'] = async (id) => {
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (error) return void toast(errMsg(error), 'err')
    setGoals((p) => p.filter((g) => g.id !== id))
  }

  const saveHabit: DataState['saveHabit'] = async (input, id) => {
    const q = id
      ? supabase.from('habits').update(input).eq('id', id)
      : supabase.from('habits').insert({ ...input, user_id: userId })
    const { data, error } = await q.select(HABIT_COLS).single()
    if (error) {
      toast(errMsg(error), 'err')
      return null
    }
    const h = data as Habit
    setHabits((p) => (id ? p.map((x) => (x.id === id ? h : x)) : [...p, h]))
    return h
  }

  const deleteHabit: DataState['deleteHabit'] = async (id) => {
    const { error } = await supabase.from('habits').delete().eq('id', id)
    if (error) return void toast(errMsg(error), 'err')
    setHabits((p) => p.filter((h) => h.id !== id))
    setLogs((p) => p.filter((l) => l.habit_id !== id))
  }

  const toggleLog: DataState['toggleLog'] = async (habit, date) => {
    const existing = logs.find((l) => l.habit_id === habit.id && l.log_date === date)
    if (existing) {
      setLogs((p) => p.filter((l) => l.id !== existing.id))
      const { error } = await supabase.from('habit_logs').delete().eq('id', existing.id)
      if (error) {
        setLogs((p) => [...p, existing])
        toast(errMsg(error), 'err')
      }
      return
    }
    const tmp: Log = { id: `tmp-${Math.random()}`, habit_id: habit.id, log_date: date, done: true, value: null }
    setLogs((p) => [...p, tmp])
    const { data, error } = await supabase
      .from('habit_logs')
      .upsert({ user_id: userId, habit_id: habit.id, log_date: date, done: true }, { onConflict: 'habit_id,log_date' })
      .select(LOG_COLS)
      .single()
    if (error) {
      setLogs((p) => p.filter((l) => l.id !== tmp.id))
      toast(errMsg(error), 'err')
      return
    }
    setLogs((p) => p.map((l) => (l.id === tmp.id ? (data as Log) : l)))
  }

  const togglePlan: DataState['togglePlan'] = async (id) => {
    const it = plan.find((p) => p.id === id)
    if (!it) return
    setPlan((p) => p.map((x) => (x.id === id ? { ...x, done: !x.done } : x)))
    const { error } = await supabase.from('plan_items').update({ done: !it.done }).eq('id', id)
    if (error) {
      setPlan((p) => p.map((x) => (x.id === id ? { ...x, done: it.done } : x)))
      toast(errMsg(error), 'err')
    }
  }

  const extendPlan: DataState['extendPlan'] = async () => {
    const max = Math.max(0, ...plan.map((p) => p.day_number))
    if (max >= 30) return
    const rows = buildPlan(prof.focus_areas, prof.daily_minutes, max + 1, 30).map((i) => ({ ...i, user_id: userId }))
    const { data, error } = await supabase.from('plan_items').insert(rows).select('id,day_number,title,area,done')
    if (error) return void toast(errMsg(error), 'err')
    setPlan((p) => [...p, ...((data ?? []) as PlanItem[])].sort((a, b) => a.day_number - b.day_number))
  }

  const addNote: DataState['addNote'] = async (body) => {
    const { data, error } = await supabase
      .from('notes')
      .insert({ user_id: userId, body, note_date: ymd() })
      .select('id,note_date,body,created_at')
      .single()
    if (error) return void toast(errMsg(error), 'err')
    setNotes((p) => [data as Note, ...p])
  }

  const deleteNote: DataState['deleteNote'] = async (id) => {
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) return void toast(errMsg(error), 'err')
    setNotes((p) => p.filter((n) => n.id !== id))
  }

  const exportAll: DataState['exportAll'] = () => ({
    exported_at: new Date().toISOString(),
    email,
    profile: prof,
    goals,
    habits,
    habit_logs: logs,
    plan_items: plan,
    notes,
  })

  const deleteAllData: DataState['deleteAllData'] = async () => {
    try {
      for (const t of ['habits', 'goals', 'plan_items', 'notes'] as const) {
        const r = await supabase.from(t).delete().eq('user_id', userId)
        if (r.error) throw r.error
      }
      const r = await supabase
        .from('profiles')
        .update({
          display_name: null, age_group: null, height_cm: null, weight_kg: null, interests: [], focus_areas: [],
          wake_time: null, sleep_time: null, free_windows: null, notif_enabled: false, consent_at: null,
          onboarded: false, updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
      if (r.error) throw r.error
      await load()
      return true
    } catch (e) {
      toast(errMsg(e), 'err')
      return false
    }
  }

  const deleteAccount: DataState['deleteAccount'] = async () => {
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      toast(errMsg(error), 'err')
      return false
    }
    await supabase.auth.signOut()
    return true
  }

  const value: DataState = {
    userId, email, profile: prof, goals, habits, logs, plan, notes,
    saveProfile, completeOnboarding, addGoal, deleteGoal, saveHabit, deleteHabit, toggleLog,
    togglePlan, extendPlan, addNote, deleteNote, exportAll, deleteAllData, deleteAccount,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
