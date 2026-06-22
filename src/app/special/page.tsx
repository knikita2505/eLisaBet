import { redirect } from "next/navigation";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTournament } from "@/lib/db/tournament";
import {
  setChampionBetAction,
  setThirdPlaceBetAction,
} from "@/app/_actions/special";

function formatTime(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function SpecialPage() {
  const team = await requireSessionTeam();
  if (!team.name) redirect("/onboarding");

  const tournamentId = await getActiveTournament();

  const { data: tournament } = await supabaseAdmin
    .from("tournaments")
    .select("winner_bet_locked_at,third_place_bet_locked_at")
    .eq("id", tournamentId)
    .single();

  const lockedWinner = tournament?.winner_bet_locked_at
    ? new Date(tournament.winner_bet_locked_at) <= new Date()
    : false;

  const lockedThird = tournament?.third_place_bet_locked_at
    ? new Date(tournament.third_place_bet_locked_at) <= new Date()
    : false;

  const { data: championBet } = await supabaseAdmin
    .from("bets_champion")
    .select("pick_country")
    .eq("team_id", team.teamId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();

  const { data: thirdBet } = await supabaseAdmin
    .from("bets_third_place")
    .select("pick_country")
    .eq("team_id", team.teamId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();

  const { data: tournamentTeams } = await supabaseAdmin
    .from("tournament_teams")
    .select("team_name")
    .eq("tournament_id", tournamentId);

  const options = new Set<string>();
  for (const r of tournamentTeams ?? []) {
    if (r.team_name && r.team_name !== "Уточняется") options.add(r.team_name);
  }

  if (!options.size) {
    const { data: matchTeams } = await supabaseAdmin
      .from("matches")
      .select("home_team_name,away_team_name")
      .eq("tournament_id", tournamentId);

    for (const r of matchTeams ?? []) {
      if (r.home_team_name && r.home_team_name !== "Уточняется") {
        options.add(r.home_team_name);
      }
      if (r.away_team_name && r.away_team_name !== "Уточняется") {
        options.add(r.away_team_name);
      }
    }
  }

  const teamList = Array.from(options).sort((a, b) => a.localeCompare(b, "ru"));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Спецставки</h1>
        <p className="page-desc">
          Победителя ЧМ и 3-е место можно выбрать до старта 1/16.
          {!teamList.length ? (
            <span className="mt-1 block text-accent">
              Список стран появится после синхронизации в админке.
            </span>
          ) : null}
        </p>
      </div>

      <section className="card-padded">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="section-title">Победитель ЧМ 2026</h2>
            <p className="mt-1 text-sm text-muted">+5 очков</p>
          </div>
          <span className="text-2xl opacity-40">🏆</span>
        </div>
        <p className="mt-2 text-sm text-muted">
          {tournament?.winner_bet_locked_at
            ? `Закроется: ${formatTime(tournament.winner_bet_locked_at)}`
            : "Неизвестно (нужно синхронизировать матчи)"}
        </p>

        <form
          action={setChampionBetAction}
          className="mt-4 flex max-w-md flex-col gap-3"
        >
          <label className="label">
            Выберите страну
            <select
              name="pickCountry"
              defaultValue={championBet?.pick_country ?? ""}
              disabled={lockedWinner}
              className="select"
              required
            >
              <option value="" disabled>
                — выберите —
              </option>
              {teamList.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={lockedWinner}
            className="btn-primary"
          >
            Сохранить ставку
          </button>
        </form>
      </section>

      <section className="card-padded">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="section-title">3-е место ЧМ 2026</h2>
            <p className="mt-1 text-sm text-muted">+3 очка</p>
          </div>
          <span className="text-2xl opacity-40">🥉</span>
        </div>
        <p className="mt-2 text-sm text-muted">
          {tournament?.third_place_bet_locked_at
            ? `Закроется: ${formatTime(tournament.third_place_bet_locked_at)}`
            : "Неизвестно (нужно синхронизировать матчи)"}
        </p>

        <form
          action={setThirdPlaceBetAction}
          className="mt-4 flex max-w-md flex-col gap-3"
        >
          <label className="label">
            Выберите страну
            <select
              name="pickCountry"
              defaultValue={thirdBet?.pick_country ?? ""}
              disabled={lockedThird}
              className="select"
              required
            >
              <option value="" disabled>
                — выберите —
              </option>
              {teamList.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" disabled={lockedThird} className="btn-primary">
            Сохранить ставку
          </button>
        </form>
      </section>
    </div>
  );
}
