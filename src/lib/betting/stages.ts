export const STAGE_RANK = {
  R32: 1, // 1/16 финала (32 команды, 16 матчей)
  R16: 2, // 1/8 финала (16 команд)
  QF: 3, // 1/4 финала
  SF: 4, // полуфинал
  THIRD_PLACE: 5, // матч за 3-е место
  FINAL: 6, // финал
} as const;

export type StageRank = (typeof STAGE_RANK)[keyof typeof STAGE_RANK];

export const MIN_PLAYOFF_STAGE_RANK = STAGE_RANK.R32;
