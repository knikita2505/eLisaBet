import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTournament } from "@/lib/db/tournament";
import { stageLabel } from "@/lib/betting/stageMapping";

export default async function AdminBetsPage() {
  const admin = await requireSessionTeam();
  if (admin.role !== "admin") redirect("/matches");

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
      .select("id,stage,home_team_name,away_team_name,kickoff_at"),
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

  type TeamBets = {
    teamId: string;
    teamName: string;
    code: string;
    items: string[];
  };

  const byTeam = new Map<string, TeamBets>();

  function ensureTeam(teamId: string) {
    if (!byTeam.has(teamId)) {
      const t = teamById.get(teamId);
      byTeam.set(teamId, {
        teamId,
        teamName: t?.name ?? "—",
        code: t?.code ?? "—",
        items: [],
      });
    }
    return byTeam.get(teamId)!;
  }

  for (const b of championBets ?? []) {
    const row = ensureTeam(b.team_id);
    const pts = pointsByBet.get(`champion:${b.id}`) ?? 0;
    row.items.push(`Победитель ЧМ: ${b.pick_country}${pts ? ` (+${pts})` : ""}`);
  }

  for (const b of thirdBets ?? []) {
    const row = ensureTeam(b.team_id);
    const pts = pointsByBet.get(`third_place:${b.id}`) ?? 0;
    row.items.push(`3-е место: ${b.pick_country}${pts ? ` (+${pts})` : ""}`);
  }

  for (const b of outcomeBets ?? []) {
    const m = matchById.get(b.match_id);
    const row = ensureTeam(b.team_id);
    const pick =
      b.selection === "home"
        ? m?.home_team_name ?? "дома"
        : m?.away_team_name ?? "гости";
    const pts = pointsByBet.get(`match_outcome:${b.id}`) ?? 0;
    const stage = m ? stageLabel(m.stage) : "";
    row.items.push(
      `${stage} ${m?.home_team_name ?? "?"} — ${m?.away_team_name ?? "?"}: исход «${pick}»${pts ? ` (+${pts})` : ""}`
    );
  }

  for (const b of scoreBets ?? []) {
    const m = matchById.get(b.match_id);
    const row = ensureTeam(b.team_id);
    const pts = pointsByBet.get(`match_exact_score:${b.id}`) ?? 0;
    const stage = m ? stageLabel(m.stage) : "";
    row.items.push(
      `${stage} ${m?.home_team_name ?? "?"} — ${m?.away_team_name ?? "?"}: счёт ${b.home_goals}:${b.away_goals}${pts ? ` (+${pts})` : ""}`
    );
  }

  const sorted = Array.from(byTeam.values()).sort((a, b) =>
    a.teamName.localeCompare(b.teamName, "ru")
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ставки всех команд</h1>
          <p className="mt-2 text-white/70">
            Видны только администратору.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-orange-400 hover:text-orange-300"
        >
          ← Админ
        </Link>
      </div>

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
            {t.items.length ? (
              <ul className="mt-3 flex flex-col gap-1.5 text-sm text-white/85">
                {t.items.map((item, i) => (
                  <li key={i} className="border-b border-white/5 pb-1.5 last:border-0">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-white/50">Ставок нет</p>
            )}
          </section>
        ))
      ) : (
        <p className="text-white/60">Пока никто не сделал ставок.</p>
      )}
    </div>
  );
}
