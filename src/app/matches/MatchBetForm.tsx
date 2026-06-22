"use client";

import { useState } from "react";
import { setMatchBetsAction } from "@/app/_actions/bets";

type Props = {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  locked: boolean;
  initialSelection: "home" | "away" | null;
  initialHomeGoals: number;
  initialAwayGoals: number;
};

export function MatchBetForm({
  matchId,
  homeTeamName,
  awayTeamName,
  locked,
  initialSelection,
  initialHomeGoals,
  initialAwayGoals,
}: Props) {
  const [selection, setSelection] = useState<"home" | "away" | null>(
    initialSelection
  );
  const [homeGoals, setHomeGoals] = useState(initialHomeGoals);
  const [awayGoals, setAwayGoals] = useState(initialAwayGoals);

  return (
    <form action={setMatchBetsAction} className="mt-5 flex flex-col gap-4">
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="selection" value={selection ?? ""} />
      <input type="hidden" name="homeGoals" value={homeGoals} />
      <input type="hidden" name="awayGoals" value={awayGoals} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card-inner">
          <div className="section-title">Исход</div>
          <p className="mt-1 text-xs text-muted">+1 очко за верный прогноз</p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              disabled={locked}
              onClick={() => setSelection("home")}
              className={selection === "home" ? "bet-btn-active" : "bet-btn"}
            >
              Победа: {homeTeamName}
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => setSelection("away")}
              className={selection === "away" ? "bet-btn-active" : "bet-btn"}
            >
              Победа: {awayTeamName}
            </button>
          </div>
        </div>

        <div className="card-inner">
          <div className="section-title">Точный счёт</div>
          <p className="mt-1 text-xs text-muted">+2 очка (+3 с исходом)</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="label-sm">
              {homeTeamName}
              <select
                value={homeGoals}
                disabled={locked}
                onChange={(e) => setHomeGoals(Number(e.target.value))}
                className="select"
              >
                {Array.from({ length: 8 }).map((_, i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>

            <label className="label-sm">
              {awayTeamName}
              <select
                value={awayGoals}
                disabled={locked}
                onChange={(e) => setAwayGoals(Number(e.target.value))}
                className="select"
              >
                {Array.from({ length: 8 }).map((_, i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={locked || !selection}
        className="btn-primary w-full sm:w-auto sm:self-end"
      >
        Сохранить ставки
      </button>
    </form>
  );
}
