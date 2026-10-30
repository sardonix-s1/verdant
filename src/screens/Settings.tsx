import { useState, type FormEvent } from 'react'
import { useData } from '../lib/data'
import { supabase, errMsg } from '../lib/supabase'
import { AREAS } from '../lib/plan'
import { notificationsSupported, showNotice } from '../lib/reminders'
import { toast } from '../lib/toast'
import { PRIVACY_POLICY } from '../lib/policy'
import { ChipMulti, ChipSelect, Field, Group } from '../components/ui'
import { CHRONOS, MINUTES, MOTIVATIONS, PENALTY_MODES, STYLES } from './Onboarding'
import type { Gender, PenaltyMode, Profile } from '../lib/types'

const fmtDt = (s: string | null) => (s ? new Date(s).toLocaleDateString('ru-RU') : 'не давалось')

export default function Settings() {
  const { profile, email, saveProfile, exportAll, deleteAllData, deleteAccount } = useData()

  const [name, setName] = useState(profile.display_name ?? '')
  const [gender, setGender] = useState<Gender | null>(profile.gender)
  const [motivation, setMotivation] = useState<string | null>(profile.motivation)
  const [chrono, setChrono] = useState<string | null>(profile.chronotype)
  const [why, setWhy] = useState(profile.why ?? '')
  const [areas, setAreas] = useState<string[]>(profile.focus_areas)
  const [minutes, setMinutes] = useState<number>(profile.daily_minutes)
  const [style, setStyle] = useState(profile.reminder_style)
  const [mode, setMode] = useState<PenaltyMode>(profile.penalty_mode)
  const [saving, setSaving] = useState(false)
  const [pw, setPw] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const patch: Partial<Profile> = {
      display_name: name.trim() || null,
      gender,
      motivation,
      chronotype: chrono,
      why: why.trim() || null,
      focus_areas: areas,
      daily_minutes: minutes,
      reminder_style: style,
      penalty_mode: mode,
    }
    if (await saveProfile(patch)) toast('Сохранено', 'ok')
    setSaving(false)
  }

  /* ----- Напоминания ----- */
  const supported = notificationsSupported()
  const perm = supported ? Notification.permission : 'denied'

  async function enableNotifs() {
    if (!supported) return
    const p = await Notification.requestPermission()
    if (p === 'granted') {
      if (await saveProfile({ notif_enabled: true })) toast('Уведомления включены', 'ok')
    } else {
      toast('Браузер не дал разрешение. Напоминания будут показываться внутри сайта.', 'info')
    }
  }
  async function disableNotifs() {
    await saveProfile({ notif_enabled: false })
  }
  async function testReminder() {
    toast('Тестовое напоминание: так оно выглядит внутри сайта', 'info')
    if (profile.notif_enabled) {
      const ok = await showNotice('VERDANT', 'Тестовое уведомление')
      if (!ok) toast('Системное уведомление не показалось: проверь разрешения браузера.', 'err')
    }
  }

  /* ----- Данные ----- */
  function download() {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `verdant-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  async function wipe() {
    if (!window.confirm('Удалить все привычки, цели, награды и заметки и пройти настройку заново? Аккаунт останется.')) return
    if (await deleteAllData()) toast('Данные удалены', 'ok')
  }
  async function dropAccount() {
    if (!window.confirm('Удалить аккаунт и все данные безвозвратно?')) return
    if (!window.confirm('Точно удалить? Восстановить будет нельзя.')) return
    await deleteAccount()
  }
  async function changePassword(e: FormEvent) {
    e.preventDefault()
    if (pw.length < 8) return toast('Пароль: не короче 8 символов', 'err')
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) toast(errMsg(error), 'err')
    else {
      toast('Пароль изменён', 'ok')
      setPw('')
    }
  }

  return (
    <div className="screen">
      <header className="head">
        <h1>Профиль</h1>
        <p className="muted">{email}</p>
      </header>

      <form className="card form" onSubmit={save}>
        <h2>Настройки</h2>
        <Field label="Имя или псевдоним"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></Field>
        <Group label="Пол" hint="для обращения в текстах">
          <ChipSelect options={[{ v: 'male' as Gender, l: 'Мужской' }, { v: 'female' as Gender, l: 'Женский' }]} value={gender} onChange={setGender} />
        </Group>
        <Group label="Что тебя ведёт">
          <ChipSelect options={MOTIVATIONS.map((m) => ({ v: m.v, l: m.t }))} value={motivation} onChange={setMotivation} />
        </Group>
        <Field label="Зачем тебе это"><input value={why} onChange={(e) => setWhy(e.target.value)} maxLength={120} /></Field>
        <Group label="Лучшее время дня">
          <ChipSelect options={CHRONOS.map((c) => ({ v: c.v, l: c.t }))} value={chrono} onChange={setChrono} />
        </Group>
        <Group label="Сферы развития"><ChipMulti options={AREAS.map((a) => ({ v: a.id, l: a.label }))} value={areas} onChange={setAreas} /></Group>
        <Group label="Минут в день"><ChipSelect options={MINUTES.map((v) => ({ v, l: `${v}` }))} value={minutes} onChange={setMinutes} /></Group>
        <Group label="Стиль напоминаний"><ChipSelect options={STYLES} value={style} onChange={setStyle} /></Group>
        <Group label="Пропуски" hint="первая ошибка недели прощается всегда">
          <ChipSelect options={PENALTY_MODES.map((m) => ({ v: m.v, l: m.t }))} value={mode} onChange={setMode} />
        </Group>
        <button className="btn" disabled={saving}>{saving ? 'Сохраняю…' : 'Сохранить'}</button>
      </form>

      <section className="card">
        <h2>Напоминания</h2>
        <p className="muted">
          Внутри сайта напоминания работают всегда, пока он открыт. Системные уведомления зависят от браузера и разрешения. Если сайт закрыт, браузер может их не показать, и мы этого не обещаем.
          На iPhone системные уведомления доступны только после добавления сайта на экран «Домой».
        </p>
        {!supported && <p className="fine">Этот браузер не поддерживает системные уведомления.</p>}
        {supported && perm === 'denied' && <p className="fine">Уведомления заблокированы в настройках браузера для этого сайта.</p>}
        <div className="row2">
          {profile.notif_enabled && perm === 'granted' ? (
            <button className="btn ghost" onClick={() => void disableNotifs()}>Выключить</button>
          ) : (
            <button className="btn" onClick={() => void enableNotifs()} disabled={!supported || perm === 'denied'}>Включить</button>
          )}
          <button className="btn ghost" onClick={() => void testReminder()}>Проверить</button>
        </div>
      </section>

      <form className="card form" onSubmit={changePassword}>
        <h2>Безопасность</h2>
        <Field label="Новый пароль" hint="не короче 8 символов"><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <button className="btn ghost" disabled={!pw}>Сменить пароль</button>
      </form>

      <section className="card">
        <h2>Приватность и данные</h2>
        <p className="muted">Согласие на обработку данных: {fmtDt(profile.consent_at)}. Политика конфиденциальности принята: {fmtDt(profile.privacy_at)}.</p>
        <details className="policy">
          <summary>Политика конфиденциальности</summary>
          {PRIVACY_POLICY.map((p) => (
            <div key={p.h}><h3>{p.h}</h3><p className="fine">{p.t}</p></div>
          ))}
        </details>
        <div className="stack">
          <button className="btn ghost" onClick={download}>Скачать мои данные (JSON)</button>
          <button className="btn ghost" onClick={() => void wipe()}>Удалить все данные</button>
          <button className="btn danger" onClick={() => void dropAccount()}>Удалить аккаунт</button>
        </div>
      </section>

      <button className="btn ghost" onClick={() => void supabase.auth.signOut()}>Выйти</button>
      <p className="fine center">VERDANT · закрытый проект</p>
    </div>
  )
}
