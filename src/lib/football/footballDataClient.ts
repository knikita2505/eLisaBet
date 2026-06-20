import "server-only";
import { env } from "@/lib/env";

export type FootballDataMatchesResponse = {
  matches: Array<Record<string, unknown>>;
};

export async function fetchWorldCupMatchesFromFootballData() {
  const url = `https://api.football-data.org/v4/competitions/${env.FOOTBALL_DATA_COMPETITION_CODE}/matches?season=${env.FOOTBALL_DATA_SEASON}`;

  const res = await fetch(url, {
    headers: {
      "X-Auth-Token": env.FOOTBALL_DATA_API_KEY,
      Accept: "application/json",
    },
    // Sync should not be cached
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `football-data.org error: ${res.status} ${res.statusText} ${text}`
    );
  }

  const json = (await res.json()) as FootballDataMatchesResponse;
  return json.matches ?? [];
}

