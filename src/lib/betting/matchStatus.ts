export type MatchDbStatus = "SCHEDULED" | "LIVE" | "PLAYED";

export type MatchDisplayStatus = {
  label: "Ожидается" | "Идёт" | "Завершена";
  badgeClass: "badge-scheduled" | "badge-live" | "badge-finished";
};

export function getMatchDisplayStatus(match: {
  status: string;
  kickoff_at: string;
}): MatchDisplayStatus {
  if (match.status === "PLAYED") {
    return { label: "Завершена", badgeClass: "badge-finished" };
  }

  const started = new Date() >= new Date(match.kickoff_at);
  if (match.status === "LIVE" || started) {
    return { label: "Идёт", badgeClass: "badge-live" };
  }

  return { label: "Ожидается", badgeClass: "badge-scheduled" };
}

export function isBettingOpen(match: {
  bet_locked_at?: string | null;
  kickoff_at: string;
}) {
  const deadline = match.bet_locked_at ?? match.kickoff_at;
  return new Date() < new Date(deadline);
}
