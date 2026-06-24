import "server-only";
import { getActiveTournament } from "@/lib/db/tournament";
import {
  fetchWorldCupMatchesFromFootballData,
  fetchWorldCupTeamsFromFootballData,
} from "@/lib/football/footballDataClient";
import {
  GROUP_STAGE_FROM_ISO,
  MIN_BETTABLE_STAGE_RANK,
  STAGE_RANK,
} from "@/lib/betting/stages";
import { stageKeyFromFootballData } from "@/lib/betting/stageMapping";
import { extractBoardScore } from "@/lib/football/boardScore";
import {
  afterMatchImport,
  recalculateTournamentPoints,
} from "@/lib/sync/finalizeSync";
import { upsertMatchesWithDedup, isPlaceholderTeamName } from "@/lib/sync/matchUpsert";
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
  group?: string | null;
  status?: string | null;
  homeTeam?: { name?: string | null; teamName?: string | null };
  awayTeam?: { name?: string | null; teamName?: string | null };
  score?: {
    regularTime?: { home?: unknown; away?: unknown; homeTeam?: unknown; awayTeam?: unknown };
    fullTime?: { home?: unknown; away?: unknown; homeTeam?: unknown; awayTeam?: unknown };
    fulltime?: { home?: unknown; away?: unknown; homeTeam?: unknown; awayTeam?: unknown };
    extraTime?: { home?: unknown; away?: unknown; homeTeam?: unknown; awayTeam?: unknown };
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

function mapMatchStatus(statusRaw: string): MatchUpsertPayload["status"] {
  const s = statusRaw.toUpperCase();
  if (s === "FINISHED" || s === "AWARDED") return "PLAYED";
  if (
    s === "IN_PLAY" ||
    s === "PAUSED" ||
    s === "LIVE" ||
    s === "HALFTIME" ||
    s === "SUSPENDED"
  ) {
    return "LIVE";
  }
  return "SCHEDULED";
}

function mapFootballMatchToDbMatch(args: {
  tournamentId: string;
  m: FootballMatch;
}): MatchUpsertPayload | null {
  const { tournamentId, m } = args;

  const stage = stageKeyFromFootballData(
    m.stage ?? m.matchStage,
    m.group ?? null
  );
  if (stage.rank < MIN_BETTABLE_STAGE_RANK) return null;

  const kickoffAt = m.utcDate ?? m.datetime ?? null;
  if (!kickoffAt) return null;

  if (
    stage.rank === STAGE_RANK.GROUP &&
    new Date(kickoffAt) < new Date(GROUP_STAGE_FROM_ISO)
  ) {
    return null;
  }

  const homeTeamName =
    m.homeTeam?.name?.trim() || m.homeTeam?.teamName?.trim() || "Уточняется";
  const awayTeamName =
    m.awayTeam?.name?.trim() || m.awayTeam?.teamName?.trim() || "Уточняется";

  const statusRaw = String(m.status ?? "");
  const status = mapMatchStatus(statusRaw);
  const played = status === "PLAYED";
  const score = m.score ?? {};
  const board = extractBoardScore(score);

  const homeGoals = board.home;
  const awayGoals = board.away;
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
    status,
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

  const teamNamesFromMatches = payloads
    .flatMap((p) => [p.home_team_name, p.away_team_name])
    .filter((n) => !isPlaceholderTeamName(n));

  const allTeams = [
    ...new Set([...tournamentTeams, ...teamNamesFromMatches]),
  ];

  await afterMatchImport({ tournamentTeams: allTeams });

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
