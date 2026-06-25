export type YesNoSelection = "yes" | "no";

type MatchForProps = {
  home_goals: number | null;
  away_goals: number | null;
  home_penalties?: number | null;
  away_penalties?: number | null;
};

/** Обе команды забьют — по счёту на табло (без серии пенальти). */
export function actualBothTeamsScore(match: MatchForProps): boolean | null {
  const hg = match.home_goals;
  const ag = match.away_goals;
  if (hg == null || ag == null) return null;
  return hg > 0 && ag > 0;
}

/** Серия пенальти после ничьи на табло. */
export function actualPenaltyShootout(match: MatchForProps): boolean | null {
  const hg = match.home_goals;
  const ag = match.away_goals;
  const hp = match.home_penalties;
  const ap = match.away_penalties;
  if (hg == null || ag == null) return null;
  if (hp != null && ap != null) return true;
  return false;
}

export function yesNoMatchesActual(
  selection: YesNoSelection,
  actual: boolean
): boolean {
  return (selection === "yes") === actual;
}

export function formatYesNoLabel(selection: YesNoSelection): string {
  return selection === "yes" ? "Да" : "Нет";
}
