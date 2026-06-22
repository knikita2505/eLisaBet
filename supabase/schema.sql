-- eLisaBet schema (чёрновик для Supabase Postgres)

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Команды (отделы)
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text,
  role text not null default 'team' check (role in ('team', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_teams_updated_at on public.teams;
create trigger trg_teams_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

-- Турнир (в MVP один активный турнир)
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  season int not null,
  name text not null,

  -- Блокировка ставок на победителя/3-е место в момент старта 1/16 (R32)
  winner_bet_locked_at timestamptz,
  third_place_bet_locked_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_tournaments_updated_at on public.tournaments;
create trigger trg_tournaments_updated_at
before update on public.tournaments
for each row execute function public.set_updated_at();

-- Матчи ЧМ (только плей-офф, начиная с 1/16 финала)
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,

  external_id bigint not null,
  stage text not null,
  stage_rank int not null,

  kickoff_at timestamptz not null,

  home_team_name text not null,
  away_team_name text not null,

  status text not null default 'SCHEDULED',

  -- Для сыгранных матчей
  home_goals int,
  away_goals int,
  home_penalties int,
  away_penalties int,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tournament_id, external_id)
);

drop trigger if exists trg_matches_updated_at on public.matches;
create trigger trg_matches_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

-- Ставка на исход матча (победа домашней/гостевой; ничьей нет)
create table if not exists public.bets_outcome (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,

  selection text not null check (selection in ('home', 'away')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (team_id, match_id)
);

drop trigger if exists trg_bets_outcome_updated_at on public.bets_outcome;
create trigger trg_bets_outcome_updated_at
before update on public.bets_outcome
for each row execute function public.set_updated_at();

-- Ставка на точный счёт (включая пенальти для случаев, когда счёт в основное время равный)
create table if not exists public.bets_exact_score (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,

  home_goals int not null check (home_goals >= 0 and home_goals <= 10),
  away_goals int not null check (away_goals >= 0 and away_goals <= 10),

  -- Используются только когда home_goals = away_goals (матч мог решиться по пенальти)
  home_penalties int,
  away_penalties int,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (team_id, match_id),
  constraint bets_exact_score_penalties_rules
    check (
      (
        home_goals <> away_goals
        and home_penalties is null
        and away_penalties is null
      )
      or
      (
        home_goals = away_goals
        and home_penalties is not null
        and away_penalties is not null
        and home_penalties <> away_penalties
      )
    )
);

drop trigger if exists trg_bets_exact_score_updated_at on public.bets_exact_score;
create trigger trg_bets_exact_score_updated_at
before update on public.bets_exact_score
for each row execute function public.set_updated_at();

-- Ставка на победителя ЧМ
create table if not exists public.bets_champion (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,

  pick_country text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (team_id, tournament_id)
);

drop trigger if exists trg_bets_champion_updated_at on public.bets_champion;
create trigger trg_bets_champion_updated_at
before update on public.bets_champion
for each row execute function public.set_updated_at();

-- Ставка на 3-е место
create table if not exists public.bets_third_place (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,

  pick_country text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (team_id, tournament_id)
);

drop trigger if exists trg_bets_third_place_updated_at on public.bets_third_place;
create trigger trg_bets_third_place_updated_at
before update on public.bets_third_place
for each row execute function public.set_updated_at();

-- Лог начисленных очков (для лидерборда)
create table if not exists public.team_points_ledger (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,

  bet_type text not null check (
    bet_type in ('match_outcome', 'match_exact_score', 'champion', 'third_place')
  ),

  bet_id uuid not null,
  match_id uuid,

  points int not null,

  created_at timestamptz not null default now(),

  unique (team_id, bet_type, bet_id)
);

-- Участники турнира (для спецставок)
create table if not exists public.tournament_teams (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_name text not null,
  primary key (tournament_id, team_name)
);

