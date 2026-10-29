export type Kind = 'good' | 'quit' | 'task' | 'goal'
export type Freq = 'daily' | 'weekdays' | 'times_per_week'

export interface Habit {
  id: string
  user_id: string
  title: string
  description: string | null
  kind: Kind
  frequency: Freq
  weekdays: number[] // 0 = воскресенье ... 6 = суббота (как в JS getDay)
  times_per_week: number | null
  target: number | null
  unit: string | null
  reminder_time: string | null
  start_date: string
  status: 'active' | 'archived'
  reason: string | null
  created_at: string
}

export interface Log {
  id: string
  habit_id: string
  log_date: string
  done: boolean
  value: number | null
}

export interface Profile {
  user_id: string
  display_name: string | null
  age_group: string | null
  height_cm: number | null
  weight_kg: number | null
  interests: string[]
  focus_areas: string[]
  wake_time: string | null
  sleep_time: string | null
  free_windows: string | null
  daily_minutes: number
  reminder_style: string
  intensity: string
  notif_enabled: boolean
  consent_at: string | null
  onboarded: boolean
}

export interface Goal {
  id: string
  horizon: 30 | 90
  area: string | null
  text: string
}

export interface PlanItem {
  id: string
  day_number: number
  title: string
  area: string | null
  done: boolean
}

export interface Note {
  id: string
  note_date: string
  body: string
  created_at: string
}
