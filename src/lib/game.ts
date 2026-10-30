import { addDays, dow, parse } from './dates'
import { habitStreak, overallStreak } from './logic'
import type { Habit, LedgerRow, Log } from './types'

/* ---------- Уровни ---------- */
export const LEVEL_TITLES = [
  'Росток', 'Ученик', 'Практик', 'Упорный', 'Стабильный', 'Мастер ритма',
  'Хранитель', 'Наставник', 'Стратег', 'Легенда',
]

/** Нужно XP, чтобы достичь уровня n (n >= 1). */
export const xpFor = (level: number) => 50 * (level - 1) * (level - 1) + (level > 1 ? 30 * (level - 1) : 0)

export function levelOf(xp: number) {
  let lvl = 1
  while (xpFor(lvl + 1) <= xp) lvl++
  const from = xpFor(lvl)
  const to = xpFor(lvl + 1)
  return {
    level: lvl,
    title: LEVEL_TITLES[Math.min(lvl - 1, LEVEL_TITLES.length - 1)],
    into: xp - from,
    span: to - from,
    pct: Math.round(((xp - from) / (to - from)) * 100),
  }
}

export function totals(ledger: LedgerRow[]) {
  let xp = 0
  let coins = 0
  for (const r of ledger) {
    xp += r.xp
    coins += r.coins
  }
  return { xp: Math.max(0, xp), coins: Math.max(0, coins) }
}

/** XP за отметку: базовые 10 + бонус за серию (до +10). */
export const completionReward = (h: Habit, streak: number) => {
  const bonus = Math.min(streak, 5) * 2
  return { xp: (h.kind === 'quit' ? 12 : 10) + bonus, coins: h.kind === 'quit' ? 6 : 5 }
}
export const PERFECT_DAY = { xp: 20, coins: 10 }
export const MISS_COINS = 5

/* ---------- Сундук дня ---------- */
export interface ChestResult {
  xp: number
  coins: number
  rare: boolean
  note: string
}
export function rollChest(): ChestResult {
  const r = Math.random()
  if (r < 0.1) return { xp: 25, coins: 60, rare: true, note: 'Редкая находка' }
  if (r < 0.4) return { xp: 12, coins: 30, rare: false, note: 'Хорошая добыча' }
  return { xp: 6, coins: 15, rare: false, note: 'Небольшой бонус' }
}

/* ---------- Недельный щит ---------- */
export const weekStart = (d: string) => addDays(d, -((dow(d) + 6) % 7))

export function shieldUsedInWeek(ledger: LedgerRow[], date: string) {
  const ws = weekStart(date)
  const we = addDays(ws, 6)
  return ledger.some((r) => {
    if (!r.ref.startsWith('shield:')) return false
    const d = r.ref.split(':')[1]
    return d >= ws && d <= we
  })
}

/* ---------- Санкции (мягкие, без стыда) ---------- */
export const FORFEITS = [
  '10 приседаний',
  'Убрать один ящик или полку',
  'Написать близкому «спасибо»',
  'Выпить стакан воды и пройтись 3 минуты',
  'Сделать отжимания, сколько получится',
  '5 минут без телефона',
  'Подготовить вещи на завтра',
  'Проветрить комнату и размяться',
  'Записать одну мысль, что поможет завтра',
]
export function pickForfeit(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return FORFEITS[h % FORFEITS.length]
}

/* ---------- Подарки ---------- */
export const REWARD_PRESETS: { title: string; emoji: string; cost: number }[] = [
  { title: 'Любимый кофе или чай', emoji: '☕', cost: 30 },
  { title: 'Серия любимого сериала', emoji: '🎬', cost: 60 },
  { title: 'Час хобби без чувства вины', emoji: '🎧', cost: 80 },
  { title: 'Свободный вечер', emoji: '🌙', cost: 120 },
  { title: 'Заказать любимую еду', emoji: '🍜', cost: 150 },
  { title: 'Небольшая покупка себе', emoji: '🎁', cost: 300 },
]

/* ---------- Значки ---------- */
export interface Badge {
  id: string
  emoji: string
  title: string
  hint: string
  got: boolean
}

export function badges(habits: Habit[], logs: Log[], ledger: LedgerRow[], today: string): Badge[] {
  const done = logs.filter((l) => l.done)
  const streak = overallStreak(habits, logs, today)
  const best = Math.max(0, ...habits.map((h) => habitStreak(h, logs, today)))
  const days = new Set(done.map((l) => l.log_date)).size
  const perfect = ledger.filter((r) => r.ref.startsWith('day:')).length
  const chests = ledger.filter((r) => r.ref.startsWith('chest:')).length
  const spent = ledger.filter((r) => r.ref.startsWith('reward:')).length
  const redeemed = ledger.filter((r) => r.ref.startsWith('pen:')).length
  const quitDays = habits.filter((h) => h.kind === 'quit').reduce((m, h) => Math.max(m, habitStreak(h, logs, today)), 0)
  const { xp } = totals(ledger)
  const b = (id: string, emoji: string, title: string, hint: string, got: boolean): Badge => ({ id, emoji, title, hint, got })
  return [
    b('first', '🌱', 'Первый шаг', 'Отметь первое дело', done.length >= 1),
    b('s3', '🔥', '3 дня подряд', 'Серия из 3 дней', Math.max(streak, best) >= 3),
    b('s7', '⚡', 'Неделя', 'Серия из 7 дней', Math.max(streak, best) >= 7),
    b('s14', '🌊', 'Две недели', 'Серия из 14 дней', Math.max(streak, best) >= 14),
    b('s30', '🏔️', 'Месяц', 'Серия из 30 дней', Math.max(streak, best) >= 30),
    b('perfect', '✨', 'Идеальный день', 'Закрой все дела за день', perfect >= 1),
    b('perfect5', '💎', 'Пять идеальных', 'Пять идеальных дней', perfect >= 5),
    b('days20', '📅', '20 активных дней', 'Отмечай дела в 20 разных днях', days >= 20),
    b('quit5', '🧘', 'Пять дней без', 'Пять дней без вредной привычки', quitDays >= 5),
    b('chest', '🎰', 'Охотник за сундуками', 'Открой 5 сундуков', chests >= 5),
    b('gift', '🎁', 'Заслужил(а) подарок', 'Получи первую награду', spent >= 1),
    b('redeem', '🔄', 'Исправил(а) курс', 'Выполни «долг»', redeemed >= 1),
    b('xp500', '🚀', '500 XP', 'Набери 500 XP', xp >= 500),
  ]
}

export const parseDay = parse
