import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

const COOKIE_NAME = "elisabet_session";

type SessionPayload = {
  teamId: string;
};

export type TeamSession = {
  teamId: string;
  role: "admin" | "team";
  name: string | null;
};

export async function createTeamSession(teamId: string) {
  // HMAC-signed JWT (HS256) stored in httpOnly cookie
  const secret = new TextEncoder().encode(env.SESSION_SECRET);
  const token = await new SignJWT({ teamId } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function getSessionTeam() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(env.SESSION_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    const teamId = payload.teamId;
    if (typeof teamId !== "string") return null;

    const { data, error } = await supabaseAdmin
      .from("teams")
      .select("id, role, name")
      .eq("id", teamId)
      .single();
    if (error || !data) return null;

    return {
      teamId: data.id,
      role: data.role as "admin" | "team",
      name: data.name as string | null,
    } satisfies TeamSession;
  } catch {
    return null;
  }
}

export async function requireSessionTeam() {
  const team = await getSessionTeam();
  if (!team) redirect("/login");
  return team;
}

