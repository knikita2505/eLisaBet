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
import {
  MatchesBetBoard,
  type MatchBetItem,
  type MatchesDisplayGroup,
} from "@/app/matches/MatchesBetBoard";

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

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const team = await requireSessionTeam();
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
  let bttsBets: { match_id: string; selection: "yes" | "no" }[] = [];
  let shootoutBets: { match_id: string; selection: "yes" | "no" }[] = [];

  if (matchIds.length) {
    const { data } = await supabaseAdmin
      .from("bets_exact_score")
      .select("match_id,home_goals,away_goals")
      .eq("team_id", team.teamId)
      .in("match_id", matchIds);
    scoreBets = (data ?? []) as typeof scoreBets;

    const { data: bttsData } = await supabaseAdmin
      .from("bets_both_teams_score")
      .select("match_id,selection")
      .eq("team_id", team.teamId)
      .in("match_id", matchIds);
    bttsBets = (bttsData ?? []) as typeof bttsBets;

    const { data: shootoutData } = await supabaseAdmin
      .from("bets_penalty_shootout")
      .select("match_id,selection")
      .eq("team_id", team.teamId)
      .in("match_id", matchIds);
    shootoutBets = (shootoutData ?? []) as typeof shootoutBets;
  }

  const outcomeByMatch = new Map(
    outcomeBets.map((b) => [b.match_id, b.selection])
  );
  const scoreByMatch = new Map(scoreBets.map((b) => [b.match_id, b]));
  const bttsByMatch = new Map(bttsBets.map((b) => [b.match_id, b.selection]));
  const shootoutByMatch = new Map(
    shootoutBets.map((b) => [b.match_id, b.selection])
  );

  const matchesById: Record<string, MatchBetItem> = {};
  for (const m of matches) {
    const homeLabel = displayTeamName(m.home_team_name, "home", translations);
    const awayLabel = displayTeamName(m.away_team_name, "away", translations);
    const displayStatus = getMatchDisplayStatus(m);
    const score = scoreByMatch.get(m.id);

    matchesById[m.id] = {
      id: m.id,
      homeLabel,
      awayLabel,
      kickoffLabel: formatDateTime(m.kickoff_at),
      statusLabel: displayStatus.label,
      statusBadgeClass: displayStatus.badgeClass,
      locked: !isBettingOpen(m),
      betDeadlineLabel: formatDateTime(m.bet_locked_at ?? m.kickoff_at),
      resultLabel: m.status === "PLAYED" ? formatMatchResult(m) : null,
      initialSelection: outcomeByMatch.get(m.id) ?? null,
      initialHasExactScore: Boolean(score),
      initialHomeGoals: score?.home_goals ?? 0,
      initialAwayGoals: score?.away_goals ?? 0,
      initialBothTeamsScore: bttsByMatch.get(m.id) ?? null,
      initialPenaltyShootout: shootoutByMatch.get(m.id) ?? null,
    };
  }

  const displayGroups: MatchesDisplayGroup[] = groupMatchesForDisplay(
    matches
  ).map((group) => {
    if (group.type === "groups") {
      return {
        type: "groups" as const,
        label: group.label,
        children: group.children.map((child) => ({
          stageKey: child.stageKey,
          label: child.label,
          matchIds: child.matches.map((m) => m.id),
        })),
      };
    }

    return {
      type: "stage" as const,
      stageKey: group.stageKey,
      label: group.label,
      matchIds: group.matches.map((m) => m.id),
    };
  });

  const savedOutcomeByMatch = Object.fromEntries(outcomeByMatch);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Матчи и ставки</h1>
        <p className="page-desc">
          Выберите исход, точный счёт и дополнительные ставки по матчам, затем
          нажмите «Сохранить ставки» внизу экрана. Групповой этап — матчи с 26
          июня.
        </p>
      </div>

      {params.saved ? (
        <div className="alert-success">Ставки сохранены.</div>
      ) : null}
      {params.locked ? (
        <div className="alert-error">Приём ставок на этот матч закрыт.</div>
      ) : null}
      {params.error === "conflict" ? (
        <div className="alert-error">
          Не удалось сохранить: ставки противоречат друг другу. Проверьте исход,
          точный счёт, «обе забьют» и «серию пенальти».
        </div>
      ) : params.error === "no_outcome" ? (
        <div className="alert-error">
          Не удалось сохранить: для каждого изменённого матча нужно выбрать
          исход.
        </div>
      ) : params.error ? (
        <div className="alert-error">
          Не удалось сохранить: {decodeURIComponent(params.error)}
        </div>
      ) : null}

      {displayGroups.length ? (
        <MatchesBetBoard
          displayGroups={displayGroups}
          matchesById={matchesById}
          savedOutcomeByMatch={savedOutcomeByMatch}
        />
      ) : (
        <div className="card-padded text-muted">
          Пока нет данных матчей. Админу нужно синхронизировать расписание.
        </div>
      )}
    </div>
  );
}
