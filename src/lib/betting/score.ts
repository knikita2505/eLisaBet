type MatchScore = {
  home_team_name: string;
  away_team_name: string;
  home_goals: number | null;
  away_goals: number | null;
  home_penalties?: number | null;
  away_penalties?: number | null;
};

/** Победитель с учётом пенальти при ничьей в основное время */
export function matchWinner(
  match: MatchScore
): "home" | "away" | null {
  const hg = match.home_goals;
  const ag = match.away_goals;
  if (hg == null || ag == null) return null;
  if (hg !== ag) return hg > ag ? "home" : "away";

  const hp = match.home_penalties;
  const ap = match.away_penalties;
  if (hp == null || ap == null) return null;
  return hp > ap ? "home" : "away";
}

/** Счёт на табло: голы в основное/доп. время; пенальти — отдельной пометкой */
export function formatMatchResult(match: MatchScore): string {
  const hg = match.home_goals;
  const ag = match.away_goals;
  if (hg == null || ag == null) return "—";

  let text = `${hg}:${ag}`;
  const hp = match.home_penalties;
  const ap = match.away_penalties;
  if (hp != null && ap != null && hg === ag) {
    const winner = hp > ap ? match.home_team_name : match.away_team_name;
    text += ` (победа ${winner} по пенальти)`;
  }
  return text;
}

export function exactScoreMatchesBet(
  match: MatchScore,
  bet: { home_goals: number; away_goals: number }
) {
  const hg = match.home_goals;
  const ag = match.away_goals;
  if (hg == null || ag == null) return false;
  return bet.home_goals === hg && bet.away_goals === ag;
}
