-- v2: пол, согласия, мотивация, награды, штрафы (уже применено к проекту verdant)
alter table public.profiles
  add column if not exists gender text check (gender in ('male','female')),
  add column if not exists privacy_at timestamptz,
  add column if not exists motivation text,
  add column if not exists chronotype text,
  add column if not exists why text,
  add column if not exists obstacles text[] not null default '{}',
  add column if not exists penalty_mode text not null default 'soft' check (penalty_mode in ('off','soft','forfeit'));

create table if not exists public.ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ref text not null, kind text not null,
  xp int not null default 0, coins int not null default 0,
  note text, created_at timestamptz not null default now(),
  unique (user_id, ref)
);
create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  emoji text, cost int not null default 50 check (cost >= 0),
  claimed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.penalties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  habit_id uuid references public.habits(id) on delete set null,
  for_date date not null default current_date,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, habit_id, for_date)
);
alter table public.ledger enable row level security;
alter table public.rewards enable row level security;
alter table public.penalties enable row level security;
create policy ledger_own on public.ledger for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy rewards_own on public.rewards for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy penalties_own on public.penalties for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index if not exists ledger_user_idx on public.ledger (user_id, created_at);
create index if not exists rewards_user_idx on public.rewards (user_id);
create index if not exists penalties_user_idx on public.penalties (user_id, for_date);
create index if not exists penalties_habit_idx on public.penalties (habit_id);
