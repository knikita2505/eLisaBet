"use client";

import { useState, type ReactNode } from "react";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/8 text-white/80 shadow-sm transition-colors hover:bg-white/12 hover:text-white"
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-5 w-5 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  );
}

export function CollapsibleStage({
  title,
  count,
  defaultOpen = false,
  variant = "root",
  betsComplete,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  variant?: "root" | "nested";
  /** Зелёная рамка — все ставки проставлены, красная — нет */
  betsComplete?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const borderClass =
    betsComplete === undefined
      ? ""
      : betsComplete
        ? "stage-border-complete"
        : "stage-border-incomplete";

  const sectionClass =
    variant === "root"
      ? `card-padded ${borderClass}`
      : `card-inner ${borderClass}`;

  return (
    <section className={sectionClass}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2
            className={
              variant === "root" ? "section-title" : "text-base font-semibold"
            }
          >
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-muted">{count} матч(ей)</p>
        </div>
        <ChevronIcon open={open} />
      </button>
      {open ? (
        <div className="mt-4 flex flex-col gap-4">{children}</div>
      ) : null}
    </section>
  );
}
