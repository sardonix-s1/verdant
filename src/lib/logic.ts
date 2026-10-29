import { addDays, dow } from './dates'
import type { Habit, Log, Profile } from './types'

/** Должна ли привычка выполняться в этот день. */
export function isDue(h: Habit, date: string): boolean {
  if (h.status !== 'active' || h.start_date > date) return false
  if (h.frequency === 'weekdays') return h.weekdays.includes(dow(date))
  return true
}

const weight = (h: Habit) =>
  h.frequency === 'times_per_week' ? Math.min(7, Math.max(1, h.times_per_week ?? 3)) / 7 : 1

export function doneIdsOn(logs: Log[], date: string): Set<string> {
  return new Set(logs.filter((l) => l.log_date === date && l.done).map((l) => l.habit_id))
}

export function dayStats(habits: Habit[], logs: Log[], date: string) {
  const due = habits.filter((h) => isDue(h, date))
  const ids = doneIdsOn(logs, date)
  return { due: due.length, done: due.filter((h) => ids.has(h.id)).length }
}

/** Доля выполнения за период (0..1) или null, если нечего выполнять. */
export function rangeRate(habits: Habit[], logs: Log[], from: string, to: string): number | null {
  const byDate = new Map<string, Set<string>>()
  for (const l of logs) {
    if (!l.done) continue
    const s = byDate.get(l.log_date) ?? new Set<string>()
    s.add(l.habit_id)
    byDate.set(l.log_date, s)
  }
  let due = 0
  let done = 0
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const s = byDate.get(d)
    for (const h of habits) {
      if (!isDue(h, d)) continue
      due += weight(h)
      if (s?.has(h.id)) done += 1
    }
  }
  return due === 0 ? null : Math.min(1, done / due)
}

export function habitStreak(h: Habit, logs: Log[], today: string): number {
  const set = new Set(logs.filter((l) => l.habit_id === h.id && l.done).map((l) => l.log_date))
  let d = today
  if (isDue(h, d) && !set.has(d)) d = addDays(d, -1)
  let n = 0
  for (let i = 0; i < 400; i++) {
    if (d < h.start_date) break
    const notDue = h.frequency === 'weekdays' && !h.weekdays.includes(dow(d))
    if (set.has(d)) n++
    else if (!notDue) break
    d = addDays(d, -1)
  }
  return n
}

/** Серия дней подряд, в которые отмечено хотя бы одно действие. */
export function overallStreak(habits: Habit[], logs: Log[], today: string): number {
  const ids = new Set(habits.filter((h) => h.status === 'active').map((h) => h.id))
  const dates = new Set(logs.filter((l) => l.done && ids.has(l.habit_id)).map((l) => l.log_date))
  let d = dates.has(today) ? today : addDays(today, -1)
  let n = 0
  while (dates.has(d) && n < 1000) {
    n++
    d = addDays(d, -1)
  }
  return n
}

export interface Insight {
  tone: 'good' | 'tip' | 'warn'
  title: string
  text: string
}

/** Советы на правилах: по целям, пропускам и истории. Без внешнего AI. */
export function buildInsights(habits: Habit[], logs: Log[], profile: Profile, today: string): Insight[] {
  const out: Insight[] = []
  const active = habits.filter((h) => h.status === 'active')

  if (active.length === 0) {
    out.push({
      tone: 'tip',
      title: 'Начни с малого',
      text: 'Пока нет активных привычек. Добавь одну-три небольшие — этого достаточно, чтобы запустить ритм.',
    })
    return out
  }

  if (active.length > 5) {
    out.push({
      tone: 'tip',
      title: 'Много привычек сразу',
      text: `Сейчас активных привычек: ${active.length}. Когда их больше пяти, их проще бросить все сразу. Можно отправить часть в архив и вернуться к ним позже.`,
    })
  }

  const week = rangeRate(active, logs, addDays(today, -6), today)
  const hasHistory = logs.length > 0
  if (week !== null && hasHistory) {
    const p = Math.round(week * 100)
    if (week >= 0.8) {
      out.push({ tone: 'good', title: `Сильная неделя: ${p}%`, text: 'Ты стабильно выполняешь план. Если хочется большего, можно слегка усложнить одну привычку, но не все сразу.' })
    } else if (week >= 0.4) {
      out.push({ tone: 'tip', title: `Неделя: ${p}%`, text: 'Хороший ход. Выбери одну привычку, которая даётся легче всего, и сделай её «якорем» дня.' })
    } else {
      out.push({
        tone: 'tip',
        title: `Неделя: ${p}%`,
        text: profile.intensity === 'high'
          ? 'По твоим ответам выбран интенсивный план, а выполнение пока низкое. Может подойти режим «Сбалансированный» в профиле: это не шаг назад, а настройка под реальную жизнь.'
          : 'Возможно, план сейчас тяжеловат. Попробуй сделать каждую привычку вдвое меньше: важнее вернуть регулярность.',
      })
    }
  }

  // Самые «трудные» привычки за последние 14 дней
  const hard = active
    .filter((h) => h.kind !== 'quit')
    .map((h) => ({ h, r: rangeRate([h], logs, addDays(today, -13), today) }))
    .filter((x): x is { h: Habit; r: number } => x.r !== null && x.r < 0.35 && x.h.start_date <= addDays(today, -6))
    .sort((a, b) => a.r - b.r)
    .slice(0, 2)
  for (const { h } of hard) {
    out.push({
      tone: 'tip',
      title: `«${h.title}» даётся труднее`,
      text: `Попробуй уменьшить её до пары минут или привязать к уже устоявшемуся действию (после чая, после душа).${profile.free_windows ? ` Из твоих свободных окон: ${profile.free_windows}.` : ''}`,
    })
  }

  // Серии
  const best = active
    .filter((h) => h.kind !== 'quit')
    .map((h) => ({ h, s: habitStreak(h, logs, today) }))
    .sort((a, b) => b.s - a.s)[0]
  if (best && best.s >= 3) {
    out.push({ tone: 'good', title: `Серия: ${best.s} дн.`, text: `«${best.h.title}» выполняется несколько дней подряд. Продолжай, но один пропуск серию не определяет.` })
  }

  // Вредные привычки
  for (const h of active.filter((x) => x.kind === 'quit')) {
    const s = habitStreak(h, logs, today)
    if (s >= 1) {
      out.push({ tone: 'good', title: `${s} дн. без «${h.title}»`, text: 'Каждый такой день — отдельная победа. Если случится срыв, ничего страшного: смотри на общую динамику, а не на один день.' })
    }
  }

  // Давно не было отметок
  const recent = logs.some((l) => l.done && l.log_date >= addDays(today, -2))
  if (!recent && hasHistory) {
    out.push({ tone: 'warn', title: 'Вернуться можно в любой момент', text: 'Несколько дней без отметок — это нормально. Выбери одну самую маленькую привычку и сделай её сегодня: этого достаточно, чтобы продолжить.' })
  }

  if (profile.daily_minutes <= 10 && active.length >= 4) {
    out.push({ tone: 'tip', title: 'Мало времени, много привычек', text: 'Ты выбрал(а) короткие ежедневные задачи, но привычек несколько. Можно оставить по одной в 2–3 сферах.' })
  }

  return out.slice(0, 6)
}
