import { isPlaceholderTeamName } from "@/lib/sync/matchUpsert";
import { translateTeamToRu } from "@/lib/football/teamTranslations";

export function displayTeamName(
  name: string,
  slot: "home" | "away",
  translations?: Map<string, string>
): string {
  if (isPlaceholderTeamName(name)) {
    return slot === "home" ? "Команда 1" : "Команда 2";
  }

  const fromDb = translations?.get(name);
  if (fromDb) return fromDb;

  return translateTeamToRu(name);
}
