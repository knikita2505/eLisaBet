import { STAGE_RANK } from "@/lib/betting/stages";
import { stageLabel } from "@/lib/betting/stageMapping";

export type StageGroup<T> = {
  stageKey: string;
  stageRank: number;
  label: string;
  matches: T[];
};

export type DisplayMatchGroup<T> =
  | {
      type: "groups";
      label: string;
      stageRank: number;
      children: StageGroup<T>[];
    }
  | {
      type: "stage";
      stageKey: string;
      stageRank: number;
      label: string;
      matches: T[];
    };

export function groupMatchesByStage<T extends { stage: string; stage_rank: number }>(
  matches: T[]
): StageGroup<T>[] {
  const map = new Map<string, StageGroup<T>>();

  for (const m of matches) {
    if (!map.has(m.stage)) {
      map.set(m.stage, {
        stageKey: m.stage,
        stageRank: m.stage_rank,
        label: stageLabel(m.stage),
        matches: [],
      });
    }
    map.get(m.stage)!.matches.push(m);
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.stageRank !== b.stageRank) return a.stageRank - b.stageRank;
    return a.stageKey.localeCompare(b.stageKey, "ru");
  });
}

export function groupMatchesForDisplay<
  T extends { stage: string; stage_rank: number; kickoff_at: string },
>(matches: T[]): DisplayMatchGroup<T>[] {
  const stageGroups = groupMatchesByStage(matches);
  const groupStages = stageGroups
    .filter((g) => g.stageRank === STAGE_RANK.GROUP)
    .sort((a, b) => {
      const aKickoff = Math.min(
        ...a.matches.map((m) => new Date(m.kickoff_at).getTime())
      );
      const bKickoff = Math.min(
        ...b.matches.map((m) => new Date(m.kickoff_at).getTime())
      );
      return aKickoff - bKickoff;
    });
  const playoffStages = stageGroups.filter((g) => g.stageRank > STAGE_RANK.GROUP);

  const result: DisplayMatchGroup<T>[] = [];

  if (groupStages.length) {
    result.push({
      type: "groups",
      label: "Группы",
      stageRank: STAGE_RANK.GROUP,
      children: groupStages,
    });
  }

  for (const stage of playoffStages) {
    result.push({ type: "stage", ...stage });
  }

  return result;
}
