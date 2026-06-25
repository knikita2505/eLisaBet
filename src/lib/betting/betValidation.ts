import type { YesNoSelection } from "@/lib/betting/matchProps";

/** Победитель на табло по счёту (без пенальти). Ничья → null. */
export function boardWinner(
  homeGoals: number,
  awayGoals: number
): "home" | "away" | null {
  if (homeGoals === awayGoals) return null;
  return homeGoals > awayGoals ? "home" : "away";
}

/**
 * Исход и счёт на табло согласованы, если:
 * - на табло ничья (исход решается пенальти), или
 * - победитель на табло совпадает с выбранным исходом.
 */
export function getOutcomeScoreConflictMessage(
  selection: "home" | "away",
  homeGoals: number,
  awayGoals: number,
  homeTeamName: string,
  awayTeamName: string
): string | null {
  const winnerOnBoard = boardWinner(homeGoals, awayGoals);
  if (!winnerOnBoard || winnerOnBoard === selection) return null;

  const pickedName = selection === "home" ? homeTeamName : awayTeamName;
  const boardWinnerName =
    winnerOnBoard === "home" ? homeTeamName : awayTeamName;

  return `Выбрана победа «${pickedName}», но счёт ${homeGoals}:${awayGoals} означает победу «${boardWinnerName}» на табло`;
}

export function getMatchBetConflictMessages(args: {
  selection: "home" | "away" | null;
  hasExactScore: boolean;
  homeGoals: number;
  awayGoals: number;
  bothTeamsScore: YesNoSelection | null;
  penaltyShootout: YesNoSelection | null;
  homeTeamName: string;
  awayTeamName: string;
}): string[] {
  const {
    selection,
    hasExactScore,
    homeGoals,
    awayGoals,
    bothTeamsScore,
    penaltyShootout,
    homeTeamName,
    awayTeamName,
  } = args;

  const messages: string[] = [];

  if (!hasExactScore) return messages;

  if (selection) {
    const outcomeConflict = getOutcomeScoreConflictMessage(
      selection,
      homeGoals,
      awayGoals,
      homeTeamName,
      awayTeamName
    );
    if (outcomeConflict) messages.push(outcomeConflict);
  }

  if (bothTeamsScore === "yes") {
    if (homeGoals <= 0 || awayGoals <= 0) {
      messages.push(
        "Ставка «обе забьют: да» требует больше 0 голов у каждой команды в точном счёте"
      );
    }
  }

  if (bothTeamsScore === "no") {
    if (homeGoals > 0 && awayGoals > 0) {
      messages.push(
        "Ставка «обе забьют: нет» требует 0 голов хотя бы у одной команды в точном счёте"
      );
    }
  }

  if (penaltyShootout === "yes") {
    if (homeGoals !== awayGoals) {
      messages.push(
        "Ставка «серия пенальти: да» требует равный точный счёт на табло"
      );
    }
  }

  if (penaltyShootout === "no") {
    if (homeGoals === awayGoals) {
      messages.push(
        "Ставка «серия пенальти: нет» требует разный точный счёт на табло"
      );
    }
  }

  return messages;
}

export function getMatchBetConflictMessage(
  args: Parameters<typeof getMatchBetConflictMessages>[0]
): string | null {
  const messages = getMatchBetConflictMessages(args);
  return messages.length ? messages.join("\n") : null;
}
