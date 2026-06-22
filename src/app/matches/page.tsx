import { redirect } from "next/navigation";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTournament } from "@/lib/db/tournament";
import { MIN_PLAYOFF_STAGE_RANK } from "@/lib/betting/stages";
import { stageLabel } from "@/lib/betting/stageMapping";
import { formatMatchResult } from "@/lib/betting/score";
import { MatchBetForm } from "@/app/matches/MatchBetForm";

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

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const team = await requireSessionTeam();
  if (!team.name) redirect("/onboarding");

  const params = await searchParams;
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
          Выберите исход и точный счёт, затем нажмите «Сохранить ставки» на
          карточке матча. Ставки принимаются до начала игры.
        </p>
      </div>

      {params.saved ? (
        <div className="alert-success">Ставки сохранены.</div>
      ) : null}
      {params.locked ? (
        <div className="alert-error">Приём ставок на этот матч закрыт.</div>
      ) : null}
      {params.error ? (
        <div className="alert-error">
          Не удалось сохранить. Проверьте, что выбран исход.
        </div>
      ) : null}

      {matches.length ? (
        matches.map((m) => {
          const locked = now >= new Date(m.kickoff_at);
          const selection = outcomeByMatch.get(m.id) ?? null;
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
                  <span
                    className={
                      locked ? "badge badge-closed" : "badge badge-open"
                    }
                  >
                    {locked ? "Закрыто" : "Можно ставить"}
                  </span>
                </div>
              </div>

              <MatchBetForm
                matchId={m.id}
                homeTeamName={m.home_team_name}
                awayTeamName={m.away_team_name}
                locked={locked}
                initialSelection={selection}
                initialHomeGoals={score?.home_goals ?? 0}
                initialAwayGoals={score?.away_goals ?? 0}
              />
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
