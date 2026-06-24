export type MatchUpsertPayload = {
  tournament_id: string;
  external_id: number;
  stage: string;
  stage_rank: number;
  kickoff_at: string;
  bet_locked_at?: string | null;
  home_team_name: string;
  away_team_name: string;
  status: "PLAYED" | "SCHEDULED" | "LIVE";
  home_goals: number | null;
  away_goals: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
};

export type SyncResult = {
  fetched: number;
  upserted: number;
  skipped: number;
};

export type RecalculateResult = {
  played: number;
  pointsAwarded: number;
};
