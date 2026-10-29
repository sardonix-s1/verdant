-- VERDANT: схема базы (уже применена к проекту verdant). Используется как резервная копия схемы.
-- Для восстановления в новом проекте Supabase: SQL Editor -> вставить файл целиком -> Run.

-- ===== Allowlist (закрытый доступ) =====
create table public.allowed_emails (
  email text primary key,
  note text,
  created_at timestamptz not null default now(),
  constraint allowed_emails_lower check (email = lower(email))
);
alter table public.allowed_emails enable row level security;
-- политик нет: клиенты (anon/authenticated) не могут читать и писать эту таблицу
revoke all on public.allowed_emails from anon, authenticated;

-- Шлюз: ни один пользователь auth не создаётся, если его email не в allowlist
create or replace function public.enforce_email_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or not exists (
    select 1 from public.allowed_emails a where a.email = lower(new.email)
  ) then
    raise exception 'Доступ только по приглашению' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_email_allowlist() from public, anon, authenticated;

create trigger trg_enforce_email_allowlist
  before insert on auth.users
  for each row execute function public.enforce_email_allowlist();

-- ===== Таблицы =====
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  age_group text,
  height_cm numeric,
  weight_kg numeric,
  interests text[] not null default '{}',
  focus_areas text[] not null default '{}',
  wake_time time,
  sleep_time time,
  free_windows text,
  daily_minutes int not null default 20,
  reminder_style text not null default 'gentle',
  intensity text not null default 'light',
  notif_enabled boolean not null default false,
  consent_at timestamptz,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  horizon int not null check (horizon in (30, 90)),
  area text,
  text text not null,
  created_at timestamptz not null default now()
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  kind text not null default 'good' check (kind in ('good','quit','task','goal')),
  frequency text not null default 'daily' check (frequency in ('daily','weekdays','times_per_week')),
  weekdays int[] not null default '{0,1,2,3,4,5,6}',
  times_per_week int,
  target numeric,
  unit text,
  reminder_time time,
  start_date date not null default current_date,
  status text not null default 'active' check (status in ('active','archived')),
  reason text,
  created_at timestamptz not null default now()
);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  log_date date not null,
  done boolean not null default true,
  value numeric,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_number int not null check (day_number between 1 and 30),
  title text not null,
  area text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_date date not null default current_date,
  body text not null,
  created_at timestamptz not null default now()
);

create index on public.goals (user_id);
create index on public.habits (user_id);
create index on public.habit_logs (user_id, log_date);
create index on public.habit_logs (habit_id);
create index on public.plan_items (user_id);
create index on public.notes (user_id);

-- ===== RLS: каждый видит и меняет только свои строки =====
do $$
declare t text;
begin
  foreach t in array array['profiles','goals','habits','habit_logs','plan_items','notes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy "own rows select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- отметка может ссылаться только на привычку её владельца
create or replace function public.check_log_owner()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from public.habits h where h.id = new.habit_id and h.user_id = new.user_id) then
    raise exception 'habit does not belong to user';
  end if;
  return new;
end $$;
create trigger trg_check_log_owner before insert or update on public.habit_logs
  for each row execute function public.check_log_owner();

-- ===== Автосоздание профиля =====
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger trg_on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== Удаление своего аккаунта (+ все данные через cascade) =====
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
