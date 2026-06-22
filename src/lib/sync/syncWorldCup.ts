import "server-only";
import { getActiveTournament } from "@/lib/db/tournament";
import {
  fetchWorldCupMatchesFromFootballData,
  fetchWorldCupTeamsFromFootballData,
} from "@/lib/football/footballDataClient";
import { MIN_PLAYOFF_STAGE_RANK } from "@/lib/betting/stages";
import { stageKeyFromFootballData } from "@/lib/betting/stageMapping";
import {
  afterMatchImport,
  recalculateTournamentPoints,
} from "@/lib/sync/finalizeSync";
import { upsertMatchesWithDedup } from "@/lib/sync/matchUpsert";
import type {
  MatchUpsertPayload,
  RecalculateResult,
  SyncResult,
} from "@/lib/sync/types";

type FootballMatch = {
  id: number | string;
  utcDate?: string;
  datetime?: string;
  stage?: string | null;
  matchStage?: string | null;
  status?: string | null;
  homeTeam?: { name?: string | null; teamName?: string | null };
  awayTeam?: { name?: string | null; teamName?: string | null };
  score?: {
    fullTime?: { home?: unknown; away?: unknown; homeTeam?: unknown; awayTeam?: unknown };
    fulltime?: { home?: unknown; away?: unknown; homeTeam?: unknown; awayTeam?: unknown };
    penalties?: { home?: unknown; away?: unknown; homeTeam?: unknown; awayTeam?: unknown };
  };
};

function extractNumber(maybe: unknown): number | null {
  if (maybe == null) return null;
  if (typeof maybe === "number") return maybe;
  if (typeof maybe === "string" && maybe.trim() !== "") {
    const n = Number(maybe);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isPlayedStatus(statusRaw: string) {
  const s = statusRaw.toUpperCase();
  return s === "FINISHED" || s === "AWARDED";
}

function mapFootballMatchToDbMatch(args: {
  tournamentId: string;
  m: FootballMatch;
}): MatchUpsertPayload | null {
  const { tournamentId, m } = args;

  const stage = stageKeyFromFootballData(m.stage ?? m.matchStage);
  if (stage.rank < MIN_PLAYOFF_STAGE_RANK) return null;

  const kickoffAt = m.utcDate ?? m.datetime ?? null;
  if (!kickoffAt) return null;

  const homeTeamName =
    m.homeTeam?.name?.trim() || m.homeTeam?.teamName?.trim() || "Уточняется";
  const awayTeamName =
    m.awayTeam?.name?.trim() || m.awayTeam?.teamName?.trim() || "Уточняется";

  const statusRaw = String(m.status ?? "");
  const played = isPlayedStatus(statusRaw);
  const score = m.score ?? {};

  const homeGoals = extractNumber(
    score?.fullTime?.home ??
      score?.fullTime?.homeTeam ??
      score?.fulltime?.home ??
      score?.fulltime?.homeTeam
  );
  const awayGoals = extractNumber(
    score?.fullTime?.away ??
      score?.fullTime?.awayTeam ??
      score?.fulltime?.away ??
      score?.fulltime?.awayTeam
  );
  const homePenalties = extractNumber(
    score?.penalties?.home ?? score?.penalties?.homeTeam
  );
  const awayPenalties = extractNumber(
    score?.penalties?.away ?? score?.penalties?.awayTeam
  );

  return {
    tournament_id: tournamentId,
    external_id: Number(m.id),
    stage: stage.key,
    stage_rank: stage.rank,
    kickoff_at: kickoffAt,
    home_team_name: homeTeamName,
    away_team_name: awayTeamName,
    status: played ? "PLAYED" : "SCHEDULED",
    home_goals: played ? homeGoals : null,
    away_goals: played ? awayGoals : null,
    home_penalties: played ? homePenalties : null,
    away_penalties: played ? awayPenalties : null,
  };
}

export type { SyncResult, RecalculateResult };

export async function importWorldCupMatches(): Promise<SyncResult> {
  const tournamentId = await getActiveTournament();
  const footballMatches = await fetchWorldCupMatchesFromFootballData();

  const payloads: MatchUpsertPayload[] = [];
  for (const m0 of footballMatches) {
    const mapped = mapFootballMatchToDbMatch({
      tournamentId,
      m: m0 as FootballMatch,
    });
    if (mapped) payloads.push(mapped);
  }

  if (!payloads.length) {
    await afterMatchImport({});
    return {
      fetched: footballMatches.length,
      upserted: 0,
      skipped: footballMatches.length,
    };
  }

  const upserted = await upsertMatchesWithDedup(payloads);

  let tournamentTeams: string[] = [];
  try {
    tournamentTeams = await fetchWorldCupTeamsFromFootballData();
  } catch (e) {
    console.warn("teams fetch failed:", e);
  }

  await afterMatchImport({ tournamentTeams });

  return {
    fetched: footballMatches.length,
    upserted,
    skipped: footballMatches.length - payloads.length,
  };
}

/** Импорт матчей + пересчёт очков — для cron. */
export async function syncWorldCupMatches(): Promise<
  SyncResult & RecalculateResult
> {
  const sync = await importWorldCupMatches();
  const points = await recalculateTournamentPoints();
  return { ...sync, ...points };
}
