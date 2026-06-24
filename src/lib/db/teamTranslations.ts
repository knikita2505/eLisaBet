import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { translateTeamToRu } from "@/lib/football/teamTranslations";

export async function loadTeamTranslations(tournamentId: string) {
  const { data } = await supabaseAdmin
    .from("tournament_teams")
    .select("team_name,name_ru")
    .eq("tournament_id", tournamentId);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const ru = row.name_ru?.trim() || translateTeamToRu(row.team_name);
    map.set(row.team_name, ru);
  }
  return map;
}

export async function upsertTournamentTeamTranslations(
  tournamentId: string,
  apiNames: string[]
) {
  const unique = [...new Set(apiNames.map((n) => n.trim()).filter(Boolean))];
  if (!unique.length) return;

  const rows = unique.map((team_name) => ({
    tournament_id: tournamentId,
    team_name,
    name_ru: translateTeamToRu(team_name),
  }));

  const { error } = await supabaseAdmin
    .from("tournament_teams")
    .upsert(rows, { onConflict: "tournament_id,team_name" });

  if (error) {
    console.warn("tournament_teams upsert failed:", error.message);
  }
}
