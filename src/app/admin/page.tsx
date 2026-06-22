import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTournament } from "@/lib/db/tournament";
import {
  createTeamAction,
  deleteTeamAction,
  recalculatePointsAction,
  syncWorldCupAction,
  updateTeamNameAction,
} from "@/app/_actions/admin";

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const team = await requireSessionTeam();
  if (team.role !== "admin") redirect("/matches");
  if (!team.name) redirect("/onboarding");

  const params = await searchParams;
  const tournamentId = await getActiveTournament();

  const { data: tournament } = await supabaseAdmin
    .from("tournaments")
    .select("winner_bet_locked_at,third_place_bet_locked_at,season,name")
    .eq("id", tournamentId)
    .single();

  const { count: matchesCount } = await supabaseAdmin
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  const { data: teams } = await supabaseAdmin
    .from("teams")
    .select("id,code,name,role,created_at")
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Админ</h1>
          <p className="page-desc">
            Синхронизация, команды и управление турниром.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/results" className="btn-ghost">
            Результаты матчей →
          </Link>
          <Link href="/admin/bets" className="btn-outline">
            Ставки всех команд →
          </Link>
        </div>
      </div>

      {params.synced ? (
        <div className="alert-success">
          Матчи синхронизированы: загружено {params.fetched ?? "?"}, сохранено{" "}
          {params.upserted ?? "?"}.
        </div>
      ) : null}
      {params.recalculated ? (
        <div className="alert-success">
          Очки пересчитаны: сыграно матчей {params.played ?? "?"}, новых
          начислений {params.points ?? "?"}.
        </div>
      ) : null}
      {params.created ? (
        <div className="alert-success">
          Команда создана. Код:{" "}
          <span className="font-mono font-bold">{params.created}</span>
        </div>
      ) : null}
      {params.teamUpdated ? (
        <div className="alert-success">Название команды обновлено.</div>
      ) : null}
      {params.teamDeleted ? (
        <div className="alert-success">Команда удалена.</div>
      ) : null}
      {params.error ? (
        <div className="alert-error">{decodeURIComponent(params.error)}</div>
      ) : null}

      <section className="card-padded">
        <h2 className="section-title">Синхронизация</h2>
        <div className="mt-2 text-sm text-muted">
          Матчей в базе: <span className="text-white/90">{matchesCount ?? 0}</span>
          <br />
          Блокировка спецставок (1/16):{" "}
          {tournament?.winner_bet_locked_at
            ? formatDateTime(tournament.winner_bet_locked_at)
            : "—"}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={syncWorldCupAction}>
            <button type="submit" className="btn-primary">
              Синхронизировать матчи
            </button>
          </form>
          <form action={recalculatePointsAction}>
            <button type="submit" className="btn-outline">
              Пересчитать очки
            </button>
          </form>
        </div>
        <p className="mt-3 text-xs text-muted">
          Синхронизация загружает данные из football-data.org. Пересчёт начисляет
          очки по текущим результатам в базе.
        </p>
      </section>

      <section className="card-padded">
        <h2 className="section-title">Команды</h2>
        <form
          action={createTeamAction}
          className="mt-4 flex flex-col gap-3 md:flex-row md:items-end"
        >
          <label className="label flex-1">
            Код (необязательно)
            <input
              name="code"
              className="input"
              placeholder="MARKETING-01"
            />
          </label>
          <button type="submit" className="btn-primary">
            Создать команду
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-3">
          {(teams ?? []).map((t) => (
            <div key={t.id} className="card-inner">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono text-accent">{t.code}</span>
                <span className="text-muted">·</span>
                <span className="text-muted">{t.role}</span>
              </div>

              <form
                action={updateTeamNameAction}
                className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end"
              >
                <input type="hidden" name="teamId" value={t.id} />
                <label className="label-sm flex-1">
                  Название
                  <input
                    name="name"
                    defaultValue={t.name ?? ""}
                    className="input"
                    required
                  />
                </label>
                <button type="submit" className="btn-ghost">
                  Сохранить
                </button>
              </form>

              {t.role !== "admin" ? (
                <form action={deleteTeamAction} className="mt-2">
                  <input type="hidden" name="teamId" value={t.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-300 hover:text-red-200"
                  >
                    Удалить команду
                  </button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
