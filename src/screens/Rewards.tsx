import { useState, type CSSProperties, type FormEvent } from 'react'
import { useData } from '../lib/data'
import { ymd } from '../lib/dates'
import { REWARD_PRESETS, badges, levelOf } from '../lib/game'
import { burst, center, confetti, haptic } from '../lib/fx'
import { toast } from '../lib/toast'
import { AnimatedNumber, IcCoin } from '../components/ui'

const EMOJIS = ['🎁', '☕', '🎬', '🍜', '🎧', '🎮', '🛍️', '🌙', '🍰', '🏖️']

export default function Rewards() {
  const { profile, habits, logs, ledger, rewards, penalties, xp, coins, addReward, deleteReward, claimReward, completePenalty } = useData()
  const [title, setTitle] = useState('')
  const [cost, setCost] = useState('50')
  const [emoji, setEmoji] = useState('🎁')
  const lvl = levelOf(xp)
  const bs = badges(habits, logs, ledger, ymd())
  const got = bs.filter((b) => b.got).length
  const open = penalties.filter((p) => !p.done)
  const history = ledger.filter((r) => r.ref.startsWith('reward:')).slice(-5).reverse()

  async function submit(e: FormEvent) {
    e.preventDefault()
    const c = Number(cost)
    if (!title.trim() || !(c >= 0)) return
    await addReward(title.trim(), emoji, Math.round(c))
    setTitle('')
  }

  async function claim(id: string, el: HTMLElement) {
    const r = rewards.find((x) => x.id === id)
    if (!r) return
    if (await claimReward(r)) {
      const c = center(el)
      burst(c.x, c.y)
      confetti()
      haptic([20, 30, 20])
      toast(`Наслаждайся: ${r.title}`, 'ok')
    }
  }

  const presets = REWARD_PRESETS.filter((p) => !rewards.some((r) => r.title === p.title))

  return (
    <div className="screen">
      <header className="head"><h1>Награды</h1></header>

      <section className="card glossy wallet">
        <div>
          <span className="eyebrow">Монеты</span>
          <b className="huge"><IcCoin /><AnimatedNumber value={coins} /></b>
        </div>
        <div className="lvlbox">
          <span className="eyebrow">Уровень {lvl.level}</span>
          <b>{lvl.title}</b>
          <div className="xpbar"><i style={{ width: `${lvl.pct}%` }} /></div>
          <small className="muted">{xp} XP · ещё {lvl.span - lvl.into} до следующего</small>
        </div>
      </section>

      {open.length > 0 && (
        <section className="card debt">
          <span className="eyebrow">Долги</span>
          <ul className="plain">
            {open.map((p) => (
              <li key={p.id} className="goal">
                <span><b>{p.title}</b><br /><small className="muted">{habits.find((h) => h.id === p.habit_id)?.title ?? 'привычка'} · {p.for_date}</small></span>
                <button className="btn small" onClick={() => void completePenalty(p.id)}>Готово</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="stack">
        <h2>Магазин подарков</h2>
        {rewards.length === 0 && <p className="muted">Создай первый подарок себе или выбери из готовых ниже. Монеты копятся за дела.</p>}
        <ul className="list">
          {rewards.map((r, i) => (
            <li key={r.id} className="card reward" style={{ '--i': i } as CSSProperties}>
              <span className="remoji" aria-hidden="true">{r.emoji ?? '🎁'}</span>
              <span className="hbody"><b>{r.title}</b><small>{r.cost} монет{r.claimed_at ? ' · уже получал(а)' : ''}</small></span>
              <button className={'btn small' + (coins >= r.cost ? '' : ' ghost')} onClick={(e) => void claim(r.id, e.currentTarget)}>{coins >= r.cost ? 'Забрать' : `${r.cost - coins} не хватает`}</button>
              <button className="iconbtn" onClick={() => void deleteReward(r.id)} aria-label={`Удалить «${r.title}»`}>✕</button>
            </li>
          ))}
        </ul>
        {presets.length > 0 && (
          <>
            <p className="fine">Готовые идеи, нажми чтобы добавить:</p>
            <div className="chips">
              {presets.map((p) => <button key={p.title} className="chip" onClick={() => void addReward(p.title, p.emoji, p.cost)}>{p.emoji} {p.title} · {p.cost}</button>)}
            </div>
          </>
        )}
      </section>

      <form className="card form" onSubmit={submit}>
        <h2>Свой подарок</h2>
        <div className="chips">
          {EMOJIS.map((e) => <button type="button" key={e} className={'chip emo' + (emoji === e ? ' on' : '')} onClick={() => setEmoji(e)} aria-pressed={emoji === e}>{e}</button>)}
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: вечер с друзьями" maxLength={80} aria-label="Название подарка" />
        <input type="number" inputMode="numeric" min={0} value={cost} onChange={(e) => setCost(e.target.value)} aria-label="Цена в монетах" />
        <button className="btn" disabled={!title.trim()}>Добавить подарок</button>
      </form>

      <section className="card">
        <h2>Значки · {got} из {bs.length}</h2>
        <div className="badges">
          {bs.map((b) => (
            <div key={b.id} className={'badge-i' + (b.got ? ' got' : '')} title={b.hint}>
              <span className="be">{b.emoji}</span>
              <b>{b.title}</b>
              <small>{b.got ? 'получен' : b.hint}</small>
            </div>
          ))}
        </div>
      </section>

      {history.length > 0 && (
        <section className="card">
          <h2>Недавно получено</h2>
          <ul className="plain">
            {history.map((h) => <li key={h.id} className="statrow"><span>{h.note}</span><span className="muted">−{Math.abs(h.coins)}</span></li>)}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Как это работает</h2>
        <ul className="bul">
          <li>За каждое дело: XP и монеты. Серия даёт бонус.</li>
          <li>Идеальный день (все дела) даёт +20 XP и +10 монет.</li>
          <li>Сундук дня открывается после первого дела.</li>
          <li>Одна ошибка в неделю прощается щитом. {profile.penalty_mode === 'off' ? 'Штрафы выключены.' : profile.penalty_mode === 'soft' ? 'Дальше пропуск стоит 5 монет.' : 'Дальше пропуск даёт маленький «долг».'}</li>
          <li>Если вернулся и отметил пропущенный день, штраф снимается.</li>
        </ul>
      </section>
    </div>
  )
}
