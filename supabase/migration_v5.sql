-- ============================================================
-- Yangiariq Yuridik Senter — v5 yangilanishi: GURUHLAR
--   1) groups va group_members jadvallari
--   2) tests.group_id: testni faqat bitta guruhga ochish
--   3) Talaba testni ko'rishi / boshlashi qoidalari guruhni hisobga oladi
-- Supabase > SQL Editor ga to'liq joylab, bir marta Run bosing.
-- Qayta ishga tushirsangiz ham xavfsiz (ma'lumot o'chmaydi).
-- migration_v2.sql oldin ishga tushirilgan bo'lishi kerak.
-- ============================================================

-- 1) Guruhlar
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists groups_name_unique on public.groups (lower(name));

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, student_id)
);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

drop policy if exists "groups_admin_all" on public.groups;
create policy "groups_admin_all" on public.groups
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "group_members_admin_all" on public.group_members;
create policy "group_members_admin_all" on public.group_members
  for all using (public.is_admin()) with check (public.is_admin());

-- 2) Test faqat bitta guruhga ochilishi uchun (null = cheklov yo'q).
--    "restrict": guruh o'chirilganda test tasodifan hammaga ochilib qolmasligi uchun
--    (dastur avval testlarni yopadi, keyin guruhni o'chiradi).
alter table public.tests add column if not exists group_id uuid references public.groups(id) on delete restrict;

-- 3) Joriy talaba shu guruhdami?
create or replace function public.in_group(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.student_id = auth.uid()
  );
$$;

grant execute on function public.in_group(uuid) to authenticated;

-- 4) Talaba testni boshlay oladimi? (vaqt oynasi, guruh, bir martalik, tanlanganlar)
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
      and (t.opens_at is null or t.opens_at <= now())
      and (t.closes_at is null or t.closes_at > now())
      and (
        (
          t.access in ('allowed', 'one_time')
          and (t.group_id is null or public.in_group(t.group_id))
          and (
            t.access = 'allowed'
            or not exists (
              select 1 from public.attempts a
              where a.test_id = t.id
                and a.student_id = auth.uid()
                and a.submitted_at is not null
            )
          )
        )
        or (
          t.access = 'selected'
          and exists (
            select 1 from public.test_access ta
            where ta.test_id = t.id and ta.student_id = auth.uid()
          )
        )
      )
  );
$$;

-- 5) Talabalar testlarni ko'rish qoidasi (guruh bilan)
drop policy if exists "tests_select_student" on public.tests;
create policy "tests_select_student" on public.tests
  for select using (
    (access in ('allowed', 'one_time') and (group_id is null or public.in_group(group_id)))
    or (
      access = 'selected'
      and exists (select 1 from public.test_access ta where ta.test_id = tests.id and ta.student_id = auth.uid())
    )
    or exists (select 1 from public.attempts where attempts.test_id = tests.id and attempts.student_id = auth.uid())
  );

-- API keshini yangilash
notify pgrst, 'reload schema';
