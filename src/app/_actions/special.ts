"use server";

import "server-only";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireSessionTeam } from "@/lib/auth/session";
import { getActiveTournament } from "@/lib/db/tournament";

export async function setChampionBetAction(formData: FormData) {
  const team = await requireSessionTeam();
  const pick = formData.get("pickCountry");
  const pickCountry = typeof pick === "string" ? pick.trim() : "";
  if (!pickCountry) redirect("/special?error=1");

  const tournamentId = await getActiveTournament();

  const { data: tournament } = await supabaseAdmin
    .from("tournaments")
    .select("winner_bet_locked_at")
    .eq("id", tournamentId)
    .single();

  const lockedAt = tournament?.winner_bet_locked_at
    ? new Date(tournament.winner_bet_locked_at)
    : null;
  if (lockedAt && new Date() >= lockedAt) redirect("/special?locked=1");

  const { error } = await supabaseAdmin
    .from("bets_champion")
    .upsert(
      { team_id: team.teamId, tournament_id: tournamentId, pick_country: pickCountry },
      { onConflict: "team_id,tournament_id" }
    );
  if (error) redirect("/special?error=1");
  redirect("/special");
}

export async function setThirdPlaceBetAction(formData: FormData) {
  const team = await requireSessionTeam();
  const pick = formData.get("pickCountry");
  const pickCountry = typeof pick === "string" ? pick.trim() : "";
  if (!pickCountry) redirect("/special?error=1");

  const tournamentId = await getActiveTournament();

  const { data: tournament } = await supabaseAdmin
    .from("tournaments")
    .select("third_place_bet_locked_at")
    .eq("id", tournamentId)
    .single();

  const lockedAt = tournament?.third_place_bet_locked_at
    ? new Date(tournament.third_place_bet_locked_at)
    : null;
  if (lockedAt && new Date() >= lockedAt) redirect("/special?locked=1");

  const { error } = await supabaseAdmin
    .from("bets_third_place")
    .upsert(
      { team_id: team.teamId, tournament_id: tournamentId, pick_country: pickCountry },
      { onConflict: "team_id,tournament_id" }
    );
  if (error) redirect("/special?error=1");
  redirect("/special");
}

