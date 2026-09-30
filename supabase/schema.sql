-- ============================================================
-- Online Test Platform - Supabase Schema
-- Run this entire file once in the Supabase SQL Editor.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  role text not null check (role in ('admin', 'student')),
  created_at timestamptz not null default now()
);

create table if not exists tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  questions_json jsonb not null,
  -- Kirish huquqi: 'locked' (yopiq), 'allowed' (hammaga ochiq), 'one_time' (bir martalik)
  access text not null default 'locked' check (access in ('locked', 'allowed', 'one_time')),
  created_at timestamptz not null default now()
);

create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  test_id uuid not null references tests(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score integer,
  total_questions integer not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'pending_review', 'completed')),
  created_at timestamptz not null default now()
);

-- Prevent a student from having two simultaneous in-progress attempts
-- for the same test.
create unique index if not exists one_active_attempt_per_test
  on attempts (student_id, test_id)
  where status = 'in_progress';

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  question_index integer not null,
  answer text,
  is_correct boolean,
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Eski bazalar uchun: "access" ustunini qo'shadi.
-- Ustun birinchi marta qo'shilayotganda mavjud testlar "allowed" bo'ladi,
-- shunda ular talabalarga ko'rinishda qolaveradi. Qayta ishga tushirilsa hech narsa o'zgarmaydi.
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tests' and column_name = 'access'
  ) then
    alter table public.tests
      add column access text not null default 'locked'
      check (access in ('locked', 'allowed', 'one_time'));
    update public.tests set access = 'allowed';
  end if;
end $$;

-- ------------------------------------------------------------
-- Helper function: is the current user an admin?
-- security definer + owned by the table owner lets this bypass RLS
-- internally, which avoids infinite recursion in the profiles policies.
-- ------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ------------------------------------------------------------
-- Helper function: can the current student start this test?
-- 'allowed'  -> har doim mumkin
-- 'one_time' -> faqat talaba uni hali topshirmagan bo'lsa
-- 'locked'   -> mumkin emas
-- ------------------------------------------------------------

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

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------

alter table profiles enable row level security;
alter table tests enable row level security;
alter table attempts enable row level security;
alter table answers enable row level security;

-- Profiles: a user can read their own profile; admins can read/insert/delete any.
drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_select_admin" on profiles;
create policy "profiles_select_admin" on profiles
  for select using (public.is_admin());

drop policy if exists "profiles_insert_admin" on profiles;
create policy "profiles_insert_admin" on profiles
  for insert with check (public.is_admin());

drop policy if exists "profiles_delete_admin" on profiles;
create policy "profiles_delete_admin" on profiles
  for delete using (public.is_admin());

-- Tests: admins see all; students see only allowed / one-time tests
-- (plus tests they have already attempted, so their past results still open).
drop policy if exists "tests_select_authenticated" on tests;

drop policy if exists "tests_select_admin" on tests;
create policy "tests_select_admin" on tests
  for select using (public.is_admin());

drop policy if exists "tests_select_student" on tests;
create policy "tests_select_student" on tests
  for select using (
    access in ('allowed', 'one_time')
    or exists (select 1 from attempts where attempts.test_id = tests.id and attempts.student_id = auth.uid())
  );

drop policy if exists "tests_update_admin" on tests;
create policy "tests_update_admin" on tests
  for update using (public.is_admin());

drop policy if exists "tests_insert_admin" on tests;
create policy "tests_insert_admin" on tests
  for insert with check (public.is_admin());

drop policy if exists "tests_delete_admin" on tests;
create policy "tests_delete_admin" on tests
  for delete using (public.is_admin());

-- Attempts: a student can read/create/update their own attempts; admins can read/update all.
drop policy if exists "attempts_select_own" on attempts;
create policy "attempts_select_own" on attempts
  for select using (auth.uid() = student_id);

drop policy if exists "attempts_select_admin" on attempts;
create policy "attempts_select_admin" on attempts
  for select using (public.is_admin());

drop policy if exists "attempts_insert_own" on attempts;
create policy "attempts_insert_own" on attempts
  for insert with check (auth.uid() = student_id and public.can_start_test(test_id));

drop policy if exists "attempts_update_own" on attempts;
create policy "attempts_update_own" on attempts
  for update using (auth.uid() = student_id);

drop policy if exists "attempts_update_admin" on attempts;
create policy "attempts_update_admin" on attempts
  for update using (public.is_admin());

-- Answers: a student can read/insert answers for their own attempts; admins can read/update all.
drop policy if exists "answers_select_own" on answers;
create policy "answers_select_own" on answers
  for select using (
    exists (select 1 from attempts where attempts.id = answers.attempt_id and attempts.student_id = auth.uid())
  );

drop policy if exists "answers_select_admin" on answers;
create policy "answers_select_admin" on answers
  for select using (public.is_admin());

drop policy if exists "answers_insert_own" on answers;
create policy "answers_insert_own" on answers
  for insert with check (
    exists (select 1 from attempts where attempts.id = answers.attempt_id and attempts.student_id = auth.uid())
  );

drop policy if exists "answers_update_admin" on answers;
create policy "answers_update_admin" on answers
  for update using (public.is_admin());

-- ============================================================
-- After running this schema, create the admin account:
--
-- 1. In Supabase Dashboard > Authentication > Providers > Email,
--    turn OFF "Confirm email" (so accounts work immediately).
-- 2. Go to Authentication > Users > "Add user":
--      Email:    admin@testplatform.local
--      Password: Otabek1266
--      Toggle "Auto Confirm User" ON.
-- 3. Copy the new user's UID from the users list.
-- 4. Run the statement below, replacing the UID:
--
--    insert into public.profiles (id, username, role)
--    values ('PASTE-UID-HERE', 'admin', 'admin');
--
-- See README.md for the full step-by-step guide.
-- ============================================================

-- API keshini yangilash
notify pgrst, 'reload schema';
