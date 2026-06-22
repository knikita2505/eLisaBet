"use server";

import "server-only";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireSessionTeam } from "@/lib/auth/session";
import { MIN_PLAYOFF_STAGE_RANK } from "@/lib/betting/stages";

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
    .select("id,kickoff_at,stage_rank,status")
    .eq("id", matchId)
    .single();

  if (error || !match) return null;

  const now = new Date();
  if (now >= new Date(match.kickoff_at)) return null;
  if (match.stage_rank < MIN_PLAYOFF_STAGE_RANK) return null;
  if (match.status && match.status !== "SCHEDULED") return null;

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
