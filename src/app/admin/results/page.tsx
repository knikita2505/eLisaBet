import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTournament } from "@/lib/db/tournament";
import { MIN_PLAYOFF_STAGE_RANK } from "@/lib/betting/stages";
import { stageLabel } from "@/lib/betting/stageMapping";
import { updateMatchResultAction } from "@/app/_actions/admin";

export default async function AdminResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const team = await requireSessionTeam();
  if (team.role !== "admin") redirect("/matches");

  const params = await searchParams;
  const tournamentId = await getActiveTournament();

  const { data: matches } = await supabaseAdmin
    .from("matches")
    .select(
      "id,stage,kickoff_at,status,home_team_name,away_team_name,home_goals,away_goals"
    )
    .eq("tournament_id", tournamentId)
    .gte("stage_rank", MIN_PLAYOFF_STAGE_RANK)
    .order("kickoff_at", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Ручная правка результатов
          </h1>
          <p className="mt-2 text-white/70">
            Счёт на табло (голы в основное время). После сохранения очки
            начисляются за этот матч автоматически.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-orange-400 hover:text-orange-300"
        >
          ← Админ
        </Link>
      </div>

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

      <div className="flex flex-col gap-4">
        {(matches ?? []).map((m) => (
          <form
            key={m.id}
            action={updateMatchResultAction}
            className="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <input type="hidden" name="matchId" value={m.id} />
            <div className="text-sm text-white/70">{stageLabel(m.stage)}</div>
            <div className="font-semibold">
              {m.home_team_name} — {m.away_team_name}
            </div>
            {m.status === "PLAYED" ? (
              <div className="mt-1 text-xs text-white/50">
                Текущий счёт: {m.home_goals}:{m.away_goals}
              </div>
            ) : (
              <div className="mt-1 text-xs text-orange-400">Ожидается</div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2 max-w-xs">
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
            </div>

            <button
              type="submit"
              className="mt-3 rounded-md bg-orange-500 px-3 py-1.5 text-sm font-semibold text-[#0f2744] hover:bg-orange-400"
            >
              Сохранить результат
            </button>
          </form>
        ))}
        {!matches?.length ? (
          <p className="text-sm text-white/60">
            Нет матчей — сначала запустите синхронизацию в админке.
          </p>
        ) : null}
      </div>
    </div>
  );
}
