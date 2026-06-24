import { redirect } from "next/navigation";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTournament } from "@/lib/db/tournament";
import { isBettableMatch, MIN_BETTABLE_STAGE_RANK } from "@/lib/betting/stages";
import { groupMatchesForDisplay } from "@/lib/betting/groupMatches";
import {
  getMatchDisplayStatus,
  isBettingOpen,
} from "@/lib/betting/matchStatus";
import { displayTeamName } from "@/lib/betting/teamNames";
import { formatMatchResult } from "@/lib/betting/score";
import { formatDateTime } from "@/lib/formatDateTime";
import { loadTeamTranslations } from "@/lib/db/teamTranslations";
import { MatchBetForm } from "@/app/matches/MatchBetForm";
import { CollapsibleStage } from "@/app/_components/CollapsibleStage";

type MatchRow = {
  id: string;
  stage: string;
  stage_rank: number;
  kickoff_at: string;
  bet_locked_at: string | null;
  status: string;
  home_team_name: string;
  away_team_name: string;
  home_goals: number | null;
  away_goals: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
};

function renderMatchCard(
  m: MatchRow,
  translations: Map<string, string>,
  outcomeByMatch: Map<string, "home" | "away">,
  scoreByMatch: Map<string, { home_goals: number; away_goals: number }>
) {
  const locked = !isBettingOpen(m);
  const selection = outcomeByMatch.get(m.id) ?? null;
  const score = scoreByMatch.get(m.id);
  const homeLabel = displayTeamName(m.home_team_name, "home", translations);
  const awayLabel = displayTeamName(m.away_team_name, "away", translations);
  const displayStatus = getMatchDisplayStatus(m);
  const betDeadline = m.bet_locked_at ?? m.kickoff_at;

  return (
    <section key={m.id} className="card-inner">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            {homeLabel}
            <span className="mx-2 font-normal text-muted">—</span>
            {awayLabel}
          </h3>
          <p className="mt-1 text-sm text-muted">{formatDateTime(m.kickoff_at)}</p>
          {m.status === "PLAYED" ? (
            <p className="mt-1 text-sm text-muted">
              Результат:{" "}
              <span className="text-white/90">{formatMatchResult(m)}</span>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
          <span className={`badge ${displayStatus.badgeClass}`}>
            {displayStatus.label}
          </span>
          {locked ? (
            <span className="badge badge-closed">Закрыто</span>
          ) : (
            <span className="badge badge-open">
              Можно ставить до {formatDateTime(betDeadline)}
            </span>
          )}
        </div>
      </div>

      <MatchBetForm
        matchId={m.id}
        homeTeamName={homeLabel}
        awayTeamName={awayLabel}
        locked={locked}
        initialSelection={selection}
        initialHomeGoals={score?.home_goals ?? 0}
        initialAwayGoals={score?.away_goals ?? 0}
      />
    </section>
  );
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const team = await requireSessionTeam();
  if (!team.name) redirect("/onboarding");

  const params = await searchParams;
  const tournamentId = await getActiveTournament();
  const translations = await loadTeamTranslations(tournamentId);

  const { data: matchesRaw } = await supabaseAdmin
    .from("matches")
    .select(
      "id,stage,stage_rank,kickoff_at,bet_locked_at,status,home_team_name,away_team_name,home_goals,away_goals,home_penalties,away_penalties"
    )
    .eq("tournament_id", tournamentId)
    .gte("stage_rank", MIN_BETTABLE_STAGE_RANK)
    .order("kickoff_at", { ascending: true });

  const matches = (matchesRaw ?? [])
    .filter((m) => isBettableMatch(m as MatchRow))
    .map((m) => m as MatchRow);

  const matchIds = matches.map((m) => m.id);

  let outcomeBets: { match_id: string; selection: "home" | "away" }[] = [];
  if (matchIds.length) {
    const { data } = await supabaseAdmin
      .from("bets_outcome")
      .select("match_id,selection")
      .eq("team_id", team.teamId)
      .in("match_id", matchIds);
    outcomeBets = (data ?? []) as typeof outcomeBets;
  }

  let scoreBets: { match_id: string; home_goals: number; away_goals: number }[] =
    [];
  if (matchIds.length) {
    const { data } = await supabaseAdmin
      .from("bets_exact_score")
      .select("match_id,home_goals,away_goals")
      .eq("team_id", team.teamId)
      .in("match_id", matchIds);
    scoreBets = (data ?? []) as typeof scoreBets;
  }

  const outcomeByMatch = new Map(
    outcomeBets.map((b) => [b.match_id, b.selection])
  );
  const scoreByMatch = new Map(scoreBets.map((b) => [b.match_id, b]));

  const displayGroups = groupMatchesForDisplay(matches);

  function stageBetsComplete(matchIds: string[]) {
    if (!matchIds.length) return true;
    return matchIds.every((id) => outcomeByMatch.has(id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Матчи и ставки</h1>
        <p className="page-desc">
          Выберите исход и точный счёт, затем нажмите «Сохранить ставки».
          Групповой этап — матчи с 26 июня.
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

      {displayGroups.length ? (
        displayGroups.map((group) => {
          if (group.type === "groups") {
            const totalCount = group.children.reduce(
              (sum, child) => sum + child.matches.length,
              0
            );
            const allGroupMatchIds = group.children.flatMap((child) =>
              child.matches.map((m) => m.id)
            );

            return (
              <CollapsibleStage
                key="groups"
                title={group.label}
                count={totalCount}
                betsComplete={stageBetsComplete(allGroupMatchIds)}
              >
                {group.children.map((child) => (
                  <CollapsibleStage
                    key={child.stageKey}
                    title={child.label}
                    count={child.matches.length}
                    variant="nested"
                    betsComplete={stageBetsComplete(
                      child.matches.map((m) => m.id)
                    )}
                  >
                    {child.matches.map((m) =>
                      renderMatchCard(
                        m,
                        translations,
                        outcomeByMatch,
                        scoreByMatch
                      )
                    )}
                  </CollapsibleStage>
                ))}
              </CollapsibleStage>
            );
          }

          return (
            <CollapsibleStage
              key={group.stageKey}
              title={group.label}
              count={group.matches.length}
              betsComplete={stageBetsComplete(group.matches.map((m) => m.id))}
            >
              {group.matches.map((m) =>
                renderMatchCard(
                  m,
                  translations,
                  outcomeByMatch,
                  scoreByMatch
                )
              )}
            </CollapsibleStage>
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
