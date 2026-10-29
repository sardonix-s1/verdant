import { useState } from 'react'
import { useData } from '../lib/data'
import { WD } from '../lib/dates'
import { ChipSelect, IcEdit, IcPlus } from '../components/ui'
import type { Habit } from '../lib/types'

type Filter = 'all' | 'good' | 'quit' | 'other' | 'archived'
const FILTERS: { v: Filter; l: string }[] = [
  { v: 'all', l: 'Все' },
  { v: 'good', l: 'Полезные' },
  { v: 'quit', l: 'Сократить' },
  { v: 'other', l: 'Задачи и цели' },
  { v: 'archived', l: 'Архив' },
]

function freqText(h: Habit) {
  if (h.frequency === 'daily') return 'каждый день'
  if (h.frequency === 'times_per_week') return `${h.times_per_week} раз в неделю`
  return h.weekdays.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WD[d]).join(', ')
}

export default function Habits({ onAdd, onEdit }: { onAdd: () => void; onEdit: (h: Habit) => void }) {
  const { habits } = useData()
  const [f, setF] = useState<Filter>('all')

  const list = habits.filter((h) => {
    if (f === 'archived') return h.status === 'archived'
    if (h.status !== 'active') return false
    if (f === 'good') return h.kind === 'good'
    if (f === 'quit') return h.kind === 'quit'
    if (f === 'other') return h.kind === 'task' || h.kind === 'goal'
    return true
  })

  const kindLabel = (h: Habit) => ({ good: 'Полезная', quit: 'Сократить', task: 'Задача', goal: 'Цель' })[h.kind]

  return (
    <div className="screen">
      <header className="head"><h1>Привычки</h1></header>
      <ChipSelect options={FILTERS} value={f} onChange={setF} />
      {list.length === 0 ? (
        <div className="empty card"><p>Здесь пока пусто.</p>{f !== 'archived' && <button className="btn" onClick={onAdd}>Добавить привычку</button>}</div>
      ) : (
        <ul className="list">
          {list.map((h) => (
            <li key={h.id} className="card hrow">
              <div className="hbody">
                <b>{h.title}</b>
                <small>{kindLabel(h)} · {freqText(h)}{h.reminder_time ? ` · ${h.reminder_time.slice(0, 5)}` : ''}</small>
                {h.reason && <small className="muted">Зачем: {h.reason}</small>}
              </div>
              <button className="iconbtn" onClick={() => onEdit(h)} aria-label={`Изменить «${h.title}»`}><IcEdit /></button>
            </li>
          ))}
        </ul>
      )}
      <button className="fab" onClick={onAdd} aria-label="Новая привычка"><IcPlus /></button>
    </div>
  )
}
