-- ============================================================
-- Yangiariq Yuridik Senter — v3 yangilanishi
--   1) E'lonlar (announcements) jadvali
--   2) "Yangi natija" belgisi uchun attempts.result_seen ustuni
--   3) Talaba o'z parolini o'zgartirganda admin ko'radigan parol ham yangilanishi uchun funksiya
-- Supabase > SQL Editor ga to'liq joylab, bir marta Run bosing.
-- Qayta ishga tushirsangiz ham xavfsiz (ma'lumot o'chmaydi).
-- ============================================================

-- 1) E'lonlar
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

drop policy if exists "announcements_select" on public.announcements;
create policy "announcements_select" on public.announcements
  for select using (auth.uid() is not null and (active or public.is_admin()));

drop policy if exists "announcements_admin_all" on public.announcements;
create policy "announcements_admin_all" on public.announcements
  for all using (public.is_admin()) with check (public.is_admin());

-- 2) "Yangi natija": odatiy qiymat true (ko'rilgan). Admin baholashni tugatganda false qiladi,
--    talaba natijani ochganda yana true bo'ladi. Eski natijalar "yangi" bo'lib qolmaydi.
alter table public.attempts add column if not exists result_seen boolean not null default true;

-- 3) Talaba o'z parolini o'zgartirgach, adminga ko'rinadigan parolni ham yangilash
create or replace function public.save_my_password(p_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Kirmagansiz';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Parol kamida 6 ta belgidan iborat bo''lishi kerak';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'student') then
    raise exception 'Faqat talaba o''z parolini o''zgartira oladi';
  end if;
  insert into public.student_passwords (student_id, password, updated_at)
  values (auth.uid(), p_password, now())
  on conflict (student_id) do update set password = excluded.password, updated_at = now();
end;
$$;

grant execute on function public.save_my_password(text) to authenticated;

-- API keshini yangilash
notify pgrst, 'reload schema';
