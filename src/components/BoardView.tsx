import { useEffect, useMemo, useState } from 'react';
import type { BoardColumnId, BoardState, FiredEventLog, Scenario, SpeedMul } from '../model';
import {
  BOARD_COLUMNS,
  COLUMN_LABELS,
  SPEED_MUL_OPTIONS,
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
import { JobDetail } from './JobDetail';
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
  onMarkInspectionComplete: (jobId: string) => void;
  onApproveAllPending: (jobId: string) => void;
  onApproveLine: (jobId: string, lineId: string) => void;
  onMarkPartsOrdered: (jobId: string, lineId: string) => void;
  onMarkLineDone: (jobId: string, lineId: string) => void;
  onMarkLineInRepair: (jobId: string, lineId: string) => void;
  onTogglePause: () => void;
  onEnd: () => void;
  onDismissToast: () => void;
  onHome: () => void;
  onOpenTutorial?: () => void;
  onOpenDemo?: () => void;
  /** Force full HUD + sticky toast for decision demo */
  demoMode?: boolean;
  speedMul: SpeedMul;
  onSpeedMul: (mul: SpeedMul) => void;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
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
  onMarkInspectionComplete,
  onApproveAllPending,
  onApproveLine,
  onMarkPartsOrdered,
  onMarkLineDone,
  onMarkLineInRepair,
  onTogglePause,
  onEnd,
  onDismissToast,
  onHome,
  onOpenTutorial,
  onOpenDemo,
  demoMode = false,
  speedMul,
  onSpeedMul,
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

  const compactHudMode = useMediaQuery(
    '(max-width: 900px), (max-height: 500px)',
  );
  const landscapeShort = useMediaQuery(
    '(orientation: landscape) and (max-height: 500px)',
  );
  const [hudExpanded, setHudExpanded] = useState(false);
  const showFullHud =
    demoMode || !compactHudMode || (hudExpanded && !landscapeShort);

  useEffect(() => {
    if (!toast || demoMode) return;
    const t = window.setTimeout(() => onDismissToast(), 4200);
    return () => window.clearTimeout(t);
  }, [toast, onDismissToast, demoMode]);

  return (
    <div className="board-screen">
      <header className="topbar">
        <div className="topbar__left">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onHome}>
            ← Exit
          </button>
          <div className="topbar__titles">
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
          {onOpenDemo && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={onOpenDemo}
              title="Watch decision demo"
              aria-label="Watch decision demo"
            >
              Demo
            </button>
          )}
          <div
            className="speed-seg"
            role="radiogroup"
            aria-label="Sim speed multiplier"
            title="Real-time playback speed (independent of Pace)"
            data-demo="speed"
          >
            {SPEED_MUL_OPTIONS.map((mul) => (
              <button
                key={mul}
                type="button"
                role="radio"
                aria-checked={speedMul === mul}
                className={`speed-seg__btn ${speedMul === mul ? 'speed-seg__btn--active' : ''}`}
                onClick={() => onSpeedMul(mul)}
              >
                {mul}×
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--sm btn--primary" onClick={onTogglePause}>
            {running ? 'Pause' : 'Resume'}
          </button>
          <button type="button" className="btn btn--sm btn--warn" onClick={onEnd}>
            End &amp; debrief
          </button>
        </div>
      </header>

      {compactHudMode && !showFullHud ? (
        <div
          className="board-hud board-hud--compact"
          aria-label="Compact board status"
        >
          <div className="board-hud__compact-main">
            <span className="board-hud__next-label">Next</span>
            <span className="board-hud__next-reason board-hud__next-reason--compact">
              {nextHint.reason}
            </span>
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
          <div className="board-hud__compact-meta">
            {bottleneck && (
              <span className="hud-pill hud-pill--hot" title="Bottleneck column">
                Bottleneck {COLUMN_LABELS[bottleneck].slice(0, 6)}
              </span>
            )}
            {waiterCount > 0 && (
              <span className="hud-pill hud-pill--waiter">W×{waiterCount}</span>
            )}
            {lateAnswerCount > 0 && (
              <span className="hud-pill hud-pill--late">Late×{lateAnswerCount}</span>
            )}
            {!landscapeShort && (
              <button
                type="button"
                className="btn btn--sm btn--ghost board-hud__stats-toggle"
                aria-expanded={false}
                onClick={() => setHudExpanded(true)}
              >
                Stats
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="board-hud" aria-label="Factory of hours and bottlenecks">
            {compactHudMode && (
              <div className="board-hud__compact-toolbar">
                <button
                  type="button"
                  className="btn btn--sm btn--ghost board-hud__stats-toggle"
                  aria-expanded={true}
                  onClick={() => setHudExpanded(false)}
                >
                  Hide stats
                </button>
              </div>
            )}
            <div className="board-hud__zones" data-demo="zones">
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
            <div data-demo="magnets">
              <MagnetLegend compact className="board-hud__legend" />
            </div>
            <div className="board-hud__counts" data-demo="counts">
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

          <div className="board-hud board-hud--goals" aria-label="Flag hours and GP$ sold goals" data-demo="goals">
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

          <div className="board-hud board-hud--coach" aria-label="Next most important" data-demo="next-important">
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
        </>
      )}

      {toast && (
        <div className="toast" role="status" data-demo="toast">
          <span className="toast__text">{toast}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onDismissToast}>
            Dismiss
          </button>
        </div>
      )}

      <div className="board" role="list" data-demo="columns">
        {BOARD_COLUMNS.map((col) => (
          <Column
            key={col}
            columnId={col}
            jobs={jobsInColumn(board, col)}
            selectedId={selectedId}
            highlightJobId={nextHint.jobId}
            bottleneck={bottleneck === col}
            simMin={simMin}
            onSelect={(id) => onSelect(id)}
            onDragStart={(id) => onSelect(id)}
            onDropJob={(columnId, jobId) => onMove(jobId, columnId)}
          />
        ))}
      </div>

      {selected && (
        <JobDetail
          job={selected}
          simMin={simMin}
          onClose={() => onSelect(null)}
          onMarkInspectionComplete={() => onMarkInspectionComplete(selected.id)}
          onApproveAllPending={() => onApproveAllPending(selected.id)}
          onApproveLine={(lineId) => onApproveLine(selected.id, lineId)}
          onMarkPartsOrdered={(lineId) => onMarkPartsOrdered(selected.id, lineId)}
          onMarkLineDone={(lineId) => onMarkLineDone(selected.id, lineId)}
          onMarkLineInRepair={(lineId) => onMarkLineInRepair(selected.id, lineId)}
        />
      )}

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
