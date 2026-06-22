import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MatchUpsertPayload } from "@/lib/sync/types";

const PLACEHOLDERS = new Set([
  "",
  "уточняется",
  "tbd",
  "to be determined",
  "winner",
  "loser",
]);

export function isPlaceholderTeamName(name: string | null | undefined) {
  if (!name?.trim()) return true;
  const n = name.trim().toLowerCase();
  if (PLACEHOLDERS.has(n)) return true;
  return n.startsWith("winner ") || n.startsWith("loser ");
}

export function resolveTeamName(
  incoming: string,
  existing?: string | null
): string {
  if (!isPlaceholderTeamName(incoming)) return incoming.trim();
  if (existing && !isPlaceholderTeamName(existing)) return existing;
  return incoming.trim() || "Уточняется";
}

export async function upsertMatchesWithDedup(payloads: MatchUpsertPayload[]) {
  let upserted = 0;

  for (const payload of payloads) {
    const { data: existing } = await supabaseAdmin
      .from("matches")
      .select("id,home_team_name,away_team_name")
      .eq("tournament_id", payload.tournament_id)
      .eq("kickoff_at", payload.kickoff_at)
      .eq("stage_rank", payload.stage_rank)
      .maybeSingle();

    const row = {
      ...payload,
      home_team_name: resolveTeamName(
        payload.home_team_name,
        existing?.home_team_name
      ),
      away_team_name: resolveTeamName(
        payload.away_team_name,
        existing?.away_team_name
      ),
    };

    if (existing) {
      const { error } = await supabaseAdmin
        .from("matches")
        .update(row)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("matches").insert(row);
      if (error) throw error;
    }
    upserted++;
  }

  return upserted;
}
