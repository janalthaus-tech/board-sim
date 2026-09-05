import { useState } from 'react';
import {
  SCENARIOS,
  loadPace,
  savePace,
  PACE_OPTIONS,
  type PaceId,
} from '../model';
import { MagnetLegend } from './MagnetLegend';
import { Tutorial } from './Tutorial';

interface Props {
  onStart: (scenarioId: string, pace: PaceId) => void;
  onWatchDemo?: () => void;
}

export function Home({ onStart, onWatchDemo }: Props) {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [pace, setPace] = useState<PaceId>(() => loadPace());

  const selectPace = (next: PaceId) => {
    setPace(next);
    savePace(next);
  };

  const blurb =
    PACE_OPTIONS.find((o) => o.id === pace)?.blurb ??
    'More real time per sim minute';

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
              onClick={onWatchDemo}
            >
              Watch decision demo
            </button>
          )}
        </div>
        <MagnetLegend className="home__legend" />
      </header>

      <section className="pace-panel" aria-label="Training pace">
        <div className="pace-panel__head">
          <h2 className="pace-panel__title">Pace</h2>
          <p className="pace-panel__blurb">{blurb}</p>
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
      </section>

      <section className="scenario-grid" aria-label="Training scenarios">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="scenario-card"
            onClick={() => onStart(s.id, pace)}
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
