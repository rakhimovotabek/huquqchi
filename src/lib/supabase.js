import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// The app only asks for a username, but Supabase Auth needs an email.
// We deterministically map username -> a fake internal email address.
export function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@testplatform-users.com`
}

// Eski parolni tekshirish uchun alohida (sessiyani saqlamaydigan) klient.
// Asosiy sessiyaga ta'sir qilmaydi.
export async function verifyPassword(username, password) {
  const temp = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
  const { error } = await temp.auth.signInWithPassword({ email: usernameToEmail(username), password })
  return !error
}
