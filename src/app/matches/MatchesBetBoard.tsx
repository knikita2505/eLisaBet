"use client";

import { useMemo, useState, useTransition } from "react";
import { CollapsibleStage } from "@/app/_components/CollapsibleStage";
import { setAllMatchBetsAction } from "@/app/_actions/bets";
import { getMatchBetConflictMessage } from "@/lib/betting/betValidation";
import type { YesNoSelection } from "@/lib/betting/matchProps";
import { LoadingOverlay } from "@/app/_components/LoadingOverlay";
import { MatchBetCard } from "@/app/matches/MatchBetCard";

export type MatchBetItem = {
  id: string;
  homeLabel: string;
  awayLabel: string;
  kickoffLabel: string;
  statusLabel: string;
  statusBadgeClass: string;
  locked: boolean;
  betDeadlineLabel: string;
  resultLabel: string | null;
  initialSelection: "home" | "away" | null;
  initialHasExactScore: boolean;
  initialHomeGoals: number;
  initialAwayGoals: number;
  initialBothTeamsScore: YesNoSelection | null;
  initialPenaltyShootout: YesNoSelection | null;
};

export type MatchesDisplayGroup =
  | {
      type: "groups";
      label: string;
      children: { stageKey: string; label: string; matchIds: string[] }[];
    }
  | {
      type: "stage";
      stageKey: string;
      label: string;
      matchIds: string[];
    };

type BetState = {
  selection: "home" | "away" | null;
  homeGoals: number;
  awayGoals: number;
  hasExactScore: boolean;
  bothTeamsScore: YesNoSelection | null;
  penaltyShootout: YesNoSelection | null;
  locked: boolean;
  initialSelection: "home" | "away" | null;
  initialHasExactScore: boolean;
  initialHomeGoals: number;
  initialAwayGoals: number;
  initialBothTeamsScore: YesNoSelection | null;
  initialPenaltyShootout: YesNoSelection | null;
};

type Props = {
  displayGroups: MatchesDisplayGroup[];
  matchesById: Record<string, MatchBetItem>;
  savedOutcomeByMatch: Record<string, "home" | "away">;
};

function stageBetsComplete(
  matchIds: string[],
  saved: Record<string, "home" | "away">
) {
  if (!matchIds.length) return true;
  return matchIds.every((id) => id in saved);
}

function betIsDirty(bet: BetState) {
  return (
    bet.selection !== bet.initialSelection ||
    bet.hasExactScore !== bet.initialHasExactScore ||
    bet.homeGoals !== bet.initialHomeGoals ||
    bet.awayGoals !== bet.initialAwayGoals ||
    bet.bothTeamsScore !== bet.initialBothTeamsScore ||
    bet.penaltyShootout !== bet.initialPenaltyShootout
  );
}

function betIsSaveable(bet: BetState) {
  return (
    !bet.locked &&
    betIsDirty(bet) &&
    (bet.selection === "home" || bet.selection === "away")
  );
}

function conflictForBet(
  bet: BetState,
  match: MatchBetItem | undefined
): string | null {
  if (bet.locked || !match) return null;
  return getMatchBetConflictMessage({
    selection: bet.selection,
    hasExactScore: bet.hasExactScore,
    homeGoals: bet.homeGoals,
    awayGoals: bet.awayGoals,
    bothTeamsScore: bet.bothTeamsScore,
    penaltyShootout: bet.penaltyShootout,
    homeTeamName: match.homeLabel,
    awayTeamName: match.awayLabel,
  });
}

export function MatchesBetBoard({
  displayGroups,
  matchesById,
  savedOutcomeByMatch,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [bets, setBets] = useState(() => {
    const initial = new Map<string, BetState>();
    for (const match of Object.values(matchesById)) {
      initial.set(match.id, {
        selection: match.initialSelection,
        homeGoals: match.initialHomeGoals,
        awayGoals: match.initialAwayGoals,
        hasExactScore: match.initialHasExactScore,
        bothTeamsScore: match.initialBothTeamsScore,
        penaltyShootout: match.initialPenaltyShootout,
        locked: match.locked,
        initialSelection: match.initialSelection,
        initialHomeGoals: match.initialHomeGoals,
        initialAwayGoals: match.initialAwayGoals,
        initialHasExactScore: match.initialHasExactScore,
        initialBothTeamsScore: match.initialBothTeamsScore,
        initialPenaltyShootout: match.initialPenaltyShootout,
      });
    }
    return initial;
  });

  const conflicts = useMemo(() => {
    const map = new Map<string, string>();
    for (const [matchId, bet] of bets) {
      const message = conflictForBet(bet, matchesById[matchId]);
      if (message) map.set(matchId, message);
    }
    return map;
  }, [bets, matchesById]);

  const pendingBets = useMemo(
    () =>
      [...bets.entries()].filter(([, bet]) => betIsSaveable(bet)),
    [bets]
  );

  const canSave = useMemo(() => {
    if (!pendingBets.length) return false;
    return pendingBets.every(([matchId, bet]) => {
      return !conflictForBet(bet, matchesById[matchId]);
    });
  }, [pendingBets, matchesById]);

  function updateBet(matchId: string, patch: Partial<BetState>) {
    setBets((prev) => {
      const current = prev.get(matchId);
      if (!current) return prev;
      const next = new Map(prev);
      next.set(matchId, { ...current, ...patch });
      return next;
    });
  }

  function handleSave() {
    if (!canSave || isPending) return;

    const payload = pendingBets.map(([matchId, bet]) => ({
      matchId,
      selection: bet.selection,
      hasExactScore: bet.hasExactScore,
      homeGoals: bet.homeGoals,
      awayGoals: bet.awayGoals,
      bothTeamsScore: bet.bothTeamsScore,
      penaltyShootout: bet.penaltyShootout,
    }));

    const formData = new FormData();
    formData.set("bets", JSON.stringify(payload));

    startTransition(() => {
      void setAllMatchBetsAction(formData);
    });
  }

  function renderMatchCard(matchId: string) {
    const match = matchesById[matchId];
    const bet = bets.get(matchId);
    if (!match || !bet) return null;

    return (
      <section key={matchId} className="card-inner">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">
              {match.homeLabel}
              <span className="mx-2 font-normal text-muted">—</span>
              {match.awayLabel}
            </h3>
            <p className="mt-1 text-sm text-muted">{match.kickoffLabel}</p>
            {match.resultLabel ? (
              <p className="mt-1 text-sm text-muted">
                Результат:{" "}
                <span className="text-white/90">{match.resultLabel}</span>
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
            <span className={`badge ${match.statusBadgeClass}`}>
              {match.statusLabel}
            </span>
            {match.locked ? (
              <span className="badge badge-closed">Закрыто</span>
            ) : (
              <span className="badge badge-open">
                Можно ставить до {match.betDeadlineLabel}
              </span>
            )}
          </div>
        </div>

        <MatchBetCard
          homeTeamName={match.homeLabel}
          awayTeamName={match.awayLabel}
          locked={bet.locked}
          selection={bet.selection}
          hasExactScore={bet.hasExactScore}
          homeGoals={bet.homeGoals}
          awayGoals={bet.awayGoals}
          bothTeamsScore={bet.bothTeamsScore}
          penaltyShootout={bet.penaltyShootout}
          conflictMessage={conflicts.get(matchId) ?? null}
          onSelectionChange={(selection) => updateBet(matchId, { selection })}
          onHasExactScoreChange={(hasExactScore) =>
            updateBet(matchId, { hasExactScore })
          }
          onHomeGoalsChange={(homeGoals) => updateBet(matchId, { homeGoals })}
          onAwayGoalsChange={(awayGoals) => updateBet(matchId, { awayGoals })}
          onBothTeamsScoreChange={(bothTeamsScore) =>
            updateBet(matchId, { bothTeamsScore })
          }
          onPenaltyShootoutChange={(penaltyShootout) =>
            updateBet(matchId, { penaltyShootout })
          }
        />
      </section>
    );
  }

  return (
    <>
      <LoadingOverlay show={isPending} />
      <div className="flex flex-col gap-6 pb-24">
        {displayGroups.map((group) => {
          if (group.type === "groups") {
            const totalCount = group.children.reduce(
              (sum, child) => sum + child.matchIds.length,
              0
            );
            const allGroupMatchIds = group.children.flatMap(
              (child) => child.matchIds
            );

            return (
              <CollapsibleStage
                key="groups"
                title={group.label}
                count={totalCount}
                betsComplete={stageBetsComplete(
                  allGroupMatchIds,
                  savedOutcomeByMatch
                )}
              >
                {group.children.map((child) => (
                  <CollapsibleStage
                    key={child.stageKey}
                    title={child.label}
                    count={child.matchIds.length}
                    variant="nested"
                    betsComplete={stageBetsComplete(
                      child.matchIds,
                      savedOutcomeByMatch
                    )}
                  >
                    {child.matchIds.map(renderMatchCard)}
                  </CollapsibleStage>
                ))}
              </CollapsibleStage>
            );
          }

          return (
            <CollapsibleStage
              key={group.stageKey}
              title={group.label}
              count={group.matchIds.length}
              betsComplete={stageBetsComplete(
                group.matchIds,
                savedOutcomeByMatch
              )}
            >
              {group.matchIds.map(renderMatchCard)}
            </CollapsibleStage>
          );
        })}
      </div>

      <div className="bet-save-bar">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="btn-primary bet-save-btn"
        >
          {isPending ? "Сохранение…" : "Сохранить ставки"}
        </button>
      </div>
    </>
  );
}
