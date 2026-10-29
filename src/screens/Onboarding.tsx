import { useState } from 'react'
import { useData } from '../lib/data'
import { AREAS } from '../lib/plan'
import { ChipMulti, ChipSelect, Field, Group } from '../components/ui'
import type { Profile } from '../lib/types'

export const AGE_GROUPS = ['До 18', '18–24', '25–34', '35–44', '45+']
export const MINUTES = [5, 10, 15, 20, 30, 45, 60]
export const STYLES = [
  { v: 'gentle', l: 'Мягкие' },
  { v: 'neutral', l: 'Коротко, по делу' },
  { v: 'firm', l: 'Настойчивые' },
]
export const INTENSITY = [
  { v: 'light', l: 'Лёгкий' },
  { v: 'medium', l: 'Сбалансированный' },
  { v: 'high', l: 'Интенсивный' },
]

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
const STEPS = 7

export default function Onboarding() {
  const { profile, completeOnboarding } = useData()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  const [consent, setConsent] = useState(false)
  const [name, setName] = useState(profile.display_name ?? '')
  const [age, setAge] = useState<string | null>(profile.age_group)
  const [height, setHeight] = useState(profile.height_cm != null ? String(profile.height_cm) : '')
  const [weight, setWeight] = useState(profile.weight_kg != null ? String(profile.weight_kg) : '')
  const [interests, setInterests] = useState(profile.interests.join(', '))
  const [g30, setG30] = useState('')
  const [g90, setG90] = useState('')
  const [areas, setAreas] = useState<string[]>(profile.focus_areas)
  const [wake, setWake] = useState(profile.wake_time?.slice(0, 5) ?? '07:00')
  const [sleep, setSleep] = useState(profile.sleep_time?.slice(0, 5) ?? '23:00')
  const [windows, setWindows] = useState(profile.free_windows ?? '')
  const [minutes, setMinutes] = useState<number>(profile.daily_minutes)
  const [good, setGood] = useState('')
  const [quit, setQuit] = useState('')
  const [style, setStyle] = useState(profile.reminder_style)
  const [intensity, setIntensity] = useState(profile.intensity)

  const canNext = step === 0 ? consent && name.trim().length > 0 : true

  async function finish() {
    setBusy(true)
    const patch: Partial<Profile> = {
      display_name: name.trim(),
      age_group: age,
      height_cm: height ? Number(height) : null,
      weight_kg: weight ? Number(weight) : null,
      interests: interests.split(',').map((x) => x.trim()).filter(Boolean),
      focus_areas: areas,
      wake_time: wake || null,
      sleep_time: sleep || null,
      free_windows: windows.trim() || null,
      daily_minutes: minutes,
      reminder_style: style,
      intensity,
    }
    const goals = [
      ...(g30.trim() ? [{ horizon: 30 as const, area: null, text: g30.trim() }] : []),
      ...(g90.trim() ? [{ horizon: 90 as const, area: null, text: g90.trim() }] : []),
    ]
    await completeOnboarding(patch, goals, lines(good), lines(quit))
    setBusy(false)
  }

  const next = () => (step === STEPS - 1 ? void finish() : setStep(step + 1))

  return (
    <div className="onb">
      <div className="onb-top">
        <button className="btn ghost small" onClick={() => setStep(step - 1)} disabled={step === 0} aria-label="Назад">← Назад</button>
        <span className="muted">Шаг {step + 1} из {STEPS}</span>
      </div>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS} aria-valuenow={step + 1}>
        <i style={{ width: `${((step + 1) / STEPS) * 100}%` }} />
      </div>

      <div className="screen onb-body" key={step}>
        {step === 0 && (
          <>
            <h1>Добро пожаловать</h1>
            <p className="muted">Несколько вопросов, чтобы собрать план под тебя. Всё необязательное можно пропустить, а ответы потом изменить в профиле.</p>
            <Field label="Как тебя называть?" hint="имя или псевдоним">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
            </Field>
            <label className="check-row">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Я согласен(на), что мои ответы хранятся в личном аккаунте для работы трекера. Данные видны только мне, их можно экспортировать, изменить или удалить в любой момент.</span>
            </label>
          </>
        )}
        {step === 1 && (
          <>
            <h1>Немного о тебе</h1>
            <Group label="Возрастная группа" hint="нужна только чтобы подбирать реалистичную нагрузку">
              <ChipSelect options={AGE_GROUPS.map((v) => ({ v, l: v }))} value={age} onChange={setAge} />
            </Group>
            <div className="row2">
              <Field label="Рост, см" hint="необязательно"><input type="number" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} /></Field>
              <Field label="Вес, кг" hint="необязательно"><input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
            </div>
            <p className="fine">Рост и вес заполняй, только если сам(а) хочешь их отслеживать. Они не определяют твою ценность и не влияют на план.</p>
            <Field label="Интересы и увлечения" hint="через запятую">
              <input value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="спорт, программирование, книги" />
            </Field>
          </>
        )}
        {step === 2 && (
          <>
            <h1>Цели и сферы</h1>
            <Field label="Главная цель на 30 дней"><input value={g30} onChange={(e) => setG30(e.target.value)} maxLength={140} /></Field>
            <Field label="Главная цель на 90 дней"><input value={g90} onChange={(e) => setG90(e.target.value)} maxLength={140} /></Field>
            <Group label="Что хочется улучшить" hint="лучше выбрать 2–4 сферы">
              <ChipMulti options={AREAS.map((a) => ({ v: a.id, l: a.label }))} value={areas} onChange={setAreas} />
            </Group>
          </>
        )}
        {step === 3 && (
          <>
            <h1>Распорядок</h1>
            <div className="row2">
              <Field label="Обычно просыпаюсь"><input type="time" value={wake} onChange={(e) => setWake(e.target.value)} /></Field>
              <Field label="Обычно ложусь"><input type="time" value={sleep} onChange={(e) => setSleep(e.target.value)} /></Field>
            </div>
            <Field label="Свободные окна в течение дня" hint="необязательно">
              <input value={windows} onChange={(e) => setWindows(e.target.value)} placeholder="например: утром до 8, вечером после 19" />
            </Field>
            <Group label="Сколько минут в день на привычки" hint="план не будет предлагать задачи дольше">
              <ChipSelect options={MINUTES.map((v) => ({ v, l: `${v} мин` }))} value={minutes} onChange={setMinutes} />
            </Group>
          </>
        )}
        {step === 4 && (
          <>
            <h1>Полезные привычки</h1>
            <p className="muted">Что хочется сформировать? По одной на строке. Для начала достаточно 3–5.</p>
            <textarea rows={6} value={good} onChange={(e) => setGood(e.target.value)} placeholder={'Читать 10 минут\nПрогулка после обеда'} />
            <p className="fine">Если оставишь пусто, мы предложим стартовые привычки по выбранным сферам.</p>
          </>
        )}
        {step === 5 && (
          <>
            <h1>Что сократить</h1>
            <p className="muted">Привычки, от которых хочется отказаться или которые хочется сократить. Необязательно, по одной на строке. Мы будем отмечать дни без них, без осуждения.</p>
            <textarea rows={5} value={quit} onChange={(e) => setQuit(e.target.value)} placeholder="Бессмысленный скроллинг ночью" />
          </>
        )}
        {step === 6 && (
          <>
            <h1>Стиль и нагрузка</h1>
            <Group label="Какие напоминания удобнее">
              <ChipSelect options={STYLES} value={style} onChange={setStyle} />
            </Group>
            <Group label="Интенсивность плана" hint="можно изменить в любой момент">
              <ChipSelect options={INTENSITY} value={intensity} onChange={setIntensity} />
            </Group>
          </>
        )}
      </div>

      <div className="onb-foot">
        <button className="btn" onClick={next} disabled={!canNext || busy}>
          {step === STEPS - 1 ? (busy ? 'Собираю план…' : 'Создать мой план') : 'Дальше'}
        </button>
      </div>
    </div>
  )
}
