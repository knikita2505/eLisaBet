import { redirect } from "next/navigation";
import { requireSessionTeam } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTournament } from "@/lib/db/tournament";
import { syncWorldCupAction } from "@/app/_actions/admin";

export default async function AdminPage() {
  const team = await requireSessionTeam();
  if (team.role !== "admin") redirect("/matches");
  if (!team.name) redirect("/onboarding");

  const tournamentId = await getActiveTournament();

  const { data: tournament } = await supabaseAdmin
    .from("tournaments")
    .select("winner_bet_locked_at,third_place_bet_locked_at,season,name")
    .eq("id", tournamentId)
    .single();

  const { count: matchesCount } = await supabaseAdmin
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  const { count: playedCount } = await supabaseAdmin
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .eq("status", "PLAYED");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Админ</h1>
        <p className="mt-2 text-white/70">Синхронизация матчей и вычисление очков.</p>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-white/70">Турнир</div>
            <div className="mt-1 font-semibold">
              ЧМ 2026 (сезон {tournament?.season})
            </div>
            <div className="mt-2 text-sm text-white/70">
              Матчей в базе: {matchesCount ?? 0}
              <br />
              Сыграно: {playedCount ?? 0}
            </div>
          </div>
          <div>
            <div className="text-sm text-white/70">Блокировки</div>
            <div className="mt-2 text-sm text-white/80">
              1/16:{" "}
              {tournament?.winner_bet_locked_at
                ? new Date(tournament.winner_bet_locked_at).toLocaleString("ru-RU")
                : "—"}
            </div>
          </div>
        </div>

        <form action={syncWorldCupAction} className="mt-4">
          <button
            type="submit"
            className="rounded-lg bg-orange-500 px-4 py-2 font-semibold text-[#0f2744] hover:bg-orange-400"
          >
            Синхронизировать матчи и пересчитать очки
          </button>
        </form>

        <div className="mt-3 text-sm text-white/60">
          Запуск синка безопасен для этого админа: сначала загрузка матчей из football-data.org,
          затем вычисление очков по ставкам.
        </div>
      </section>
    </div>
  );
}

