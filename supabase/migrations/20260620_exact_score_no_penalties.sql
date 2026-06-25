-- Точный счёт на табло больше не включает серию пенальти (отдельная ставка).

alter table public.bets_exact_score
  drop constraint if exists bets_exact_score_penalties_rules;

alter table public.bets_exact_score
  add constraint bets_exact_score_penalties_rules
  check (home_penalties is null and away_penalties is null);

update public.bets_exact_score
set home_penalties = null, away_penalties = null
where home_penalties is not null or away_penalties is not null;
