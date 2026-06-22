"use server";

import "server-only";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { importWorldCupMatches } from "@/lib/sync/syncWorldCup";
import { recalculateTournamentPoints } from "@/lib/sync/finalizeSync";
import { awardPointsForPlayedMatch } from "@/lib/sync/awardPoints";
import { getActiveTournament } from "@/lib/db/tournament";

async function requireAdmin() {
  const team = await requireSessionTeam();
  if (team.role !== "admin") redirect("/matches");
  return team;
}

export async function syncWorldCupAction() {
  await requireAdmin();

  let result;
  try {
    result = await importWorldCupMatches();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Ошибка синхронизации";
    redirect(`/admin?error=${encodeURIComponent(message)}`);
  }

  const q = new URLSearchParams({
    synced: "1",
    upserted: String(result.upserted),
    fetched: String(result.fetched),
  });
  redirect(`/admin?${q.toString()}`);
}

export async function recalculatePointsAction() {
  await requireAdmin();

  let result;
  try {
    result = await recalculateTournamentPoints();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Ошибка пересчёта";
    redirect(`/admin?error=${encodeURIComponent(message)}`);
  }

  const q = new URLSearchParams({
    recalculated: "1",
    played: String(result.played),
    points: String(result.pointsAwarded),
  });
  redirect(`/admin?${q.toString()}`);
}

export async function createTeamAction(formData: FormData) {
  await requireAdmin();

  const codeRaw = formData.get("code");
  const code =
    typeof codeRaw === "string" && codeRaw.trim()
      ? codeRaw.trim()
      : `TEAM-${randomBytes(3).toString("hex").toUpperCase()}`;

  const { error } = await supabaseAdmin.from("teams").insert({
    code,
    name: null,
    role: "team",
  });

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/admin?created=${encodeURIComponent(code)}`);
}

export async function updateTeamNameAction(formData: FormData) {
  await requireAdmin();

  const teamId = formData.get("teamId");
  const nameRaw = formData.get("name");
  const name = typeof nameRaw === "string" ? nameRaw.trim() : "";

  if (typeof teamId !== "string" || !teamId || !name) {
    redirect("/admin?error=invalid");
  }

  const { error } = await supabaseAdmin
    .from("teams")
    .update({ name })
    .eq("id", teamId);

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/admin?teamUpdated=1");
}

export async function deleteTeamAction(formData: FormData) {
  const admin = await requireAdmin();

  const teamId = formData.get("teamId");
  if (typeof teamId !== "string" || !teamId) {
    redirect("/admin?error=invalid");
  }

  if (teamId === admin.teamId) {
    redirect("/admin?error=" + encodeURIComponent("Нельзя удалить свою команду"));
  }

  const { data: target } = await supabaseAdmin
    .from("teams")
    .select("role")
    .eq("id", teamId)
    .single();

  if (target?.role === "admin") {
    redirect("/admin?error=" + encodeURIComponent("Нельзя удалить админа"));
  }

  const { error } = await supabaseAdmin.from("teams").delete().eq("id", teamId);

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/admin?teamDeleted=1");
}

export async function updateMatchResultAction(formData: FormData) {
  await requireAdmin();

  const matchId = formData.get("matchId");
  if (typeof matchId !== "string" || !matchId) {
    redirect("/admin/results?error=invalid");
  }

  const homeGoals = Number(formData.get("homeGoals"));
  const awayGoals = Number(formData.get("awayGoals"));

  const { error } = await supabaseAdmin
    .from("matches")
    .update({
      status: "PLAYED",
      home_goals: homeGoals,
      away_goals: awayGoals,
      home_penalties: null,
      away_penalties: null,
    })
    .eq("id", matchId);

  if (error) {
    redirect(`/admin/results?error=${encodeURIComponent(error.message)}`);
  }

  const tournamentId = await getActiveTournament();
  const { data: match } = await supabaseAdmin
    .from("matches")
    .select(
      "id,home_team_name,away_team_name,home_goals,away_goals,home_penalties,away_penalties"
    )
    .eq("id", matchId)
    .single();

  if (match) {
    await awardPointsForPlayedMatch({ tournamentId, match });
  }

  redirect("/admin/results?updated=1");
}

const BET_TABLES = {
  match_outcome: "bets_outcome",
  match_exact_score: "bets_exact_score",
  champion: "bets_champion",
  third_place: "bets_third_place",
} as const;

type BetType = keyof typeof BET_TABLES;

export async function deleteBetAction(formData: FormData) {
  await requireAdmin();

  const betType = formData.get("betType");
  const betId = formData.get("betId");

  if (
    typeof betType !== "string" ||
    typeof betId !== "string" ||
    !betId ||
    !(betType in BET_TABLES)
  ) {
    redirect("/admin/bets?error=invalid");
  }

  const typedBetType = betType as BetType;

  await supabaseAdmin
    .from("team_points_ledger")
    .delete()
    .eq("bet_type", typedBetType)
    .eq("bet_id", betId);

  const { error } = await supabaseAdmin
    .from(BET_TABLES[typedBetType])
    .delete()
    .eq("id", betId);

  if (error) {
    redirect(`/admin/bets?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/admin/bets?deleted=1");
}
