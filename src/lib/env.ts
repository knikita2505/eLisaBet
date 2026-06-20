import { z } from "zod";

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

/** Supabase JS client adds /rest/v1 itself — strip if copied from REST docs */
function normalizeSupabaseUrl(url: string) {
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

export const env = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    SESSION_SECRET: z.string().min(16),
    FOOTBALL_DATA_API_KEY: z.string().min(1),
    FOOTBALL_DATA_COMPETITION_CODE: z.string().min(1).default("WC"),
    FOOTBALL_DATA_SEASON: z.coerce.number().int().default(2026),
    CRON_SECRET: z.string().min(8).optional(),
  })
  .parse({
    NEXT_PUBLIC_SUPABASE_URL: normalizeSupabaseUrl(
      requiredEnv("NEXT_PUBLIC_SUPABASE_URL")
    ),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    SESSION_SECRET: requiredEnv("SESSION_SECRET"),
    FOOTBALL_DATA_API_KEY: requiredEnv("FOOTBALL_DATA_API_KEY"),
    FOOTBALL_DATA_COMPETITION_CODE:
      process.env.FOOTBALL_DATA_COMPETITION_CODE ?? "WC",
    FOOTBALL_DATA_SEASON: process.env.FOOTBALL_DATA_SEASON ?? "2026",
    CRON_SECRET: process.env.CRON_SECRET,
  });

