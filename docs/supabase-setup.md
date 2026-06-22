# Supabase: настройка eLisaBet

## 1) Создайте проект
Создайте Supabase project и откройте **Project Settings → Database → Connection string** (или просто возьмите `SUPABASE_URL` и `ANON_KEY`).

## 2) Примените схему
В **SQL Editor** выполните содержимое файла:
`supabase/schema.sql`

После этого у вас будут таблицы:
- `teams`
- `tournaments`
- `matches`
- `bets_outcome`
- `bets_exact_score`
- `bets_champion`
- `bets_third_place`
- `team_points_ledger`
- `tournament_teams` (участники ЧМ для спецставок)

## 3) Создайте турнир
Выполните (замените при необходимости):
```sql
insert into public.tournaments (slug, season, name)
values ('wc2026', 2026, 'ЧМ 2026')
on conflict (slug) do nothing;
```

## 4) Создайте хотя бы одного админа (команду)
Админ — это команда с `role = 'admin'`.

Выполните:
```sql
insert into public.teams (code, name, role)
values ('ADMIN_CODE', 'Админ', 'admin')
on conflict (code) do nothing;
```

Замените `ADMIN_CODE` на реальный уникальный код и запомните его — он нужен для входа.

Если схема уже была применена ранее, добавьте таблицу участников:
```sql
create table if not exists public.tournament_teams (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_name text not null,
  primary key (tournament_id, team_name)
);
```

## 5) Настройте переменные окружения в Next.js
Добавьте в `.env.local`:
```bash
# Project URL из Settings → API (только домен, без /rest/v1/)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

SESSION_SECRET=... # секрет для подписи cookie-JWT

FOOTBALL_DATA_API_KEY=... # ключ football-data.org
FOOTBALL_DATA_COMPETITION_CODE=WC
FOOTBALL_DATA_SEASON=2026

# По желанию (для cron-синхронизации)
CRON_SECRET=...
ADMIN_SECRET=... # если понадобятся отдельные защиты (опционально)
```

## 6) Запуск синхронизации матчей
После того как реализуем endpoint синка, можно будет делать обновления по `CRON_SECRET`.

