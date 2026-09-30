-- ============================================================
-- Yangiariq Yuridik Senter — "access" (kirish huquqi) yangilanishi
-- Supabase > SQL Editor ga to'liq joylab, bir marta Run bosing.
-- Qayta ishga tushirsangiz ham xavfsiz (ma'lumot o'chmaydi).
-- ============================================================

-- 1) tests jadvaliga "access" ustunini qo'shish.
--    Mavjud testlar "allowed" (Ruxsat berilgan) bo'lib qoladi.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tests' and column_name = 'access'
  ) then
    alter table public.tests add column access text not null default 'locked';
    update public.tests set access = 'allowed';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'tests_access_check' and conrelid = 'public.tests'::regclass
  ) then
    alter table public.tests
      add constraint tests_access_check check (access in ('locked', 'allowed', 'one_time'));
  end if;
end $$;

-- 2) Talaba testni boshlay oladimi?
create or replace function public.can_start_test(p_test_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tests t
    where t.id = p_test_id
      and (
        t.access = 'allowed'
        or (
          t.access = 'one_time'
          and not exists (
            select 1 from public.attempts a
            where a.test_id = t.id
              and a.student_id = auth.uid()
              and a.submitted_at is not null
          )
        )
      )
  );
$$;

-- 3) Qoidalar (RLS)
drop policy if exists "tests_select_authenticated" on public.tests;

drop policy if exists "tests_select_admin" on public.tests;
create policy "tests_select_admin" on public.tests
  for select using (public.is_admin());

drop policy if exists "tests_select_student" on public.tests;
create policy "tests_select_student" on public.tests
  for select using (
    access in ('allowed', 'one_time')
    or exists (select 1 from public.attempts where attempts.test_id = tests.id and attempts.student_id = auth.uid())
  );

drop policy if exists "tests_update_admin" on public.tests;
create policy "tests_update_admin" on public.tests
  for update using (public.is_admin());

drop policy if exists "attempts_insert_own" on public.attempts;
create policy "attempts_insert_own" on public.attempts
  for insert with check (auth.uid() = student_id and public.can_start_test(test_id));

-- 4) Supabase API keshini yangilash (aks holda "schema cache" xatosi chiqadi)
notify pgrst, 'reload schema';
