// Локальный «коуч»: статистическая модель + разговорные шаблоны. Никаких внешних API и токенов.
import { addDays, dow, hm } from './dates'
import { AREAS } from './plan'
import { dayStats, doneIdsOn, habitStreak, isDue, overallStreak, rangeRate } from './logic'
import type { Habit, Log, Profile } from './types'

export interface Ctx {
  profile: Profile
  habits: Habit[]
  logs: Log[]
  today: string
  now: Date
}

/* ---------- Мелочи ---------- */
const g = (p: Profile, m: string, f: string) => (p.gender === 'female' ? f : m)
const name = (p: Profile) => p.display_name || ''
const DAYS_ACC = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу']
const DAYS_NOM = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']

function seeded(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h += 0x6d2b79f5
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T,>(arr: T[], rnd: () => number) => arr[Math.floor(rnd() * arr.length)]

/* ---------- Модель: вероятность выполнить сегодня ---------- */
/** Сглаженная доля выполнения в тот же день недели (8 недель) и за последние 14 дней. */
export function doneProbability(h: Habit, logs: Log[], today: string): number {
  const set = new Set(logs.filter((l) => l.habit_id === h.id && l.done).map((l) => l.log_date))
  let n1 = 0
  let d1 = 0
  for (let w = 1; w <= 8; w++) {
    const d = addDays(today, -7 * w)
    if (d < h.start_date) break
    n1++
    if (set.has(d)) d1++
  }
  let n2 = 0
  let d2 = 0
  for (let i = 1; i <= 14; i++) {
    const d = addDays(today, -i)
    if (d < h.start_date || !isDue(h, d)) continue
    n2++
    if (set.has(d)) d2++
  }
  const p1 = (d1 + 1) / (n1 + 2)
  const p2 = (d2 + 1) / (n2 + 2)
  const wDay = n1 >= 3 ? 0.5 : 0.25
  return wDay * p1 + (1 - wDay) * p2
}

/** Лучший и худший день недели по всем привычкам (нужно минимум ~14 наблюдений). */
export function weekdayProfile(habits: Habit[], logs: Log[], today: string) {
  const due = Array(7).fill(0) as number[]
  const done = Array(7).fill(0) as number[]
  const ids = new Map(habits.map((h) => [h.id, h]))
  const doneSet = new Set(logs.filter((l) => l.done).map((l) => l.habit_id + l.log_date))
  for (let i = 1; i <= 56; i++) {
    const d = addDays(today, -i)
    for (const h of ids.values()) {
      if (h.status !== 'active' || !isDue(h, d)) continue
      due[dow(d)]++
      if (doneSet.has(h.id + d)) done[dow(d)]++
    }
  }
  const rates = due.map((n, i) => ({ i, n, r: n >= 4 ? done[i] / n : null }))
  const valid = rates.filter((x) => x.r !== null) as { i: number; n: number; r: number }[]
  if (valid.length < 4 || valid.reduce((s, x) => s + x.n, 0) < 14) return null
  valid.sort((a, b) => b.r - a.r)
  const best = valid[0]
  const worst = valid[valid.length - 1]
  return best.r - worst.r >= 0.15 ? { best: best.i, worst: worst.i, bestR: best.r, worstR: worst.r } : null
}

/** Час, в который чаще всего ставятся отметки (по created_at), если данных хватает. */
export function usualHour(logs: Log[]): number | null {
  const hrs = logs.filter((l) => l.done && l.created_at).map((l) => new Date(l.created_at as string).getHours())
  if (hrs.length < 12) return null
  const c = Array(24).fill(0) as number[]
  hrs.forEach((h) => c[h]++)
  const max = Math.max(...c)
  return c.indexOf(max)
}

/** Упрощённая версия привычки на «плохой день». */
export function microVersion(title: string): string {
  const t = title.trim()
  if (/\d+\s*(минут|мин)/i.test(t)) return t.replace(/\d+\s*(минут\w*|мин\w*)/i, '2 минуты')
  if (/\d+\s*стр/i.test(t)) return t.replace(/\d+\s*стр\w*/i, '1 страницу')
  if (/\d+\s*слов/i.test(t)) return t.replace(/\d+\s*слов\w*/i, '3 слова')
  if (/\d+/.test(t)) return t.replace(/\d+/, '1')
  return `Только начать: первые 2 минуты — «${t}»`
}

/* ---------- Подсказки новых привычек ---------- */
export interface Suggestion {
  title: string
  why: string
  time: string | null
}
export function suggestHabits(ctx: Ctx, count = 3): Suggestion[] {
  const { profile, habits } = ctx
  const have = new Set(habits.map((h) => h.title.toLowerCase()))
  const areas = profile.focus_areas.length ? AREAS.filter((a) => profile.focus_areas.includes(a.id)) : AREAS
  const t = profile.chronotype === 'morning' ? '07:30' : profile.chronotype === 'evening' ? '20:30' : profile.chronotype === 'day' ? '13:00' : null
  const hard = profile.obstacles.includes('time') || profile.daily_minutes <= 10
  const out: (Suggestion & { score: number })[] = []
  areas.forEach((a, ai) => {
    a.actions.forEach((act) => {
      if (have.has(act.title.toLowerCase())) return
      if (act.minutes > profile.daily_minutes) return
      let score = 10 - ai
      score += hard ? 5 - act.minutes / 4 : 0
      if (profile.obstacles.includes('lazy') && act.minutes <= 5) score += 3
      out.push({ title: act.title, why: act.why, time: t, score })
    })
  })
  return out.sort((a, b) => b.score - a.score).slice(0, count).map(({ score: _s, ...x }) => x)
}

/* ---------- Ежедневный разбор ---------- */
export interface Brief {
  headline: string
  body: string
  tone: 'good' | 'tip' | 'warn'
  focusId?: string
  microFor?: string
}

const MILESTONES = [3, 7, 14, 21, 30, 60, 100]

export function brief(ctx: Ctx): Brief {
  const { profile, habits, logs, today, now } = ctx
  const rnd = seeded(today + (profile.user_id || ''))
  const active = habits.filter((h) => h.status === 'active')
  const hour = now.getHours()
  const n = name(profile)
  const call = n ? `, ${n}` : ''

  if (active.length === 0) {
    return { tone: 'tip', headline: 'Начнём с одной', body: `Добавь одну маленькую привычку${call}. Если она займёт две минуты, ты её не бросишь.` }
  }

  const st = dayStats(habits, logs, today)
  const doneIds = doneIdsOn(logs, today)
  const left = active.filter((h) => isDue(h, today) && !doneIds.has(h.id))
  const streak = overallStreak(habits, logs, today)
  const hadRecent = logs.some((l) => l.done && l.log_date >= addDays(today, -2))
  const anyHistory = logs.length > 0

  if (st.due > 0 && st.done === st.due) {
    return {
      tone: 'good',
      headline: pick(['День закрыт', 'Всё сделано', 'Чисто'], rnd),
      body: pick([
        `Все дела на сегодня отмечены${call}. Загляни в сундук, он ждёт.`,
        `Сегодня ты ${g(profile, 'справился', 'справилась')} со всем. Остаток вечера свободен, это тоже часть системы.`,
        `Идеальный день. Запомни это ощущение, оно помогает завтра.`,
      ], rnd),
    }
  }

  if (anyHistory && !hadRecent && left.length) {
    const easiest = [...left].sort((a, b) => doneProbability(b, logs, today) - doneProbability(a, logs, today))[0]
    return {
      tone: 'warn',
      headline: 'С возвращением',
      body: pick([
        `Небольшая пауза не ломает путь${call}. Вернись через самое лёгкое: «${easiest.title}».`,
        `Пауза — это нормально. Начни с одного шага: «${easiest.title}», остальное подтянется.`,
      ], rnd),
      focusId: easiest.id,
      microFor: easiest.id,
    }
  }

  // Ближайший рубеж серии
  const next = MILESTONES.find((m) => m > streak)
  if (next && next - streak === 1 && streak > 0 && st.done === 0) {
    return {
      tone: 'tip',
      headline: `Завтра ${next} дней подряд`,
      body: `Серия сейчас ${streak}. Одна отметка сегодня, и рубеж будет взят.`,
    }
  }

  // Самая рискованная привычка сегодня
  if (left.length) {
    const scored = left
      .filter((h) => h.start_date <= addDays(today, -3))
      .map((h) => ({ h, p: doneProbability(h, logs, today) }))
      .sort((a, b) => a.p - b.p)
    const risky = scored[0]
    if (risky && risky.p < 0.5) {
      const wd = DAYS_ACC[dow(today)]
      const hardTail = rangeRate([risky.h], logs, addDays(today, -13), today)
      const why = hardTail !== null && hardTail < 0.35
        ? `За две недели она получается нечасто. Попробуй уменьшить: «${microVersion(risky.h.title)}».`
        : `В ${wd} с ней сложнее обычного. Сделай её первой, пока день не набрал оборотов.`
      return { tone: 'tip', headline: `Сегодня следи за «${risky.h.title}»`, body: why, focusId: risky.h.id, microFor: risky.h.id }
    }
  }

  const wp = weekdayProfile(habits, logs, today)
  if (wp && wp.worst === dow(today) && left.length) {
    return {
      tone: 'tip',
      headline: `${DAYS_NOM[wp.worst][0].toUpperCase()}${DAYS_NOM[wp.worst].slice(1)} — твой сложный день`,
      body: `По истории в этот день выполняется меньше всего. Выбери одно дело и закрой его заранее.`,
    }
  }

  if (hour >= 20 && left.length) {
    const easiest = [...left].sort((a, b) => doneProbability(b, logs, today) - doneProbability(a, logs, today))[0]
    return {
      tone: 'tip',
      headline: 'Вечер ещё твой',
      body: `Осталось ${left.length}. Самое лёгкое: «${easiest.title}». Вечера хватит.`,
      focusId: easiest.id,
    }
  }

  const ch = profile.chronotype
  const timeOk = (ch === 'morning' && hour < 12) || (ch === 'evening' && hour >= 17) || (ch === 'day' && hour >= 11 && hour < 17)
  if (timeOk && left.length) {
    return { tone: 'good', headline: 'Твоё время', body: `Сейчас по ритму самое продуктивное время. Начни с «${left[0].title}».`, focusId: left[0].id }
  }

  return {
    tone: 'good',
    headline: streak >= 2 ? `Серия ${streak} дн.` : 'Спокойный темп',
    body: pick([
      `Осталось ${left.length}. Делай по одному, не думая о всём списке сразу.`,
      `Один шаг сейчас дороже плана на неделю. Начни с «${left[0]?.title ?? 'любого дела'}».`,
      `Регулярность важнее идеальности. Достаточно отметить хотя бы одно.`,
    ], rnd),
    focusId: left[0]?.id,
  }
}

/* ---------- Чат ---------- */
export interface ChatAction {
  label: string
  kind: 'add'
  title: string
  reason?: string
  time?: string | null
}
export interface Reply {
  text: string
  actions?: ChatAction[]
}

const has = (t: string, words: string[]) => words.some((w) => t.includes(w))

const MOTIV: Record<string, string> = {
  growth: 'Ты идёшь к росту. Каждая отметка — маленький вклад в того, кем хочешь стать.',
  proof: 'Ты делаешь это, чтобы доказать себе, что можешь. Каждый день — ещё одно доказательство.',
  calm: 'Тебе важно спокойствие. Привычки делают день предсказуемее, а голову тише.',
  reward: 'Монеты и награды копятся с каждым делом. Подумай, на что потратишь следующие.',
  people: 'Ты делаешь это и ради близких. Они заметят изменения раньше, чем ты думаешь.',
}

export function reply(textRaw: string, ctx: Ctx): Reply {
  const t = textRaw.toLowerCase().trim()
  const { profile, habits, logs, today } = ctx
  const rnd = seeded(today + t)
  const active = habits.filter((h) => h.status === 'active')
  const st = dayStats(habits, logs, today)
  const left = active.filter((h) => isDue(h, today) && !doneIdsOn(logs, today).has(h.id))
  const streak = overallStreak(habits, logs, today)

  if (has(t, ['не хочу жить', 'суицид', 'покончить с собой', 'убить себя', 'навредить себе'])) {
    return {
      text: 'Мне важно, как ты сейчас. Пожалуйста, не оставайся с этим один на один: позвони близкому человеку или в экстренную службу (112). Это важнее любых привычек. Я рядом, но живой человек сейчас нужнее.',
    }
  }

  if (!t) return { text: 'Напиши, что на душе: «лень», «что делать сегодня», «как мои дела» или «предложи привычку».' }

  if (has(t, ['привет', 'здравствуй', 'добрый', 'хай', 'салам']))
    return { text: `Привет${name(profile) ? ', ' + name(profile) : ''}! Сегодня выполнено ${st.done} из ${st.due}. Чем помочь: план на день, подбор привычки или поддержка?` }

  if (has(t, ['спасибо', 'благодар']))
    return { text: pick(['Всегда рад. Ты делаешь основную работу.', 'Пожалуйста. Продолжай в своём темпе.'], rnd) }

  if (has(t, ['суицид']) === false && has(t, ['тревог', 'паник', 'страшно', 'депресс', 'плохо на душе', 'грустно'])) {
    return {
      text: 'Звучит непросто. Сегодня можно снизить планку: одно дело вместо всех. Попробуй медленно подышать минуту (вдох на 4, выдох на 6). Если тяжесть держится долго, поговори с близким человеком или специалистом. Я не заменяю врача.',
    }
  }

  if (has(t, ['устал', 'нет сил', 'выгор', 'вымот', 'лень', 'не хочется', 'не могу', 'не получается', 'прокраст'])) {
    const pickH = [...left].sort((a, b) => doneProbability(b, logs, today) - doneProbability(a, logs, today))[0]
    if (!pickH) return { text: 'Сегодня ты уже сделал(а) своё. Отдых тоже часть процесса.' }
    return {
      text: `${pick(['Понимаю.', 'Бывает.', 'Это нормально.'], rnd)} Не нужно делать всё. Возьми только «${microVersion(pickH.title)}». Две минуты, и можно остановиться. Обычно после старта становится легче.`,
    }
  }

  if (has(t, ['сорвал', 'пропустил', 'не сделал', 'провал', 'облажал', 'сорвалс', 'сорвала'])) {
    return {
      text: `${g(profile, 'Ты не сорвался', 'Ты не сорвалась')} навсегда, это один день. Данные показывают динамику, а не вину. Вернись завтра с самым лёгким шагом. Правило простое: не пропускай дважды подряд.`,
    }
  }

  if (has(t, ['мотива', 'вдохнов', 'поддерж', 'зачем'])) {
    const base = MOTIV[profile.motivation ?? ''] ?? 'Прогресс складывается из маленьких дней, которые видны только спустя время.'
    const why = profile.why ? ` Твоё «зачем»: «${profile.why}».` : ''
    return { text: base + why }
  }

  if (has(t, ['что делать', 'план', 'с чего начать', 'сегодня'])) {
    if (active.length === 0) return { text: 'Пока нет привычек. Напиши «предложи привычку», и я подберу несколько.' }
    if (!left.length) return { text: 'На сегодня всё закрыто. Загляни в сундук во вкладке «Сегодня».' }
    const order = [...left].sort((a, b) => doneProbability(a, logs, today) - doneProbability(b, logs, today))
    return { text: `Порядок на сегодня: ${order.slice(0, 3).map((h, i) => `${i + 1}) ${h.title}`).join('; ')}. Сложное лучше делать первым, пока есть силы.` }
  }

  if (has(t, ['как дела', 'прогресс', 'статист', 'как я', 'итог'])) {
    const week = rangeRate(active, logs, addDays(today, -6), today)
    const w = week === null ? 'пока без данных' : `${Math.round(week * 100)}% за неделю`
    return { text: `Серия: ${streak} дн. Неделя: ${w}. Сегодня ${st.done} из ${st.due}. ${week !== null && week >= 0.7 ? 'Хороший темп.' : 'Есть куда расти, и это нормально.'}` }
  }

  if (has(t, ['предлож', 'идея', 'идеи', 'новую привычк', 'что добавить', 'подбери'])) {
    const sug = suggestHabits(ctx, 3)
    if (!sug.length) return { text: 'Твои привычки уже покрывают выбранные сферы. Лучше укрепить текущие, чем добавлять новые.' }
    return {
      text: 'Подобрал по твоим сферам и времени на день. Нажми, чтобы добавить:',
      actions: sug.map((s) => ({ label: s.title, kind: 'add', title: s.title, reason: s.why, time: s.time })),
    }
  }

  if (has(t, ['сон', 'спать', 'бессонн'])) return { text: 'Для сна работает простой якорь: экран выключается за 30 минут до сна, свет приглушён. Начни с одной такой привычки.' }
  if (has(t, ['награ', 'подар', 'монет'])) return { text: 'Монеты копятся за отметки и идеальные дни. Вкладка «Награды»: там можно создать свой подарок и получить его, когда накопишь.' }
  if (has(t, ['штраф', 'наказан', 'долг'])) return { text: 'Санкции мягкие. Одна ошибка в неделю прощается щитом, дальше режим решаешь ты: ничего, небольшой штраф монетами или маленькое задание-«долг». Режим меняется в «Профиле».' }

  return {
    text: pick([
      'Я помогаю с планом дня, подбором привычек и поддержкой. Попробуй: «что делать сегодня», «лень», «как мои дела» или «предложи привычку».',
      'Не до конца понял. Спроси про план дня, прогресс или напиши, что мешает сегодня.',
    ], rnd),
  }
}

/** Короткая реакция после отметки (для всплывающей подсказки). */
export function cheer(profile: Profile, done: number, due: number, habit: Habit, streak: number, seed: string): string {
  const rnd = seeded(seed)
  if (due > 0 && done === due) return pick(['Идеальный день!', 'Всё закрыто!', 'Чисто. Заходи в сундук!'], rnd)
  if (streak >= 7) return `Серия «${habit.title}»: ${streak}!`
  if (streak >= 3) return pick([`${streak} дня подряд`, 'Серия растёт', 'Так держать'], rnd)
  const first = done === 1
  return first
    ? pick(['Старт взят', 'Первый шаг есть', 'Начало положено'], rnd)
    : pick([`Ты ${g(profile, 'молодец', 'умница')}`, 'Ещё одно', 'Отлично'], rnd)
}

export const reminderHint = (h: Habit) => (h.reminder_time ? hm(h.reminder_time) : '')
