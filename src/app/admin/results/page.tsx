import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTournament } from "@/lib/db/tournament";
import { MIN_BETTABLE_STAGE_RANK } from "@/lib/betting/stages";
import { groupMatchesForDisplay } from "@/lib/betting/groupMatches";
import { getMatchDisplayStatus } from "@/lib/betting/matchStatus";
import { displayTeamName } from "@/lib/betting/teamNames";
import {
  formatDateTime,
  toDatetimeLocalValue,
} from "@/lib/formatDateTime";
import { loadTeamTranslations } from "@/lib/db/teamTranslations";
import { updateMatchAction } from "@/app/_actions/admin";
import { CollapsibleStage } from "@/app/_components/CollapsibleStage";

type MatchRow = {
  id: string;
  stage: string;
  stage_rank: number;
  kickoff_at: string;
  bet_locked_at: string | null;
  status: string;
  home_team_name: string;
  away_team_name: string;
  home_goals: number | null;
  away_goals: number | null;
};

function renderMatchForm(
  m: MatchRow,
  translations: Map<string, string>
) {
  const displayStatus = getMatchDisplayStatus(m);
  const betDeadline = m.bet_locked_at ?? m.kickoff_at;

  return (
    <form
      key={m.id}
      action={updateMatchAction}
      className="card-inner flex flex-col gap-3"
    >
      <input type="hidden" name="matchId" value={m.id} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`badge ${displayStatus.badgeClass}`}>
          {displayStatus.label}
        </span>
        <span className="text-xs text-muted">
          Начало: {formatDateTime(m.kickoff_at)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label-sm">
          Команда 1 (дома)
          <input
            name="homeTeamName"
            defaultValue={displayTeamName(m.home_team_name, "home", translations)}
            className="input"
            required
          />
        </label>
        <label className="label-sm">
          Команда 2 (гости)
          <input
            name="awayTeamName"
            defaultValue={displayTeamName(m.away_team_name, "away", translations)}
            className="input"
            required
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="label-sm">
          Статус
          <select name="status" defaultValue={m.status} className="select">
            <option value="SCHEDULED">Ожидается</option>
            <option value="LIVE">Идёт</option>
            <option value="PLAYED">Завершена</option>
          </select>
        </label>
        <label className="label-sm sm:col-span-2">
          Дедлайн ставок (не позже начала)
          <input
            type="datetime-local"
            name="betLockedAt"
            defaultValue={toDatetimeLocalValue(betDeadline)}
            className="input"
            required
          />
        </label>
      </div>

      <div className="grid max-w-xs grid-cols-2 gap-2">
        <label className="label-sm">
          Голы (дома)
          <input
            name="homeGoals"
            type="number"
            min={0}
            defaultValue={m.home_goals ?? 0}
            className="input"
          />
        </label>
        <label className="label-sm">
          Голы (гости)
          <input
            name="awayGoals"
            type="number"
            min={0}
            defaultValue={m.away_goals ?? 0}
            className="input"
          />
        </label>
      </div>

      <button type="submit" className="btn-primary self-start">
        Сохранить
      </button>
    </form>
  );
}

export default async function AdminResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const team = await requireSessionTeam();
  if (team.role !== "admin") redirect("/matches");

  const params = await searchParams;
  const tournamentId = await getActiveTournament();
  const translations = await loadTeamTranslations(tournamentId);

  const { data: matches } = await supabaseAdmin
    .from("matches")
    .select(
      "id,stage,stage_rank,kickoff_at,bet_locked_at,status,home_team_name,away_team_name,home_goals,away_goals"
    )
    .eq("tournament_id", tournamentId)
    .gte("stage_rank", MIN_BETTABLE_STAGE_RANK)
    .order("kickoff_at", { ascending: true });

  const displayGroups = groupMatchesForDisplay(matches ?? []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Редактировать матчи</h1>
          <p className="page-desc">
            Названия команд, счёт, статус, дедлайн ставок. Очки начисляются при
            статусе «Завершена».
          </p>
        </div>
        <Link href="/admin" className="link-back">
          ← Админ
        </Link>
      </div>

      {params.updated ? (
        <div className="alert-success">Матч сохранён.</div>
      ) : null}
      {params.error ? (
        <div className="alert-error">{decodeURIComponent(params.error)}</div>
      ) : null}

      {displayGroups.length ? (
        displayGroups.map((group) => {
          if (group.type === "groups") {
            const totalCount = group.children.reduce(
              (sum, child) => sum + child.matches.length,
              0
            );

            return (
              <CollapsibleStage
                key="groups"
                title={group.label}
                count={totalCount}
              >
                {group.children.map((child) => (
                  <CollapsibleStage
                    key={child.stageKey}
                    title={child.label}
                    count={child.matches.length}
                    defaultOpen={false}
                    variant="nested"
                  >
                    {child.matches.map((m) =>
                      renderMatchForm(m, translations)
                    )}
                  </CollapsibleStage>
                ))}
              </CollapsibleStage>
            );
          }

          return (
            <CollapsibleStage
              key={group.stageKey}
              title={group.label}
              count={group.matches.length}
            >
              {group.matches.map((m) => renderMatchForm(m, translations))}
            </CollapsibleStage>
          );
        })
      ) : (
        <p className="text-sm text-muted">
          Нет матчей — сначала запустите синхронизацию в админке.
        </p>
      )}
    </div>
  );
}
