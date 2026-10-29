import { useEffect, useState } from 'react'

/** Текущее время, обновляется раз в 30 секунд (корректно переживает смену даты). */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}
