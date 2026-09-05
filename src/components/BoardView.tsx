import { useMemo } from 'react';
import type { BoardColumnId, BoardState, FiredEventLog, Scenario } from '../model';
import {
  BOARD_COLUMNS,
  COLUMN_LABELS,
  SPEED_ZONE_COLUMNS,
  SOLD_COLUMNS,
  bottleneckColumn,
  columnJobCounts,
  formatSimClock,
  gpSoldProgress,
  jobsInColumn,
  nextMostImportant,
  partsWipHours,
  techHoursProgress,
  totalFlagHours,
} from '../model';
import { Column } from './Column';
import { MagnetLegend } from './MagnetLegend';
import { MoveBar } from './VehicleCard';

interface Props {
  scenario: Scenario;
  board: BoardState;
  simMin: number;
  running: boolean;
  toast: string | null;
  fired: FiredEventLog[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (jobId: string, column: BoardColumnId) => void;
  onClearBlocker: (jobId: string) => void;
  onAnswerDelivered: (jobId: string) => void;
  onTogglePause: () => void;
  onEnd: () => void;
  onDismissToast: () => void;
  onHome: () => void;
  onOpenTutorial?: () => void;
}

export function BoardView({
  scenario,
  board,
  simMin,
  running,
  toast,
  fired,
  selectedId,
  onSelect,
  onMove,
  onClearBlocker,
  onAnswerDelivered,
  onTogglePause,
  onEnd,
  onDismissToast,
  onHome,
  onOpenTutorial,
}: Props) {
  const selected = useMemo(
    () => board.jobs.find((j) => j.id === selectedId),
    [board.jobs, selectedId],
  );
  const progress = Math.min(100, (simMin / scenario.durationMin) * 100);

  const counts = useMemo(() => columnJobCounts(board), [board]);
  const bottleneck = useMemo(() => bottleneckColumn(board), [board]);
  const hours = useMemo(() => partsWipHours(board), [board]);
  const waiterCount = useMemo(
    () =>
      board.jobs.filter(
        (j) => j.column !== 'final' && j.markers?.includes('W'),
      ).length,
    [board.jobs],
  );
  const lateAnswerCount = useMemo(
    () => board.jobs.filter((j) => j.lateAnswer).length,
    [board.jobs],
  );
  const nextHint = useMemo(
    () => nextMostImportant(board, simMin),
    [board, simMin],
  );
  const speedCount = useMemo(
    () =>
      board.jobs.filter((j) => SPEED_ZONE_COLUMNS.includes(j.column)).length,
    [board.jobs],
  );
  const soldCount = useMemo(
    () => board.jobs.filter((j) => SOLD_COLUMNS.includes(j.column)).length,
    [board.jobs],
  );

  const goalHours = scenario.goals?.techHoursPerDay ?? 8;
  const flatRate = scenario.goals?.flatRatePerFlagHr ?? 50;
  const availableClock = scenario.goals?.availableClockHrs;
  const techProg = useMemo(
    () =>
      techHoursProgress(board, {
        goalHours,
        flatRatePerFlagHr: flatRate,
        availableClockHrs: availableClock,
      }),
    [board, goalHours, flatRate, availableClock],
  );
  const gpProg = useMemo(
    () => gpSoldProgress(board, scenario),
    [board, scenario],
  );
  const gpPct = Math.min(100, gpProg.target > 0 ? (gpProg.current / gpProg.target) * 100 : 0);
  const flagTotal = useMemo(() => totalFlagHours(board), [board]);
  const gsph =
    flagTotal > 0 ? Math.round(gpProg.current / flagTotal) : null;

  return (
    <div className="board-screen">
      <header className="topbar">
        <div className="topbar__left">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onHome}>
            ← Exit
          </button>
          <div>
            <p className="eyebrow">Board Sim</p>
            <h1 className="topbar__title">{scenario.title}</h1>
          </div>
        </div>
        <div className="topbar__clock" aria-live="polite">
          <span className="clock__time">{formatSimClock(simMin)}</span>
          <span className="clock__meta">
            T+{Math.floor(simMin)}m / {scenario.durationMin}m · {fired.length} events
          </span>
          <div className="clock__bar" aria-hidden>
            <div className="clock__fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="topbar__actions">
          {onOpenTutorial && (
            <button
              type="button"
              className="btn btn--ghost btn--sm btn--help"
              onClick={onOpenTutorial}
              title="How The Board works"
              aria-label="How The Board works"
            >
              ?
            </button>
          )}
          <button type="button" className="btn btn--sm btn--primary" onClick={onTogglePause}>
            {running ? 'Pause' : 'Resume'}
          </button>
          <button type="button" className="btn btn--sm btn--warn" onClick={onEnd}>
            End &amp; debrief
          </button>
        </div>
      </header>

      <div className="board-hud" aria-label="Factory of hours and bottlenecks">
        <div className="board-hud__zones">
          <span className="hud-zone hud-zone--speed">
            Speed zone (unsold) · {speedCount}
          </span>
          <span className="hud-zone hud-zone--sold">
            Sold / production · {soldCount}
          </span>
        </div>
        <div className="board-hud__cue">
          Empty your section — find the bottleneck
        </div>
        <MagnetLegend compact className="board-hud__legend" />
        <div className="board-hud__counts">
          {BOARD_COLUMNS.map((col) => (
            <span
              key={col}
              className={`hud-pill ${bottleneck === col ? 'hud-pill--hot' : ''}`}
              title={COLUMN_LABELS[col]}
            >
              {COLUMN_LABELS[col].slice(0, 4)} {counts[col]}
            </span>
          ))}
        </div>
        <div className="board-hud__hours">
          <span>
            Parts+WIP: <strong>{hours.total.toFixed(1)}h</strong>
          </span>
          {hours.byTech.length > 0 && (
            <span className="board-hud__techs">
              {hours.byTech.map((t) => (
                <span key={t.tech} className="hud-pill hud-pill--tech">
                  {t.tech} {t.hours.toFixed(1)}h
                </span>
              ))}
            </span>
          )}
          {waiterCount > 0 && (
            <span className="hud-pill hud-pill--waiter">
              W×{waiterCount} on board
            </span>
          )}
          {lateAnswerCount > 0 && (
            <span className="hud-pill hud-pill--late">
              Late ans ×{lateAnswerCount}
            </span>
          )}
        </div>
      </div>

      <div className="board-hud board-hud--goals" aria-label="Flag hours and GP$ sold goals">
        <div className="goals-strip__label">
          Flat rate: paid on flag hours · target {goalHours} flag hrs/tech
        </div>
        <div className="goals-strip__techs">
          <span className="goals-strip__heading">Flag hrs / tech</span>
          {techProg.length === 0 ? (
            <span className="hud-pill">No techs assigned yet</span>
          ) : (
            techProg.map((t) => (
              <span
                key={t.tech}
                className={`hud-pill hud-pill--flag ${t.hit ? 'hud-pill--goal-hit' : 'hud-pill--goal-miss'}`}
                title={
                  (t.payEstimate != null
                    ? `Est. flat-rate pay $${t.payEstimate.toFixed(0)}`
                    : '') +
                  (t.efficiencyPct != null
                    ? ` · Eff ${t.efficiencyPct.toFixed(0)}%`
                    : '')
                }
              >
                <span className="flag-pill__main">
                  {t.tech} {t.hours.toFixed(1)} / {t.goal.toFixed(1)} flag
                </span>
                {t.payEstimate != null && (
                  <span className="flag-pill__pay">
                    ${t.payEstimate.toFixed(0)}
                  </span>
                )}
                {t.efficiencyPct != null && (
                  <span className="flag-pill__eff">
                    {t.efficiencyPct.toFixed(0)}%
                  </span>
                )}
              </span>
            ))
          )}
        </div>
        <div className="goals-strip__gp">
          <div className="goals-strip__gp-meta">
            <span className="goals-strip__heading">GP$ sold</span>
            <strong>
              ${gpProg.current.toLocaleString()} / ${gpProg.target.toLocaleString()}
            </strong>
            {gsph != null && (
              <span className="goals-strip__gsph" title="Gross sales per flag hour">
                GSPH ~${gsph.toLocaleString()}
                {scenario.goals?.gsphHint != null
                  ? ` (hint $${scenario.goals.gsphHint})`
                  : ''}
              </span>
            )}
          </div>
          <div className="goals-bar" aria-hidden>
            <div
              className={`goals-bar__fill ${gpProg.met ? 'goals-bar__fill--met' : ''}`}
              style={{ width: `${gpPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="board-hud board-hud--coach" aria-label="Next most important">
        <div className="board-hud__next">
          <span className="board-hud__next-label">Next most important</span>
          <span className="board-hud__next-reason">{nextHint.reason}</span>
          {nextHint.jobId && (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => onSelect(nextHint.jobId)}
            >
              Select
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onDismissToast}>
            Dismiss
          </button>
        </div>
      )}

      <div className="board" role="list">
        {BOARD_COLUMNS.map((col) => (
          <Column
            key={col}
            columnId={col}
            jobs={jobsInColumn(board, col)}
            selectedId={selectedId}
            highlightJobId={nextHint.jobId}
            bottleneck={bottleneck === col}
            onSelect={(id) => onSelect(id)}
            onDragStart={(id) => onSelect(id)}
            onDropJob={(columnId, jobId) => onMove(jobId, columnId)}
          />
        ))}
      </div>

      <MoveBar
        job={selected}
        onMove={(col) => {
          if (selected) onMove(selected.id, col);
        }}
        onClearSelection={() => onSelect(null)}
        onClearBlocker={() => {
          if (selected) onClearBlocker(selected.id);
        }}
        onAnswerDelivered={() => {
          if (selected) onAnswerDelivered(selected.id);
        }}
      />
    </div>
  );
}
