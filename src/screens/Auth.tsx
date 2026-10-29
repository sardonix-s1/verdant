import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Field } from '../components/ui'

export default function Auth() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: 'err' | 'ok'; m: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const mail = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(mail)) return setMsg({ t: 'err', m: 'Введите корректный email' })
    if (password.length < 8) return setMsg({ t: 'err', m: 'Пароль — не короче 8 символов' })
    setBusy(true)
    setMsg(null)
    if (mode === 'in') {
      const { error } = await supabase.auth.signInWithPassword({ email: mail, password })
      if (error) {
        setMsg({
          t: 'err',
          m: /invalid login/i.test(error.message) ? 'Неверный email или пароль' : /not confirmed/i.test(error.message) ? 'Email ещё не подтверждён. Проверь почту.' : error.message,
        })
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email: mail, password })
      if (error) {
        setMsg({
          t: 'err',
          m: /database error|not allowed|доступ/i.test(error.message)
            ? 'Этого email нет в списке приглашённых. Попроси администратора добавить его.'
            : error.message,
        })
      } else if (!data.session) {
        setMsg({ t: 'ok', m: 'Аккаунт создан. Подтверди email по ссылке из письма, затем войди.' })
        setMode('in')
      }
    }
    setBusy(false)
  }

  return (
    <div className="auth">
      <div className="auth-logo" aria-hidden="true">
        <img src="/icon.svg" alt="" width="64" height="64" />
      </div>
      <h1 className="brand">VERDANT</h1>
      <p className="muted center">Закрытый трекер привычек. Вход только по приглашению.</p>

      <div className="seg" role="tablist">
        <button role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'on' : ''} onClick={() => { setMode('in'); setMsg(null) }}>Вход</button>
        <button role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'on' : ''} onClick={() => { setMode('up'); setMsg(null) }}>Регистрация</button>
      </div>

      <form onSubmit={submit} className="form card">
        <Field label="Email">
          <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Пароль" hint={mode === 'up' ? 'не короче 8 символов' : undefined}>
          <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {msg && <p className={msg.t === 'err' ? 'error' : 'okmsg'} role="alert">{msg.m}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Подождите…' : mode === 'in' ? 'Войти' : 'Создать аккаунт'}</button>
      </form>
      {mode === 'up' && (
        <p className="fine center">Регистрация работает только для email-адресов, которые добавил администратор.</p>
      )}
    </div>
  )
}
