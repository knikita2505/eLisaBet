import { redirect } from "next/navigation";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTournament } from "@/lib/db/tournament";
import { MIN_PLAYOFF_STAGE_RANK } from "@/lib/betting/stages";
import { stageLabel } from "@/lib/betting/stageMapping";
import { formatMatchResult } from "@/lib/betting/score";
import { setMatchExactScoreBetAction, setMatchOutcomeBetAction } from "@/app/_actions/bets";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

type MatchRow = {
  id: string;
  stage: string;
  stage_rank: number;
  kickoff_at: string;
  status: string;
  home_team_name: string;
  away_team_name: string;
  home_goals: number | null;
  away_goals: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
};

type OutcomeBetRow = {
  match_id: string;
  selection: "home" | "away";
};

type ExactScoreBetRow = {
  match_id: string;
  home_goals: number;
  away_goals: number;
};

export default async function MatchesPage() {
  const team = await requireSessionTeam();
  if (!team.name) redirect("/onboarding");

  const tournamentId = await getActiveTournament();

  const { data: matchesRaw } = await supabaseAdmin
    .from("matches")
    .select(
      "id,stage,stage_rank,kickoff_at,status,home_team_name,away_team_name,home_goals,away_goals,home_penalties,away_penalties"
    )
    .eq("tournament_id", tournamentId)
    .gte("stage_rank", MIN_PLAYOFF_STAGE_RANK)
    .order("kickoff_at", { ascending: true });

  const matches = (matchesRaw ?? []) as MatchRow[];
  const matchIds = matches.map((m) => m.id);

  let outcomeBets: OutcomeBetRow[] = [];
  if (matchIds.length) {
    const { data } = await supabaseAdmin
      .from("bets_outcome")
      .select("match_id,selection")
      .eq("team_id", team.teamId)
      .in("match_id", matchIds);
    outcomeBets = (data ?? []) as OutcomeBetRow[];
  }

  let scoreBets: ExactScoreBetRow[] = [];
  if (matchIds.length) {
    const { data } = await supabaseAdmin
      .from("bets_exact_score")
      .select("match_id,home_goals,away_goals")
      .eq("team_id", team.teamId)
      .in("match_id", matchIds);
    scoreBets = (data ?? []) as ExactScoreBetRow[];
  }

  const now = new Date();

  const outcomeByMatch = new Map<string, OutcomeBetRow["selection"]>(
    outcomeBets.map((b) => [b.match_id, b.selection])
  );
  const scoreByMatch = new Map<string, ExactScoreBetRow>(
    scoreBets.map((b) => [b.match_id, b])
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Матчи и ставки</h1>
        <p className="page-desc">
          Ставки принимаются до начала каждого матча. Точный счёт — голы на
          табло после окончания матча.
        </p>
      </div>

      {matches.length ? (
        matches.map((m) => {
          const locked = now >= new Date(m.kickoff_at);
          const selection = outcomeByMatch.get(m.id);
          const score = scoreByMatch.get(m.id);

          return (
            <section key={m.id} className="card-padded">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="badge badge-type">{stageLabel(m.stage)}</span>
                  <div className="mt-2 text-lg font-semibold tracking-tight">
                    {m.home_team_name}
                    <span className="mx-2 font-normal text-muted">—</span>
                    {m.away_team_name}
                  </div>
                  {m.status !== "SCHEDULED" ? (
                    <div className="mt-1.5 text-sm text-muted">
                      Результат:{" "}
                      <span className="text-white/90">
                        {formatMatchResult(m)}
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
                  <span className="text-sm text-muted">
                    {formatDateTime(m.kickoff_at)}
                  </span>
                  <span className={locked ? "badge badge-closed" : "badge badge-open"}>
                    {locked ? "Закрыто" : "Можно ставить"}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="card-inner">
                  <div className="section-title">Исход</div>
                  <p className="mt-1 text-xs text-muted">+1 очко за верный прогноз</p>
                  <form
                    action={setMatchOutcomeBetAction}
                    className="mt-3 flex flex-col gap-2"
                  >
                    <input type="hidden" name="matchId" value={m.id} />

                    <button
                      type="submit"
                      name="selection"
                      value="home"
                      disabled={locked}
                      className={
                        selection === "home" ? "bet-btn-active" : "bet-btn"
                      }
                    >
                      Победа: {m.home_team_name}
                    </button>
                    <button
                      type="submit"
                      name="selection"
                      value="away"
                      disabled={locked}
                      className={
                        selection === "away" ? "bet-btn-active" : "bet-btn"
                      }
                    >
                      Победа: {m.away_team_name}
                    </button>
                  </form>
                </div>

                <div className="card-inner">
                  <div className="section-title">Точный счёт</div>
                  <p className="mt-1 text-xs text-muted">+2 очка (+3 с исходом)</p>

                  <form
                    action={setMatchExactScoreBetAction}
                    className="mt-3 grid grid-cols-2 gap-2"
                  >
                    <input type="hidden" name="matchId" value={m.id} />

                    <label className="label-sm">
                      {m.home_team_name}
                      <select
                        name="homeGoals"
                        defaultValue={score?.home_goals ?? 0}
                        disabled={locked}
                        className="select"
                      >
                        {Array.from({ length: 8 }).map((_, i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="label-sm">
                      {m.away_team_name}
                      <select
                        name="awayGoals"
                        defaultValue={score?.away_goals ?? 0}
                        disabled={locked}
                        className="select"
                      >
                        {Array.from({ length: 8 }).map((_, i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="submit"
                      disabled={locked}
                      className="btn-primary col-span-2 mt-1"
                    >
                      Сохранить
                    </button>
                  </form>
                </div>
              </div>
            </section>
          );
        })
      ) : (
        <div className="card-padded text-muted">
          Пока нет данных матчей. Админу нужно синхронизировать расписание.
        </div>
      )}
    </div>
  );
}
