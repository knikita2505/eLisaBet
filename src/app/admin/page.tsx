import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTournament } from "@/lib/db/tournament";
import {
  createTeamAction,
  deleteTeamAction,
  syncWorldCupAction,
  updateMatchResultAction,
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Админ</h1>
          <p className="mt-2 text-white/70">
            Синхронизация, команды и ручная правка результатов.
          </p>
        </div>
        <Link
          href="/admin/bets"
          className="rounded-lg border border-orange-500/50 px-4 py-2 text-sm font-semibold text-orange-400 hover:bg-orange-500/10"
        >
          Ставки всех команд →
        </Link>
      </div>

      {params.ok ? (
        <div className="rounded-lg border border-green-400/40 bg-green-400/10 p-3 text-sm text-green-100">
          Синхронизация: загружено {params.fetched ?? "?"}, сохранено{" "}
          {params.upserted ?? "?"}, сыграно {params.played ?? "?"}, новых
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
      {params.updated ? (
        <div className="rounded-lg border border-green-400/40 bg-green-400/10 p-3 text-sm text-green-100">
          Результат матча обновлён.
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
        <form action={syncWorldCupAction} className="mt-4">
          <button
            type="submit"
            className="rounded-lg bg-orange-500 px-4 py-2 font-semibold text-[#0f2744] hover:bg-orange-400"
          >
            Синхронизировать матчи и пересчитать очки
          </button>
        </form>
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

      <AdminMatchResults tournamentId={tournamentId} />
    </div>
  );
}

async function AdminMatchResults({ tournamentId }: { tournamentId: string }) {
  const { MIN_PLAYOFF_STAGE_RANK } = await import("@/lib/betting/stages");
  const { stageLabel } = await import("@/lib/betting/stageMapping");

  const { data: matches } = await supabaseAdmin
    .from("matches")
    .select(
      "id,stage,kickoff_at,status,home_team_name,away_team_name,home_goals,away_goals,home_penalties,away_penalties"
    )
    .eq("tournament_id", tournamentId)
    .gte("stage_rank", MIN_PLAYOFF_STAGE_RANK)
    .order("kickoff_at", { ascending: true });

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="text-lg font-semibold">Ручная правка результатов</h2>
      <p className="mt-1 text-sm text-white/60">
        Счёт на табло + пенальти (только для определения победителя при ничьей).
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {(matches ?? []).map((m) => (
          <form
            key={m.id}
            action={updateMatchResultAction}
            className="rounded-lg border border-white/10 bg-[#0f2744]/40 p-3"
          >
            <input type="hidden" name="matchId" value={m.id} />
            <div className="text-sm text-white/70">{stageLabel(m.stage)}</div>
            <div className="font-semibold">
              {m.home_team_name} — {m.away_team_name}
            </div>

            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              <label className="text-xs text-white/70">
                {m.home_team_name}
                <input
                  name="homeGoals"
                  type="number"
                  min={0}
                  defaultValue={m.home_goals ?? 0}
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f2744] px-2 py-1"
                />
              </label>
              <label className="text-xs text-white/70">
                {m.away_team_name}
                <input
                  name="awayGoals"
                  type="number"
                  min={0}
                  defaultValue={m.away_goals ?? 0}
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f2744] px-2 py-1"
                />
              </label>
              <label className="text-xs text-white/70">
                Пен. {m.home_team_name}
                <input
                  name="homePenalties"
                  type="number"
                  min={0}
                  defaultValue={m.home_penalties ?? ""}
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f2744] px-2 py-1"
                />
              </label>
              <label className="text-xs text-white/70">
                Пен. {m.away_team_name}
                <input
                  name="awayPenalties"
                  type="number"
                  min={0}
                  defaultValue={m.away_penalties ?? ""}
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f2744] px-2 py-1"
                />
              </label>
            </div>

            <button
              type="submit"
              className="mt-3 rounded-md bg-orange-500 px-3 py-1.5 text-sm font-semibold text-[#0f2744]"
            >
              Сохранить результат
            </button>
          </form>
        ))}
        {!matches?.length ? (
          <p className="text-sm text-white/60">Нет матчей — запустите синхронизацию.</p>
        ) : null}
      </div>
    </section>
  );
}
