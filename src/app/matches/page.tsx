import { redirect } from "next/navigation";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTournament } from "@/lib/db/tournament";
import { MIN_PLAYOFF_STAGE_RANK } from "@/lib/betting/stages";
import { stageLabel } from "@/lib/betting/stageMapping";
import { setMatchExactScoreBetAction, setMatchOutcomeBetAction } from "@/app/_actions/bets";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

type MatchRow = {
  id: string;
  stage: string;
  stage_rank: number;
  kickoff_at: string;
  status: string;
  home_team_name: string;
  away_team_name: string;
  home_goals: number | null;
  away_goals: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
};

type OutcomeBetRow = {
  match_id: string;
  selection: "home" | "away";
};

type ExactScoreBetRow = {
  match_id: string;
  home_goals: number;
  away_goals: number;
  home_penalties: number | null;
  away_penalties: number | null;
};

export default async function MatchesPage() {
  const team = await requireSessionTeam();
  if (!team.name) redirect("/onboarding");

  const tournamentId = await getActiveTournament();

  const { data: matchesRaw } = await supabaseAdmin
    .from("matches")
    .select(
      "id,stage,stage_rank,kickoff_at,status,home_team_name,away_team_name,home_goals,away_goals,home_penalties,away_penalties"
    )
    .eq("tournament_id", tournamentId)
    .gte("stage_rank", MIN_PLAYOFF_STAGE_RANK)
    .order("kickoff_at", { ascending: true });

  const matches = (matchesRaw ?? []) as MatchRow[];
  const matchIds = matches.map((m) => m.id);

  let outcomeBets: OutcomeBetRow[] = [];
  if (matchIds.length) {
    const { data } = await supabaseAdmin
      .from("bets_outcome")
      .select("match_id,selection")
      .eq("team_id", team.teamId)
      .in("match_id", matchIds);
    outcomeBets = (data ?? []) as OutcomeBetRow[];
  }

  let scoreBets: ExactScoreBetRow[] = [];
  if (matchIds.length) {
    const { data } = await supabaseAdmin
      .from("bets_exact_score")
      .select(
        "match_id,home_goals,away_goals,home_penalties,away_penalties"
      )
      .eq("team_id", team.teamId)
      .in("match_id", matchIds);
    scoreBets = (data ?? []) as ExactScoreBetRow[];
  }

  const now = new Date();

  const outcomeByMatch = new Map<string, OutcomeBetRow["selection"]>(
    outcomeBets.map((b) => [b.match_id, b.selection])
  );
  const scoreByMatch = new Map<string, ExactScoreBetRow>(
    scoreBets.map((b) => [b.match_id, b])
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Матчи и ставки</h1>
          <p className="mt-2 text-white/70">
            Ставки принимаются до начала каждого матча.
          </p>
        </div>
      </div>

      {matches.length ? (
        matches.map((m) => {
          const locked = now >= new Date(m.kickoff_at);
          const selection = outcomeByMatch.get(m.id);
          const score = scoreByMatch.get(m.id);

          return (
            <section
              key={m.id}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-white/70">
                      {stageLabel(m.stage)}
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {m.home_team_name} — {m.away_team_name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white/70">
                      {formatDateTime(m.kickoff_at)}
                    </div>
                    <div className="mt-1 text-sm">
                      {locked ? (
                        <span className="text-white/60">Закрыто</span>
                      ) : (
                        <span className="text-orange-400">Можно ставить</span>
                      )}
                    </div>
                  </div>
                </div>

                {m.status !== "SCHEDULED" ? (
                  <div className="text-sm text-white/80">
                    Результат:{" "}
                    {m.home_goals ?? "-"} : {m.away_goals ?? "-"}
                    {m.home_penalties != null && m.away_penalties != null ? (
                      <span className="text-white/60">
                        {" "}
                        (пен. {m.home_penalties}–{m.away_penalties})
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-white/10 bg-[#0f2744]/40 p-3">
                  <div className="text-sm font-semibold">1) Исход</div>
                  <form action={setMatchOutcomeBetAction} className="mt-3 flex gap-2">
                    <input type="hidden" name="matchId" value={m.id} />

                    <button
                      type="submit"
                      name="selection"
                      value="home"
                      disabled={locked}
                      className={
                        selection === "home"
                          ? "flex-1 rounded-md bg-orange-500 text-[#0f2744] px-3 py-2 font-semibold disabled:opacity-50"
                          : "flex-1 rounded-md border border-white/15 text-white/90 px-3 py-2 hover:bg-white/10 disabled:opacity-50"
                      }
                    >
                      Победа первой
                    </button>
                    <button
                      type="submit"
                      name="selection"
                      value="away"
                      disabled={locked}
                      className={
                        selection === "away"
                          ? "flex-1 rounded-md bg-orange-500 text-[#0f2744] px-3 py-2 font-semibold disabled:opacity-50"
                          : "flex-1 rounded-md border border-white/15 text-white/90 px-3 py-2 hover:bg-white/10 disabled:opacity-50"
                      }
                    >
                      Победа второй
                    </button>
                  </form>
                </div>

                <div className="rounded-lg border border-white/10 bg-[#0f2744]/40 p-3">
                  <div className="text-sm font-semibold">2) Точный счёт</div>

                  <form action={setMatchExactScoreBetAction} className="mt-3 grid grid-cols-2 gap-2">
                    <input type="hidden" name="matchId" value={m.id} />

                    <label className="text-xs text-white/70">
                      Хозяева
                      <select
                        name="homeGoals"
                        defaultValue={score?.home_goals ?? 0}
                        disabled={locked}
                        className="mt-1 w-full rounded-md bg-[#0f2744] border border-white/10 px-2 py-1 disabled:opacity-50"
                      >
                        {Array.from({ length: 8 }).map((_, i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs text-white/70">
                      Гости
                      <select
                        name="awayGoals"
                        defaultValue={score?.away_goals ?? 0}
                        disabled={locked}
                        className="mt-1 w-full rounded-md bg-[#0f2744] border border-white/10 px-2 py-1 disabled:opacity-50"
                      >
                        {Array.from({ length: 8 }).map((_, i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="col-span-2 text-xs text-white/70">
                      Если выбрали одинаковый счёт (например, 1:1), укажите пенальти.
                    </div>

                    <label className="text-xs text-white/70">
                      Пен. хозяева
                      <select
                        name="homePenalties"
                        defaultValue={
                          score?.home_penalties != null ? String(score.home_penalties) : ""
                        }
                        disabled={locked}
                        className="mt-1 w-full rounded-md bg-[#0f2744] border border-white/10 px-2 py-1 disabled:opacity-50"
                      >
                        <option value="">—</option>
                        {Array.from({ length: 8 }).map((_, i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs text-white/70">
                      Пен. гости
                      <select
                        name="awayPenalties"
                        defaultValue={
                          score?.away_penalties != null ? String(score.away_penalties) : ""
                        }
                        disabled={locked}
                        className="mt-1 w-full rounded-md bg-[#0f2744] border border-white/10 px-2 py-1 disabled:opacity-50"
                      >
                        <option value="">—</option>
                        {Array.from({ length: 8 }).map((_, i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="submit"
                      disabled={locked}
                      className="col-span-2 mt-1 inline-flex justify-center rounded-md bg-orange-500 px-3 py-2 font-semibold text-[#0f2744] hover:bg-orange-400 disabled:opacity-50"
                    >
                      Сохранить
                    </button>
                  </form>
                </div>
              </div>
            </section>
          );
        })
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/70">
          Пока нет данных матчей. Админу нужно синхронизировать расписание.
        </div>
      )}
    </div>
  );
}

