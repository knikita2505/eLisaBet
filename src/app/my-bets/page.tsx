import { redirect } from "next/navigation";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTournament } from "@/lib/db/tournament";
import { stageLabel } from "@/lib/betting/stageMapping";

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function MyBetsPage() {
  const team = await requireSessionTeam();
  if (!team.name) redirect("/onboarding");

  const tournamentId = await getActiveTournament();

  const { data: outcomeBets } = await supabaseAdmin
    .from("bets_outcome")
    .select("id,selection,match_id,created_at")
    .eq("team_id", team.teamId);

  const { data: scoreBets } = await supabaseAdmin
    .from("bets_exact_score")
    .select(
      "id,home_goals,away_goals,home_penalties,away_penalties,match_id,created_at"
    )
    .eq("team_id", team.teamId);

  const { data: championBet } = await supabaseAdmin
    .from("bets_champion")
    .select("id,pick_country,created_at")
    .eq("team_id", team.teamId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();

  const { data: thirdBet } = await supabaseAdmin
    .from("bets_third_place")
    .select("id,pick_country,created_at")
    .eq("team_id", team.teamId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();

  const matchIds = [
    ...new Set([
      ...(outcomeBets ?? []).map((b) => b.match_id),
      ...(scoreBets ?? []).map((b) => b.match_id),
    ]),
  ];

  const { data: matches } = matchIds.length
    ? await supabaseAdmin
        .from("matches")
        .select(
          "id,stage,kickoff_at,status,home_team_name,away_team_name,home_goals,away_goals,home_penalties,away_penalties"
        )
        .in("id", matchIds)
    : { data: [] };

  const matchById = new Map((matches ?? []).map((m) => [m.id, m]));

  const { data: ledger } = await supabaseAdmin
    .from("team_points_ledger")
    .select("bet_type,bet_id,points")
    .eq("team_id", team.teamId)
    .eq("tournament_id", tournamentId);

  const pointsByBet = new Map<string, number>();
  for (const row of ledger ?? []) {
    pointsByBet.set(`${row.bet_type}:${row.bet_id}`, row.points);
  }

  const totalPoints = (ledger ?? []).reduce((sum, r) => sum + r.points, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Мои ставки</h1>
        <p className="mt-2 text-white/70">
          Команда: <span className="text-white font-semibold">{team.name}</span> ·
          Очков: <span className="text-orange-400 font-semibold">{totalPoints}</span>
        </p>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold">Спецставки</h2>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
            <span>Победитель ЧМ</span>
            <span className="text-white/80">
              {championBet?.pick_country ?? "—"}
              {championBet
                ? ` (+${pointsByBet.get(`champion:${championBet.id}`) ?? 0})`
                : ""}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span>3-е место</span>
            <span className="text-white/80">
              {thirdBet?.pick_country ?? "—"}
              {thirdBet
                ? ` (+${pointsByBet.get(`third_place:${thirdBet.id}`) ?? 0})`
                : ""}
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold">Ставки на матчи</h2>

        {!outcomeBets?.length && !scoreBets?.length ? (
          <p className="mt-3 text-sm text-white/60">
            Пока нет ставок. Перейдите в раздел «Матчи».
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {matchIds.map((matchId) => {
              const m = matchById.get(matchId);
              const outcome = outcomeBets?.find((b) => b.match_id === matchId);
              const score = scoreBets?.find((b) => b.match_id === matchId);

              return (
                <div
                  key={matchId}
                  className="rounded-lg border border-white/10 bg-[#0f2744]/40 p-3"
                >
                  {m ? (
                    <>
                      <div className="text-sm text-white/70">
                        {stageLabel(m.stage)} · {formatDateTime(m.kickoff_at)}
                      </div>
                      <div className="font-semibold">
                        {m.home_team_name} — {m.away_team_name}
                      </div>
                      {m.status === "PLAYED" ? (
                        <div className="text-sm text-white/80">
                          Результат: {m.home_goals}:{m.away_goals}
                          {m.home_penalties != null
                            ? ` (пен. ${m.home_penalties}:${m.away_penalties})`
                            : ""}
                        </div>
                      ) : (
                        <div className="text-sm text-orange-400">Ожидается</div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-white/60">Матч</div>
                  )}

                  <div className="mt-2 text-sm space-y-1">
                    {outcome ? (
                      <div>
                        Исход:{" "}
                        {outcome.selection === "home"
                          ? "победа первой"
                          : "победа второй"}
                        {" "}
                        <span className="text-orange-400">
                          (+{pointsByBet.get(`match_outcome:${outcome.id}`) ?? 0})
                        </span>
                      </div>
                    ) : null}
                    {score ? (
                      <div>
                        Точный счёт: {score.home_goals}:{score.away_goals}
                        {score.home_penalties != null
                          ? ` (пен. ${score.home_penalties}:${score.away_penalties})`
                          : ""}
                        {" "}
                        <span className="text-orange-400">
                          (+{pointsByBet.get(`match_exact_score:${score.id}`) ?? 0})
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
