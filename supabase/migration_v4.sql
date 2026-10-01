-- ============================================================
-- Yangiariq Yuridik Senter — v4 yangilanishi
--   1) Administrator natijalarni (urinishlarni) o'chira oladi
--      (javoblar avtomatik birga o'chadi)
--   2) E'lonlar jadvali olib tashlanadi (e'lon imkoniyati o'chirildi)
-- Supabase > SQL Editor ga to'liq joylab, bir marta Run bosing.
-- Qayta ishga tushirsangiz ham xavfsiz.
-- ============================================================

drop policy if exists "attempts_delete_admin" on public.attempts;
create policy "attempts_delete_admin" on public.attempts
  for delete using (public.is_admin());

drop table if exists public.announcements;

notify pgrst, 'reload schema';
