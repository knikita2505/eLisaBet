import { setTeamNameAction } from "@/app/_actions/onboarding";
import { redirect } from "next/navigation";
import { getSessionTeam } from "@/lib/auth/session";

export default async function OnboardingPage() {
  const team = await getSessionTeam();
  if (!team) redirect("/login");
  if (team.name) redirect("/matches");

  return (
    <div className="max-w-md mx-auto mt-10">
      <h1 className="text-2xl font-bold tracking-tight">Первый вход</h1>
      <p className="mt-2 text-white/70">
        Придумайте название команды (отдела) для отображения в лидерборде.
      </p>

      <form
        action={setTeamNameAction}
        className="mt-6 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4"
      >
        <label className="text-sm text-white/80">
          Название команды
          <input
            name="name"
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f2744] px-3 py-2 outline-none focus:border-orange-500"
            placeholder="Например: Отдел продаж"
            required
            autoComplete="off"
          />
        </label>

        <button
          type="submit"
          className="mt-1 inline-flex justify-center rounded-lg bg-orange-500 px-4 py-2 font-semibold text-[#0f2744] hover:bg-orange-400"
        >
          Сохранить
        </button>
      </form>
    </div>
  );
}

