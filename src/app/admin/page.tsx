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
          <h1 className="text-2xl font-bold tracking-tight">Админ</h1>
          <p className="mt-2 text-white/70">
            Синхронизация, команды и управление турниром.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/results"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
          >
            Результаты матчей →
          </Link>
          <Link
            href="/admin/bets"
            className="rounded-lg border border-orange-500/50 px-4 py-2 text-sm font-semibold text-orange-400 hover:bg-orange-500/10"
          >
            Ставки всех команд →
          </Link>
        </div>
      </div>

      {params.synced ? (
        <div className="rounded-lg border border-green-400/40 bg-green-400/10 p-3 text-sm text-green-100">
          Матчи синхронизированы: загружено {params.fetched ?? "?"}, сохранено{" "}
          {params.upserted ?? "?"}.
        </div>
      ) : null}
      {params.recalculated ? (
        <div className="rounded-lg border border-green-400/40 bg-green-400/10 p-3 text-sm text-green-100">
          Очки пересчитаны: сыграно матчей {params.played ?? "?"}, новых
          начислений {params.points ?? "?"}.
        </div>
      ) : null}
      {params.created ? (
        <div className="rounded-lg border border-green-400/40 bg-green-400/10 p-3 text-sm text-green-100">
          Команда создана. Код:{" "}
          <span className="font-mono font-bold">{params.created}</span>
        </div>
      ) : null}
      {params.teamUpdated ? (
        <div className="rounded-lg border border-green-400/40 bg-green-400/10 p-3 text-sm text-green-100">
          Название команды обновлено.
        </div>
      ) : null}
      {params.teamDeleted ? (
        <div className="rounded-lg border border-green-400/40 bg-green-400/10 p-3 text-sm text-green-100">
          Команда удалена.
        </div>
      ) : null}
      {params.error ? (
        <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-sm text-red-100">
          {decodeURIComponent(params.error)}
        </div>
      ) : null}

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold">Синхронизация</h2>
        <div className="mt-2 text-sm text-white/70">
          Матчей в базе: {matchesCount ?? 0}
          <br />
          Блокировка спецставок (1/16):{" "}
          {tournament?.winner_bet_locked_at
            ? formatDateTime(tournament.winner_bet_locked_at)
            : "—"}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={syncWorldCupAction}>
            <button
              type="submit"
              className="rounded-lg bg-orange-500 px-4 py-2 font-semibold text-[#0f2744] hover:bg-orange-400"
            >
              Синхронизировать матчи
            </button>
          </form>
          <form action={recalculatePointsAction}>
            <button
              type="submit"
              className="rounded-lg border border-orange-500/50 px-4 py-2 font-semibold text-orange-400 hover:bg-orange-500/10"
            >
              Пересчитать очки
            </button>
          </form>
        </div>
        <p className="mt-3 text-xs text-white/50">
          Синхронизация загружает данные из football-data.org. Пересчёт начисляет
          очки по текущим результатам в базе.
        </p>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold">Команды</h2>
        <form
          action={createTeamAction}
          className="mt-4 flex flex-col gap-3 md:flex-row md:items-end"
        >
          <label className="flex-1 text-sm text-white/80">
            Код (необязательно)
            <input
              name="code"
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f2744] px-3 py-2"
              placeholder="MARKETING-01"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-orange-500 px-4 py-2 font-semibold text-[#0f2744] hover:bg-orange-400"
          >
            Создать команду
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-3">
          {(teams ?? []).map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-white/10 bg-[#0f2744]/40 p-3"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono text-orange-400">{t.code}</span>
                <span className="text-white/50">·</span>
                <span className="text-white/60">{t.role}</span>
              </div>

              <form
                action={updateTeamNameAction}
                className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end"
              >
                <input type="hidden" name="teamId" value={t.id} />
                <label className="flex-1 text-xs text-white/70">
                  Название
                  <input
                    name="name"
                    defaultValue={t.name ?? ""}
                    className="mt-1 w-full rounded-md border border-white/10 bg-[#0f2744] px-2 py-1.5"
                    required
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-md border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10"
                >
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
