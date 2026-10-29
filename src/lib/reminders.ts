import { useEffect, useRef } from 'react'
import { hm, nowHM, toMin, ymd } from './dates'
import { doneIdsOn, isDue } from './logic'
import { toast } from './toast'
import type { Habit, Log, Profile } from './types'

export function reminderText(style: string, title: string) {
  if (style === 'firm') return `Пора: ${title}`
  if (style === 'neutral') return title
  return `Когда будет момент: ${title}`
}

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window

/** Системное уведомление. Работает только если есть разрешение; фон при закрытом сайте не гарантируется. */
export async function showNotice(title: string, body: string): Promise<boolean> {
  try {
    if (!notificationsSupported() || Notification.permission !== 'granted') return false
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (reg) {
      await reg.showNotification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png' })
      return true
    }
    new Notification(title, { body, icon: '/icon-192.png' })
    return true
  } catch {
    return false
  }
}

/** Пока сайт открыт, раз в 30 сек проверяет время напоминаний. */
export function useReminders(habits: Habit[], logs: Log[], profile: Profile) {
  const ref = useRef({ habits, logs, profile })
  ref.current = { habits, logs, profile }

  useEffect(() => {
    const tick = () => {
      const { habits, logs, profile } = ref.current
      const today = ymd()
      const nowT = nowHM()
      const done = doneIdsOn(logs, today)
      for (const h of habits) {
        if (!h.reminder_time || !isDue(h, today) || done.has(h.id)) continue
        const rt = hm(h.reminder_time)
        // сработать, если время наступило и прошло не более 3 часов
        if (nowT < rt || toMin(nowT) - toMin(rt) > 180) continue
        const key = `verdant.fired.${today}.${h.id}`
        let fired = false
        try {
          fired = localStorage.getItem(key) === '1'
        } catch {
          /* localStorage может быть недоступен */
        }
        if (fired) continue
        try {
          localStorage.setItem(key, '1')
        } catch {
          /* ignore */
        }
        const text = reminderText(profile.reminder_style, h.title)
        toast(text, 'info')
        if (profile.notif_enabled) void showNotice('VERDANT', text)
      }
    }
    tick()
    const id = window.setInterval(tick, 30000)
    return () => window.clearInterval(id)
  }, [])
}
