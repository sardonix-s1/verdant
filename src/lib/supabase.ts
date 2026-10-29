import { createClient } from '@supabase/supabase-js'

// Только публичные значения. Service-role ключ в клиент не попадает никогда.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const configured = Boolean(url && key)

export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true },
})

export const errMsg = (e: unknown): string =>
  e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Что-то пошло не так'
