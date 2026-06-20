"use server";

import "server-only";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncWorldCupMatches } from "@/lib/sync/syncWorldCup";
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
    result = await syncWorldCupMatches();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Ошибка синхронизации";
    redirect(`/admin?error=${encodeURIComponent(message)}`);
  }

  const q = new URLSearchParams({
    ok: "1",
    upserted: String(result.upserted),
    fetched: String(result.fetched),
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

export async function updateMatchResultAction(formData: FormData) {
  await requireAdmin();

  const matchId = formData.get("matchId");
  if (typeof matchId !== "string" || !matchId) redirect("/admin?error=invalid");

  const homeGoals = Number(formData.get("homeGoals"));
  const awayGoals = Number(formData.get("awayGoals"));
  const homePenaltiesRaw = formData.get("homePenalties");
  const awayPenaltiesRaw = formData.get("awayPenalties");

  const homePenalties =
    typeof homePenaltiesRaw === "string" && homePenaltiesRaw !== ""
      ? Number(homePenaltiesRaw)
      : null;
  const awayPenalties =
    typeof awayPenaltiesRaw === "string" && awayPenaltiesRaw !== ""
      ? Number(awayPenaltiesRaw)
      : null;

  const { error } = await supabaseAdmin
    .from("matches")
    .update({
      status: "PLAYED",
      home_goals: homeGoals,
      away_goals: awayGoals,
      home_penalties: homePenalties,
      away_penalties: awayPenalties,
    })
    .eq("id", matchId);

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
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

  redirect("/admin?updated=1");
}
