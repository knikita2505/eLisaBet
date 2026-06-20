import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTournament } from "@/lib/db/tournament";
import { fetchWorldCupMatchesFromFootballData } from "@/lib/football/footballDataClient";
import { MIN_PLAYOFF_STAGE_RANK, STAGE_RANK } from "@/lib/betting/stages";
import { awardChampionAndThirdPlace, awardPointsForPlayedMatch } from "@/lib/sync/awardPoints";

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
    fullTime?: { homeTeam?: unknown; awayTeam?: unknown };
    fulltime?: { homeTeam?: unknown; awayTeam?: unknown };
    penalties?: { homeTeam?: unknown; awayTeam?: unknown };
  };
};

type MatchUpsertPayload = {
  tournament_id: string;
  external_id: number;
  stage: string;
  stage_rank: number;
  kickoff_at: string;
  home_team_name: string;
  away_team_name: string;
  status: "PLAYED" | "SCHEDULED";
  home_goals: number | null;
  away_goals: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
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

function stageKeyFromFootballData(stageRaw: string | null | undefined) {
  const s = (stageRaw ?? "").toLowerCase();

  if (s.includes("round of 32") || s === "r32" || s.includes("1/16")) {
    return { key: "R32", rank: STAGE_RANK.R32 };
  }
  if (s.includes("round of 16") || s === "r16" || s.includes("1/8")) {
    return { key: "R16", rank: STAGE_RANK.R16 };
  }
  if (s.includes("quarter")) {
    return { key: "QF", rank: STAGE_RANK.QF };
  }
  if (s.includes("semi")) {
    return { key: "SF", rank: STAGE_RANK.SF };
  }
  if (s.includes("third")) {
    return { key: "THIRD_PLACE", rank: STAGE_RANK.THIRD_PLACE };
  }
  if (s.includes("final")) {
    return { key: "FINAL", rank: STAGE_RANK.FINAL };
  }
  return { key: "UNKNOWN", rank: 0 };
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

  const homeTeamName = m.homeTeam?.name ?? m.homeTeam?.teamName ?? null;
  const awayTeamName = m.awayTeam?.name ?? m.awayTeam?.teamName ?? null;
  if (!homeTeamName || !awayTeamName) return null;

  const statusRaw = String(m.status ?? "").toUpperCase();
  const played =
    statusRaw === "FINISHED" ||
    statusRaw === "PLAYED" ||
    statusRaw === "POSTPONED" ||
    statusRaw === "AWARDED";

  const score = m.score ?? {};

  const homeGoals = extractNumber(score?.fullTime?.homeTeam ?? score?.fulltime?.homeTeam);
  const awayGoals = extractNumber(score?.fullTime?.awayTeam ?? score?.fulltime?.awayTeam);

  const homePenalties = extractNumber(score?.penalties?.homeTeam);
  const awayPenalties = extractNumber(score?.penalties?.awayTeam);

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

export async function syncWorldCupMatches() {
  const tournamentId = await getActiveTournament();
  const footballMatches = await fetchWorldCupMatchesFromFootballData();

  const payloads: MatchUpsertPayload[] = [];
  for (const m0 of footballMatches) {
    const m = m0 as FootballMatch;
    const mapped = mapFootballMatchToDbMatch({ tournamentId, m });
    if (!mapped) continue;
    payloads.push(mapped);
  }

  if (!payloads.length) return { upserted: 0 };

  // Upsert matches
  const { error: upsertError } = await supabaseAdmin
    .from("matches")
    .upsert(payloads, { onConflict: "tournament_id,external_id" });

  if (upsertError) throw upsertError;

  // Update lock timestamps for winner/3rd place (earliest R32 kickoff)
  const { data: r32Rows } = await supabaseAdmin
    .from("matches")
    .select("kickoff_at")
    .eq("tournament_id", tournamentId)
    .eq("stage_rank", STAGE_RANK.R32);

  const earliest = (r32Rows ?? [])
    .map((r) => r.kickoff_at)
    .filter(Boolean)
    .sort(
      (a: string, b: string) =>
        new Date(a).getTime() - new Date(b).getTime()
    )[0];

  if (earliest) {
    await supabaseAdmin
      .from("tournaments")
      .update({
        winner_bet_locked_at: earliest,
        third_place_bet_locked_at: earliest,
      })
      .eq("id", tournamentId);
  }

  // Award points for all played matches in MVP
  const { data: playedMatches } = await supabaseAdmin
    .from("matches")
    .select(
      "id,home_team_name,away_team_name,home_goals,away_goals,home_penalties,away_penalties,status"
    )
    .eq("tournament_id", tournamentId)
    .gte("stage_rank", MIN_PLAYOFF_STAGE_RANK)
    .eq("status", "PLAYED");

  for (const match of playedMatches ?? []) {
    await awardPointsForPlayedMatch({
      tournamentId,
      match,
    });
  }

  // Champion + third place bets (based on FINAL and THIRD_PLACE matches)
  const { data: finalMatch } = await supabaseAdmin
    .from("matches")
    .select(
      "home_team_name,away_team_name,home_goals,away_goals,home_penalties,away_penalties"
    )
    .eq("tournament_id", tournamentId)
    .eq("stage_rank", STAGE_RANK.FINAL)
    .eq("status", "PLAYED")
    .maybeSingle();

  const { data: thirdMatch } = await supabaseAdmin
    .from("matches")
    .select(
      "home_team_name,away_team_name,home_goals,away_goals,home_penalties,away_penalties"
    )
    .eq("tournament_id", tournamentId)
    .eq("stage_rank", STAGE_RANK.THIRD_PLACE)
    .eq("status", "PLAYED")
    .maybeSingle();

  type MatchForWinner = {
    home_team_name: string;
    away_team_name: string;
    home_goals: number | null;
    away_goals: number | null;
    home_penalties: number | null;
    away_penalties: number | null;
  };

  const winnerNameFromMatch = (match: MatchForWinner | null) => {
    // winner based on full-time goals, otherwise penalties
    if (!match) return null;
    const hg = match.home_goals;
    const ag = match.away_goals;
    if (hg == null || ag == null) return null;
    if (hg !== ag) return hg > ag ? match.home_team_name : match.away_team_name;

    const hp = match.home_penalties;
    const ap = match.away_penalties;
    if (hp == null || ap == null) return null;
    return hp > ap ? match.home_team_name : match.away_team_name;
  };

  await awardChampionAndThirdPlace({
    tournamentId,
    championName: winnerNameFromMatch(finalMatch),
    thirdPlaceName: winnerNameFromMatch(thirdMatch),
  });

  return { upserted: payloads.length };
}

