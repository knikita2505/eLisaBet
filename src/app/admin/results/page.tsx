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
          <h1 className="page-title">Ручная правка результатов</h1>
          <p className="page-desc">
            Счёт на табло (голы в основное время). После сохранения очки
            начисляются за этот матч автоматически.
          </p>
        </div>
        <Link href="/admin" className="link-back">
          ← Админ
        </Link>
      </div>

      {params.updated ? (
        <div className="alert-success">Результат матча обновлён.</div>
      ) : null}
      {params.error ? (
        <div className="alert-error">{decodeURIComponent(params.error)}</div>
      ) : null}

      <div className="flex flex-col gap-4">
        {(matches ?? []).map((m) => (
          <form key={m.id} action={updateMatchResultAction} className="card-padded">
            <input type="hidden" name="matchId" value={m.id} />
            <span className="badge badge-type">{stageLabel(m.stage)}</span>
            <div className="mt-2 font-semibold">
              {m.home_team_name} — {m.away_team_name}
            </div>
            {m.status === "PLAYED" ? (
              <div className="mt-1 text-xs text-muted">
                Текущий счёт: {m.home_goals}:{m.away_goals}
              </div>
            ) : (
              <div className="mt-1">
                <span className="badge badge-open">Ожидается</span>
              </div>
            )}

            <div className="mt-3 grid max-w-xs grid-cols-2 gap-2">
              <label className="label-sm">
                {m.home_team_name}
                <input
                  name="homeGoals"
                  type="number"
                  min={0}
                  defaultValue={m.home_goals ?? 0}
                  className="input"
                />
              </label>
              <label className="label-sm">
                {m.away_team_name}
                <input
                  name="awayGoals"
                  type="number"
                  min={0}
                  defaultValue={m.away_goals ?? 0}
                  className="input"
                />
              </label>
            </div>

            <button type="submit" className="btn-primary mt-3">
              Сохранить результат
            </button>
          </form>
        ))}
        {!matches?.length ? (
          <p className="text-sm text-muted">
            Нет матчей — сначала запустите синхронизацию в админке.
          </p>
        ) : null}
      </div>
    </div>
  );
}
