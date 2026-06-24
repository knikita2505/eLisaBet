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

type ExistingMatchRow = {
  home_team_name: string;
  away_team_name: string;
  bet_locked_at: string | null;
  status: string;
  home_goals: number | null;
  away_goals: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
};

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

function apiHasFinalResult(payload: MatchUpsertPayload) {
  return (
    payload.status === "PLAYED" &&
    payload.home_goals != null &&
    payload.away_goals != null
  );
}

function existingHasManualResult(existing: ExistingMatchRow) {
  return (
    (existing.status === "PLAYED" || existing.status === "LIVE") &&
    existing.home_goals != null &&
    existing.away_goals != null
  );
}

/** Не затираем ручные правки админа, пока API не отдал финальный результат. */
export function mergeMatchWithExisting(
  existing: ExistingMatchRow,
  payload: MatchUpsertPayload
): MatchUpsertPayload {
  if (apiHasFinalResult(payload)) {
    return payload;
  }

  if (!existingHasManualResult(existing)) {
    return payload;
  }

  return {
    ...payload,
    status: existing.status as MatchUpsertPayload["status"],
    home_goals: existing.home_goals,
    away_goals: existing.away_goals,
    home_penalties: existing.home_penalties,
    away_penalties: existing.away_penalties,
    home_team_name: existing.home_team_name,
    away_team_name: existing.away_team_name,
  };
}

export async function upsertMatchesWithDedup(payloads: MatchUpsertPayload[]) {
  let upserted = 0;

  for (const payload of payloads) {
    const { data: existing } = await supabaseAdmin
      .from("matches")
      .select(
        "id,home_team_name,away_team_name,bet_locked_at,status,home_goals,away_goals,home_penalties,away_penalties"
      )
      .eq("tournament_id", payload.tournament_id)
      .eq("external_id", payload.external_id)
      .maybeSingle();

    const merged = existing
      ? mergeMatchWithExisting(existing as ExistingMatchRow, payload)
      : payload;

    const row = {
      ...merged,
      home_team_name: resolveTeamName(
        merged.home_team_name,
        existing?.home_team_name
      ),
      away_team_name: resolveTeamName(
        merged.away_team_name,
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
      const { error } = await supabaseAdmin.from("matches").insert({
        ...row,
        bet_locked_at: payload.kickoff_at,
      });
      if (error) throw error;
    }
    upserted++;
  }

  return upserted;
}
