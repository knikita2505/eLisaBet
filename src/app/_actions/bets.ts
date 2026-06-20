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

export async function setMatchOutcomeBetAction(formData: FormData) {
  const team = await requireSessionTeam();

  const matchIdRaw = formData.get("matchId");
  const matchId = typeof matchIdRaw === "string" ? matchIdRaw : "";
  const selectionRaw = formData.get("selection");
  const selection =
    selectionRaw === "home" || selectionRaw === "away"
      ? selectionRaw
      : null;
  if (!matchId || !selection) redirect("/matches?error=1");

  const { data: match, error } = await supabaseAdmin
    .from("matches")
    .select("id,kickoff_at,stage_rank,status")
    .eq("id", matchId)
    .single();
  if (error || !match) redirect("/matches?error=1");

  const now = new Date();
  if (now >= new Date(match.kickoff_at)) redirect("/matches?locked=1");
  if (match.stage_rank < MIN_PLAYOFF_STAGE_RANK) redirect("/matches");
  if (match.status && match.status !== "SCHEDULED") redirect("/matches?locked=1");

  const { error: upsertError } = await supabaseAdmin
    .from("bets_outcome")
    .upsert(
      {
        team_id: team.teamId,
        match_id: matchId,
        selection,
      },
      { onConflict: "team_id,match_id" }
    );

  if (upsertError) redirect("/matches?error=1");
  redirect("/matches");
}

export async function setMatchExactScoreBetAction(formData: FormData) {
  const team = await requireSessionTeam();

  const matchIdRaw = formData.get("matchId");
  const matchId = typeof matchIdRaw === "string" ? matchIdRaw : "";

  const homeGoals = toInt(formData.get("homeGoals"));
  const awayGoals = toInt(formData.get("awayGoals"));
  const homePenalties = toInt(formData.get("homePenalties"));
  const awayPenalties = toInt(formData.get("awayPenalties"));

  if (!matchId || homeGoals === null || awayGoals === null) redirect("/matches?error=1");
  if (homeGoals < 0 || homeGoals > 10 || awayGoals < 0 || awayGoals > 10) redirect("/matches?error=1");

  const { data: match, error } = await supabaseAdmin
    .from("matches")
    .select("id,kickoff_at,stage_rank,status")
    .eq("id", matchId)
    .single();
  if (error || !match) redirect("/matches?error=1");

  const now = new Date();
  if (now >= new Date(match.kickoff_at)) redirect("/matches?locked=1");
  if (match.stage_rank < MIN_PLAYOFF_STAGE_RANK) redirect("/matches");
  if (match.status && match.status !== "SCHEDULED") redirect("/matches?locked=1");

  const isPenaltiesCase = homeGoals === awayGoals;
  if (isPenaltiesCase) {
    if (homePenalties === null || awayPenalties === null) {
      redirect("/matches?error=1");
    }
    if (
      homePenalties < 0 ||
      homePenalties > 10 ||
      awayPenalties < 0 ||
      awayPenalties > 10
    )
      redirect("/matches?error=1");
    if (homePenalties === awayPenalties) redirect("/matches?error=1");
  }

  const payload = {
    team_id: team.teamId,
    match_id: matchId,
    home_goals: homeGoals,
    away_goals: awayGoals,
    home_penalties: isPenaltiesCase ? homePenalties! : null,
    away_penalties: isPenaltiesCase ? awayPenalties! : null,
  };

  const { error: upsertError } = await supabaseAdmin
    .from("bets_exact_score")
    .upsert(payload, { onConflict: "team_id,match_id" });

  if (upsertError) redirect("/matches?error=1");
  redirect("/matches");
}

