import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useData } from '../lib/data'
import { addDays, dow, ymd } from '../lib/dates'
import { isDue } from '../lib/logic'
import { brief, doneProbability, microVersion, reply, usualHour, weekdayProfile, type ChatAction } from '../lib/coach'
import { toast } from '../lib/toast'
import { IcSend } from '../components/ui'

interface Msg {
  id: number
  me: boolean
  text: string
  actions?: ChatAction[]
}

const DAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
const QUICK = ['Что делать сегодня?', 'Лень', 'Как мои дела?', 'Предложи привычку', 'Мотивация']

export default function Coach() {
  const { profile, habits, logs, saveHabit } = useData()
  const today = ymd()
  const ctx = () => ({ profile, habits, logs, today, now: new Date() })
  const b = useMemo(() => brief(ctx()), [profile, habits, logs, today]) // eslint-disable-line react-hooks/exhaustive-deps
  const [msgs, setMsgs] = useState<Msg[]>(() => [{ id: 0, me: false, text: `${b.headline}. ${b.body}` }])
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const [added, setAdded] = useState<string[]>([])
  const end = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)

  useEffect(() => {
    if (msgs.length > 1) end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs, typing])

  function send(raw: string) {
    const t = raw.trim()
    if (!t || typing) return
    setMsgs((p) => [...p, { id: nextId.current++, me: true, text: t }])
    setText('')
    setTyping(true)
    const r = reply(t, ctx())
    window.setTimeout(() => {
      setMsgs((p) => [...p, { id: nextId.current++, me: false, text: r.text, actions: r.actions }])
      setTyping(false)
    }, 450 + Math.min(900, r.text.length * 6))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    send(text)
  }

  async function addHabit(a: ChatAction) {
    const ok = await saveHabit({ title: a.title, kind: 'good', reason: a.reason ?? null, reminder_time: a.time ?? null })
    if (ok) {
      setAdded((p) => [...p, a.title])
      toast(`Добавлено: «${a.title}»`, 'ok')
    }
  }

  // Наблюдения по истории (простая статистика, без выводов о личности)
  const active = habits.filter((h) => h.status === 'active')
  const notes: { t: string; d: string }[] = []
  const wp = weekdayProfile(habits, logs, today)
  if (wp) {
    notes.push({ t: `Лучший день: ${DAYS[wp.best]}`, d: `Выполняется около ${Math.round(wp.bestR * 100)}% дел. Хороший день для сложного.` })
    notes.push({ t: `Сложнее всего: ${DAYS[wp.worst]}`, d: `Около ${Math.round(wp.worstR * 100)}%. В этот день лучше ставить меньше задач.` })
  }
  const uh = usualHour(logs)
  if (uh !== null) notes.push({ t: `Обычно отмечаешь около ${uh}:00`, d: 'Поставь напоминание на этот час, и оно совпадёт с твоим ритмом.' })
  const risky = active
    .filter((h) => h.start_date <= addDays(today, -6))
    .map((h) => ({ h, p: doneProbability(h, logs, today) }))
    .filter((x) => x.p < 0.4)
    .sort((a, b2) => a.p - b2.p)
    .slice(0, 2)
  for (const { h, p } of risky) {
    notes.push({ t: `«${h.title}» буксует`, d: `Шанс выполнить по модели около ${Math.round(p * 100)}%. Попробуй мини-версию: ${microVersion(h.title)}.` })
  }
  const todayLeft = active.filter((h) => isDue(h, today)).length
  if (!notes.length) notes.push({ t: 'Пока мало данных', d: `Отмечай дела несколько дней, и я начну замечать закономерности (сегодня ${DAYS[dow(today)]}, дел: ${todayLeft}).` })

  return (
    <div className="screen coach-screen">
      <header className="head">
        <h1>Коуч</h1>
        <p className="muted">Считает на твоём устройстве, без внешних сервисов</p>
      </header>

      <section className="card glossy">
        <span className="eyebrow">Что я заметил</span>
        <ul className="plain obs">
          {notes.map((n) => (
            <li key={n.t}><b>{n.t}</b><p className="muted">{n.d}</p></li>
          ))}
        </ul>
      </section>

      <section className="chat" aria-live="polite">
        {msgs.map((m) => (
          <div key={m.id} className={'bubble ' + (m.me ? 'me' : 'bot')}>
            <p>{m.text}</p>
            {m.actions && (
              <div className="chips">
                {m.actions.map((a) => (
                  <button key={a.title} className={'chip' + (added.includes(a.title) ? ' on' : '')} disabled={added.includes(a.title)} onClick={() => void addHabit(a)}>
                    {added.includes(a.title) ? '✓ ' : '+ '}{a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {typing && <div className="bubble bot typing" aria-label="Коуч печатает"><i /><i /><i /></div>}
        <div ref={end} />
      </section>

      <div className="quick">
        {QUICK.map((q) => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}
      </div>
      <form className="chatbar" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Напиши коучу…" maxLength={300} aria-label="Сообщение коучу" />
        <button className="btn send" disabled={!text.trim() || typing} aria-label="Отправить"><IcSend /></button>
      </form>
    </div>
  )
}
