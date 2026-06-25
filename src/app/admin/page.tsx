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
import { FormLoadingOverlay } from "@/app/_components/FormLoadingOverlay";
import { formatDateTime } from "@/lib/formatDateTime";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const team = await requireSessionTeam();
  if (team.role !== "admin") redirect("/matches");

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
            Синхронизация, участники и управление турниром.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/results" className="btn-ghost">
            Редактировать матчи →
          </Link>
          <Link href="/admin/bets" className="btn-outline">
            Ставки всех участников →
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
          Участник создан. Код:{" "}
          <span className="font-mono font-bold">{params.created}</span>
        </div>
      ) : null}
      {params.teamUpdated ? (
        <div className="alert-success">Имя участника обновлено.</div>
      ) : null}
      {params.teamDeleted ? (
        <div className="alert-success">Участник удалён.</div>
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
            <FormLoadingOverlay />
            <button type="submit" className="btn-primary">
              Синхронизировать матчи
            </button>
          </form>
          <form action={recalculatePointsAction}>
            <FormLoadingOverlay />
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
        <h2 className="section-title">Участники</h2>
        <form
          action={createTeamAction}
          className="mt-4 flex flex-col gap-3 md:flex-row md:items-end"
        >
          <label className="label flex-1">
            Имя
            <input
              name="name"
              className="input"
              placeholder="Например: Иван Петров"
              required
            />
          </label>
          <button type="submit" className="btn-primary">
            Создать участника
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-3">
          {(teams ?? []).map((t) => (
            <div key={t.id} className="card-inner relative pr-10">
              {t.role !== "admin" ? (
                <form action={deleteTeamAction} className="absolute right-2 top-2">
                  <input type="hidden" name="teamId" value={t.id} />
                  <button
                    type="submit"
                    aria-label="Удалить участника"
                    className="rounded-md p-1.5 text-red-300/80 hover:bg-red-500/10 hover:text-red-200"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-4 w-4"
                      aria-hidden
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 9.24A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-9.24.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.492.15l.375 3.75a.75.75 0 101.492-.15l-.375-3.75zm4.34.15a.75.75 0 10-1.492-.15l-.375 3.75a.75.75 0 101.492.15l.375-3.75z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </form>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-white/90">
                  {t.name ?? "—"}
                </span>
                <span className="text-muted">·</span>
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
                  Имя
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
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
