import { useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
import { useData } from '../lib/data'
import { addDays, fmtLong, hm, nowHM, ymd } from '../lib/dates'
import { dayStats, doneIdsOn, habitStreak, isDue, overallStreak } from '../lib/logic'
import { brief, cheer, microVersion } from '../lib/coach'
import { levelOf, type ChestResult } from '../lib/game'
import { burst, center, confetti, floatText, haptic } from '../lib/fx'
import { toast } from '../lib/toast'
import { useNow } from '../lib/useNow'
import { AnimatedNumber, IcCheck, IcCoin, IcEdit, IcFlame, IcLeft, IcPlus, IcRight, ProgressRing } from '../components/ui'
import type { Habit } from '../lib/types'

function ChestModal({ onClose, onOpen }: { onClose: () => void; onOpen: () => Promise<ChestResult | null> }) {
  const [phase, setPhase] = useState<'idle' | 'shake' | 'open'>('idle')
  const [res, setRes] = useState<ChestResult | null>(null)

  async function tap() {
    if (phase !== 'idle') return
    setPhase('shake')
    haptic([20, 40, 20])
    const [r] = await Promise.all([onOpen(), new Promise((ok) => window.setTimeout(ok, 800))])
    if (!r) return onClose()
    setRes(r)
    setPhase('open')
    haptic(40)
    confetti()
  }

  return (
    <div className="overlay center-ov" onMouseDown={(e) => e.target === e.currentTarget && phase !== 'shake' && onClose()}>
      <div className="chest-modal" role="dialog" aria-modal="true" aria-label="Сундук дня">
        <button type="button" className={'chest ' + phase} onClick={() => void tap()} aria-label="Открыть сундук">
          <span className="lid" />
          <span className="box" />
          <span className="lock" />
          <span className="shine" />
        </button>
        {phase === 'open' && res ? (
          <div className="chest-res">
            <p className="fine">{res.note}</p>
            <h2>+<AnimatedNumber value={res.coins} /> монет</h2>
            <p className="muted">+{res.xp} XP{res.rare ? ' · редкая находка ✨' : ''}</p>
            <button className="btn" onClick={onClose}>Забрать</button>
          </div>
        ) : (
          <div className="chest-res">
            <h2>Сундук дня</h2>
            <p className="muted">{phase === 'shake' ? 'Открываем…' : 'Нажми на сундук'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Today({ onAdd, onEdit }: { onAdd: () => void; onEdit: (h: Habit) => void }) {
  const { profile, habits, logs, ledger, penalties, xp, coins, toggleLog, openChest, completePenalty } = useData()
  const now = useNow()
  const today = ymd(now)
  const [offset, setOffset] = useState(0)
  const [chest, setChest] = useState(false)
  const [micro, setMicro] = useState(false)
  const date = addDays(today, offset)
  const isToday = offset === 0

  const due = habits.filter((h) => isDue(h, date))
  const done = doneIdsOn(logs, date)
  const st = dayStats(habits, logs, date)
  const pct = st.due ? Math.round((st.done / st.due) * 100) : 0
  const lvl = levelOf(xp)
  const streak = overallStreak(habits, logs, today)
  const chestOpened = ledger.some((r) => r.ref === `chest:${today}`)
  const doneToday = doneIdsOn(logs, today).size
  const open = penalties.filter((p) => !p.done)

  const b = useMemo(
    () => brief({ profile, habits, logs, today, now: new Date() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, habits, logs, today],
  )
  const microHabit = b.microFor ? habits.find((h) => h.id === b.microFor) : undefined

  const hour = now.getHours()
  const greet = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер'
  const nowT = nowHM(now)

  function sub(h: Habit) {
    const parts: string[] = []
    if (h.kind === 'quit') parts.push('день без этого')
    if (h.target) parts.push(`${h.target}${h.unit ? ' ' + h.unit : ''}`)
    if (h.frequency === 'times_per_week') parts.push(`${h.times_per_week} раз в неделю`)
    const s = habitStreak(h, logs, today)
    if (s >= 2) parts.push(`серия ${s} дн.`)
    return parts.join(' · ')
  }

  async function tap(h: Habit, e: MouseEvent<HTMLButtonElement>) {
    const c = center(e.currentTarget.querySelector('.check'))
    const r = await toggleLog(h, date)
    if (!r) return
    if (r.added) {
      haptic(r.perfect ? [15, 30, 15, 30, 40] : 14)
      burst(c.x, c.y)
      floatText(c.x, c.y - 10, `+${r.xp} XP`, 'xp')
      window.setTimeout(() => floatText(c.x + 28, c.y + 10, `+${r.coins}`, 'coin'), 160)
      if (r.perfect) {
        confetti()
        toast(cheer(profile, r.done, r.due, h, r.streak, h.id + date), 'ok')
      } else if (r.streak >= 3) toast(cheer(profile, r.done, r.due, h, r.streak, h.id + date), 'ok')
      if (r.levelUp) {
        confetti()
        toast(`Новый уровень: ${r.levelUp}`, 'ok')
      }
    } else haptic(8)
  }

  return (
    <div className="screen">
      <header className="head">
        <div className="hero-top">
          <div>
            <p className="muted">{greet}{profile.display_name ? `, ${profile.display_name}` : ''}</p>
            <h1 className="cap">{fmtLong(date)}</h1>
          </div>
        </div>
        <div className="stat-chips">
          <span className="schip lvl" title="Уровень"><b>{lvl.level}</b> {lvl.title}</span>
          <span className="schip coin"><IcCoin /><AnimatedNumber value={coins} /></span>
          <span className="schip fire"><IcFlame />{streak}</span>
        </div>
        <div className="xpbar" aria-label={`До следующего уровня ${lvl.span - lvl.into} XP`}><i style={{ width: `${lvl.pct}%` }} /></div>
        <div className="datenav">
          <button className="iconbtn" onClick={() => setOffset(offset - 1)} disabled={offset <= -30} aria-label="Предыдущий день"><IcLeft /></button>
          <button className="btn ghost small" onClick={() => setOffset(0)} disabled={isToday}>Сегодня</button>
          <button className="iconbtn" onClick={() => setOffset(offset + 1)} disabled={isToday} aria-label="Следующий день"><IcRight /></button>
        </div>
        {!isToday && <p className="fine">Прошлый день: отметка тоже даёт награду.</p>}
      </header>

      <section className="card day-card glossy" style={{ '--i': 0 } as CSSProperties}>
        <ProgressRing pct={pct} label={`Выполнено ${pct}%`} />
        <div>
          <b className="big"><AnimatedNumber value={st.done} /> из {st.due}</b>
          <p className="muted">{st.due === 0 ? 'На этот день ничего не запланировано' : 'выполнено за день'}</p>
        </div>
      </section>

      {isToday && (
        <section className={'card coach-card ' + b.tone} style={{ '--i': 1 } as CSSProperties}>
          <span className="eyebrow">Коуч</span>
          <b>{b.headline}</b>
          <p>{b.body}</p>
          {microHabit && !micro && <button className="link" onClick={() => setMicro(true)}>Сделать проще</button>}
          {microHabit && micro && <p className="fine">Мини-версия на сегодня: {microVersion(microHabit.title)}. Этого достаточно, чтобы день засчитался.</p>}
        </section>
      )}

      {isToday && st.due > 0 && !chestOpened && (
        <button className={'card chest-card' + (doneToday > 0 ? ' ready' : ' locked')} style={{ '--i': 2 } as CSSProperties} onClick={() => (doneToday > 0 ? setChest(true) : toast('Сундук откроется после первого дела за день', 'info'))}>
          <span className="chest-ico" aria-hidden="true" />
          <span className="hbody">
            <b>{doneToday > 0 ? 'Сундук дня готов' : 'Сундук дня'}</b>
            <small>{doneToday > 0 ? 'Нажми, чтобы открыть' : 'Откроется после первого дела'}</small>
          </span>
        </button>
      )}

      {isToday && open.length > 0 && (
        <section className="card debt" style={{ '--i': 3 } as CSSProperties}>
          <span className="eyebrow">Долги</span>
          <ul className="plain">
            {open.slice(0, 3).map((p) => {
              const h = habits.find((x) => x.id === p.habit_id)
              return (
                <li key={p.id} className="goal">
                  <span><b>{p.title}</b><br /><small className="muted">за «{h?.title ?? 'привычку'}», {fmtLong(p.for_date)}</small></span>
                  <button className="btn small" onClick={(e) => { const c = center(e.currentTarget); void completePenalty(p.id); burst(c.x, c.y); haptic(12) }}>Готово</button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {habits.filter((h) => h.status === 'active').length === 0 ? (
        <div className="empty card">
          <p>Пока нет привычек.</p>
          <button className="btn" onClick={onAdd}>Добавить первую</button>
        </div>
      ) : (
        <ul className="list">
          {due.map((h, idx) => {
            const isDone = done.has(h.id)
            const rt = hm(h.reminder_time)
            let chip: { t: string; c: string } | null = null
            if (!isDone && rt && isToday) chip = nowT >= rt ? { t: 'ждёт', c: 'warn' } : { t: `в ${rt}`, c: '' }
            else if (rt && !isToday) chip = { t: rt, c: '' }
            return (
              <li key={h.id} className={'hcard' + (isDone ? ' done' : '')} style={{ '--i': idx + 3 } as CSSProperties}>
                <button className="hmain" onClick={(e) => void tap(h, e)} aria-pressed={isDone}>
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
      {chest && <ChestModal onClose={() => setChest(false)} onOpen={() => openChest(today)} />}
    </div>
  )
}
