import { useState } from 'react'
import { useData } from '../lib/data'
import { addDays, fmtLong, hm, nowHM, ymd } from '../lib/dates'
import { dayStats, doneIdsOn, habitStreak, isDue } from '../lib/logic'
import { useNow } from '../lib/useNow'
import { IcCheck, IcEdit, IcLeft, IcPlus, IcRight, ProgressRing } from '../components/ui'
import type { Habit } from '../lib/types'

export default function Today({ onAdd, onEdit }: { onAdd: () => void; onEdit: (h: Habit) => void }) {
  const { profile, habits, logs, toggleLog } = useData()
  const now = useNow()
  const today = ymd(now)
  const [offset, setOffset] = useState(0)
  const date = addDays(today, offset)
  const isToday = offset === 0

  const due = habits.filter((h) => isDue(h, date))
  const done = doneIdsOn(logs, date)
  const st = dayStats(habits, logs, date)
  const pct = st.due ? Math.round((st.done / st.due) * 100) : 0
  const yest = dayStats(habits, logs, addDays(today, -1))

  const hour = now.getHours()
  const greet = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер'
  const nowT = nowHM(now)

  let calm: string | null = null
  if (isToday && st.due > 0 && st.done === 0 && yest.due > 0 && yest.done === 0) {
    calm = 'Вчера не получилось, и это нормально. Начни с одного маленького действия, остальное подтянется.'
  } else if (isToday && st.due > 0 && st.done === st.due) {
    calm = 'Все дела на сегодня отмечены. Отличная работа.'
  }

  function sub(h: Habit) {
    const parts: string[] = []
    if (h.kind === 'quit') parts.push('день без этого')
    if (h.target) parts.push(`${h.target}${h.unit ? ' ' + h.unit : ''}`)
    if (h.frequency === 'times_per_week') parts.push(`${h.times_per_week} раз в неделю`)
    const s = habitStreak(h, logs, today)
    if (s >= 2) parts.push(`серия ${s} дн.`)
    return parts.join(' · ')
  }

  return (
    <div className="screen">
      <header className="head">
        <p className="muted">{greet}{profile.display_name ? `, ${profile.display_name}` : ''}</p>
        <h1 className="cap">{fmtLong(date)}</h1>
        <div className="datenav">
          <button className="iconbtn" onClick={() => setOffset(offset - 1)} disabled={offset <= -30} aria-label="Предыдущий день"><IcLeft /></button>
          <button className="btn ghost small" onClick={() => setOffset(0)} disabled={isToday}>Сегодня</button>
          <button className="iconbtn" onClick={() => setOffset(offset + 1)} disabled={isToday} aria-label="Следующий день"><IcRight /></button>
        </div>
        {!isToday && <p className="fine">Ты редактируешь прошлый день. Можно поставить или снять отметку.</p>}
      </header>

      <section className="card day-card">
        <ProgressRing pct={pct} label={`Выполнено ${pct}%`} />
        <div>
          <b className="big">{st.done} из {st.due}</b>
          <p className="muted">{st.due === 0 ? 'На этот день ничего не запланировано' : 'выполнено за день'}</p>
        </div>
      </section>

      {calm && <p className="notice">{calm}</p>}

      {habits.filter((h) => h.status === 'active').length === 0 ? (
        <div className="empty card">
          <p>Пока нет привычек.</p>
          <button className="btn" onClick={onAdd}>Добавить первую</button>
        </div>
      ) : (
        <ul className="list">
          {due.map((h) => {
            const isDone = done.has(h.id)
            const rt = hm(h.reminder_time)
            let chip: { t: string; c: string } | null = null
            if (!isDone && rt && isToday) chip = nowT >= rt ? { t: 'ждёт', c: 'warn' } : { t: `в ${rt}`, c: '' }
            else if (rt && !isToday) chip = { t: rt, c: '' }
            return (
              <li key={h.id} className={'hcard' + (isDone ? ' done' : '')}>
                <button className="hmain" onClick={() => void toggleLog(h, date)} aria-pressed={isDone}>
                  <span className={'check' + (isDone ? ' on' : '')}>{isDone && <IcCheck size={20} />}</span>
                  <span className="hbody">
                    <b>{h.title}</b>
                    {sub(h) && <small>{sub(h)}</small>}
                  </span>
                  {chip && <span className={'chip-s ' + chip.c}>{chip.t}</span>}
                </button>
                <button className="iconbtn" onClick={() => onEdit(h)} aria-label={`Изменить «${h.title}»`}><IcEdit /></button>
              </li>
            )
          })}
          {due.length === 0 && <li className="muted center">В этот день нет запланированных привычек.</li>}
        </ul>
      )}

      <button className="fab" onClick={onAdd} aria-label="Добавить привычку"><IcPlus /></button>
    </div>
  )
}
