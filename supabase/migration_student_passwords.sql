-- ============================================================
-- Yangiariq Yuridik Senter — talaba parollarini admin ko'ra olishi uchun
-- Supabase > SQL Editor ga to'liq joylab, bir marta Run bosing.
-- Qayta ishga tushirsangiz ham xavfsiz (ma'lumot o'chmaydi).
--
-- Eslatma: parollar oddiy matn ko'rinishida saqlanadi va FAQAT administrator
-- o'qiy oladi (talabalar o'z parolini ham bu jadvaldan o'qiy olmaydi).
-- Jadvalga yozish faqat Edge Function'lar (service role) orqali bo'ladi.
-- ============================================================

create table if not exists public.student_passwords (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  password text not null,
  updated_at timestamptz not null default now()
);

alter table public.student_passwords enable row level security;

drop policy if exists "student_passwords_select_admin" on public.student_passwords;
create policy "student_passwords_select_admin" on public.student_passwords
  for select using (public.is_admin());

-- API keshini yangilash
notify pgrst, 'reload schema';
