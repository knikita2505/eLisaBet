import { redirect } from "next/navigation";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTournament } from "@/lib/db/tournament";

export default async function LeaderboardPage() {
  const team = await requireSessionTeam();
  if (!team.name) redirect("/onboarding");

  const tournamentId = await getActiveTournament();

  const { data: teams } = await supabaseAdmin
    .from("teams")
    .select("id,code,name")
    .order("created_at", { ascending: true });

  const { data: ledgerRows } = await supabaseAdmin
    .from("team_points_ledger")
    .select("team_id,bet_type,points")
    .eq("tournament_id", tournamentId);

  const byTeam = new Map<
    string,
    { id: string; code: string; name: string | null; points: number; exactCorrect: number }
  >();

  for (const t of teams ?? []) {
    byTeam.set(t.id, {
      id: t.id,
      code: t.code,
      name: t.name,
      points: 0,
      exactCorrect: 0,
    });
  }

  for (const r of ledgerRows ?? []) {
    const row = byTeam.get(r.team_id);
    if (!row) continue;
    row.points += r.points;
    if (r.bet_type === "match_exact_score" && r.points > 0) {
      row.exactCorrect += 1;
    }
  }

  const sorted = Array.from(byTeam.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.exactCorrect - a.exactCorrect;
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Лидерборд</h1>
        <p className="mt-2 text-white/70">
          Очки обновляются по мере появления результатов матчей.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-white/70 text-sm">
            <tr>
              <th className="py-3 px-4">#</th>
              <th className="py-3 px-4">Команда</th>
              <th className="py-3 px-4">Очки</th>
              <th className="py-3 px-4">Точные счёты (верно)</th>
              <th className="py-3 px-4">Код</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {sorted.map((t, idx) => {
              const isMe = t.id === team.teamId;
              return (
                <tr
                  key={t.id}
                  className={isMe ? "bg-orange-500/10" : undefined}
                >
                  <td className="py-3 px-4">{idx + 1}</td>
                  <td className="py-3 px-4 font-semibold">
                    {t.name ?? "(без названия)"}
                  </td>
                  <td className="py-3 px-4 font-semibold">{t.points}</td>
                  <td className="py-3 px-4">{t.exactCorrect}</td>
                  <td className="py-3 px-4 text-white/60">{t.code}</td>
                </tr>
              );
            })}
            {!sorted.length ? (
              <tr>
                <td className="py-4 px-4 text-white/70" colSpan={5}>
                  Пока нет данных. Нужно синхронизировать матчи.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

