import { useEffect, useLayoutEffect, useState } from 'react';

export type DemoTarget =
  | 'columns'
  | 'zones'
  | 'magnets'
  | 'waiter'
  | 'next-important'
  | 'counts'
  | 'toast'
  | 'goals'
  | 'movebar'
  | 'speed'
  | 'repair-chips'
  | 'job-detail';

interface DemoStep {
  target: DemoTarget;
  title: string;
  body: string;
  /** Prefer selecting a waiter card so MoveBar / timer are visible */
  selectWaiter?: boolean;
}

const STEPS: DemoStep[] = [
  {
    target: 'columns',
    title: 'Ride the track left → right',
    body: 'Board columns are roller-coaster order: Dispatch through Final. Don’t skip cars ahead of earlier ones — clear the earliest step first.',
  },
  {
    target: 'zones',
    title: 'Speed zone vs Sold',
    body: 'Unsold cars live in the speed zone (Dispatch / Inspection / answer). Prioritize getting answers out before polishing sold / production work.',
  },
  {
    target: 'magnets',
    title: 'Magnet markers W / R / S / H',
    body: 'Letter magnets flag special cars: Waiter, Rental, Shuttle, Heart. Scan magnets before you dig into concerns — they change priority.',
  },
  {
    target: 'waiter',
    title: 'Waiter timer = 1-hour answer',
    body: 'W cars show a countdown. Earliest timer first — deliver an answer within about an hour of drop-off before chasing sold WIP.',
    selectWaiter: true,
  },
  {
    target: 'next-important',
    title: 'Trust “Next most important”',
    body: 'The coach picks the earliest pressure on the board. Read the reason, tap Select, then act — don’t invent a different fire unless the board proves otherwise.',
  },
  {
    target: 'counts',
    title: 'Column pills & bottlenecks',
    body: 'Count pills show where cars pile up. A hot (bottleneck) pill means empty that section before feeding more work into it.',
  },
  {
    target: 'toast',
    title: 'Toast events — react',
    body: 'Toasts are live shop events (walk-ins, parts late, QC fails). Read them, update the board, don’t dismiss and forget.',
  },
  {
    target: 'goals',
    title: 'Flag hrs & GP$ sold',
    body: 'Shop goals track flat-rate flag hours and GP$ sold. Important — but secondary to clearing the unsold speed zone and waiter timers.',
  },
  {
    target: 'repair-chips',
    title: 'Inspection → approval → parts → repair',
    body: 'Card chips answer the four shop questions: Is inspection done? What did the customer approve? Are parts available (and when)? Is the repair complete?',
    selectWaiter: true,
  },
  {
    target: 'job-detail',
    title: 'Open a card for line-level detail',
    body: 'The detail sheet shows proposed lines, approvals, parts ETAs, and completion times. Training actions let you mark inspection complete, approve, order parts, or finish a line.',
    selectWaiter: true,
  },
  {
    target: 'movebar',
    title: 'How to act',
    body: 'Tap a card, then use MoveBar: advance columns, mark Answer delivered, or Clear blocker. That’s how decisions become flow.',
    selectWaiter: true,
  },
  {
    target: 'speed',
    title: 'Pace + 0.5× while learning',
    body: 'Easy pace buys real-time thinking room. Drop to 0.5× when you’re learning indicators — turn speed back up once the HUD feels automatic.',
  },
];

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  open: boolean;
  onSelectWaiter?: () => void;
  onFinishPlay: () => void;
  onFinishHome: () => void;
  onSkip: () => void;
}

function queryTarget(target: DemoTarget): Element | null {
  return document.querySelector(`[data-demo="${target}"]`);
}

function measure(el: Element | null): SpotlightRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  const pad = 6;
  return {
    top: Math.max(4, r.top - pad),
    left: Math.max(4, r.left - pad),
    width: Math.min(window.innerWidth - 8, r.width + pad * 2),
    height: Math.min(window.innerHeight - 8, r.height + pad * 2),
  };
}

export function DecisionDemo({
  open,
  onSelectWaiter,
  onFinishPlay,
  onFinishHome,
  onSkip,
}: Props) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [spot, setSpot] = useState<SpotlightRect | null>(null);

  const current = STEPS[step];
  const last = step >= STEPS.length - 1;
  const coachTop =
    current?.target === 'movebar' ||
    current?.target === 'job-detail' ||
    current?.target === 'toast' ||
    current?.target === 'speed';

  useEffect(() => {
    if (!open) {
      setStep(0);
      setDone(false);
      setSpot(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || done || !current?.selectWaiter) return;
    onSelectWaiter?.();
  }, [open, done, step, current?.selectWaiter, onSelectWaiter]);

  useLayoutEffect(() => {
    if (!open || done) {
      setSpot(null);
      return;
    }

    let cancelled = false;
    const update = () => {
      if (cancelled) return;
      const el = queryTarget(current.target);
      setSpot(measure(el));
      if (el && 'scrollIntoView' in el) {
        try {
          (el as HTMLElement).scrollIntoView({
            block: 'nearest',
            inline: 'nearest',
            behavior: 'smooth',
          });
        } catch {
          /* ignore */
        }
      }
    };

    update();
    // Retry after layout (compact HUD expand / MoveBar select)
    const t1 = window.setTimeout(update, 80);
    const t2 = window.setTimeout(update, 220);
    const onResize = () => update();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, done, step, current?.target]);

  if (!open) return null;

  if (done) {
    return (
      <div
        className="demo-overlay demo-overlay--done"
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-done-title"
      >
        <div className="demo-coach demo-coach--done">
          <p className="eyebrow">Decision demo</p>
          <h2 id="demo-done-title">You’re ready to decide on The Board</h2>
          <p className="demo-coach__body">
            Play Morning Rush with the clock running, or head home and reopen this demo anytime.
          </p>
          <div className="demo-coach__actions">
            <button type="button" className="btn btn--ghost" onClick={onFinishHome}>
              Back to home
            </button>
            <button type="button" className="btn btn--primary" onClick={onFinishPlay}>
              Play this scenario
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="demo-overlay" role="dialog" aria-modal="true" aria-labelledby="demo-title">
      <div className="demo-dim" aria-hidden />
      {spot && (
        <div
          className="demo-spotlight"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
          }}
          aria-hidden
        />
      )}

      <div className={`demo-coach ${coachTop ? 'demo-coach--top' : ''}`}>
        <div className="demo-coach__head">
          <p className="eyebrow">Decision demo</p>
          <p className="demo-coach__count">
            Step {step + 1} / {STEPS.length}
          </p>
        </div>
        <h2 id="demo-title">{current.title}</h2>
        <p className="demo-coach__body">{current.body}</p>
        <div className="demo-coach__dots" aria-hidden>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`demo-coach__dot ${i === step ? 'demo-coach__dot--active' : ''}`}
            />
          ))}
        </div>
        <div className="demo-coach__actions">
          <button type="button" className="btn btn--ghost" onClick={onSkip}>
            Skip
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </button>
          {!last ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setDone(true)}
            >
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function decisionDemoStepCount(): number {
  return STEPS.length;
}
