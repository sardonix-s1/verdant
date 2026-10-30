import { useMemo, useState } from 'react'
import { useData, type StarterInput } from '../lib/data'
import { AREAS } from '../lib/plan'
import { suggestHabits } from '../lib/coach'
import { ymd } from '../lib/dates'
import { ChipMulti, ChipSelect, Field, Group } from '../components/ui'
import { PRIVACY_POLICY } from '../lib/policy'
import type { Gender, PenaltyMode, Profile } from '../lib/types'

export const MINUTES = [5, 10, 15, 20, 30, 45, 60]
export const STYLES = [
  { v: 'gentle', l: 'Мягкие' },
  { v: 'neutral', l: 'Коротко, по делу' },
  { v: 'firm', l: 'Настойчивые' },
]
export const MOTIVATIONS = [
  { v: 'growth', t: 'Стать лучше', d: 'Расти и развиваться' },
  { v: 'proof', t: 'Доказать себе', d: 'Что я могу' },
  { v: 'calm', t: 'Порядок и спокойствие', d: 'Меньше хаоса в голове' },
  { v: 'reward', t: 'Азарт и награды', d: 'Игра, монеты, подарки' },
  { v: 'people', t: 'Ради близких', d: 'Быть примером и опорой' },
]
export const CHRONOS = [
  { v: 'morning', t: 'Утро', d: 'Лучше всего с утра' },
  { v: 'day', t: 'День', d: 'Пик в середине дня' },
  { v: 'evening', t: 'Вечер', d: 'Вечером бодрее' },
]
export const OBSTACLES = [
  { v: 'lazy', l: 'Лень' },
  { v: 'forget', l: 'Забываю' },
  { v: 'time', l: 'Нет времени' },
  { v: 'relapse', l: 'Срываюсь' },
  { v: 'goal', l: 'Нет чёткой цели' },
]
export const PENALTY_MODES: { v: PenaltyMode; t: string; d: string }[] = [
  { v: 'off', t: 'Только награды', d: 'Никаких штрафов, только монеты и XP' },
  { v: 'soft', t: 'Мягко', d: 'Пропуск стоит 5 монет. Первая ошибка недели прощается' },
  { v: 'forfeit', t: 'С заданиями', d: 'За пропуск маленький «долг»: короткое задание. Первая ошибка недели прощается' },
]
const QUIT_IDEAS = ['Бесконечный скроллинг', 'Сладкое вечером', 'Курение', 'Ночные перекусы', 'Игры допоздна']

const STEPS = 6

function Cards<T extends string>({ items, value, onChange }: { items: { v: T; t: string; d: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div className="pick">
      {items.map((o) => (
        <button type="button" key={o.v} className={'pickcard' + (value === o.v ? ' on' : '')} aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
          <b>{o.t}</b>
          <small>{o.d}</small>
        </button>
      ))}
    </div>
  )
}

export default function Onboarding() {
  const { profile, completeOnboarding } = useData()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  const [okData, setOkData] = useState(false)
  const [okPolicy, setOkPolicy] = useState(false)
  const [name, setName] = useState(profile.display_name ?? '')
  const [gender, setGender] = useState<Gender | null>(profile.gender)
  const [motivation, setMotivation] = useState<string | null>(profile.motivation)
  const [areas, setAreas] = useState<string[]>(profile.focus_areas)
  const [why, setWhy] = useState(profile.why ?? '')
  const [chrono, setChrono] = useState<string | null>(profile.chronotype)
  const [minutes, setMinutes] = useState<number>(profile.daily_minutes)
  const [obst, setObst] = useState<string[]>([])
  const [picked, setPicked] = useState<string[] | null>(null)
  const [custom, setCustom] = useState('')
  const [quit, setQuit] = useState<string[]>([])
  const [mode, setMode] = useState<PenaltyMode>('soft')
  const [style, setStyle] = useState(profile.reminder_style)

  const suggestions = useMemo(
    () =>
      suggestHabits(
        {
          profile: { ...profile, focus_areas: areas, daily_minutes: minutes, obstacles: obst, chronotype: chrono },
          habits: [],
          logs: [],
          today: ymd(),
          now: new Date(),
        },
        6,
      ),
    [profile, areas, minutes, obst, chrono],
  )
  const chosen = picked ?? suggestions.slice(0, 3).map((s) => s.title)

  const canNext =
    step === 0 ? okData && okPolicy : step === 1 ? name.trim().length > 0 && gender !== null : step === 2 ? motivation !== null : true

  async function finish() {
    setBusy(true)
    const patch: Partial<Profile> = {
      display_name: name.trim(),
      gender,
      motivation,
      focus_areas: areas,
      why: why.trim() || null,
      chronotype: chrono,
      daily_minutes: minutes,
      obstacles: obst,
      penalty_mode: mode,
      reminder_style: style,
    }
    const good: StarterInput[] = [
      ...suggestions.filter((s) => chosen.includes(s.title)).map((s) => ({ title: s.title, reason: s.why, time: s.time })),
      ...(custom.trim() ? [{ title: custom.trim() }] : []),
    ]
    await completeOnboarding(patch, [], good, quit)
    setBusy(false)
  }

  const next = () => (step === STEPS - 1 ? void finish() : setStep(step + 1))

  return (
    <div className="onb">
      <div className="onb-top">
        <button className="btn ghost small" onClick={() => setStep(step - 1)} disabled={step === 0} aria-label="Назад">← Назад</button>
        <span className="muted">{step + 1} / {STEPS}</span>
      </div>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS} aria-valuenow={step + 1}>
        <i style={{ width: `${((step + 1) / STEPS) * 100}%` }} />
      </div>

      <div className="screen onb-body" key={step}>
        {step === 0 && (
          <>
            <h1 className="brand-h">VERDANT</h1>
            <p className="muted">Закрытый трекер привычек с наградами и личным коучем. Всего два согласия, и больше мы ни о чём не попросим.</p>
            <label className="consent">
              <input type="checkbox" checked={okData} onChange={(e) => setOkData(e.target.checked)} />
              <span>Я даю согласие на обработку персональных данных, чтобы трекер работал в моём аккаунте.</span>
            </label>
            <label className="consent">
              <input type="checkbox" checked={okPolicy} onChange={(e) => setOkPolicy(e.target.checked)} />
              <span>Я принимаю политику конфиденциальности.</span>
            </label>
            <details className="policy">
              <summary>Прочитать политику конфиденциальности</summary>
              {PRIVACY_POLICY.map((p) => (
                <div key={p.h}>
                  <h3>{p.h}</h3>
                  <p className="fine">{p.t}</p>
                </div>
              ))}
            </details>
          </>
        )}
        {step === 1 && (
          <>
            <h1>Знакомство</h1>
            <Field label="Как тебя называть?" hint="имя или псевдоним">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
            </Field>
            <Group label="Пол" hint="нужен только для обращения в тексте">
              <div className="gender">
                <button type="button" className={'pickcard' + (gender === 'male' ? ' on' : '')} aria-pressed={gender === 'male'} onClick={() => setGender('male')}><b>Мужской</b></button>
                <button type="button" className={'pickcard' + (gender === 'female' ? ' on' : '')} aria-pressed={gender === 'female'} onClick={() => setGender('female')}><b>Женский</b></button>
              </div>
            </Group>
          </>
        )}
        {step === 2 && (
          <>
            <h1>Что тебя ведёт</h1>
            <Cards items={MOTIVATIONS} value={motivation} onChange={setMotivation} />
            <Group label="Что хочется улучшить" hint="можно выбрать несколько">
              <ChipMulti options={AREAS.map((a) => ({ v: a.id, l: a.label }))} value={areas} onChange={setAreas} />
            </Group>
            <Field label="Зачем тебе это" hint="одна строка, необязательно. Я напомню в трудный день">
              <input value={why} onChange={(e) => setWhy(e.target.value)} maxLength={120} />
            </Field>
          </>
        )}
        {step === 3 && (
          <>
            <h1>Твой ритм</h1>
            <Cards items={CHRONOS} value={chrono as 'morning' | 'day' | 'evening' | null} onChange={setChrono} />
            <Group label="Сколько минут в день готов(а) уделять">
              <ChipSelect options={MINUTES.map((v) => ({ v, l: `${v} мин` }))} value={minutes} onChange={setMinutes} />
            </Group>
            <Group label="Что обычно мешает" hint="я подстрою советы">
              <ChipMulti options={OBSTACLES} value={obst} onChange={setObst} />
            </Group>
          </>
        )}
        {step === 4 && (
          <>
            <h1>Стартовые привычки</h1>
            <p className="muted">Подобрано под твои сферы и время. Оставь то, что нравится. Остальное можно добавить позже.</p>
            <div className="stack">
              {suggestions.map((s) => {
                const on = chosen.includes(s.title)
                return (
                  <button type="button" key={s.title} className={'pickcard row' + (on ? ' on' : '')} aria-pressed={on} onClick={() => setPicked(on ? chosen.filter((x) => x !== s.title) : [...chosen, s.title])}>
                    <b>{s.title}</b>
                    <small>{s.why}</small>
                  </button>
                )
              })}
            </div>
            <Field label="Своя привычка" hint="необязательно">
              <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={80} />
            </Field>
            <Group label="Что хочется сократить" hint="необязательно">
              <ChipMulti options={QUIT_IDEAS.map((v) => ({ v, l: v }))} value={quit} onChange={setQuit} />
            </Group>
          </>
        )}
        {step === 5 && (
          <>
            <h1>Правила игры</h1>
            <p className="muted">Награды есть всегда. Выбери, как строго относиться к пропускам. Режим можно поменять в профиле.</p>
            <Cards items={PENALTY_MODES} value={mode} onChange={setMode} />
            <Group label="Как напоминать">
              <ChipSelect options={STYLES} value={style} onChange={setStyle} />
            </Group>
          </>
        )}
      </div>

      <div className="onb-foot">
        <button className="btn" onClick={next} disabled={!canNext || busy}>
          {step === STEPS - 1 ? (busy ? 'Собираю…' : 'Начать') : 'Дальше'}
        </button>
      </div>
    </div>
  )
}
