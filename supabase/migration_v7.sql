-- ============================================================
-- Yangiariq Yuridik Senter — v7 yangilanishi
--   1) Qoidabuzarlik kodi endi kerak emas (ustun ixtiyoriy bo'ladi)
--   2) app_settings: "Avtomatik ruxsat" sozlamasi
--   3) grade_answer(): savol bo'yicha tekshirishda bitta javobni baholaydi va
--      talabaning barcha javoblari tekshirilgan bo'lsa, yakuniy ballni hisoblaydi
-- Supabase > SQL Editor ga to'liq joylab, bir marta Run bosing.
-- Qayta ishga tushirsangiz ham xavfsiz (ma'lumot o'chmaydi).
-- ============================================================

-- 1) Kod ustuni ixtiyoriy
alter table public.violations alter column code drop not null;

-- 2) Sozlamalar
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select" on public.app_settings;
create policy "app_settings_select" on public.app_settings
  for select using (auth.uid() is not null);

drop policy if exists "app_settings_admin_write" on public.app_settings;
create policy "app_settings_admin_write" on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.app_settings (key, value) values ('auto_allow', 'false')
  on conflict (key) do nothing;

-- 3) Bitta javobni baholash. Agar talabaning barcha javoblari tekshirilgan bo'lsa,
--    ball hisoblanadi, holat "completed" bo'ladi va talabaga "Yangi natija" belgisi chiqadi.
--    Qaytaradi: true = shu baholash talabaning ishini to'liq yakunladi.
create or replace function public.grade_answer(p_answer_id uuid, p_correct boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt uuid;
  v_status text;
  v_left integer;
begin
  if not public.is_admin() then
    raise exception 'Faqat administrator';
  end if;

  update public.answers
    set is_correct = p_correct, reviewed = true
    where id = p_answer_id
    returning attempt_id into v_attempt;

  if v_attempt is null then
    raise exception 'Javob topilmadi';
  end if;

  select status into v_status from public.attempts where id = v_attempt;
  select count(*) into v_left from public.answers where attempt_id = v_attempt and reviewed = false;

  if v_left = 0 and v_status in ('pending_review', 'completed') then
    update public.attempts
      set score = (select count(*) from public.answers where attempt_id = v_attempt and is_correct is true),
          status = 'completed',
          result_seen = case when v_status = 'pending_review' then false else result_seen end
      where id = v_attempt;
    return v_status = 'pending_review';
  end if;

  return false;
end;
$$;

grant execute on function public.grade_answer(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
