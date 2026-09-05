import { useState } from 'react';
import {
  SCENARIOS,
  loadPace,
  savePace,
  PACE_OPTIONS,
  loadRepairDetailEnabled,
  saveRepairDetailEnabled,
  loadRole,
  saveRole,
  ROLE_OPTIONS,
  type PaceId,
  type RoleId,
} from '../model';
import { MagnetLegend } from './MagnetLegend';
import { Tutorial } from './Tutorial';

export interface StartOptions {
  pace: PaceId;
  repairDetailEnabled: boolean;
  role: RoleId;
}

interface Props {
  onStart: (scenarioId: string, options: StartOptions) => void;
  onWatchDemo?: (options: StartOptions) => void;
}

export function Home({ onStart, onWatchDemo }: Props) {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [pace, setPace] = useState<PaceId>(() => loadPace());
  const [repairDetail, setRepairDetail] = useState(() =>
    loadRepairDetailEnabled(),
  );
  const [role, setRole] = useState<RoleId>(() => loadRole());

  const selectPace = (next: PaceId) => {
    setPace(next);
    savePace(next);
  };

  const toggleRepairDetail = (next: boolean) => {
    setRepairDetail(next);
    saveRepairDetailEnabled(next);
  };

  const selectRole = (next: RoleId) => {
    setRole(next);
    saveRole(next);
  };

  const startOptions = (): StartOptions => ({
    pace,
    repairDetailEnabled: repairDetail,
    role,
  });

  const paceBlurb =
    PACE_OPTIONS.find((o) => o.id === pace)?.blurb ??
    'More real time per sim minute';
  const roleBlurb =
    ROLE_OPTIONS.find((o) => o.id === role)?.blurb ?? 'All controls';

  return (
    <div className="home">
      <header className="home__hero">
        <p className="eyebrow">Board Sim</p>
        <h1>The Board Simulator</h1>
        <p className="home__lede">
          Train automotive repair shop flow on The Board. Pick a scenario, move jobs through
          Dispatch → Final, and survive timed chaos.
        </p>
        <div className="home__cta-row">
          <button
            type="button"
            className="btn btn--primary home__tutorial-btn"
            onClick={() => setTutorialOpen(true)}
          >
            How The Board works
          </button>
          {onWatchDemo && (
            <button
              type="button"
              className="btn btn--ghost home__tutorial-btn"
              onClick={() => onWatchDemo(startOptions())}
            >
              Watch decision demo
            </button>
          )}
        </div>
        <MagnetLegend className="home__legend" />
      </header>

      <section className="sim-options" aria-label="Simulation options">
        <div className="sim-options__head">
          <h2 className="sim-options__title">Simulation options</h2>
          <p className="sim-options__lede">
            Applied when you start a scenario (or the decision demo).
          </p>
        </div>

        <div className="pace-panel pace-panel--nested" aria-label="Training pace">
          <div className="pace-panel__head">
            <h3 className="pace-panel__title">Pace</h3>
            <p className="pace-panel__blurb">{paceBlurb}</p>
          </div>
          <div
            className="pace-seg"
            role="radiogroup"
            aria-label="Pace — real-time pressure"
          >
            {PACE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={pace === opt.id}
                className={`pace-seg__btn ${pace === opt.id ? 'pace-seg__btn--active' : ''}`}
                onClick={() => selectPace(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="pace-panel__hint">
            Pace changes real time per sim minute — separate from scenario complexity
            (intro / intermediate / advanced).
          </p>
        </div>

        <div className="sim-option-row">
          <div className="sim-option-row__text">
            <label className="sim-option-row__label" htmlFor="repair-detail-toggle">
              Repair &amp; approval detail
            </label>
            <p className="sim-option-row__help">
              Off (default) = classic board: move cards by column, concerns/flags/markers/HUD.
              On = inspection status, repair lines, approvals, parts ETA, and progress sheet.
            </p>
          </div>
          <button
            id="repair-detail-toggle"
            type="button"
            role="switch"
            aria-checked={repairDetail}
            className={`toggle ${repairDetail ? 'toggle--on' : ''}`}
            onClick={() => toggleRepairDetail(!repairDetail)}
          >
            <span className="toggle__knob" aria-hidden />
            <span className="toggle__label">{repairDetail ? 'On' : 'Off'}</span>
          </button>
        </div>

        <div className="sim-option-block" aria-label="Role mode">
          <div className="pace-panel__head">
            <h3 className="pace-panel__title">Role</h3>
            <p className="pace-panel__blurb">{roleBlurb}</p>
          </div>
          <div
            className="pace-seg role-seg"
            role="radiogroup"
            aria-label="Role mode"
          >
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={role === opt.id}
                className={`pace-seg__btn ${role === opt.id ? 'pace-seg__btn--active' : ''}`}
                onClick={() => selectRole(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="pace-panel__hint">
            Role focuses UI and coach cues — same board; cards are never removed.
          </p>
        </div>
      </section>

      <section className="scenario-grid" aria-label="Training scenarios">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="scenario-card"
            onClick={() => onStart(s.id, startOptions())}
          >
            {(s.difficulty || s.focus) && (
              <div className="scenario-card__tags">
                {s.difficulty && (
                  <span className={`scenario-card__difficulty scenario-card__difficulty--${s.difficulty}`}>
                    {s.difficulty}
                  </span>
                )}
                {s.focus && <span className="scenario-card__focus">{s.focus}</span>}
              </div>
            )}
            <h2>{s.title}</h2>
            <p>{s.description}</p>
            <div className="scenario-card__meta">
              <span>{s.durationMin} sim min</span>
              <span>{s.seedJobs.length} starter cars</span>
              <span>{s.events.length} events</span>
              {s.goals && (
                <span>
                  GP$ {s.goals.gpSoldTarget.toLocaleString()} · {s.goals.techHoursPerDay} flag hrs/tech
                </span>
              )}
            </div>
            <span className="scenario-card__cta">Start scenario →</span>
          </button>
        ))}
      </section>

      <footer className="footer">
        Inspired by Shop Fix Academy Board workflow · Training simulator only — not an official product
      </footer>

      <Tutorial open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </div>
  );
}
