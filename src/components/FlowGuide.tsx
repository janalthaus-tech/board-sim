interface Props {
  onHome: () => void;
}

export function FlowGuide({ onHome }: Props) {
  return (
    <div className="flow-guide">
      <header className="flow-guide__bar no-print">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onHome}>
          ← Home
        </button>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => window.print()}
        >
          Print / Save PDF
        </button>
      </header>

      <article className="flow-guide__sheet">
        <p className="eyebrow">ShopFix · Board Sim</p>
        <h1>Optimize shop flow with The Board</h1>
        <p className="flow-guide__subtitle">
          (+ Kanban &amp; Toyota Way) — a one-pager for advisors, managers, and techs
        </p>

        <section className="flow-guide__section">
          <h2>Board alone</h2>
          <ol className="flow-guide__list">
            <li>
              <strong>Protect the speed zone</strong> — Dispatch → Inspection → Answer.
              Aim for ~1-hour answers to the customer.
            </li>
            <li>
              <strong>Next most important thing</strong> — earliest stuck step / oldest
              waiter first. Clear the earliest bottle before polishing later ones.
            </li>
            <li>
              <strong>Empty the sections</strong> — piles mark bottlenecks. Final is the
              finish line (throughput), not a section you “empty” like Approval or Parts.
            </li>
            <li>
              <strong>Sell, assign tech, then produce</strong> — sold hours + tech on the
              card → flag hrs; GP$ comes from the sold pipeline.
            </li>
            <li>
              <strong>Magnets &amp; daily production meeting</strong> — W / R / S / H
              markers; commit what <em>goes today</em>.
            </li>
          </ol>
        </section>

        <section className="flow-guide__section">
          <h2>Kanban on The Board</h2>
          <ul className="flow-guide__bullets">
            <li>
              <strong>WIP limits</strong> — cap how many cars sit in a column so work
              pulls through instead of piling up.
            </li>
            <li>
              <strong>Pull, not push</strong> — take the next car when capacity frees;
              don’t shove more into a jammed bay.
            </li>
            <li>
              <strong>Visual blockers &amp; waiters</strong> — flags and W timers make
              stuck work obvious from across the shop.
            </li>
            <li>
              <strong>Cycle time per column</strong> — watch how long cars linger; long
              dwell = the next process improvement target.
            </li>
          </ul>
        </section>

        <section className="flow-guide__section">
          <h2>Toyota Way habits</h2>
          <ul className="flow-guide__bullets">
            <li>
              <strong>Flow over batching</strong> — keep cars moving; small, frequent
              handoffs beat big end-of-day dumps.
            </li>
            <li>
              <strong>Jidoka</strong> — QC fail returns the car (e.g. back toward Approval /
              rework) instead of letting defects travel downstream.
            </li>
            <li>
              <strong>Standard work</strong> — same column order, same magnets, same
              daily meeting rhythm.
            </li>
            <li>
              <strong>Heijunka</strong> — level the load across techs and hours so peaks
              don’t crush the speed zone.
            </li>
            <li>
              <strong>Kaizen via debrief</strong> — after each sim (and each real day),
              pick one bottleneck and improve it.
            </li>
          </ul>
        </section>

        <section className="flow-guide__section">
          <h2>What improves when it sticks</h2>
          <ul className="flow-guide__gains">
            <li>Faster answers and closer cycles</li>
            <li>More flag hours and steadier GP$</li>
            <li>Less WIP chaos and shorter cycle time</li>
            <li>Clearer roles — advisor sells, tech produces, board shows truth</li>
            <li>Capacity to scale without drowning in piles</li>
          </ul>
        </section>

        <p className="flow-guide__close">
          <strong>Board Sim</strong> is the practice gym — build the habits before you
          put live WIP limits on the shop floor.
        </p>

        <p className="flow-guide__disclaimer">
          Inspired by Shop Fix Board / roller-coaster training — paraphrased for training
          only. Not an official Shop Fix Academy product.
        </p>
      </article>
    </div>
  );
}
