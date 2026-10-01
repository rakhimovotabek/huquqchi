-- ============================================================
-- Yangiariq Yuridik Senter — v2 yangilanishi
-- Yangi imkoniyatlar: test jadvali (ochilish/yopilish vaqti), savollarni aralashtirish,
-- reyting, tanlangan talabalarga ruxsat.
-- Supabase > SQL Editor ga to'liq joylab, bir marta Run bosing.
-- Qayta ishga tushirsangiz ham xavfsiz (ma'lumot o'chmaydi).
-- ============================================================

-- 1) tests jadvaliga yangi ustunlar (hammasi ixtiyoriy, odatiy qiymat: o'chiq)
alter table public.tests add column if not exists opens_at timestamptz;
alter table public.tests add column if not exists closes_at timestamptz;
alter table public.tests add column if not exists shuffle boolean not null default false;
alter table public.tests add column if not exists show_leaderboard boolean not null default false;

-- 2) "access" ga yangi qiymat: 'selected' (faqat tanlangan talabalarga)
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.tests'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%access%'
  loop
    execute format('alter table public.tests drop constraint %I', c.conname);
  end loop;
  alter table public.tests
    add constraint tests_access_check check (access in ('locked', 'allowed', 'one_time', 'selected'));
end $$;

-- 3) Tanlangan talabalar jadvali
create table if not exists public.test_access (
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (test_id, student_id)
);

alter table public.test_access enable row level security;

drop policy if exists "test_access_admin_all" on public.test_access;
create policy "test_access_admin_all" on public.test_access
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "test_access_select_own" on public.test_access;
create policy "test_access_select_own" on public.test_access
  for select using (auth.uid() = student_id);

-- 4) Talaba testni boshlay oladimi? (vaqt oynasi va tanlangan talabalar hisobga olinadi)
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

-- 5) Talabalar testlarni ko'rish qoidasi
drop policy if exists "tests_select_student" on public.tests;
create policy "tests_select_student" on public.tests
  for select using (
    access in ('allowed', 'one_time')
    or (
      access = 'selected'
      and exists (select 1 from public.test_access ta where ta.test_id = tests.id and ta.student_id = auth.uid())
    )
    or exists (select 1 from public.attempts where attempts.test_id = tests.id and attempts.student_id = auth.uid())
  );

-- 6) Reyting: har bir talabaning eng yaxshi natijasi bo'yicha eng yaxshi 10 talaba
--    (+ so'ragan talabaning o'z o'rni). Talaba faqat reyting yoqilgan testda va
--    testni topshirgan bo'lsa ko'ra oladi; admin har doim ko'ra oladi.
create or replace function public.test_leaderboard(p_test_id uuid)
returns table (rank bigint, username text, score integer, total integer, is_me boolean)
language sql
security definer
set search_path = public
stable
as $$
  with allowed as (
    select 1 as ok from public.tests t
    where t.id = p_test_id
      and (
        public.is_admin()
        or (
          t.show_leaderboard
          and exists (
            select 1 from public.attempts a
            where a.test_id = t.id and a.student_id = auth.uid() and a.submitted_at is not null
          )
        )
      )
  ),
  best as (
    select distinct on (a.student_id)
      a.student_id, a.score, a.total_questions, a.submitted_at
    from public.attempts a
    where a.test_id = p_test_id
      and a.status = 'completed'
      and a.total_questions > 0
      and exists (select 1 from allowed)
    order by a.student_id, (a.score::numeric / a.total_questions) desc, a.submitted_at asc
  ),
  ranked as (
    select b.student_id, p.username, b.score, b.total_questions,
           rank() over (order by (b.score::numeric / b.total_questions) desc) as rnk
    from best b
    join public.profiles p on p.id = b.student_id
  )
  select r.rnk, r.username, r.score, r.total_questions, (r.student_id = auth.uid())
  from ranked r
  where r.rnk <= 10 or r.student_id = auth.uid()
  order by r.rnk, r.username;
$$;

grant execute on function public.test_leaderboard(uuid) to authenticated;

-- API keshini yangilash
notify pgrst, 'reload schema';
