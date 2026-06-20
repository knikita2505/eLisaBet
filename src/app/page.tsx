import { redirect } from "next/navigation";
import { getSessionTeam } from "@/lib/auth/session";

export default async function Home() {
  const team = await getSessionTeam();
  if (!team) redirect("/login");
  if (!team.name) redirect("/onboarding");
  redirect("/matches");
}
