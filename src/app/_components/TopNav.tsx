"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { TeamSession } from "@/lib/auth/session";
import { logoutAction } from "@/app/_actions/auth";

const NAV_ITEMS = [
  { href: "/matches", label: "Матчи" },
  { href: "/special", label: "Спецставки" },
  { href: "/my-bets", label: "Мои ставки" },
  { href: "/leaderboard", label: "Лидерборд" },
] as const;

function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav({ team }: { team: TeamSession | null }) {
  const pathname = usePathname();
  const isAdmin = team?.role === "admin";

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a1e36]/75 shadow-[0_4px_24px_rgba(0,0,0,0.25)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-lg tracking-tight"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 text-sm shadow-md shadow-orange-500/30">
              ⚽
            </span>
            <span className="bg-gradient-to-r from-orange-300 to-orange-500 bg-clip-text text-transparent">
              eLisaBet
            </span>
          </Link>
          <span className="hidden rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/55 sm:inline">
            ЧМ 2026
          </span>
        </div>

        {team ? (
          <nav className="flex flex-wrap items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? "nav-link nav-link-active" : "nav-link"}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
            {isAdmin ? (
              <Link
                href="/admin"
                className={
                  isNavActive(pathname, "/admin")
                    ? "nav-link nav-link-admin nav-link-active"
                    : "nav-link nav-link-admin"
                }
                aria-current={
                  isNavActive(pathname, "/admin") ? "page" : undefined
                }
              >
                Админ
              </Link>
            ) : null}

            <form action={logoutAction} className="ml-1">
              <button
                type="submit"
                className="nav-link text-white/50 hover:text-white/80"
              >
                Выйти
              </button>
            </form>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
