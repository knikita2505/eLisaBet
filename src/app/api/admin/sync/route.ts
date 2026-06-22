import { NextResponse } from "next/server";
import "server-only";
import { syncWorldCupMatches } from "@/lib/sync/syncWorldCup";
import { getSessionTeam } from "@/lib/auth/session";
import { env } from "@/lib/env";

function isAuthorizedCron(req: Request) {
  if (!env.CRON_SECRET) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${env.CRON_SECRET}`) return true;
  const headerSecret = req.headers.get("x-cron-secret");
  return headerSecret === env.CRON_SECRET;
}

async function runSync() {
  try {
    const result = await syncWorldCupMatches();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === "string" ? e : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSync();
}

export async function POST(req: Request) {
  if (isAuthorizedCron(req)) {
    return runSync();
  }

  const team = await getSessionTeam();
  if (!team || team.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runSync();
}
