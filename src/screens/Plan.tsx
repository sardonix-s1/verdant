import { useState, type FormEvent } from 'react'
import { useData } from '../lib/data'
import { AREAS, areaLabel } from '../lib/plan'
import { Field, Group, ChipSelect, IcCheck } from '../components/ui'

export default function Plan() {
  const { profile, goals, habits, plan, togglePlan, extendPlan, addGoal, deleteGoal } = useData()
  const [span, setSpan] = useState<7 | 30>(7)
  const [text, setText] = useState('')
  const [hor, setHor] = useState<30 | 90>(30)

  const active = habits.filter((h) => h.status === 'active')
  const maxDay = Math.max(0, ...plan.map((p) => p.day_number))
  const items = plan.filter((p) => p.day_number <= span)
  const next = plan.filter((p) => !p.done).slice(0, 3)

  // Обзор строится по ответам; формулировки осторожные: это предположения, а не выводы.
  const strengths: string[] = []
  if (profile.interests.length) strengths.push(`Интересы (${profile.interests.slice(0, 3).join(', ')}) можно связать с привычками, так их проще удерживать.`)
  if (active.length) strengths.push(`Ты уже определил(а) привычки, с которых хочешь начать (${active.length}).`)
  if (goals.length) strengths.push('У тебя есть сформулированные цели: от них удобно считать прогресс.')
  if (profile.wake_time && profile.sleep_time) strengths.push('Режим дня известен, значит напоминания можно ставить в удобные окна.')

  const obstacles: string[] = []
  if (profile.daily_minutes <= 10) obstacles.push('Времени немного, поэтому шаги в плане короткие. Регулярность важнее длительности.')
  if (active.length > 5) obstacles.push('Привычек много. Может подойти оставить 3–5 основных и остальные отправить в архив.')
  if (habits.some((h) => h.kind === 'quit')) obstacles.push('Сокращать привычки сложно: срывы бывают у всех. Смотри на динамику недели, а не на один день.')
  if (profile.intensity === 'high') obstacles.push('Выбран интенсивный план. Если почувствуешь усталость, можно снизить нагрузку в профиле.')
  if (obstacles.length === 0) obstacles.push('Самое частое препятствие — резкий старт с большой нагрузкой. Начни с минимума и увеличивай по мере привычки.')

  const days = Array.from(new Set(items.map((i) => i.day_number)))

  async function submitGoal(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    await addGoal({ horizon: hor, area: null, text: text.trim() })
    setText('')
  }

  return (
    <div className="screen">
      <header className="head"><h1>Мой план</h1></header>

      <section className="card">
        <h2>Обзор</h2>
        <p className="muted">
          {goals.length ? 'Твои цели:' : 'Добавь цель ниже, чтобы план опирался на неё.'}
        </p>
        <ul className="plain">
          {goals.map((g) => (
            <li key={g.id} className="goal">
              <span><b>{g.horizon} дн.</b> {g.text}</span>
              <button className="iconbtn" aria-label="Удалить цель" onClick={() => void deleteGoal(g.id)}>✕</button>
            </li>
          ))}
        </ul>
        {profile.focus_areas.length > 0 && (
          <p><span className="muted">Приоритетные сферы: </span>{profile.focus_areas.map(areaLabel).join(', ')}</p>
        )}
        {strengths.length > 0 && (<><h3>Что уже есть</h3><ul className="bul">{strengths.map((s) => <li key={s}>{s}</li>)}</ul></>)}
        <h3>Возможные препятствия</h3>
        <ul className="bul">{obstacles.map((s) => <li key={s}>{s}</li>)}</ul>
        <h3>Как понять, что идёшь вперёд</h3>
        <ul className="bul">
          <li>Доля выполненных действий за неделю растёт или держится.</li>
          <li>Раз в неделю смотрим вкладку «Прогресс»: что получилось, что стоит сделать проще.</li>
        </ul>
        <p className="fine">По твоим ответам может подойти такой план, но это предположение. Всё можно менять вручную.</p>
      </section>

      <form className="card form" onSubmit={submitGoal}>
        <h2>Новая цель</h2>
        <Group label="Горизонт">
          <ChipSelect options={[{ v: 30 as const, l: '30 дней' }, { v: 90 as const, l: '90 дней' }]} value={hor} onChange={setHor} />
        </Group>
        <Field label="Формулировка"><input value={text} onChange={(e) => setText(e.target.value)} maxLength={140} /></Field>
        <button className="btn" disabled={!text.trim()}>Добавить цель</button>
      </form>

      {next.length > 0 && (
        <section className="card">
          <h2>Ближайшие действия</h2>
          <ul className="plain">
            {next.map((p) => (
              <li key={p.id}><button className="planrow" onClick={() => void togglePlan(p.id)}><span className="check small" />День {p.day_number}: {p.title}</button></li>
            ))}
          </ul>
        </section>
      )}

      <div className="seg" role="tablist">
        <button role="tab" aria-selected={span === 7} className={span === 7 ? 'on' : ''} onClick={() => setSpan(7)}>7 дней</button>
        <button role="tab" aria-selected={span === 30} className={span === 30 ? 'on' : ''} onClick={() => setSpan(30)}>30 дней</button>
      </div>

      {span === 30 && maxDay < 30 && (
        <button className="btn ghost" onClick={() => void extendPlan()}>Расширить план до 30 дней</button>
      )}
      {span === 30 && maxDay === 0 && <p className="muted center">План пока пуст.</p>}

      <ul className="list">
        {days.map((d) => (
          <li key={d} className="card day">
            <b className="muted">День {d}</b>
            {items.filter((i) => i.day_number === d).map((p) => (
              <button key={p.id} className={'planrow' + (p.done ? ' done' : '')} onClick={() => void togglePlan(p.id)} aria-pressed={p.done}>
                <span className={'check small' + (p.done ? ' on' : '')}>{p.done && <IcCheck size={14} />}</span>
                <span>{p.title}<small className="muted"> · {AREAS.find((a) => a.id === p.area)?.label ?? ''}</small></span>
              </button>
            ))}
          </li>
        ))}
      </ul>
    </div>
  )
}
