import { supabase } from './supabase'

// Students are created through a Supabase Edge Function (create-student),
// which uses the admin API on Supabase's servers. This avoids the public
// sign-up email rate limit entirely and never exposes the service-role key
// to the browser.
export async function createStudentAccount(username, password) {
  const { data, error } = await supabase.functions.invoke('create-student', {
    body: { username, password }
  })

  if (error) {
    let message = error.message
    try {
      const body = await error.context.json()
      if (body?.error) message = body.error
    } catch (_) {
      // response body wasn't JSON; fall back to the generic error message
    }
    throw new Error(message)
  }

  if (data?.error) throw new Error(data.error)

  return data.id
}

// Administrator talabaga yangi parol o'rnatadi (set-student-password Edge Function).
export async function setStudentPassword(studentId, password) {
  const { data, error } = await supabase.functions.invoke('set-student-password', {
    body: { studentId, password }
  })

  if (error) {
    let message = error.message
    try {
      const body = await error.context.json()
      if (body?.error) message = body.error
    } catch (_) {
      // javob JSON emas
    }
    throw new Error(message)
  }

  if (data?.error) throw new Error(data.error)
  return true
}
