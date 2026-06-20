import { NextResponse } from "next/server";
import "server-only";
import { syncWorldCupMatches } from "@/lib/sync/syncWorldCup";
import { getSessionTeam } from "@/lib/auth/session";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  const cronSecret = req.headers.get("x-cron-secret") ?? "";
  const isCron = env.CRON_SECRET ? cronSecret === env.CRON_SECRET : false;

  let team = null;
  if (!isCron) {
    team = await getSessionTeam();
    if (!team || team.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await syncWorldCupMatches();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === "string" ? e : String(e);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

