import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

type MatchForScoring = {
  id: string;
  home_team_name: string;
  away_team_name: string;
  home_goals: number | null;
  away_goals: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
};

function actualWinner(match: MatchForScoring): "home" | "away" | null {
  const hg = match.home_goals;
  const ag = match.away_goals;
  if (hg == null || ag == null) return null;
  if (hg !== ag) return hg > ag ? "home" : "away";

  // Full-time draw: decide by penalties (should exist for knockout)
  const hp = match.home_penalties;
  const ap = match.away_penalties;
  if (hp == null || ap == null) return null;
  return hp > ap ? "home" : "away";
}

function exactScoreMatchesBet(
  match: MatchForScoring,
  bet: {
    home_goals: number;
    away_goals: number;
    home_penalties: number | null;
    away_penalties: number | null;
  }
) {
  const hg = match.home_goals;
  const ag = match.away_goals;
  if (hg == null || ag == null) return false;

  if (hg !== ag) {
    return bet.home_goals === hg && bet.away_goals === ag;
  }

  // Penalties case: exact score includes penalties (bet requires penalties when goals equal)
  const hp = match.home_penalties;
  const ap = match.away_penalties;
  if (hp == null || ap == null) return false;

  return (
    bet.home_goals === hg &&
    bet.away_goals === ag &&
    bet.home_penalties === hp &&
    bet.away_penalties === ap
  );
}

async function ledgerExists(
  teamId: string,
  betType: string,
  betId: string
) {
  const { data, error } = await supabaseAdmin
    .from("team_points_ledger")
    .select("id")
    .eq("team_id", teamId)
    .eq("bet_type", betType)
    .eq("bet_id", betId)
    .maybeSingle();

  return Boolean(data && !error);
}

export async function awardPointsForPlayedMatch(params: {
  tournamentId: string;
  match: MatchForScoring;
}) {
  const { tournamentId, match } = params;
  const winner = actualWinner(match);
  if (!winner) return;

  // Outcome bet (+1)
  const { data: outcomeBets } = await supabaseAdmin
    .from("bets_outcome")
    .select("id,team_id,selection")
    .eq("match_id", match.id);

  for (const bet of outcomeBets ?? []) {
    const correct = bet.selection === winner;
    if (!correct) continue;

    const exists = await ledgerExists(
      bet.team_id,
      "match_outcome",
      bet.id
    );
    if (exists) continue;

    await supabaseAdmin.from("team_points_ledger").insert({
      team_id: bet.team_id,
      tournament_id: tournamentId,
      bet_type: "match_outcome",
      bet_id: bet.id,
      match_id: match.id,
      points: 1,
    });
  }

  // Exact score bet (+2, но в сумме с исходом даст +3)
  const { data: exactBets } = await supabaseAdmin
    .from("bets_exact_score")
    .select(
      "id,team_id,home_goals,away_goals,home_penalties,away_penalties"
    )
    .eq("match_id", match.id);

  for (const bet of exactBets ?? []) {
    const correct = exactScoreMatchesBet(match, bet);
    if (!correct) continue;

    const exists = await ledgerExists(bet.team_id, "match_exact_score", bet.id);
    if (exists) continue;

    await supabaseAdmin.from("team_points_ledger").insert({
      team_id: bet.team_id,
      tournament_id: tournamentId,
      bet_type: "match_exact_score",
      bet_id: bet.id,
      match_id: match.id,
      points: 2,
    });
  }
}

export async function awardChampionAndThirdPlace(params: {
  tournamentId: string;
  championName: string | null;
  thirdPlaceName: string | null;
}) {
  const { tournamentId, championName, thirdPlaceName } = params;

  if (championName) {
    const { data: bets } = await supabaseAdmin
      .from("bets_champion")
      .select("id,team_id,pick_country")
      .eq("tournament_id", tournamentId);

    for (const b of bets ?? []) {
      if (b.pick_country !== championName) continue;

      const exists = await ledgerExists(b.team_id, "champion", b.id);
      if (exists) continue;

      await supabaseAdmin.from("team_points_ledger").insert({
        team_id: b.team_id,
        tournament_id: tournamentId,
        bet_type: "champion",
        bet_id: b.id,
        match_id: null,
        points: 5,
      });
    }
  }

  if (thirdPlaceName) {
    const { data: bets } = await supabaseAdmin
      .from("bets_third_place")
      .select("id,team_id,pick_country")
      .eq("tournament_id", tournamentId);

    for (const b of bets ?? []) {
      if (b.pick_country !== thirdPlaceName) continue;

      const exists = await ledgerExists(b.team_id, "third_place", b.id);
      if (exists) continue;

      await supabaseAdmin.from("team_points_ledger").insert({
        team_id: b.team_id,
        tournament_id: tournamentId,
        bet_type: "third_place",
        bet_id: b.id,
        match_id: null,
        points: 3,
      });
    }
  }
}

