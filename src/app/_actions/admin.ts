"use server";

import "server-only";
import { redirect } from "next/navigation";
import { requireSessionTeam } from "@/lib/auth/session";
import { generateUniqueParticipantCode } from "@/lib/auth/participantCode";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { importWorldCupMatches } from "@/lib/sync/syncWorldCup";
import { recalculateTournamentPoints } from "@/lib/sync/finalizeSync";

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

  const nameRaw = formData.get("name");
  const name = typeof nameRaw === "string" ? nameRaw.trim() : "";

  if (!name) {
    redirect("/admin?error=" + encodeURIComponent("Укажите имя участника"));
  }

  let code: string;
  try {
    code = await generateUniqueParticipantCode();
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Не удалось сгенерировать код";
    redirect(`/admin?error=${encodeURIComponent(message)}`);
  }

  const { error } = await supabaseAdmin.from("teams").insert({
    code,
    name,
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
    redirect(
      "/admin?error=" + encodeURIComponent("Нельзя удалить свой аккаунт")
    );
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

export async function updateMatchAction(formData: FormData) {
  await requireAdmin();

  const matchId = formData.get("matchId");
  if (typeof matchId !== "string" || !matchId) {
    redirect("/admin/results?error=invalid");
  }

  const homeTeamNameRaw = formData.get("homeTeamName");
  const awayTeamNameRaw = formData.get("awayTeamName");
  const homeTeamName =
    typeof homeTeamNameRaw === "string" ? homeTeamNameRaw.trim() : "";
  const awayTeamName =
    typeof awayTeamNameRaw === "string" ? awayTeamNameRaw.trim() : "";

  const statusRaw = formData.get("status");
  const status =
    statusRaw === "SCHEDULED" ||
    statusRaw === "LIVE" ||
    statusRaw === "PLAYED"
      ? statusRaw
      : "SCHEDULED";

  const betLockedAtRaw = formData.get("betLockedAt");
  const homeGoals = Number(formData.get("homeGoals"));
  const awayGoals = Number(formData.get("awayGoals"));

  if (!homeTeamName || !awayTeamName) {
    redirect("/admin/results?error=" + encodeURIComponent("Укажите названия команд"));
  }

  const { data: existing } = await supabaseAdmin
    .from("matches")
    .select("kickoff_at,status")
    .eq("id", matchId)
    .single();

  if (!existing) redirect("/admin/results?error=invalid");

  const { fromDatetimeLocalValue } = await import("@/lib/formatDateTime");

  let betLockedAt: string;
  if (typeof betLockedAtRaw === "string" && betLockedAtRaw) {
    betLockedAt = fromDatetimeLocalValue(betLockedAtRaw);
  } else {
    betLockedAt = existing.kickoff_at;
  }

  if (new Date(betLockedAt) > new Date(existing.kickoff_at)) {
    redirect(
      "/admin/results?error=" +
        encodeURIComponent("Дедлайн ставок не может быть позже начала матча")
    );
  }

  const update: Record<string, unknown> = {
    home_team_name: homeTeamName,
    away_team_name: awayTeamName,
    status,
    bet_locked_at: betLockedAt,
    home_penalties: null,
    away_penalties: null,
  };

  if (status === "PLAYED") {
    if (
      !Number.isFinite(homeGoals) ||
      !Number.isFinite(awayGoals) ||
      homeGoals < 0 ||
      awayGoals < 0
    ) {
      redirect(
        "/admin/results?error=" +
          encodeURIComponent("Укажите корректный счёт матча")
      );
    }
    update.home_goals = homeGoals;
    update.away_goals = awayGoals;
  } else {
    update.home_goals = null;
    update.away_goals = null;
  }

  const { error } = await supabaseAdmin
    .from("matches")
    .update(update)
    .eq("id", matchId);

  if (error) {
    redirect(`/admin/results?error=${encodeURIComponent(error.message)}`);
  }

  if (status === "PLAYED" || existing.status === "PLAYED") {
    await recalculateTournamentPoints();
  }

  redirect("/admin/results?updated=1");
}

/** @deprecated используйте updateMatchAction */
export async function updateMatchResultAction(formData: FormData) {
  return updateMatchAction(formData);
}

const BET_TABLES = {
  match_outcome: "bets_outcome",
  match_exact_score: "bets_exact_score",
  match_both_teams_score: "bets_both_teams_score",
  match_penalty_shootout: "bets_penalty_shootout",
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

export async function deleteMatchBetsAction(formData: FormData) {
  await requireAdmin();

  const teamId = formData.get("teamId");
  const matchId = formData.get("matchId");

  if (typeof teamId !== "string" || !teamId || typeof matchId !== "string" || !matchId) {
    redirect("/admin/bets?error=invalid");
  }

  const { data: outcomeBet } = await supabaseAdmin
    .from("bets_outcome")
    .select("id")
    .eq("team_id", teamId)
    .eq("match_id", matchId)
    .maybeSingle();

  const { data: scoreBet } = await supabaseAdmin
    .from("bets_exact_score")
    .select("id")
    .eq("team_id", teamId)
    .eq("match_id", matchId)
    .maybeSingle();

  const { data: bttsBet } = await supabaseAdmin
    .from("bets_both_teams_score")
    .select("id")
    .eq("team_id", teamId)
    .eq("match_id", matchId)
    .maybeSingle();

  const { data: shootoutBet } = await supabaseAdmin
    .from("bets_penalty_shootout")
    .select("id")
    .eq("team_id", teamId)
    .eq("match_id", matchId)
    .maybeSingle();

  if (!outcomeBet && !scoreBet && !bttsBet && !shootoutBet) {
    redirect("/admin/bets?error=invalid");
  }

  const deleteBetRecord = async (betType: BetType, betId: string) => {
    await supabaseAdmin
      .from("team_points_ledger")
      .delete()
      .eq("bet_type", betType)
      .eq("bet_id", betId);

    const { error } = await supabaseAdmin
      .from(BET_TABLES[betType])
      .delete()
      .eq("id", betId);

    if (error) {
      redirect(`/admin/bets?error=${encodeURIComponent(error.message)}`);
    }
  };

  if (outcomeBet) {
    await deleteBetRecord("match_outcome", outcomeBet.id);
  }

  if (scoreBet) {
    await deleteBetRecord("match_exact_score", scoreBet.id);
  }

  if (bttsBet) {
    await deleteBetRecord("match_both_teams_score", bttsBet.id);
  }

  if (shootoutBet) {
    await deleteBetRecord("match_penalty_shootout", shootoutBet.id);
  }

  redirect("/admin/bets?deleted=1");
}
