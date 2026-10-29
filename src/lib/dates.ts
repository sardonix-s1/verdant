// Все даты — локальные для пользователя (формат YYYY-MM-DD), а не UTC.
export const pad = (n: number) => String(n).padStart(2, '0')

export const ymd = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDays = (s: string, n: number) => {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return ymd(d)
}

export const dow = (s: string) => parse(s).getDay()

export const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
export const WD_ORDER = [1, 2, 3, 4, 5, 6, 0]

export const fmtLong = (s: string) =>
  parse(s).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

export const nowHM = (d: Date = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** "07:00:00" -> "07:00" */
export const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '')

export const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
