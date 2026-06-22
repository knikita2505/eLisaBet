import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTournament } from "@/lib/db/tournament";
import { stageLabel } from "@/lib/betting/stageMapping";
import { STAGE_RANK } from "@/lib/betting/stages";
import { deleteBetAction } from "@/app/_actions/admin";

type BetType =
  | "match_outcome"
  | "match_exact_score"
  | "champion"
  | "third_place";

type AdminBetItem = {
  id: string;
  betType: BetType;
  kindLabel: string;
  stageKey: string | null;
  stageRank: number;
  matchLabel: string | null;
  pick: string;
  points: number;
};

type TeamBetsView = {
  teamId: string;
  teamName: string;
  code: string;
  special: AdminBetItem[];
  byStage: { stageKey: string; stageRank: number; bets: AdminBetItem[] }[];
};

function betKindLabel(betType: BetType) {
  const map: Record<BetType, string> = {
    match_outcome: "Исход",
    match_exact_score: "Точный счёт",
    champion: "Победитель ЧМ",
    third_place: "3-е место",
  };
  return map[betType];
}

function AdminBetRow({ bet }: { bet: AdminBetItem }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-[#0f2744]/40 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-orange-500/20 px-2 py-0.5 text-xs font-semibold text-orange-300">
            {bet.kindLabel}
          </span>
          {bet.matchLabel ? (
            <span className="text-sm font-medium text-white/90">
              {bet.matchLabel}
            </span>
          ) : null}
        </div>
        <div className="mt-1.5 text-sm">
          <span className="text-white/50">Ставка: </span>
          <span className="text-white/90">{bet.pick}</span>
          {bet.points > 0 ? (
            <span className="ml-2 font-semibold text-orange-400">
              +{bet.points} очк.
            </span>
          ) : (
            <span className="ml-2 text-white/40">0 очк.</span>
          )}
        </div>
      </div>

      <form action={deleteBetAction} className="shrink-0">
        <input type="hidden" name="betType" value={bet.betType} />
        <input type="hidden" name="betId" value={bet.id} />
        <button
          type="submit"
          className="text-xs text-red-300 hover:text-red-200"
        >
          Удалить
        </button>
      </form>
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
    { data: matches },
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
      .from("matches")
      .select("id,stage,stage_rank,home_team_name,away_team_name,kickoff_at"),
    supabaseAdmin
      .from("team_points_ledger")
      .select("team_id,bet_type,bet_id,points")
      .eq("tournament_id", tournamentId),
  ]);

  const matchById = new Map((matches ?? []).map((m) => [m.id, m]));
  const pointsByBet = new Map<string, number>();
  for (const row of ledger ?? []) {
    pointsByBet.set(`${row.bet_type}:${row.bet_id}`, row.points);
  }

  const byTeam = new Map<
    string,
    { special: AdminBetItem[]; matchBets: AdminBetItem[] }
  >();

  function ensureTeam(teamId: string) {
    if (!byTeam.has(teamId)) {
      byTeam.set(teamId, { special: [], matchBets: [] });
    }
    return byTeam.get(teamId)!;
  }

  for (const b of championBets ?? []) {
    const row = ensureTeam(b.team_id);
    row.special.push({
      id: b.id,
      betType: "champion",
      kindLabel: betKindLabel("champion"),
      stageKey: null,
      stageRank: 0,
      matchLabel: null,
      pick: b.pick_country,
      points: pointsByBet.get(`champion:${b.id}`) ?? 0,
    });
  }

  for (const b of thirdBets ?? []) {
    const row = ensureTeam(b.team_id);
    row.special.push({
      id: b.id,
      betType: "third_place",
      kindLabel: betKindLabel("third_place"),
      stageKey: null,
      stageRank: 0,
      matchLabel: null,
      pick: b.pick_country,
      points: pointsByBet.get(`third_place:${b.id}`) ?? 0,
    });
  }

  for (const b of outcomeBets ?? []) {
    const m = matchById.get(b.match_id);
    const row = ensureTeam(b.team_id);
    const pick =
      b.selection === "home"
        ? m?.home_team_name ?? "дома"
        : m?.away_team_name ?? "гости";
    row.matchBets.push({
      id: b.id,
      betType: "match_outcome",
      kindLabel: betKindLabel("match_outcome"),
      stageKey: m?.stage ?? null,
      stageRank: m?.stage_rank ?? STAGE_RANK.R32,
      matchLabel: m
        ? `${m.home_team_name} — ${m.away_team_name}`
        : "Матч",
      pick,
      points: pointsByBet.get(`match_outcome:${b.id}`) ?? 0,
    });
  }

  for (const b of scoreBets ?? []) {
    const m = matchById.get(b.match_id);
    const row = ensureTeam(b.team_id);
    row.matchBets.push({
      id: b.id,
      betType: "match_exact_score",
      kindLabel: betKindLabel("match_exact_score"),
      stageKey: m?.stage ?? null,
      stageRank: m?.stage_rank ?? STAGE_RANK.R32,
      matchLabel: m
        ? `${m.home_team_name} — ${m.away_team_name}`
        : "Матч",
      pick: `${b.home_goals}:${b.away_goals}`,
      points: pointsByBet.get(`match_exact_score:${b.id}`) ?? 0,
    });
  }

  const sorted: TeamBetsView[] = Array.from(byTeam.entries())
    .map(([teamId, data]) => {
      const t = teamById.get(teamId);
      const stageMap = new Map<string, AdminBetItem[]>();

      for (const bet of data.matchBets) {
        const key = bet.stageKey ?? "UNKNOWN";
        if (!stageMap.has(key)) stageMap.set(key, []);
        stageMap.get(key)!.push(bet);
      }

      const byStage = Array.from(stageMap.entries())
        .map(([stageKey, bets]) => ({
          stageKey,
          stageRank: bets[0]?.stageRank ?? 0,
          bets: bets.sort((a, b) => {
            if (a.betType === b.betType) return 0;
            return a.betType === "match_outcome" ? -1 : 1;
          }),
        }))
        .sort((a, b) => a.stageRank - b.stageRank);

      return {
        teamId,
        teamName: t?.name ?? "—",
        code: t?.code ?? "—",
        special: data.special,
        byStage,
      };
    })
    .filter((t) => t.special.length > 0 || t.byStage.length > 0)
    .sort((a, b) => a.teamName.localeCompare(b.teamName, "ru"));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Ставки всех команд
          </h1>
          <p className="mt-2 text-white/70">Видны только администратору.</p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-orange-400 hover:text-orange-300"
        >
          ← Админ
        </Link>
      </div>

      {params.deleted ? (
        <div className="rounded-lg border border-green-400/40 bg-green-400/10 p-3 text-sm text-green-100">
          Ставка удалена.
        </div>
      ) : null}
      {params.error ? (
        <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-sm text-red-100">
          {decodeURIComponent(params.error)}
        </div>
      ) : null}

      {sorted.length ? (
        sorted.map((t) => (
          <section
            key={t.teamId}
            className="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <h2 className="text-lg font-semibold">
              {t.teamName}{" "}
              <span className="text-sm font-normal text-white/50 font-mono">
                ({t.code})
              </span>
            </h2>

            {t.special.length ? (
              <div className="mt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-white/50">
                  Спецставки
                </h3>
                <div className="mt-2 flex flex-col gap-2">
                  {t.special.map((bet) => (
                    <AdminBetRow key={`${bet.betType}:${bet.id}`} bet={bet} />
                  ))}
                </div>
              </div>
            ) : null}

            {t.byStage.map((stage) => (
              <div key={stage.stageKey} className="mt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-white/50">
                  {stageLabel(stage.stageKey)}
                </h3>
                <div className="mt-2 flex flex-col gap-2">
                  {stage.bets.map((bet) => (
                    <AdminBetRow key={`${bet.betType}:${bet.id}`} bet={bet} />
                  ))}
                </div>
              </div>
            ))}

            {!t.special.length && !t.byStage.length ? (
              <p className="mt-2 text-sm text-white/50">Ставок нет</p>
            ) : null}
          </section>
        ))
      ) : (
        <p className="text-white/60">Пока никто не сделал ставок.</p>
      )}
    </div>
  );
}
