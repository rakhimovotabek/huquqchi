-- ============================================================
-- Yangiariq Yuridik Senter — v6 yangilanishi: TEST PAytida CHIQIB KETISHNI NAZORAT QILISH
--   1) violations jadvali (talaba test oynasidan chiqsa, shu yerga yoziladi)
--   2) Administrator "Tugatish" bosganda javoblarni yozishi uchun ruxsat
--   3) "Davom ettirish": talabaning bloklangan vaqti test vaqtiga qaytariladi
-- Supabase > SQL Editor ga to'liq joylab, bir marta Run bosing.
-- Qayta ishga tushirsangiz ham xavfsiz (ma'lumot o'chmaydi).
-- ============================================================

-- 1) Qoidabuzarliklar
create table if not exists public.violations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  reason text,
  status text not null default 'open' check (status in ('open', 'resumed', 'finished')),
  answers jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Bitta urinishda bir vaqtning o'zida faqat bitta ochiq blok bo'lishi mumkin
create unique index if not exists one_open_violation_per_attempt
  on public.violations (attempt_id) where status = 'open';

create index if not exists violations_created_idx on public.violations (created_at desc);

alter table public.violations enable row level security;

drop policy if exists "violations_admin_all" on public.violations;
create policy "violations_admin_all" on public.violations
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "violations_select_own" on public.violations;
create policy "violations_select_own" on public.violations
  for select using (auth.uid() = student_id);

-- Talaba faqat o'z davom etayotgan urinishi uchun yozishi mumkin; o'zgartira/o'chira olmaydi
drop policy if exists "violations_insert_own" on public.violations;
create policy "violations_insert_own" on public.violations
  for insert with check (
    auth.uid() = student_id
    and status = 'open'
    and exists (
      select 1 from public.attempts a
      where a.id = attempt_id and a.student_id = auth.uid() and a.status = 'in_progress'
    )
  );

-- 2) Administrator talaba nomidan javoblarni yoza oladi ("Tugatish" uchun)
drop policy if exists "answers_insert_admin" on public.answers;
create policy "answers_insert_admin" on public.answers
  for insert with check (public.is_admin());

-- 3) "Davom ettirish": talaba bloklangan vaqt test vaqtiga qo'shib beriladi,
--    shuning uchun test qolgan joyidan, qolgan vaqt bilan davom etadi.
create or replace function public.resume_violation(p_violation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.violations%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Faqat administrator';
  end if;

  select * into v from public.violations where id = p_violation_id and status = 'open' for update;
  if not found then
    raise exception 'Bu hodisa allaqachon hal qilingan';
  end if;

  update public.attempts
    set started_at = started_at + (now() - v.created_at)
    where id = v.attempt_id and status = 'in_progress';

  update public.violations
    set status = 'resumed', resolved_at = now()
    where id = v.id;
end;
$$;

grant execute on function public.resume_violation(uuid) to authenticated;

-- API keshini yangilash
notify pgrst, 'reload schema';
