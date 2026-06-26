"use server";

import "server-only";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireSessionTeam } from "@/lib/auth/session";
import {
  allowsPenaltyShootoutBet,
  MIN_BETTABLE_STAGE_RANK,
} from "@/lib/betting/stages";
import { isBettingOpen } from "@/lib/betting/matchStatus";
import { getMatchBetConflictMessage } from "@/lib/betting/betValidation";
import type { YesNoSelection } from "@/lib/betting/matchProps";

type BulkBetPayload = {
  matchId: string;
  selection: "home" | "away" | null;
  hasExactScore: boolean;
  homeGoals: number;
  awayGoals: number;
  bothTeamsScore: YesNoSelection | null;
  penaltyShootout: YesNoSelection | null;
  allowsPenaltyShootout: boolean;
};

function parseYesNo(v: unknown): YesNoSelection | null {
  return v === "yes" || v === "no" ? v : null;
}

function isOptionalYesNo(v: unknown): boolean {
  return v === null || v === undefined || v === "yes" || v === "no";
}

function normalizeBulkBet(raw: BulkBetPayload): BulkBetPayload {
  return {
    matchId: typeof raw.matchId === "string" ? raw.matchId : "",
    selection:
      raw.selection === "home" || raw.selection === "away" ? raw.selection : null,
    hasExactScore: raw.hasExactScore === true,
    homeGoals:
      typeof raw.homeGoals === "number" && Number.isFinite(raw.homeGoals)
        ? Math.trunc(raw.homeGoals)
        : 0,
    awayGoals:
      typeof raw.awayGoals === "number" && Number.isFinite(raw.awayGoals)
        ? Math.trunc(raw.awayGoals)
        : 0,
    bothTeamsScore: parseYesNo(raw.bothTeamsScore),
    penaltyShootout: parseYesNo(raw.penaltyShootout),
    allowsPenaltyShootout: raw.allowsPenaltyShootout === true,
  };
}

async function deletePenaltyShootoutBet(teamId: string, matchId: string) {
  const { data: existing } = await supabaseAdmin
    .from("bets_penalty_shootout")
    .select("id")
    .eq("team_id", teamId)
    .eq("match_id", matchId)
    .maybeSingle();

  if (!existing) return;

  await supabaseAdmin
    .from("team_points_ledger")
    .delete()
    .eq("bet_type", "match_penalty_shootout")
    .eq("bet_id", existing.id);

  await supabaseAdmin
    .from("bets_penalty_shootout")
    .delete()
    .eq("id", existing.id);
}

async function upsertYesNoBets(
  teamId: string,
  matchId: string,
  bothTeamsScore: YesNoSelection | null,
  penaltyShootout: YesNoSelection | null
) {
  if (bothTeamsScore) {
    const { error } = await supabaseAdmin.from("bets_both_teams_score").upsert(
      {
        team_id: teamId,
        match_id: matchId,
        selection: bothTeamsScore,
      },
      { onConflict: "team_id,match_id" }
    );
    if (error) return error;
  }

  if (penaltyShootout) {
    const { error } = await supabaseAdmin.from("bets_penalty_shootout").upsert(
      {
        team_id: teamId,
        match_id: matchId,
        selection: penaltyShootout,
      },
      { onConflict: "team_id,match_id" }
    );
    if (error) return error;
  }

  return null;
}

function toInt(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string") return null;
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

async function assertMatchOpenForBets(matchId: string) {
  const { data: match, error } = await supabaseAdmin
    .from("matches")
    .select("id,kickoff_at,bet_locked_at,stage_rank,status")
    .eq("id", matchId)
    .single();

  if (error || !match) return null;

  if (!isBettingOpen(match)) return null;
  if (match.stage_rank < MIN_BETTABLE_STAGE_RANK) return null;
  if (match.status === "PLAYED") return null;

  return match;
}

export async function setMatchBetsAction(formData: FormData) {
  const team = await requireSessionTeam();

  const matchIdRaw = formData.get("matchId");
  const matchId = typeof matchIdRaw === "string" ? matchIdRaw : "";
  const selectionRaw = formData.get("selection");
  const selection =
    selectionRaw === "home" || selectionRaw === "away" ? selectionRaw : null;

  const homeGoals = toInt(formData.get("homeGoals"));
  const awayGoals = toInt(formData.get("awayGoals"));

  if (!matchId || !selection || homeGoals === null || awayGoals === null) {
    redirect("/matches?error=1");
  }
  if (homeGoals < 0 || homeGoals > 10 || awayGoals < 0 || awayGoals > 10) {
    redirect("/matches?error=1");
  }

  const match = await assertMatchOpenForBets(matchId);
  if (!match) redirect("/matches?locked=1");

  const { data: matchRow } = await supabaseAdmin
    .from("matches")
    .select("home_team_name,away_team_name,stage_rank")
    .eq("id", matchId)
    .maybeSingle();

  const allowsPenalty = matchRow
    ? allowsPenaltyShootoutBet(matchRow)
    : false;

  const conflict = getMatchBetConflictMessage({
    selection,
    hasExactScore: true,
    homeGoals,
    awayGoals,
    bothTeamsScore: null,
    penaltyShootout: null,
    allowsPenaltyShootout: allowsPenalty,
    homeTeamName: matchRow?.home_team_name ?? "Команда 1",
    awayTeamName: matchRow?.away_team_name ?? "Команда 2",
  });
  if (conflict) redirect("/matches?error=conflict");

  const { error: outcomeError } = await supabaseAdmin.from("bets_outcome").upsert(
    {
      team_id: team.teamId,
      match_id: matchId,
      selection,
    },
    { onConflict: "team_id,match_id" }
  );

  if (outcomeError) redirect("/matches?error=1");

  const { error: scoreError } = await supabaseAdmin
    .from("bets_exact_score")
    .upsert(
      {
        team_id: team.teamId,
        match_id: matchId,
        home_goals: homeGoals,
        away_goals: awayGoals,
        home_penalties: null,
        away_penalties: null,
      },
      { onConflict: "team_id,match_id" }
    );

  if (scoreError) redirect("/matches?error=1");
  redirect("/matches?saved=1");
}

export async function setAllMatchBetsAction(formData: FormData) {
  const team = await requireSessionTeam();

  const raw = formData.get("bets");
  if (typeof raw !== "string") redirect("/matches?error=1");

  let bets: BulkBetPayload[];
  try {
    bets = JSON.parse(raw) as BulkBetPayload[];
  } catch {
    redirect("/matches?error=1");
  }

  if (!Array.isArray(bets) || !bets.length) redirect("/matches?error=1");

  const normalizedBets = bets.map((bet) => normalizeBulkBet(bet));

  for (const bet of normalizedBets) {
    if (!bet.matchId) redirect("/matches?error=1");

    if (!bet.selection) redirect("/matches?error=no_outcome");

    if (
      bet.homeGoals < 0 ||
      bet.homeGoals > 10 ||
      bet.awayGoals < 0 ||
      bet.awayGoals > 10
    ) {
      redirect("/matches?error=1");
    }

    if (!isOptionalYesNo(bet.bothTeamsScore)) {
      redirect("/matches?error=1");
    }

    if (!isOptionalYesNo(bet.penaltyShootout)) {
      redirect("/matches?error=1");
    }

    const { data: matchRow } = await supabaseAdmin
      .from("matches")
      .select("home_team_name,away_team_name,stage_rank")
      .eq("id", bet.matchId)
      .maybeSingle();

    const homeName = matchRow?.home_team_name ?? "Команда 1";
    const awayName = matchRow?.away_team_name ?? "Команда 2";
    const allowsPenalty = matchRow
      ? allowsPenaltyShootoutBet(matchRow)
      : bet.allowsPenaltyShootout;

    const conflict = getMatchBetConflictMessage({
      selection: bet.selection,
      hasExactScore: bet.hasExactScore,
      homeGoals: bet.homeGoals,
      awayGoals: bet.awayGoals,
      bothTeamsScore: parseYesNo(bet.bothTeamsScore),
      penaltyShootout: allowsPenalty ? parseYesNo(bet.penaltyShootout) : null,
      allowsPenaltyShootout: allowsPenalty,
      homeTeamName: homeName,
      awayTeamName: awayName,
    });
    if (conflict) redirect("/matches?error=conflict");
  }

  for (const bet of normalizedBets) {
    const match = await assertMatchOpenForBets(bet.matchId);
    if (!match) continue;

    if (bet.hasExactScore) {
      const { error: scoreError } = await supabaseAdmin
        .from("bets_exact_score")
        .upsert(
          {
            team_id: team.teamId,
            match_id: bet.matchId,
            home_goals: bet.homeGoals,
            away_goals: bet.awayGoals,
            home_penalties: null,
            away_penalties: null,
          },
          { onConflict: "team_id,match_id" }
        );

      if (scoreError) {
        redirect(`/matches?error=${encodeURIComponent(scoreError.message)}`);
      }
    } else {
      const { data: existingScore } = await supabaseAdmin
        .from("bets_exact_score")
        .select("id")
        .eq("team_id", team.teamId)
        .eq("match_id", bet.matchId)
        .maybeSingle();

      if (existingScore) {
        await supabaseAdmin
          .from("team_points_ledger")
          .delete()
          .eq("bet_type", "match_exact_score")
          .eq("bet_id", existingScore.id);

        const { error: deleteError } = await supabaseAdmin
          .from("bets_exact_score")
          .delete()
          .eq("id", existingScore.id);

        if (deleteError) {
          redirect(
            `/matches?error=${encodeURIComponent(deleteError.message)}`
          );
        }
      }
    }

    const { data: matchMeta } = await supabaseAdmin
      .from("matches")
      .select("stage_rank")
      .eq("id", bet.matchId)
      .maybeSingle();

    const allowsPenalty = matchMeta
      ? allowsPenaltyShootoutBet(matchMeta)
      : bet.allowsPenaltyShootout;

    const propError = await upsertYesNoBets(
      team.teamId,
      bet.matchId,
      bet.bothTeamsScore,
      allowsPenalty ? bet.penaltyShootout : null
    );
    if (propError) {
      redirect(`/matches?error=${encodeURIComponent(propError.message)}`);
    }

    if (!allowsPenalty) {
      await deletePenaltyShootoutBet(team.teamId, bet.matchId);
    }

    const { error: outcomeError } = await supabaseAdmin
      .from("bets_outcome")
      .upsert(
        {
          team_id: team.teamId,
          match_id: bet.matchId,
          selection: bet.selection as "home" | "away",
        },
        { onConflict: "team_id,match_id" }
      );

    if (outcomeError) {
      redirect(
        `/matches?error=${encodeURIComponent(outcomeError.message)}`
      );
    }
  }

  redirect("/matches?saved=1");
}
