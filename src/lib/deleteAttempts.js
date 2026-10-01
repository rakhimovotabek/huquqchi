import { supabase } from './supabase'

// Natijalarni (urinishlarni) o'chiradi. Javoblar avtomatik birga o'chadi.
// Qaytaradi: haqiqatan o'chirilgan qatorlar soni. Xatolik bo'lsa Error tashlaydi.
export async function deleteAttempts(ids) {
  let removed = 0
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const { data, error } = await supabase.from('attempts').delete().in('id', chunk).select('id')
    if (error) throw new Error(error.message)
    removed += data ? data.length : 0
  }
  if (removed < ids.length) {
    throw new Error(
      "Ba'zi natijalar o'chirilmadi. supabase/migration_v4.sql faylini SQL Editor'da bir marta ishga tushirganingizni tekshiring."
    )
  }
  return removed
}
