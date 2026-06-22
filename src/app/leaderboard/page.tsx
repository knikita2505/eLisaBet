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
    .select("id,name")
    .order("created_at", { ascending: true });

  const { data: ledgerRows } = await supabaseAdmin
    .from("team_points_ledger")
    .select("team_id,bet_type,points")
    .eq("tournament_id", tournamentId);

  const byTeam = new Map<
    string,
    { id: string; name: string | null; points: number; exactCorrect: number }
  >();

  for (const t of teams ?? []) {
    byTeam.set(t.id, {
      id: t.id,
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Лидерборд</h1>
        <p className="page-desc">
          Очки обновляются по мере появления результатов матчей.
        </p>
      </div>

      <div className="table-shell">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th>#</th>
              <th>Команда</th>
              <th>Очки</th>
              <th>Точные счёты</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, idx) => {
              const isMe = t.id === team.teamId;
              const isTop = idx === 0 && t.points > 0;
              return (
                <tr
                  key={t.id}
                  className={isMe ? "row-highlight" : undefined}
                >
                  <td className="text-muted">
                    {isTop ? "🏆" : idx + 1}
                  </td>
                  <td className="font-semibold">
                    {t.name ?? "(без названия)"}
                    {isMe ? (
                      <span className="ml-2 text-xs font-normal text-accent">
                        вы
                      </span>
                    ) : null}
                  </td>
                  <td className="points-value text-base">{t.points}</td>
                  <td className="text-muted">{t.exactCorrect}</td>
                </tr>
              );
            })}
            {!sorted.length ? (
              <tr>
                <td className="text-muted" colSpan={4}>
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
