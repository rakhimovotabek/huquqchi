// Supabase Edge Function: create-student
// Creates a student account using the Admin API (service-role key),
// which is NOT subject to the public sign-up email rate limit.
// The service-role key never touches the browser: it only exists
// inside this function, running on Supabase's servers.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: "Avtorizatsiya sarlavhasi yo'q" }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Identify the caller using their own token (does not bypass RLS).
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: userData, error: userErr } = await callerClient.auth.getUser()
    if (userErr || !userData.user) return json({ error: "Sessiya yaroqsiz. Qaytadan kiring" }, 401)

    // Privileged client for admin-only operations. Only used after we
    // confirm below that the caller is an admin.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: callerProfile, error: profileErr } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()

    if (profileErr || !callerProfile || callerProfile.role !== 'admin') {
      return json({ error: "Talabalarni faqat administrator yarata oladi" }, 403)
    }

    const { username, password } = await req.json()
    const cleanUsername = (username || '').trim().toLowerCase()
    if (!cleanUsername) return json({ error: "Foydalanuvchi nomini kiriting" }, 400)
    if (!password || password.length < 6) return json({ error: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" }, 400)

    const email = `${cleanUsername}@testplatform-users.com`

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })
    if (createErr) {
      const msg = /already|registered|exists/i.test(createErr.message || '')
        ? "Bu foydalanuvchi nomi band"
        : createErr.message
      return json({ error: msg }, 400)
    }

    const { error: insertErr } = await adminClient
      .from('profiles')
      .insert({ id: created.user.id, username: cleanUsername, role: 'student' })

    if (insertErr) {
      // Roll back the auth user so we don't leave an orphaned login with no profile.
      await adminClient.auth.admin.deleteUser(created.user.id)
      return json({ error: insertErr.message }, 400)
    }

    // Administrator keyinchalik ko'ra olishi uchun parolni saqlaymiz (faqat admin o'qiy oladi).
    // Jadval hali yaratilmagan bo'lsa ham talaba yaratilaveradi.
    const { error: pwErr } = await adminClient
      .from('student_passwords')
      .upsert({ student_id: created.user.id, password, updated_at: new Date().toISOString() })
    if (pwErr) console.error('student_passwords saqlanmadi:', pwErr.message)

    return json({ success: true, id: created.user.id })
  } catch (err) {
    return json({ error: err.message || "Noma'lum xatolik" }, 500)
  }
})
