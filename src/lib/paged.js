// Supabase bitta so'rovda 1000 qatorgacha qaytaradi. Ko'proq kerak bo'lsa, sahifalab olamiz.
// makeQuery: har safar yangi so'rov quruvchisini qaytaradigan funksiya (tartiblash bilan).
export async function fetchAll(makeQuery, pageSize = 1000) {
  const all = []
  let from = 0
  for (;;) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return { data: all, error: null }
}
