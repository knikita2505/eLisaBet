import { STAGE_RANK } from "@/lib/betting/stages";

export function stageKeyFromFootballData(stageRaw: string | null | undefined) {
  const s = (stageRaw ?? "").toUpperCase();

  if (
    s === "LAST_32" ||
    s === "ROUND_OF_32" ||
    s.includes("ROUND OF 32") ||
    s === "R32"
  ) {
    return { key: "R32", label: "1/16 финала", rank: STAGE_RANK.R32 };
  }
  if (
    s === "LAST_16" ||
    s === "ROUND_OF_16" ||
    s.includes("ROUND OF 16") ||
    s === "R16"
  ) {
    return { key: "R16", label: "1/8 финала", rank: STAGE_RANK.R16 };
  }
  if (s === "QUARTER_FINALS" || s.includes("QUARTER")) {
    return { key: "QF", label: "1/4 финала", rank: STAGE_RANK.QF };
  }
  if (s === "SEMI_FINALS" || s.includes("SEMI")) {
    return { key: "SF", label: "Полуфинал", rank: STAGE_RANK.SF };
  }
  if (s === "THIRD_PLACE" || s.includes("THIRD")) {
    return { key: "THIRD_PLACE", label: "Матч за 3-е место", rank: STAGE_RANK.THIRD_PLACE };
  }
  if (s === "FINAL") {
    return { key: "FINAL", label: "Финал", rank: STAGE_RANK.FINAL };
  }

  return { key: "UNKNOWN", label: stageRaw ?? "—", rank: 0 };
}

export function stageLabel(stageKey: string) {
  const map: Record<string, string> = {
    R32: "1/16 финала",
    R16: "1/8 финала",
    QF: "1/4 финала",
    SF: "Полуфинал",
    THIRD_PLACE: "Матч за 3-е место",
    FINAL: "Финал",
  };
  return map[stageKey] ?? stageKey;
}
