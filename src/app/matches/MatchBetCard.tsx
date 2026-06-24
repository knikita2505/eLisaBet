"use client";

type Props = {
  homeTeamName: string;
  awayTeamName: string;
  locked: boolean;
  selection: "home" | "away" | null;
  homeGoals: number;
  awayGoals: number;
  conflictMessage: string | null;
  onSelectionChange: (selection: "home" | "away") => void;
  onHomeGoalsChange: (goals: number) => void;
  onAwayGoalsChange: (goals: number) => void;
};

export function MatchBetCard({
  homeTeamName,
  awayTeamName,
  locked,
  selection,
  homeGoals,
  awayGoals,
  conflictMessage,
  onSelectionChange,
  onHomeGoalsChange,
  onAwayGoalsChange,
}: Props) {
  return (
    <div className="mt-5 flex flex-col gap-4">
      {conflictMessage ? (
        <div className="alert-error text-sm">{conflictMessage}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card-inner">
          <div className="section-title">Исход</div>
          <p className="mt-1 text-xs text-muted">
            +1 очко. Победитель с учётом пенальти при ничье на табло.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              disabled={locked}
              onClick={() => onSelectionChange("home")}
              className={selection === "home" ? "bet-btn-active" : "bet-btn"}
            >
              Победа: {homeTeamName}
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => onSelectionChange("away")}
              className={selection === "away" ? "bet-btn-active" : "bet-btn"}
            >
              Победа: {awayTeamName}
            </button>
          </div>
        </div>

        <div className="card-inner">
          <div className="section-title">Точный счёт на табло</div>
          <p className="mt-1 text-xs text-muted">
            +2 очка (+3 с исходом). Ничья на табло допустима.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="label-sm">
              {homeTeamName}
              <select
                value={homeGoals}
                disabled={locked}
                onChange={(e) => onHomeGoalsChange(Number(e.target.value))}
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
                onChange={(e) => onAwayGoalsChange(Number(e.target.value))}
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
    </div>
  );
}
