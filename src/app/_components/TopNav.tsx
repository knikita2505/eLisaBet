import Link from "next/link";

import type { TeamSession } from "@/lib/auth/session";
import { logoutAction } from "@/app/_actions/auth";

export function TopNav({ team }: { team: TeamSession | null }) {
  const isAdmin = team?.role === "admin";

  return (
    <header className="border-b border-white/10">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-bold text-lg tracking-tight text-orange-500">
            eLisaBet
          </Link>
          <span className="text-sm text-white/70">
            ЧМ 2026
          </span>
        </div>

        <nav className="flex items-center gap-4 text-sm">
          {team ? (
            <>
              <Link href="/matches" className="hover:text-orange-500">
                Матчи
              </Link>
              <Link href="/special" className="hover:text-orange-500">
                Спецставки
              </Link>
              <Link href="/my-bets" className="hover:text-orange-500">
                Мои ставки
              </Link>
              <Link href="/leaderboard" className="hover:text-orange-500">
                Лидерборд
              </Link>
              {isAdmin ? (
                <>
                  <Link href="/admin" className="hover:text-orange-500">
                    Админ
                  </Link>
                  <Link href="/admin/bets" className="hover:text-orange-500">
                    Все ставки
                  </Link>
                </>
              ) : null}

              <form action={logoutAction}>
                <button type="submit" className="text-white/70 hover:text-white">
                  Выйти
                </button>
              </form>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

