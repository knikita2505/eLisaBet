import "server-only";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

export function generateParticipantCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  return Array.from(
    bytes,
    (b) => CODE_CHARS[b % CODE_CHARS.length]
  ).join("");
}

export async function generateUniqueParticipantCode(): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const code = generateParticipantCode();
    const { data } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (!data) return code;
  }

  throw new Error("Не удалось сгенерировать уникальный код");
}
