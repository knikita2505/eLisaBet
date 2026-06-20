"use server";

import "server-only";
import { redirect } from "next/navigation";
import { requireSessionTeam } from "@/lib/auth/session";
import { syncWorldCupMatches } from "@/lib/sync/syncWorldCup";

export async function syncWorldCupAction() {
  const team = await requireSessionTeam();
  if (team.role !== "admin") redirect("/login");

  await syncWorldCupMatches();
  redirect("/admin?ok=1");
}

