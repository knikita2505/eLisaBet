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
