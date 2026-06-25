import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTournament } from "@/lib/db/tournament";
import { groupMatchesForDisplay } from "@/lib/betting/groupMatches";
import { formatMatchResult } from "@/lib/betting/score";
import { formatDateTime } from "@/lib/formatDateTime";
import { displayTeamName } from "@/lib/betting/teamNames";
import { getMatchDisplayStatus } from "@/lib/betting/matchStatus";
import { loadTeamTranslations } from "@/lib/db/teamTranslations";
import { translateTeamToRu } from "@/lib/football/teamTranslations";
import { deleteBetAction, deleteMatchBetsAction } from "@/app/_actions/admin";
import { CollapsibleStage } from "@/app/_components/CollapsibleStage";

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function AdminBetDeleteForm({
  betType,
  betId,
}: {
  betType: string;
  betId: string;
}) {
  return (
    <form action={deleteBetAction} className="shrink-0">
      <input type="hidden" name="betType" value={betType} />
      <input type="hidden" name="betId" value={betId} />
      <button
        type="submit"
        className="rounded-lg p-1.5 text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
        aria-label="Удалить ставку"
      >
        <TrashIcon />
      </button>
    </form>
  );
}

function AdminMatchBetsDeleteForm({
  teamId,
  matchId,
}: {
  teamId: string;
  matchId: string;
}) {
  return (
    <form action={deleteMatchBetsAction} className="shrink-0">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="matchId" value={matchId} />
      <button
        type="submit"
        className="rounded-lg p-1.5 text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
        aria-label="Удалить ставку на матч"
      >
        <TrashIcon />
      </button>
    </form>
  );
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

function renderAdminBetMatchCard(
  teamId: string,
  matchId: string,
  matchById: Map<string, MatchRow>,
  translations: Map<string, string>,
  outcomeBets: { id: string; match_id: string; selection: "home" | "away" }[],
  scoreBets: { id: string; match_id: string; home_goals: number; away_goals: number }[],
  pointsByBet: Map<string, number>
) {
  const m = matchById.get(matchId);
  const outcome = outcomeBets.find((b) => b.match_id === matchId);
  const score = scoreBets.find((b) => b.match_id === matchId);

  return (
    <div key={matchId} className="card-inner relative">
      {(outcome || score) ? (
        <div className="absolute right-2 top-2">
          <AdminMatchBetsDeleteForm teamId={teamId} matchId={matchId} />
        </div>
      ) : null}

      {m ? (
        <>
          <div className="pr-10 font-semibold">
            {displayTeamName(m.home_team_name, "home", translations)} —{" "}
            {displayTeamName(m.away_team_name, "away", translations)}
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {formatDateTime(m.kickoff_at)}
          </div>
          {m.status === "PLAYED" ? (
            <div className="mt-1 text-sm text-muted">
              Результат:{" "}
              <span className="text-white/90">{formatMatchResult(m)}</span>
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
                ? displayTeamName(m?.home_team_name ?? "", "home", translations)
                : displayTeamName(m?.away_team_name ?? "", "away", translations)}
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
}

export default async function AdminBetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const admin = await requireSessionTeam();
  if (admin.role !== "admin") redirect("/matches");

  const params = await searchParams;
  const tournamentId = await getActiveTournament();
  const translations = await loadTeamTranslations(tournamentId);

  const { data: teams } = await supabaseAdmin
    .from("teams")
    .select("id,code,name,role")
    .order("name", { ascending: true });

  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));

  const [
    { data: outcomeBets },
    { data: scoreBets },
    { data: championBets },
    { data: thirdBets },
    { data: ledger },
  ] = await Promise.all([
    supabaseAdmin.from("bets_outcome").select("id,team_id,match_id,selection"),
    supabaseAdmin
      .from("bets_exact_score")
      .select("id,team_id,match_id,home_goals,away_goals"),
    supabaseAdmin
      .from("bets_champion")
      .select("id,team_id,pick_country")
      .eq("tournament_id", tournamentId),
    supabaseAdmin
      .from("bets_third_place")
      .select("id,team_id,pick_country")
      .eq("tournament_id", tournamentId),
    supabaseAdmin
      .from("team_points_ledger")
      .select("team_id,bet_type,bet_id,points")
      .eq("tournament_id", tournamentId),
  ]);

  const pointsByBet = new Map<string, number>();
  for (const row of ledger ?? []) {
    pointsByBet.set(`${row.bet_type}:${row.bet_id}`, row.points);
  }

  const teamIdsWithBets = new Set<string>([
    ...(outcomeBets ?? []).map((b) => b.team_id),
    ...(scoreBets ?? []).map((b) => b.team_id),
    ...(championBets ?? []).map((b) => b.team_id),
    ...(thirdBets ?? []).map((b) => b.team_id),
  ]);

  const allMatchIds = [
    ...new Set([
      ...(outcomeBets ?? []).map((b) => b.match_id),
      ...(scoreBets ?? []).map((b) => b.match_id),
    ]),
  ];

  const { data: allMatches } = allMatchIds.length
    ? await supabaseAdmin
        .from("matches")
        .select(
          "id,stage,stage_rank,kickoff_at,status,home_team_name,away_team_name,home_goals,away_goals,home_penalties,away_penalties"
        )
        .in("id", allMatchIds)
    : { data: [] };

  const matchById = new Map(
    (allMatches ?? []).map((m) => [m.id, m as MatchRow])
  );

  const teamsView = [...teamIdsWithBets]
    .map((teamId) => {
      const t = teamById.get(teamId);
      const teamOutcomeBets = (outcomeBets ?? []).filter(
        (b) => b.team_id === teamId
      );
      const teamScoreBets = (scoreBets ?? []).filter(
        (b) => b.team_id === teamId
      );
      const championBet =
        (championBets ?? []).find((b) => b.team_id === teamId) ?? null;
      const thirdBet =
        (thirdBets ?? []).find((b) => b.team_id === teamId) ?? null;

      const matchIds = [
        ...new Set([
          ...teamOutcomeBets.map((b) => b.match_id),
          ...teamScoreBets.map((b) => b.match_id),
        ]),
      ];

      const matches = matchIds
        .map((id) => matchById.get(id))
        .filter((m): m is MatchRow => Boolean(m))
        .sort(
          (a, b) =>
            new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
        );

      const displayGroups = groupMatchesForDisplay(matches);
      const matchCardCount = matchIds.length;
      const specialCount = (championBet ? 1 : 0) + (thirdBet ? 1 : 0);

      return {
        teamId,
        teamName: t?.name ?? "—",
        code: t?.code ?? "—",
        championBet,
        thirdBet,
        teamOutcomeBets,
        teamScoreBets,
        displayGroups,
        totalCount: matchCardCount + specialCount,
      };
    })
    .filter((t) => t.totalCount > 0)
    .sort((a, b) => a.teamName.localeCompare(b.teamName, "ru"));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Ставки всех участников</h1>
          <p className="page-desc">Видны только администратору.</p>
        </div>
        <Link href="/admin" className="link-back">
          ← Админ
        </Link>
      </div>

      {params.deleted ? (
        <div className="alert-success">Ставка удалена.</div>
      ) : null}
      {params.error ? (
        <div className="alert-error">{decodeURIComponent(params.error)}</div>
      ) : null}

      {teamsView.length ? (
        teamsView.map((team) => (
          <CollapsibleStage
            key={team.teamId}
            title={`${team.teamName} (${team.code})`}
            count={team.totalCount}
          >
            {(team.championBet || team.thirdBet) && (
              <section className="card-inner">
                <h3 className="section-title">Спецставки</h3>
                <div className="mt-4 flex flex-col gap-3 text-sm">
                  <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-3">
                    <span className="text-muted">Победитель ЧМ</span>
                    <div className="flex items-center gap-3">
                      <span>
                        {team.championBet?.pick_country
                          ? (translations.get(team.championBet.pick_country) ??
                            translateTeamToRu(team.championBet.pick_country))
                          : "—"}
                        {team.championBet ? (
                          <span className="ml-2 points-value">
                            +
                            {pointsByBet.get(
                              `champion:${team.championBet.id}`
                            ) ?? 0}
                          </span>
                        ) : null}
                      </span>
                      {team.championBet ? (
                        <AdminBetDeleteForm
                          betType="champion"
                          betId={team.championBet.id}
                        />
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted">3-е место</span>
                    <div className="flex items-center gap-3">
                      <span>
                        {team.thirdBet?.pick_country
                          ? (translations.get(team.thirdBet.pick_country) ??
                            translateTeamToRu(team.thirdBet.pick_country))
                          : "—"}
                        {team.thirdBet ? (
                          <span className="ml-2 points-value">
                            +
                            {pointsByBet.get(
                              `third_place:${team.thirdBet.id}`
                            ) ?? 0}
                          </span>
                        ) : null}
                      </span>
                      {team.thirdBet ? (
                        <AdminBetDeleteForm
                          betType="third_place"
                          betId={team.thirdBet.id}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {team.displayGroups.length ? (
              <section className="card-inner">
                <h3 className="section-title">Ставки на матчи</h3>
                <div className="mt-4 flex flex-col gap-4">
                  {team.displayGroups.map((group) => {
                    if (group.type === "groups") {
                      const totalCount = group.children.reduce(
                        (sum, child) => sum + child.matches.length,
                        0
                      );

                      return (
                        <CollapsibleStage
                          key={`${team.teamId}-groups`}
                          title={group.label}
                          count={totalCount}
                          variant="nested"
                        >
                          {group.children.map((child) => (
                            <CollapsibleStage
                              key={`${team.teamId}-${child.stageKey}`}
                              title={child.label}
                              count={child.matches.length}
                              variant="nested"
                            >
                              {child.matches.map((m) =>
                                renderAdminBetMatchCard(
                                  team.teamId,
                                  m.id,
                                  matchById,
                                  translations,
                                  team.teamOutcomeBets,
                                  team.teamScoreBets,
                                  pointsByBet
                                )
                              )}
                            </CollapsibleStage>
                          ))}
                        </CollapsibleStage>
                      );
                    }

                    return (
                      <CollapsibleStage
                        key={`${team.teamId}-${group.stageKey}`}
                        title={group.label}
                        count={group.matches.length}
                        variant="nested"
                      >
                        {group.matches.map((m) =>
                          renderAdminBetMatchCard(
                            team.teamId,
                            m.id,
                            matchById,
                            translations,
                            team.teamOutcomeBets,
                            team.teamScoreBets,
                            pointsByBet
                          )
                        )}
                      </CollapsibleStage>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </CollapsibleStage>
        ))
      ) : (
        <p className="text-muted">Пока никто не сделал ставок.</p>
      )}
    </div>
  );
}
