import { useState, type FormEvent } from 'react'
import { useData } from '../lib/data'
import { supabase, errMsg } from '../lib/supabase'
import { AREAS } from '../lib/plan'
import { notificationsSupported, showNotice } from '../lib/reminders'
import { toast } from '../lib/toast'
import { ChipMulti, ChipSelect, Field, Group } from '../components/ui'
import { AGE_GROUPS, INTENSITY, MINUTES, STYLES } from './Onboarding'
import type { Profile } from '../lib/types'

export default function Settings() {
  const { profile, email, saveProfile, exportAll, deleteAllData, deleteAccount } = useData()

  const [name, setName] = useState(profile.display_name ?? '')
  const [age, setAge] = useState<string | null>(profile.age_group)
  const [height, setHeight] = useState(profile.height_cm != null ? String(profile.height_cm) : '')
  const [weight, setWeight] = useState(profile.weight_kg != null ? String(profile.weight_kg) : '')
  const [interests, setInterests] = useState(profile.interests.join(', '))
  const [areas, setAreas] = useState<string[]>(profile.focus_areas)
  const [wake, setWake] = useState(profile.wake_time?.slice(0, 5) ?? '')
  const [sleep, setSleep] = useState(profile.sleep_time?.slice(0, 5) ?? '')
  const [windows, setWindows] = useState(profile.free_windows ?? '')
  const [minutes, setMinutes] = useState<number>(profile.daily_minutes)
  const [style, setStyle] = useState(profile.reminder_style)
  const [intensity, setIntensity] = useState(profile.intensity)
  const [saving, setSaving] = useState(false)
  const [pw, setPw] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const patch: Partial<Profile> = {
      display_name: name.trim() || null,
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
    if (await saveProfile(patch)) toast('Профиль сохранён', 'ok')
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
    if (!window.confirm('Удалить все привычки, цели, план и заметки и пройти настройку заново? Аккаунт останется.')) return
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
        <h2>Анкета</h2>
        <Field label="Имя или псевдоним"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></Field>
        <Group label="Возрастная группа"><ChipSelect options={AGE_GROUPS.map((v) => ({ v, l: v }))} value={age} onChange={setAge} /></Group>
        <div className="row2">
          <Field label="Рост, см" hint="необязательно"><input type="number" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} /></Field>
          <Field label="Вес, кг" hint="необязательно"><input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
        </div>
        <Field label="Интересы" hint="через запятую"><input value={interests} onChange={(e) => setInterests(e.target.value)} /></Field>
        <Group label="Сферы развития"><ChipMulti options={AREAS.map((a) => ({ v: a.id, l: a.label }))} value={areas} onChange={setAreas} /></Group>
        <div className="row2">
          <Field label="Подъём"><input type="time" value={wake} onChange={(e) => setWake(e.target.value)} /></Field>
          <Field label="Сон"><input type="time" value={sleep} onChange={(e) => setSleep(e.target.value)} /></Field>
        </div>
        <Field label="Свободные окна"><input value={windows} onChange={(e) => setWindows(e.target.value)} /></Field>
        <Group label="Минут в день"><ChipSelect options={MINUTES.map((v) => ({ v, l: `${v}` }))} value={minutes} onChange={setMinutes} /></Group>
        <Group label="Стиль напоминаний"><ChipSelect options={STYLES} value={style} onChange={setStyle} /></Group>
        <Group label="Интенсивность"><ChipSelect options={INTENSITY} value={intensity} onChange={setIntensity} /></Group>
        <button className="btn" disabled={saving}>{saving ? 'Сохраняю…' : 'Сохранить'}</button>
      </form>

      <section className="card">
        <h2>Напоминания</h2>
        <p className="muted">
          Внутри сайта напоминания работают всегда, пока он открыт: на экране «Сегодня» видно, что ждёт и что пропущено.
          Системные уведомления зависят от браузера и разрешения. Если сайт закрыт, браузер может их не показать, и мы этого не обещаем.
          На iPhone системные уведомления доступны только после добавления сайта на экран «Домой».
        </p>
        {!supported && <p className="fine">Этот браузер не поддерживает системные уведомления.</p>}
        {supported && perm === 'denied' && <p className="fine">Уведомления заблокированы в настройках браузера для этого сайта.</p>}
        <div className="row2">
          {profile.notif_enabled && perm === 'granted' ? (
            <button className="btn ghost" onClick={() => void disableNotifs()}>Выключить</button>
          ) : (
            <button className="btn" onClick={() => void enableNotifs()} disabled={!supported || perm === 'denied'}>Включить уведомления</button>
          )}
          <button className="btn ghost" onClick={() => void testReminder()}>Проверить</button>
        </div>
        <p className="fine">Время каждого напоминания задаётся в самой привычке.</p>
      </section>

      <form className="card form" onSubmit={changePassword}>
        <h2>Безопасность</h2>
        <Field label="Новый пароль" hint="не короче 8 символов"><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <button className="btn ghost" disabled={!pw}>Сменить пароль</button>
      </form>

      <section className="card">
        <h2>Приватность и данные</h2>
        <p className="muted">Твои данные видны только тебе: доступ к ним ограничен на уровне базы данных. Администратор не видит анкету и привычки через сайт.</p>
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
