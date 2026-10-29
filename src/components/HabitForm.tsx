import { useState, type FormEvent } from 'react'
import { useData } from '../lib/data'
import { WD, WD_ORDER, hm, ymd } from '../lib/dates'
import type { Freq, Habit, Kind } from '../lib/types'
import { ChipMulti, ChipSelect, Field, Group, Sheet } from './ui'

const KINDS: { v: Kind; l: string }[] = [
  { v: 'good', l: 'Полезная привычка' },
  { v: 'quit', l: 'Сократить / отказаться' },
  { v: 'task', l: 'Разовая задача' },
  { v: 'goal', l: 'Цель' },
]
const FREQS: { v: Freq; l: string }[] = [
  { v: 'daily', l: 'Каждый день' },
  { v: 'weekdays', l: 'По дням недели' },
  { v: 'times_per_week', l: 'N раз в неделю' },
]

export default function HabitForm({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const { saveHabit, deleteHabit } = useData()
  const [title, setTitle] = useState(habit?.title ?? '')
  const [description, setDescription] = useState(habit?.description ?? '')
  const [kind, setKind] = useState<Kind>(habit?.kind ?? 'good')
  const [frequency, setFrequency] = useState<Freq>(habit?.frequency ?? 'daily')
  const [weekdays, setWeekdays] = useState<number[]>(habit?.weekdays ?? [1, 2, 3, 4, 5])
  const [tpw, setTpw] = useState(String(habit?.times_per_week ?? 3))
  const [target, setTarget] = useState(habit?.target != null ? String(habit.target) : '')
  const [unit, setUnit] = useState(habit?.unit ?? '')
  const [reminder, setReminder] = useState(hm(habit?.reminder_time))
  const [start, setStart] = useState(habit?.start_date ?? ymd())
  const [reason, setReason] = useState(habit?.reason ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return setErr('Введите название')
    if (frequency === 'weekdays' && weekdays.length === 0) return setErr('Выберите хотя бы один день недели')
    const n = Number(tpw)
    if (frequency === 'times_per_week' && !(n >= 1 && n <= 7)) return setErr('Число раз в неделю: от 1 до 7')
    setErr(null)
    setBusy(true)
    const saved = await saveHabit(
      {
        title: t,
        description: description.trim() || null,
        kind,
        frequency,
        weekdays: frequency === 'weekdays' ? weekdays : [0, 1, 2, 3, 4, 5, 6],
        times_per_week: frequency === 'times_per_week' ? n : null,
        target: target.trim() ? Number(target) : null,
        unit: unit.trim() || null,
        reminder_time: reminder || null,
        start_date: start || ymd(),
        reason: reason.trim() || null,
      },
      habit?.id,
    )
    setBusy(false)
    if (saved) onClose()
  }

  async function toggleArchive() {
    if (!habit) return
    setBusy(true)
    const ok = await saveHabit({ title: habit.title, status: habit.status === 'active' ? 'archived' : 'active' }, habit.id)
    setBusy(false)
    if (ok) onClose()
  }

  async function remove() {
    if (!habit) return
    if (!window.confirm(`Удалить «${habit.title}» вместе с историей отметок? Это нельзя отменить.`)) return
    setBusy(true)
    await deleteHabit(habit.id)
    setBusy(false)
    onClose()
  }

  return (
    <Sheet title={habit ? 'Изменить привычку' : 'Новая привычка'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Field label="Название">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Например: прогулка 10 минут" autoFocus={!habit} />
        </Field>
        <Group label="Тип">
          <ChipSelect options={KINDS} value={kind} onChange={setKind} />
        </Group>
        <Group label="Как часто">
          <ChipSelect options={FREQS} value={frequency} onChange={setFrequency} />
        </Group>
        {frequency === 'weekdays' && (
          <Group label="Дни недели">
            <ChipMulti options={WD_ORDER.map((d) => ({ v: d, l: WD[d] }))} value={weekdays} onChange={setWeekdays} />
          </Group>
        )}
        {frequency === 'times_per_week' && (
          <Field label="Сколько раз в неделю">
            <input type="number" inputMode="numeric" min={1} max={7} value={tpw} onChange={(e) => setTpw(e.target.value)} />
          </Field>
        )}
        <div className="row2">
          <Field label="Цель (необязательно)">
            <input type="number" inputMode="decimal" min={0} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="10" />
          </Field>
          <Field label="Единица">
            <input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} placeholder="мин, стр., раз" />
          </Field>
        </div>
        <div className="row2">
          <Field label="Напоминание" hint="необязательно">
            <input type="time" value={reminder} onChange={(e) => setReminder(e.target.value)} />
          </Field>
          <Field label="Дата начала">
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
        </div>
        <Field label="Описание" hint="необязательно">
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
        </Field>
        <Field label="Зачем мне это" hint="личная причина, видна только тебе">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} />
        </Field>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn" disabled={busy}>{habit ? 'Сохранить' : 'Добавить'}</button>
        {habit && (
          <div className="row2">
            <button type="button" className="btn ghost" onClick={toggleArchive} disabled={busy}>
              {habit.status === 'active' ? 'В архив' : 'Вернуть из архива'}
            </button>
            <button type="button" className="btn danger" onClick={remove} disabled={busy}>Удалить</button>
          </div>
        )}
      </form>
    </Sheet>
  )
}
