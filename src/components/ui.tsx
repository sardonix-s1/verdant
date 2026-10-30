import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { ToastMsg } from '../lib/toast'
import type { FxEvent } from '../lib/fx'

/* ---------- Иконки ---------- */
function Svg({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}
export const IcCheck = ({ size }: { size?: number }) => <Svg size={size}><path className="tick" d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
export const IcPlus = () => <Svg><path d="M12 5v14M5 12h14" /></Svg>
export const IcToday = () => <Svg><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.2l2.4 2.4 4.6-4.9" /></Svg>
export const IcPath = () => <Svg><path d="M4 19c4 0 3-7 8-7s4-7 8-7" /><circle cx="4" cy="19" r="1.4" /><circle cx="20" cy="5" r="1.4" /></Svg>
export const IcCoach = () => <Svg><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V15h-.5A2.5 2.5 0 0 1 4 12.5z" /><path d="M9 9.5h6M9 12h3.5" /></Svg>
export const IcGift = () => <Svg><rect x="4" y="9" width="16" height="11" rx="2" /><path d="M12 9v11M4 13h16M12 9c-1.5-4-5-4-5-1.8C7 8.5 9 9 12 9zm0 0c1.5-4 5-4 5-1.8C17 8.5 15 9 12 9z" /></Svg>
export const IcUser = () => <Svg><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c1.4-3.6 4.2-5.4 7.5-5.4s6.1 1.8 7.5 5.4" /></Svg>
export const IcLeft = () => <Svg size={20}><path d="M15 5l-7 7 7 7" /></Svg>
export const IcRight = () => <Svg size={20}><path d="M9 5l7 7-7 7" /></Svg>
export const IcEdit = () => <Svg size={18}><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></Svg>
export const IcSend = () => <Svg size={20}><path d="M4 12l16-8-6 16-2.5-6.5z" /></Svg>
export const IcFlame = () => <Svg size={18}><path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.6.7-2.6 1.5-3.5C10 10 11 8 12 3z" /></Svg>
export const IcCoin = () => <Svg size={18}><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9.5 10.2c.6-.8 1.6-1.2 2.5-1.2 1.4 0 2.5.7 2.5 1.8S13.4 12.4 12 12.6s-2.5.8-2.5 1.9S10.6 16.2 12 16.2c1 0 1.9-.4 2.5-1.2" /></Svg>

/* ---------- Анимированное число ---------- */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = from.current
    if (start === value) return
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 650)
      const e = 1 - Math.pow(1 - k, 3)
      setShown(Math.round(start + (value - start) * e))
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <span className={className}>{shown}</span>
}

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
        <div className="grab" aria-hidden="true" />
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
      window.setTimeout(() => setList((p) => p.filter((x) => x.id !== t.id)), 4500)
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

/* ---------- Эффекты: искры, всплывающий текст, конфетти ---------- */
const COLORS = ['#c9a27e', '#9bb5a0', '#a6a9d6', '#d6a3a3', '#e8dcc8']
export function FxLayer() {
  const [items, setItems] = useState<FxEvent[]>([])
  useEffect(() => {
    const on = (e: Event) => {
      const fx = (e as CustomEvent<FxEvent>).detail
      setItems((p) => [...p.slice(-6), fx])
      window.setTimeout(() => setItems((p) => p.filter((x) => x.id !== fx.id)), fx.type === 'confetti' ? 2600 : 1300)
    }
    window.addEventListener('verdant:fx', on)
    return () => window.removeEventListener('verdant:fx', on)
  }, [])
  return (
    <div className="fx" aria-hidden="true">
      {items.map((it) => {
        if (it.type === 'float') {
          return <span key={it.id} className={'fx-float ' + (it.tone ?? 'xp')} style={{ left: it.x, top: it.y }}>{it.text}</span>
        }
        if (it.type === 'burst') {
          return (
            <span key={it.id} className="fx-burst" style={{ left: it.x, top: it.y }}>
              {Array.from({ length: 12 }, (_, i) => {
                const a = (i / 12) * Math.PI * 2
                const r = 34 + (i % 3) * 10
                return <i key={i} style={{ '--dx': `${Math.cos(a) * r}px`, '--dy': `${Math.sin(a) * r}px`, '--c': COLORS[i % COLORS.length] } as CSSProperties} />
              })}
            </span>
          )
        }
        return (
          <span key={it.id} className="fx-confetti">
            {Array.from({ length: 46 }, (_, i) => (
              <i
                key={i}
                style={{
                  '--x': `${(i * 37) % 100}vw`,
                  '--d': `${(i % 7) * 0.08}s`,
                  '--t': `${1.7 + (i % 5) * 0.18}s`,
                  '--r': `${(i * 53) % 360}deg`,
                  '--c': COLORS[i % COLORS.length],
                } as CSSProperties}
              />
            ))}
          </span>
        )
      })}
    </div>
  )
}

/* ---------- Кольцо прогресса ---------- */
export function ProgressRing({ pct, label, size = 84 }: { pct: number; label: string; size?: number }) {
  const r = (size - 10) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="ring-bg" cx={size / 2} cy={size / 2} r={r} />
        <circle
          className={'ring-fg' + (pct >= 100 ? ' full' : '')}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(100, pct) / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span><AnimatedNumber value={pct} />%</span>
    </div>
  )
}
