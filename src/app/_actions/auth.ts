"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createTeamSession } from "@/lib/auth/session";

export async function loginAction(formData: FormData) {
  const codeRaw = formData.get("code");
  const code = typeof codeRaw === "string" ? codeRaw.trim() : "";
  if (!code) redirect("/login?error=1");

  const { data: team, error } = await supabaseAdmin
    .from("teams")
    .select("id, name")
    .eq("code", code)
    .single();

  if (error || !team) redirect("/login?error=1");

  await createTeamSession(team.id);
  if (!team.name) redirect("/onboarding");
  redirect("/matches");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("elisabet_session");
  redirect("/login");
}

