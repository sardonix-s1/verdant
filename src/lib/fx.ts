export interface FxEvent {
  id: number
  type: 'burst' | 'float' | 'confetti'
  x: number
  y: number
  text?: string
  tone?: 'xp' | 'coin' | 'warn'
}

let n = 0
const emit = (e: Omit<FxEvent, 'id'>) =>
  window.dispatchEvent(new CustomEvent<FxEvent>('verdant:fx', { detail: { ...e, id: ++n } }))

export function haptic(ms: number | number[] = 12) {
  try {
    if ('vibrate' in navigator) navigator.vibrate(ms)
  } catch {
    /* не поддерживается */
  }
}

/** Координаты центра элемента. */
export const center = (el: Element | null | undefined) => {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

export const burst = (x: number, y: number) => emit({ type: 'burst', x, y })
export const floatText = (x: number, y: number, text: string, tone: FxEvent['tone'] = 'xp') => emit({ type: 'float', x, y, text, tone })
export const confetti = () => emit({ type: 'confetti', x: window.innerWidth / 2, y: 0 })
