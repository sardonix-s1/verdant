import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { errMsg, supabase } from './supabase'
import { addDays, ymd } from './dates'
import { buildPlan, starterHabits } from './plan'
import { toast } from './toast'
import { dayStats, doneIdsOn, habitStreak, isDue } from './logic'
import {
  MISS_COINS, PERFECT_DAY, completionReward, levelOf, pickForfeit, rollChest, shieldUsedInWeek, totals,
  type ChestResult,
} from './game'
import type { Goal, Habit, LedgerRow, Log, Note, Penalty, PlanItem, Profile, Reward } from './types'

export type HabitInput = Partial<Omit<Habit, 'id' | 'user_id' | 'created_at'>> & { title: string }
export interface GoalInput {
  horizon: 30 | 90
  area: string | null
  text: string
}
export interface StarterInput {
  title: string
  reason?: string | null
  time?: string | null
}
export interface ToggleResult {
  added: boolean
  xp: number
  coins: number
  perfect: boolean
  streak: number
  levelUp: number | null
  done: number
  due: number
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
  ledger: LedgerRow[]
  rewards: Reward[]
  penalties: Penalty[]
  xp: number
  coins: number
  saveProfile: (patch: Partial<Profile>) => Promise<boolean>
  completeOnboarding: (patch: Partial<Profile>, goals: GoalInput[], good: StarterInput[], quit: string[]) => Promise<boolean>
  addGoal: (g: GoalInput) => Promise<void>
  deleteGoal: (id: string) => Promise<void>
  saveHabit: (input: HabitInput, id?: string) => Promise<Habit | null>
  deleteHabit: (id: string) => Promise<void>
  toggleLog: (habit: Habit, date: string) => Promise<ToggleResult | null>
  togglePlan: (id: string) => Promise<void>
  extendPlan: () => Promise<void>
  addNote: (body: string) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  openChest: (date: string) => Promise<ChestResult | null>
  addReward: (title: string, emoji: string, cost: number) => Promise<void>
  deleteReward: (id: string) => Promise<void>
  claimReward: (r: Reward) => Promise<boolean>
  completePenalty: (id: string) => Promise<void>
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
const LOG_COLS = 'id,habit_id,log_date,done,value,created_at'
const LEDGER_COLS = 'id,ref,kind,xp,coins,note,created_at'
const REWARD_COLS = 'id,title,emoji,cost,claimed_at'
const PEN_COLS = 'id,title,habit_id,for_date,done'

type NewLedger = { ref: string; kind: string; xp: number; coins: number; note?: string | null }

/** Мягкие последствия за пропуски вчера и позавчера: только в дни, когда пользователь был активен. */
async function settle(userId: string, prof: Profile, hs: Habit[], ls: Log[], led: LedgerRow[], pens: Penalty[]) {
  if (!prof.onboarded || prof.penalty_mode === 'off') return { led: [] as LedgerRow[], pen: [] as Penalty[] }
  const today = ymd()
  const newLed: NewLedger[] = []
  const newPen: { title: string; habit_id: string; for_date: string }[] = []
  const sim: { ref: string }[] = led.map((r) => ({ ref: r.ref }))
  const notes: string[] = []
  for (const back of [2, 1]) {
    const d = addDays(today, -back)
    if (!ls.some((l) => l.done && l.log_date === d)) continue
    const doneSet = doneIdsOn(ls, d)
    const missed = hs
      .filter((h) => h.frequency !== 'times_per_week' && h.kind !== 'goal' && isDue(h, d) && !doneSet.has(h.id) && h.created_at.slice(0, 10) <= d)
      .slice(0, 2)
    for (const h of missed) {
      const key = `${d}:${h.id}`
      const handled =
        sim.some((r) => r.ref === `miss:${key}` || r.ref === `shield:${key}`) ||
        pens.some((p) => p.habit_id === h.id && p.for_date === d)
      if (handled) continue
      if (!shieldUsedInWeek(sim as LedgerRow[], d)) {
        newLed.push({ ref: `shield:${key}`, kind: 'shield', xp: 0, coins: 0, note: h.title })
        sim.push({ ref: `shield:${key}` })
        notes.push(`Щит недели прикрыл «${h.title}»`)
      } else if (prof.penalty_mode === 'soft') {
        newLed.push({ ref: `miss:${key}`, kind: 'miss', xp: 0, coins: -MISS_COINS, note: h.title })
        sim.push({ ref: `miss:${key}` })
      } else {
        newPen.push({ title: pickForfeit(key), habit_id: h.id, for_date: d })
      }
    }
  }
  let ledOut: LedgerRow[] = []
  let penOut: Penalty[] = []
  if (newLed.length) {
    const r = await supabase
      .from('ledger')
      .upsert(newLed.map((x) => ({ ...x, user_id: userId })), { onConflict: 'user_id,ref', ignoreDuplicates: true })
      .select(LEDGER_COLS)
    if (!r.error) ledOut = (r.data ?? []) as LedgerRow[]
  }
  if (newPen.length) {
    const r = await supabase
      .from('penalties')
      .upsert(newPen.map((x) => ({ ...x, user_id: userId })), { onConflict: 'user_id,habit_id,for_date', ignoreDuplicates: true })
      .select(PEN_COLS)
    if (!r.error) penOut = (r.data ?? []) as Penalty[]
  }
  const missCount = ledOut.filter((r) => r.kind === 'miss').length
  if (notes.length) toast(notes[0], 'info')
  else if (missCount) toast(`Пропуски вчера: −${missCount * MISS_COINS} монет. Один шаг сегодня всё исправит.`, 'info')
  else if (penOut.length) toast('Появилось маленькое задание-«долг». Оно во вкладке «Награды».', 'info')
  return { led: ledOut, pen: penOut }
}

export function DataProvider({ userId, email, children }: { userId: string; email: string; children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<Log[]>([])
  const [plan, setPlan] = useState<PlanItem[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [penalties, setPenalties] = useState<Penalty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [p, g, h, l, pl, n, le, rw, pe] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('goals').select('id,horizon,area,text').order('created_at'),
        supabase.from('habits').select(HABIT_COLS).order('created_at'),
        supabase.from('habit_logs').select(LOG_COLS).gte('log_date', addDays(ymd(), -200)).limit(5000),
        supabase.from('plan_items').select('id,day_number,title,area,done').order('day_number').order('created_at'),
        supabase.from('notes').select('id,note_date,body,created_at').order('created_at', { ascending: false }).limit(20),
        supabase.from('ledger').select(LEDGER_COLS).order('created_at').limit(5000),
        supabase.from('rewards').select(REWARD_COLS).order('cost'),
        supabase.from('penalties').select(PEN_COLS).order('for_date', { ascending: false }).limit(200),
      ])
      for (const r of [p, g, h, l, pl, n, le, rw, pe]) if (r.error) throw r.error
      let prof = p.data as Profile | null
      if (!prof) {
        const ins = await supabase.from('profiles').insert({ user_id: userId }).select('*').single()
        if (ins.error) throw ins.error
        prof = ins.data as Profile
      }
      const hs = (h.data ?? []) as Habit[]
      const ls = (l.data ?? []) as Log[]
      let led = (le.data ?? []) as LedgerRow[]
      let pens = (pe.data ?? []) as Penalty[]
      const extra = await settle(userId, prof, hs, ls, led, pens)
      led = [...led, ...extra.led]
      pens = [...extra.pen, ...pens]
      setProfile(prof)
      setGoals((g.data ?? []) as Goal[])
      setHabits(hs)
      setLogs(ls)
      setPlan((pl.data ?? []) as PlanItem[])
      setNotes((n.data ?? []) as Note[])
      setLedger(led)
      setRewards((rw.data ?? []) as Reward[])
      setPenalties(pens)
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
  const tot = totals(ledger)

  /* ----- Ledger ----- */
  async function addLedger(rows: NewLedger[]) {
    if (!rows.length) return
    const { data, error } = await supabase
      .from('ledger')
      .upsert(rows.map((r) => ({ ...r, user_id: userId })), { onConflict: 'user_id,ref', ignoreDuplicates: true })
      .select(LEDGER_COLS)
    if (error) return void toast(errMsg(error), 'err')
    const add = (data ?? []) as LedgerRow[]
    setLedger((p) => [...p, ...add.filter((a) => !p.some((x) => x.ref === a.ref))])
  }
  async function removeLedger(refs: string[]) {
    if (!refs.length) return
    const { error } = await supabase.from('ledger').delete().in('ref', refs)
    if (error) return void toast(errMsg(error), 'err')
    setLedger((p) => p.filter((r) => !refs.includes(r.ref)))
  }

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
      const minutes = patch.daily_minutes ?? 15
      const nowIso = new Date().toISOString()
      const up = await supabase
        .from('profiles')
        .update({ ...patch, onboarded: true, consent_at: nowIso, privacy_at: nowIso, updated_at: nowIso })
        .eq('user_id', userId)
      if (up.error) throw up.error

      if (goalsIn.length) {
        const r = await supabase.from('goals').insert(goalsIn.map((g) => ({ ...g, user_id: userId })))
        if (r.error) throw r.error
      }

      const picked = good.slice(0, 6)
      const starters = picked.length < 2 ? starterHabits(areas, minutes, 2 - picked.length) : []
      const rows = [
        ...picked.map((s) => ({ title: s.title, kind: 'good', reason: s.reason ?? null, reminder_time: s.time ?? null })),
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

      await supabase
        .from('ledger')
        .upsert({ user_id: userId, ref: 'welcome', kind: 'bonus', xp: 0, coins: 20, note: 'Приветственный бонус' }, { onConflict: 'user_id,ref', ignoreDuplicates: true })

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
    setPenalties((p) => p.filter((x) => x.habit_id !== id))
  }

  const toggleLog: DataState['toggleLog'] = async (habit, date) => {
    const existing = logs.find((l) => l.habit_id === habit.id && l.log_date === date)
    if (existing) {
      const before = dayStats(habits, logs, date)
      setLogs((p) => p.filter((l) => l.id !== existing.id))
      const { error } = await supabase.from('habit_logs').delete().eq('id', existing.id)
      if (error) {
        setLogs((p) => [...p, existing])
        toast(errMsg(error), 'err')
        return null
      }
      const refs = [`log:${habit.id}:${date}`, `miss:${date}:${habit.id}`]
      if (before.due > 0 && before.done === before.due) refs.push(`day:${date}`)
      await removeLedger(refs)
      return { added: false, xp: 0, coins: 0, perfect: false, streak: 0, levelUp: null, done: before.done - 1, due: before.due }
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
      return null
    }
    const saved = data as Log
    setLogs((p) => p.map((l) => (l.id === tmp.id ? saved : l)))

    const next = [...logs, saved]
    const streak = habitStreak(habit, next, ymd())
    const r = completionReward(habit, streak)
    const st = dayStats(habits, next, date)
    const perfect = st.due > 0 && st.done === st.due
    const rows: NewLedger[] = [{ ref: `log:${habit.id}:${date}`, kind: 'log', xp: r.xp, coins: r.coins, note: habit.title }]
    let xp = r.xp
    let coins = r.coins
    if (perfect) {
      rows.push({ ref: `day:${date}`, kind: 'day', xp: PERFECT_DAY.xp, coins: PERFECT_DAY.coins, note: 'Идеальный день' })
      xp += PERFECT_DAY.xp
      coins += PERFECT_DAY.coins
    }
    // Если пользователь отметил день задним числом, «долг» и штраф за него снимаются.
    await removeLedger([`miss:${date}:${habit.id}`])
    const pen = penalties.find((x) => x.habit_id === habit.id && x.for_date === date)
    if (pen) {
      await supabase.from('penalties').delete().eq('id', pen.id)
      setPenalties((p) => p.filter((x) => x.id !== pen.id))
    }
    const before = levelOf(totals(ledger).xp).level
    await addLedger(rows)
    const after = levelOf(totals(ledger).xp + xp).level
    return { added: true, xp, coins, perfect, streak, levelUp: after > before ? after : null, done: st.done, due: st.due }
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

  const openChest: DataState['openChest'] = async (date) => {
    const ref = `chest:${date}`
    if (ledger.some((r) => r.ref === ref)) return null
    if (doneIdsOn(logs, date).size === 0) return null
    const res = rollChest()
    const { data, error } = await supabase
      .from('ledger')
      .upsert({ user_id: userId, ref, kind: 'chest', xp: res.xp, coins: res.coins, note: res.note }, { onConflict: 'user_id,ref', ignoreDuplicates: true })
      .select(LEDGER_COLS)
    if (error) {
      toast(errMsg(error), 'err')
      return null
    }
    const row = ((data ?? []) as LedgerRow[])[0]
    if (!row) return null
    setLedger((p) => [...p, row])
    return res
  }

  const addReward: DataState['addReward'] = async (title, emoji, cost) => {
    const { data, error } = await supabase
      .from('rewards')
      .insert({ user_id: userId, title, emoji, cost })
      .select(REWARD_COLS)
      .single()
    if (error) return void toast(errMsg(error), 'err')
    setRewards((p) => [...p, data as Reward].sort((a, b) => a.cost - b.cost))
  }

  const deleteReward: DataState['deleteReward'] = async (id) => {
    const { error } = await supabase.from('rewards').delete().eq('id', id)
    if (error) return void toast(errMsg(error), 'err')
    setRewards((p) => p.filter((r) => r.id !== id))
  }

  const claimReward: DataState['claimReward'] = async (r) => {
    if (totals(ledger).coins < r.cost) {
      toast('Пока не хватает монет. Ещё пара дел, и подарок твой.', 'info')
      return false
    }
    const now = new Date().toISOString()
    await addLedger([{ ref: `reward:${r.id}:${Date.now()}`, kind: 'reward', xp: 0, coins: -r.cost, note: r.title }])
    const { error } = await supabase.from('rewards').update({ claimed_at: now }).eq('id', r.id)
    if (!error) setRewards((p) => p.map((x) => (x.id === r.id ? { ...x, claimed_at: now } : x)))
    return true
  }

  const completePenalty: DataState['completePenalty'] = async (id) => {
    const { error } = await supabase.from('penalties').update({ done: true }).eq('id', id)
    if (error) return void toast(errMsg(error), 'err')
    setPenalties((p) => p.map((x) => (x.id === id ? { ...x, done: true } : x)))
    await addLedger([{ ref: `pen:${id}`, kind: 'pen', xp: 5, coins: 0, note: 'Долг закрыт' }])
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
    ledger,
    rewards,
    penalties,
  })

  const deleteAllData: DataState['deleteAllData'] = async () => {
    try {
      for (const t of ['penalties', 'rewards', 'ledger', 'habits', 'goals', 'plan_items', 'notes'] as const) {
        const r = await supabase.from(t).delete().eq('user_id', userId)
        if (r.error) throw r.error
      }
      const r = await supabase
        .from('profiles')
        .update({
          display_name: null, age_group: null, height_cm: null, weight_kg: null, interests: [], focus_areas: [],
          wake_time: null, sleep_time: null, free_windows: null, notif_enabled: false, consent_at: null, privacy_at: null,
          gender: null, motivation: null, chronotype: null, why: null, obstacles: [],
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
    userId, email, profile: prof, goals, habits, logs, plan, notes, ledger, rewards, penalties,
    xp: tot.xp, coins: tot.coins,
    saveProfile, completeOnboarding, addGoal, deleteGoal, saveHabit, deleteHabit, toggleLog,
    togglePlan, extendPlan, addNote, deleteNote, openChest, addReward, deleteReward, claimReward, completePenalty,
    exportAll, deleteAllData, deleteAccount,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
