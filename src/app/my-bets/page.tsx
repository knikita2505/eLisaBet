import { redirect } from "next/navigation";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTournament } from "@/lib/db/tournament";
import { stageLabel } from "@/lib/betting/stageMapping";
import { formatMatchResult } from "@/lib/betting/score";
import { formatDateTime } from "@/lib/formatDateTime";
import { displayTeamName } from "@/lib/betting/teamNames";
import { getMatchDisplayStatus } from "@/lib/betting/matchStatus";
import { loadTeamTranslations } from "@/lib/db/teamTranslations";
import { translateTeamToRu } from "@/lib/football/teamTranslations";

export default async function MyBetsPage() {
  const team = await requireSessionTeam();
  if (!team.name) redirect("/onboarding");

  const tournamentId = await getActiveTournament();
  const translations = await loadTeamTranslations(tournamentId);

  const { data: outcomeBets } = await supabaseAdmin
    .from("bets_outcome")
    .select("id,selection,match_id,created_at")
    .eq("team_id", team.teamId);

  const { data: scoreBets } = await supabaseAdmin
    .from("bets_exact_score")
    .select("id,home_goals,away_goals,match_id,created_at")
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
      <div className="card-padded flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Мои ставки</h1>
          <p className="page-desc">Команда: {team.name}</p>
        </div>
        <div className="rounded-xl border border-orange-500/25 bg-orange-500/10 px-5 py-3 text-center shadow-md shadow-orange-500/10">
          <div className="text-xs uppercase tracking-wide text-muted">Очков</div>
          <div className="text-3xl font-bold text-accent">{totalPoints}</div>
        </div>
      </div>

      <section className="card-padded">
        <h2 className="section-title">Спецставки</h2>
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <div className="flex justify-between gap-4 border-b border-white/8 pb-3">
            <span className="text-muted">Победитель ЧМ</span>
            <span>
              {championBet?.pick_country
                ? (translations.get(championBet.pick_country) ??
                  translateTeamToRu(championBet.pick_country))
                : "—"}
              {championBet ? (
                <span className="ml-2 points-value">
                  +{pointsByBet.get(`champion:${championBet.id}`) ?? 0}
                </span>
              ) : null}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted">3-е место</span>
            <span>
              {thirdBet?.pick_country
                ? (translations.get(thirdBet.pick_country) ??
                  translateTeamToRu(thirdBet.pick_country))
                : "—"}
              {thirdBet ? (
                <span className="ml-2 points-value">
                  +{pointsByBet.get(`third_place:${thirdBet.id}`) ?? 0}
                </span>
              ) : null}
            </span>
          </div>
        </div>
      </section>

      <section className="card-padded">
        <h2 className="section-title">Ставки на матчи</h2>

        {!outcomeBets?.length && !scoreBets?.length ? (
          <p className="mt-3 text-sm text-muted">
            Пока нет ставок. Перейдите в раздел «Матчи».
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {matchIds.map((matchId) => {
              const m = matchById.get(matchId);
              const outcome = outcomeBets?.find((b) => b.match_id === matchId);
              const score = scoreBets?.find((b) => b.match_id === matchId);

              return (
                <div key={matchId} className="card-inner">
                  {m ? (
                    <>
                      <span className="badge badge-type">{stageLabel(m.stage)}</span>
                      <div className="mt-2 font-semibold">
                        {displayTeamName(m.home_team_name, "home", translations)} —{" "}
                        {displayTeamName(m.away_team_name, "away", translations)}
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {formatDateTime(m.kickoff_at)}
                      </div>
                      {m.status === "PLAYED" ? (
                        <div className="mt-1 text-sm text-muted">
                          Результат:{" "}
                          <span className="text-white/90">
                            {formatMatchResult(m)}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-1">
                          <span
                            className={`badge ${getMatchDisplayStatus(m).badgeClass}`}
                          >
                            {getMatchDisplayStatus(m).label}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-muted">Матч</div>
                  )}

                  <div className="mt-3 space-y-2 text-sm">
                    {outcome ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge badge-type">Исход</span>
                        <span>
                          {outcome.selection === "home"
                            ? displayTeamName(
                                m?.home_team_name ?? "",
                                "home",
                                translations
                              )
                            : displayTeamName(
                                m?.away_team_name ?? "",
                                "away",
                                translations
                              )}
                        </span>
                        <span className="points-value">
                          +{pointsByBet.get(`match_outcome:${outcome.id}`) ?? 0}
                        </span>
                      </div>
                    ) : null}
                    {score ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge badge-type">Точный счёт</span>
                        <span>
                          {score.home_goals}:{score.away_goals}
                        </span>
                        <span className="points-value">
                          +{pointsByBet.get(`match_exact_score:${score.id}`) ?? 0}
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
