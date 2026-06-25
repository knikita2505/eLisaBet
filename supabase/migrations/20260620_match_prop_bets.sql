-- Ставки: обе команды забьют + серия пенальти

create table if not exists public.bets_both_teams_score (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  selection text not null check (selection in ('yes', 'no')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, match_id)
);

drop trigger if exists trg_bets_both_teams_score_updated_at on public.bets_both_teams_score;
create trigger trg_bets_both_teams_score_updated_at
before update on public.bets_both_teams_score
for each row execute function public.set_updated_at();

create table if not exists public.bets_penalty_shootout (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  selection text not null check (selection in ('yes', 'no')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, match_id)
);

drop trigger if exists trg_bets_penalty_shootout_updated_at on public.bets_penalty_shootout;
create trigger trg_bets_penalty_shootout_updated_at
before update on public.bets_penalty_shootout
for each row execute function public.set_updated_at();

alter table public.team_points_ledger
  drop constraint if exists team_points_ledger_bet_type_check;

alter table public.team_points_ledger
  add constraint team_points_ledger_bet_type_check
  check (
    bet_type in (
      'match_outcome',
      'match_exact_score',
      'match_both_teams_score',
      'match_penalty_shootout',
      'champion',
      'third_place'
    )
  );
