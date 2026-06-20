"use server";

import { redirect } from "next/navigation";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function setTeamNameAction(formData: FormData) {
  const team = await requireSessionTeam();

  const nameRaw = formData.get("name");
  const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
  if (!name) redirect("/onboarding?error=1");

  const { error } = await supabaseAdmin
    .from("teams")
    .update({ name })
    .eq("id", team.teamId)
    .is("name", null);

  if (error) redirect("/onboarding?error=1");
  redirect("/matches");
}

