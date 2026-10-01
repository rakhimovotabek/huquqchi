// Supabase Edge Function: set-student-password
// Administrator talabaga yangi parol o'rnatadi (Auth parolini almashtiradi va
// administrator ko'ra olishi uchun student_passwords jadvaliga yozadi).
// service-role kaliti brauzerga hech qachon chiqmaydi.

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

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: userData, error: userErr } = await callerClient.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'Sessiya yaroqsiz. Qaytadan kiring' }, 401)

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: callerProfile, error: profileErr } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()

    if (profileErr || !callerProfile || callerProfile.role !== 'admin') {
      return json({ error: 'Parolni faqat administrator o\'zgartira oladi' }, 403)
    }

    const { studentId, password } = await req.json()
    if (!studentId) return json({ error: 'Talaba aniqlanmadi' }, 400)
    if (!password || password.length < 6) {
      return json({ error: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" }, 400)
    }

    // Faqat talabalarning parolini o'zgartirish mumkin
    const { data: target, error: targetErr } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', studentId)
      .single()
    if (targetErr || !target || target.role !== 'student') {
      return json({ error: 'Talaba topilmadi' }, 404)
    }

    const { error: updErr } = await adminClient.auth.admin.updateUserById(studentId, { password })
    if (updErr) return json({ error: updErr.message }, 400)

    const { error: pwErr } = await adminClient
      .from('student_passwords')
      .upsert({ student_id: studentId, password, updated_at: new Date().toISOString() })
    if (pwErr) return json({ error: "Parol o'zgartirildi, lekin saqlanmadi: " + pwErr.message }, 500)

    return json({ success: true })
  } catch (err) {
    return json({ error: err.message || "Noma'lum xatolik" }, 500)
  }
})
