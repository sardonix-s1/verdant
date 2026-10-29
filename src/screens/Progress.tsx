import { useState, type FormEvent } from 'react'
import { useData } from '../lib/data'
import { addDays, dow, fmtLong, ymd } from '../lib/dates'
import { buildInsights, dayStats, habitStreak, overallStreak, rangeRate } from '../lib/logic'

const pct = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)}%`)

export default function Progress() {
  const { profile, habits, logs, notes, addNote, deleteNote } = useData()
  const [tab, setTab] = useState<'stats' | 'insights'>('stats')
  const [note, setNote] = useState('')
  const today = ymd()
  const active = habits.filter((h) => h.status === 'active')

  const week = rangeRate(active, logs, addDays(today, -6), today)
  const month = rangeRate(active, logs, addDays(today, -29), today)
  const streak = overallStreak(habits, logs, today)

  // Календарь: 5 недель, колонки Пн..Вс
  const lastMon = addDays(today, -((dow(today) + 6) % 7))
  const start = addDays(lastMon, -28)
  const cells = Array.from({ length: 35 }, (_, i) => {
    const d = addDays(start, i)
    if (d > today) return { d, lvl: -2 }
    const s = dayStats(active, logs, d)
    if (s.due === 0) return { d, lvl: -1 }
    const r = s.done / s.due
    return { d, lvl: r === 0 ? 0 : r < 0.5 ? 1 : r < 1 ? 2 : 3 }
  })

  const bars = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 6)
    const s = dayStats(active, logs, d)
    return { d, r: s.due ? s.done / s.due : 0, label: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][dow(d)] }
  })

  const insights = buildInsights(habits, logs, profile, today)

  async function saveNote(e: FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    await addNote(note.trim())
    setNote('')
  }

  return (
    <div className="screen">
      <header className="head"><h1>Прогресс</h1></header>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={tab === 'stats'} className={tab === 'stats' ? 'on' : ''} onClick={() => setTab('stats')}>Статистика</button>
        <button role="tab" aria-selected={tab === 'insights'} className={tab === 'insights' ? 'on' : ''} onClick={() => setTab('insights')}>Инсайты</button>
      </div>

      {tab === 'stats' ? (
        <>
          <div className="stats">
            <div className="card stat"><b>{pct(week)}</b><span>за неделю</span></div>
            <div className="card stat"><b>{pct(month)}</b><span>за месяц</span></div>
            <div className="card stat"><b>{streak}</b><span>дн. подряд</span></div>
          </div>

          <section className="card">
            <h2>Последние 7 дней</h2>
            <div className="bars" role="img" aria-label="Выполнение по дням за неделю">
              {bars.map((b) => (
                <div key={b.d} className="barcol" title={fmtLong(b.d)}>
                  <div className="barwrap"><i style={{ height: `${Math.max(4, b.r * 100)}%` }} className={b.r === 0 ? 'zero' : ''} /></div>
                  <span>{b.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>Календарь активности</h2>
            <div className="heads">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((x) => <span key={x}>{x}</span>)}</div>
            <div className="heat" role="img" aria-label="Календарь активности за 5 недель">
              {cells.map((c) => <i key={c.d} className={'l' + c.lvl} title={fmtLong(c.d)} />)}
            </div>
            <p className="fine">Чем ярче клетка, тем больше дел выполнено в этот день.</p>
          </section>

          <section className="card">
            <h2>По привычкам</h2>
            {active.length === 0 && <p className="muted">Нет активных привычек.</p>}
            <ul className="plain">
              {active.map((h) => {
                const s = habitStreak(h, logs, today)
                const r = rangeRate([h], logs, addDays(today, -13), today)
                return (
                  <li key={h.id} className="statrow">
                    <span>{h.title}</span>
                    <span className="muted">{h.kind === 'quit' ? `${s} дн. без` : `серия ${s}`} · {pct(r)}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      ) : (
        <>
          <ul className="list">
            {insights.map((i) => (
              <li key={i.title} className={'card insight ' + i.tone}>
                <b>{i.title}</b>
                <p>{i.text}</p>
              </li>
            ))}
          </ul>
          <p className="fine">Советы строятся по твоим ответам и истории отметок простыми правилами. Это подсказки, а не диагнозы или выводы о тебе.</p>

          <form className="card form" onSubmit={saveNote}>
            <h2>Заметка недели</h2>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Что получилось? Что сделать проще?" maxLength={1000} />
            <button className="btn" disabled={!note.trim()}>Сохранить заметку</button>
          </form>
          <ul className="list">
            {notes.slice(0, 5).map((n) => (
              <li key={n.id} className="card goal">
                <span><small className="muted">{fmtLong(n.note_date)}</small><br />{n.body}</span>
                <button className="iconbtn" aria-label="Удалить заметку" onClick={() => void deleteNote(n.id)}>✕</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
