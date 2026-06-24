/** Счёт на табло до серии пенальти (основное + доп. время). */
export function extractBoardScore(score: {
  regularTime?: { home?: unknown; away?: unknown; homeTeam?: unknown; awayTeam?: unknown };
  fullTime?: { home?: unknown; away?: unknown; homeTeam?: unknown; awayTeam?: unknown };
  fulltime?: { home?: unknown; away?: unknown; homeTeam?: unknown; awayTeam?: unknown };
  extraTime?: { home?: unknown; away?: unknown; homeTeam?: unknown; awayTeam?: unknown };
} | null | undefined): { home: number | null; away: number | null } {
  if (!score) return { home: null, away: null };

  const regularHome = pickScorePart(score.regularTime, "home");
  const regularAway = pickScorePart(score.regularTime, "away");
  const fullTime = score.fullTime ?? score.fulltime;
  const fullHome = pickScorePart(fullTime, "home");
  const fullAway = pickScorePart(fullTime, "away");
  const extraHome = pickScorePart(score.extraTime, "home") ?? 0;
  const extraAway = pickScorePart(score.extraTime, "away") ?? 0;

  // regularTime — после 90 минут; extraTime — голы в доп. время (суммируем).
  if (regularHome != null && regularAway != null) {
    return { home: regularHome + extraHome, away: regularAway + extraAway };
  }

  // fullTime — счёт к концу матча до пенальти; extraTime может быть отдельно.
  if (fullHome != null && fullAway != null) {
    const hasExtra =
      score.extraTime &&
      (pickScorePart(score.extraTime, "home") != null ||
        pickScorePart(score.extraTime, "away") != null);
    if (hasExtra) {
      return { home: fullHome + extraHome, away: fullAway + extraAway };
    }
    return { home: fullHome, away: fullAway };
  }

  return { home: null, away: null };
}

function pickScorePart(
  part: { home?: unknown; away?: unknown; homeTeam?: unknown; awayTeam?: unknown } | undefined,
  side: "home" | "away"
): number | null {
  if (!part) return null;
  const raw =
    side === "home"
      ? (part.home ?? part.homeTeam)
      : (part.away ?? part.awayTeam);
  return toNumber(raw);
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
