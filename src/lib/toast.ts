export type ToastKind = 'ok' | 'err' | 'info'
export interface ToastMsg {
  id: number
  msg: string
  kind: ToastKind
}

let counter = 0

export function toast(msg: string, kind: ToastKind = 'info') {
  window.dispatchEvent(new CustomEvent<ToastMsg>('verdant:toast', { detail: { id: ++counter, msg, kind } }))
}
