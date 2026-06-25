"use client";

import type { YesNoSelection } from "@/lib/betting/matchProps";

type Props = {
  homeTeamName: string;
  awayTeamName: string;
  locked: boolean;
  selection: "home" | "away" | null;
  hasExactScore: boolean;
  homeGoals: number;
  awayGoals: number;
  bothTeamsScore: YesNoSelection | null;
  penaltyShootout: YesNoSelection | null;
  conflictMessage: string | null;
  onSelectionChange: (selection: "home" | "away") => void;
  onHasExactScoreChange: (enabled: boolean) => void;
  onHomeGoalsChange: (goals: number) => void;
  onAwayGoalsChange: (goals: number) => void;
  onBothTeamsScoreChange: (selection: YesNoSelection) => void;
  onPenaltyShootoutChange: (selection: YesNoSelection) => void;
};

function YesNoButtons({
  label,
  hint,
  value,
  locked,
  onChange,
}: {
  label: string;
  hint: string;
  value: YesNoSelection | null;
  locked: boolean;
  onChange: (selection: YesNoSelection) => void;
}) {
  return (
    <div className="card-inner">
      <div className="section-title">{label}</div>
      <p className="mt-1 text-xs text-muted">{hint}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={locked}
          onClick={() => onChange("yes")}
          className={value === "yes" ? "bet-btn-active" : "bet-btn"}
        >
          Да
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => onChange("no")}
          className={value === "no" ? "bet-btn-active" : "bet-btn"}
        >
          Нет
        </button>
      </div>
    </div>
  );
}

export function MatchBetCard({
  homeTeamName,
  awayTeamName,
  locked,
  selection,
  hasExactScore,
  homeGoals,
  awayGoals,
  bothTeamsScore,
  penaltyShootout,
  conflictMessage,
  onSelectionChange,
  onHasExactScoreChange,
  onHomeGoalsChange,
  onAwayGoalsChange,
  onBothTeamsScoreChange,
  onPenaltyShootoutChange,
}: Props) {
  return (
    <div className="mt-5 flex flex-col gap-4">
      {conflictMessage ? (
        <div className="alert-error whitespace-pre-line text-sm">
          {conflictMessage}
        </div>
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

        <YesNoButtons
          label="Обе команды забьют"
          hint="+1 очко. По счёту на табло, без серии пенальти."
          value={bothTeamsScore}
          locked={locked}
          onChange={onBothTeamsScoreChange}
        />

        <YesNoButtons
          label="Серия пенальти"
          hint="+1 очко. Будет ли серия после ничьи на табло."
          value={penaltyShootout}
          locked={locked}
          onChange={onPenaltyShootoutChange}
        />
      </div>

      <div className="card-inner">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={hasExactScore}
            disabled={locked}
            onChange={(e) => onHasExactScoreChange(e.target.checked)}
          />
          <span>
            <span className="section-title">Точный счёт на табло</span>
            <span className="ml-2 text-xs font-normal text-muted">
              опционально
            </span>
            <p className="mt-1 text-xs text-muted">
              +2 очка (+3 с исходом). Ничья на табло допустима.
            </p>
          </span>
        </label>

        {hasExactScore ? (
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
        ) : null}
      </div>
    </div>
  );
}
