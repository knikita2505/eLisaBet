import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTournament } from "@/lib/db/tournament";
import { translateTeamToRu } from "@/lib/football/teamTranslations";
import { MIN_BETTABLE_STAGE_RANK, STAGE_RANK } from "@/lib/betting/stages";
import {
  awardChampionAndThirdPlace,
  awardPointsForPlayedMatch,
} from "@/lib/sync/awardPoints";
import type { RecalculateResult } from "@/lib/sync/types";

type MatchForWinner = {
  home_team_name: string;
  away_team_name: string;
  home_goals: number | null;
  away_goals: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
};

function winnerNameFromMatch(match: MatchForWinner | null) {
  if (!match) return null;
  const hg = match.home_goals;
  const ag = match.away_goals;
  if (hg == null || ag == null) return null;
  if (hg !== ag) return hg > ag ? match.home_team_name : match.away_team_name;

  const hp = match.home_penalties;
  const ap = match.away_penalties;
  if (hp == null || ap == null) return null;
  return hp > ap ? match.home_team_name : match.away_team_name;
}

export async function afterMatchImport(args: {
  tournamentTeams?: string[];
}) {
  const tournamentId = await getActiveTournament();

  if (args.tournamentTeams?.length) {
    try {
      const { error: teamsError } = await supabaseAdmin
        .from("tournament_teams")
        .upsert(
          args.tournamentTeams.map((name) => ({
            tournament_id: tournamentId,
            team_name: name,
            name_ru: translateTeamToRu(name),
          })),
          { onConflict: "tournament_id,team_name" }
        );
      if (teamsError) {
        console.warn("tournament_teams sync skipped:", teamsError.message);
      }
    } catch (e) {
      console.warn("tournament_teams sync failed:", e);
    }
  }

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
}

/** Полный пересчёт: сброс ledger и начисление по текущим результатам. */
export async function recalculateTournamentPoints(): Promise<RecalculateResult> {
  const tournamentId = await getActiveTournament();

  await supabaseAdmin
    .from("team_points_ledger")
    .delete()
    .eq("tournament_id", tournamentId);

  const { data: playedMatches } = await supabaseAdmin
    .from("matches")
    .select(
      "id,home_team_name,away_team_name,home_goals,away_goals,home_penalties,away_penalties,status"
    )
    .eq("tournament_id", tournamentId)
    .gte("stage_rank", MIN_BETTABLE_STAGE_RANK)
    .eq("status", "PLAYED");

  for (const match of playedMatches ?? []) {
    await awardPointsForPlayedMatch({ tournamentId, match });
  }

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

  await awardChampionAndThirdPlace({
    tournamentId,
    championName: winnerNameFromMatch(finalMatch),
    thirdPlaceName: winnerNameFromMatch(thirdMatch),
  });

  const { count } = await supabaseAdmin
    .from("team_points_ledger")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  return {
    played: playedMatches?.length ?? 0,
    pointsAwarded: count ?? 0,
  };
}
