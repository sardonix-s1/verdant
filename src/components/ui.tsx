import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { ToastMsg } from '../lib/toast'

/* ---------- Иконки ---------- */
function Svg({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}
export const IcCheck = ({ size }: { size?: number }) => <Svg size={size}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
export const IcPlus = () => <Svg><path d="M12 5v14M5 12h14" /></Svg>
export const IcToday = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></Svg>
export const IcPlan = () => <Svg><path d="M5 4v17M5 5h11l-2 4 2 4H5" /></Svg>
export const IcHabits = () => <Svg><path d="M9 7h11M9 12h11M9 17h11" /><path d="M4 7h.01M4 12h.01M4 17h.01" /></Svg>
export const IcProgress = () => <Svg><path d="M5 20V10M12 20V4M19 20v-7" /></Svg>
export const IcUser = () => <Svg><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></Svg>
export const IcLeft = () => <Svg size={20}><path d="M15 5l-7 7 7 7" /></Svg>
export const IcRight = () => <Svg size={20}><path d="M9 5l7 7-7 7" /></Svg>
export const IcEdit = () => <Svg size={18}><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></Svg>

/* ---------- Формы ---------- */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="flabel">{label}</span>
      {hint && <span className="fhint">{hint}</span>}
      {children}
    </label>
  )
}

export function Group({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field" role="group" aria-label={label}>
      <span className="flabel">{label}</span>
      {hint && <span className="fhint">{hint}</span>}
      {children}
    </div>
  )
}

export function ChipSelect<T extends string | number>({
  options, value, onChange,
}: { options: { v: T; l: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button type="button" key={String(o.v)} className={'chip' + (value === o.v ? ' on' : '')} aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
          {o.l}
        </button>
      ))}
    </div>
  )
}

export function ChipMulti<T extends string | number>({
  options, value, onChange,
}: { options: { v: T; l: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o.v)
        return (
          <button
            type="button"
            key={String(o.v)}
            className={'chip' + (on ? ' on' : '')}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o.v) : [...value, o.v])}
          >
            {o.l}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Окно ---------- */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ---------- Уведомления внутри сайта ---------- */
export function Toasts() {
  const [list, setList] = useState<ToastMsg[]>([])
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<ToastMsg>).detail
      setList((p) => [...p.slice(-2), t])
      window.setTimeout(() => setList((p) => p.filter((x) => x.id !== t.id)), 5000)
    }
    window.addEventListener('verdant:toast', on)
    return () => window.removeEventListener('verdant:toast', on)
  }, [])
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={'toast ' + t.kind}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

export function ProgressRing({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="ring" style={{ '--p': `${pct}%` } as CSSProperties} role="img" aria-label={label}>
      <span>{pct}%</span>
    </div>
  )
}
