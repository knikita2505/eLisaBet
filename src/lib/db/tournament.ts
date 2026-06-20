import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function getTournamentIdBySlug(slug: string) {
  const { data, error } = await supabaseAdmin
    .from("tournaments")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`tournament lookup failed: ${error.message}`);
  if (!data) throw new Error(`Tournament not found: ${slug}`);
  return data.id as string;
}

export async function getActiveTournament() {
  // MVP: фиксируем ЧМ 2026 через slug
  return getTournamentIdBySlug("wc2026");
}

