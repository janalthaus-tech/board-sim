import type { DebriefStats, FiredEventLog, Scenario } from '../model';

interface Props {
  scenario: Scenario;
  stats: DebriefStats;
  fired: FiredEventLog[];
  onAgain: () => void;
  onHome: () => void;
}

export function Debrief({ scenario, stats, fired, onAgain, onHome }: Props) {
  return (
    <div className="debrief">
      <header className="debrief__hero">
        <p className="eyebrow">Debrief</p>
        <h1>{scenario.title}</h1>
        <div className={`grade grade--${stats.grade.toLowerCase()}`}>
          <span className="grade__letter">{stats.grade}</span>
          <span className="grade__score">{stats.score}/100</span>
        </div>
      </header>

      <div className="debrief__stats">
        <div className="stat">
          <span className="stat__value">{stats.completed}</span>
          <span className="stat__label">Completed (Final)</span>
        </div>
        <div className="stat">
          <span className="stat__value">{stats.inProcess}</span>
          <span className="stat__label">Still in process</span>
        </div>
        <div className="stat">
          <span className="stat__value">{stats.blockersHit}</span>
          <span className="stat__label">Blockers hit</span>
        </div>
        <div className="stat">
          <span className="stat__value">{stats.urgentHandled}</span>
          <span className="stat__label">Urgents completed</span>
        </div>
        {stats.waitersLeft != null && (
          <div className="stat">
            <span className="stat__value">{stats.waitersLeft}</span>
            <span className="stat__label">Waiters left</span>
          </div>
        )}
        {stats.hoursStuckPartsWip != null && (
          <div className="stat">
            <span className="stat__value">{stats.hoursStuckPartsWip.toFixed(1)}</span>
            <span className="stat__label">Hours in Parts/WIP</span>
          </div>
        )}
        {stats.qcRestarts != null && (
          <div className="stat">
            <span className="stat__value">{stats.qcRestarts}</span>
            <span className="stat__label">QC restarts</span>
          </div>
        )}
        {stats.answersOnTime != null && (
          <div className="stat">
            <span className="stat__value">{stats.answersOnTime}</span>
            <span className="stat__label">Answers ≤1h</span>
          </div>
        )}
        {stats.answersLate != null && (
          <div className="stat">
            <span className="stat__value">{stats.answersLate}</span>
            <span className="stat__label">Answers late</span>
          </div>
        )}
        {stats.gpSold != null && stats.gpTarget != null && (
          <div className="stat">
            <span className="stat__value">
              ${stats.gpSold.toLocaleString()}
            </span>
            <span className="stat__label">
              GP$ sold / ${stats.gpTarget.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {stats.techHours && stats.techHours.length > 0 && (
        <section className="debrief__tech-hours">
          <h2>Flag hours vs baseline</h2>
          <p className="debrief__flat-note">
            Flat rate: techs earn on flag (billed/sold) hours — not clock time.
            Soft score still uses the {stats.techHours[0]?.goal ?? 8} flag hrs/tech target.
          </p>
          <ul className="debrief__tech-list">
            {stats.techHours.map((t) => {
              const hit = t.hours >= t.goal;
              const lowEff =
                t.efficiencyPct != null && t.efficiencyPct < 70;
              return (
                <li key={t.tech} className={hit ? 'tech-hit' : 'tech-miss'}>
                  <strong>{t.tech}</strong>{' '}
                  {t.hours.toFixed(1)} / {t.goal.toFixed(1)} flag hrs{' '}
                  {hit ? '✓' : '— miss'}
                  {t.payEstimate != null && (
                    <> · est. pay ${t.payEstimate.toFixed(0)}</>
                  )}
                  {t.efficiencyPct != null && (
                    <>
                      {' '}
                      · eff {t.efficiencyPct.toFixed(0)}%
                      {lowEff ? ' (low)' : ''}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="debrief__notes">
        <h2>Coach notes</h2>
        <ul>
          {stats.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      <section className="debrief__events">
        <h2>Events fired ({fired.length})</h2>
        {fired.length === 0 ? (
          <p>No timed events fired.</p>
        ) : (
          <ul>
            {fired.map((f) => (
              <li key={f.eventId}>
                <span className="event-time">T+{f.atSimMin}m</span> {f.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="debrief__actions">
        <button type="button" className="btn btn--primary" onClick={onAgain}>
          Run again
        </button>
        <button type="button" className="btn btn--ghost" onClick={onHome}>
          Scenario picker
        </button>
      </div>

      <footer className="footer">
        Inspired by Shop Fix Academy Board workflow · Training simulator only — not an official product
      </footer>
    </div>
  );
}
