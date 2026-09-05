import { useState } from 'react';
import { SCENARIOS } from '../model';
import { Tutorial } from './Tutorial';

interface Props {
  onStart: (scenarioId: string) => void;
}

export function Home({ onStart }: Props) {
  const [tutorialOpen, setTutorialOpen] = useState(false);

  return (
    <div className="home">
      <header className="home__hero">
        <p className="eyebrow">Board Sim</p>
        <h1>The Board Simulator</h1>
        <p className="home__lede">
          Train automotive repair shop flow on The Board. Pick a scenario, move jobs through
          Dispatch → Final, and survive timed chaos.
        </p>
        <button
          type="button"
          className="btn btn--primary home__tutorial-btn"
          onClick={() => setTutorialOpen(true)}
        >
          How The Board works
        </button>
      </header>

      <section className="scenario-grid" aria-label="Training scenarios">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="scenario-card"
            onClick={() => onStart(s.id)}
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
