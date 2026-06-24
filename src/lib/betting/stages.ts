export const STAGE_RANK = {
  GROUP: 0,
  R32: 1, // 1/16 финала
  R16: 2, // 1/8 финала
  QF: 3, // 1/4 финала
  SF: 4, // полуфинал
  THIRD_PLACE: 5, // матч за 3-е место
  FINAL: 6, // финал
} as const;

export type StageRank = (typeof STAGE_RANK)[keyof typeof STAGE_RANK];

/** Минимальный этап для ставок и начисления очков */
export const MIN_BETTABLE_STAGE_RANK = STAGE_RANK.GROUP;

export const MIN_PLAYOFF_STAGE_RANK = STAGE_RANK.R32;

/** Групповой этап: ставки с пятницы 26.06.2026 00:00 (МСК) */
export const GROUP_STAGE_FROM_ISO = "2026-06-25T21:00:00.000Z";

export function isBettableMatch(match: {
  stage_rank: number;
  kickoff_at: string;
}) {
  if (match.stage_rank < MIN_BETTABLE_STAGE_RANK) return false;
  if (
    match.stage_rank === STAGE_RANK.GROUP &&
    new Date(match.kickoff_at) < new Date(GROUP_STAGE_FROM_ISO)
  ) {
    return false;
  }
  return true;
}
