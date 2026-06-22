import { setTeamNameAction } from "@/app/_actions/onboarding";
import { redirect } from "next/navigation";
import { getSessionTeam } from "@/lib/auth/session";

export default async function OnboardingPage() {
  const team = await getSessionTeam();
  if (!team) redirect("/login");
  if (team.name) redirect("/matches");

  return (
    <div className="mx-auto mt-6 max-w-md">
      <div className="card-elevated">
        <h1 className="page-title">Первый вход</h1>
        <p className="page-desc">
          Придумайте название команды (отдела) для отображения в лидерборде.
        </p>

        <form action={setTeamNameAction} className="mt-6 flex flex-col gap-4">
          <label className="label">
            Название команды
            <input
              name="name"
              className="input"
              placeholder="Например: Отдел продаж"
              required
              autoComplete="off"
            />
          </label>

          <button type="submit" className="btn-primary w-full">
            Сохранить
          </button>
        </form>
      </div>
    </div>
  );
}
