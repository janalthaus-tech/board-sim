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
  /** Needs repair detail UI visible — demo will temporarily enable if off */
  needsDetail?: boolean;
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
    body: 'Card chips answer the four shop questions: Is inspection done? What did the customer approve? Are parts available (and when)? Is the repair complete? (Repair detail is turned on for this step if it was off.)',
    needsDetail: true,
  },
  {
    target: 'job-detail',
    title: 'Open a card for line-level detail',
    body: 'The detail sheet shows proposed lines, approvals, parts ETAs, and completion times. Training actions let you mark inspection complete, approve, order parts, or finish a line.',
    selectWaiter: true,
    needsDetail: true,
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
    body: 'Easy pace buys real-time thinking room. Use the 0.5× / 1× / 1.5× control in the top bar while learning indicators — turn speed back up once the HUD feels automatic.',
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
  repairDetailEnabled?: boolean;
  /** Temporarily turn detail on so demo steps that need chips/sheet can spotlight them */
  onEnsureRepairDetail?: () => void;
  onSelectWaiter?: () => void;
  /** Clear card selection so JobDetail doesn’t cover chip / column focus */
  onClearSelection?: () => void;
  onFinishPlay: () => void;
  onFinishHome: () => void;
  onSkip: () => void;
}

function isUsable(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  // Must intersect the viewport at least a little
  if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return false;
  return true;
}

function pickBest(nodes: Element[]): Element | null {
  const usable = nodes.filter(isUsable);
  if (usable.length === 0) return nodes[0] ?? null;
  // Prefer selected card descendants, then largest visible area
  const selected = usable.find((el) => el.closest('.card--selected'));
  if (selected) return selected;
  return usable.reduce((best, el) => {
    const a = el.getBoundingClientRect();
    const b = best.getBoundingClientRect();
    const areaA = Math.min(a.width, window.innerWidth) * Math.min(a.height, window.innerHeight);
    const areaB = Math.min(b.width, window.innerWidth) * Math.min(b.height, window.innerHeight);
    // For chips/timers prefer smaller focused targets over huge boards
    return areaA < areaB ? el : best;
  });
}

function queryTarget(target: DemoTarget): Element | null {
  if (target === 'columns') {
    const headers = Array.from(document.querySelectorAll('[data-demo="column-header"]'));
    if (headers.length > 0) return headers[0]; // measure() unions all headers
    return document.querySelector('[data-demo="columns"]');
  }
  if (target === 'waiter') {
    const selected =
      document.querySelector('.card--selected [data-demo="waiter"]') ??
      document.querySelector('.card--selected[data-demo="waiter"]');
    if (selected) return selected;
    return pickBest(Array.from(document.querySelectorAll('[data-demo="waiter"]')));
  }
  if (target === 'repair-chips') {
    const selected = document.querySelector('.card--selected [data-demo="repair-chips"]');
    if (selected && isUsable(selected)) return selected;
    // Prefer chips that are on-screen; avoid huge first-in-DOM offscreen cards
    const chips = Array.from(document.querySelectorAll('[data-demo="repair-chips"]'));
    const onScreen = chips.filter(isUsable);
    if (onScreen.length > 0) {
      // Prefer a card in the speed zone (left columns) when possible
      const speed = onScreen.find((el) => el.closest('.column--speed'));
      return speed ?? onScreen[0];
    }
    return chips[0] ?? null;
  }
  return document.querySelector(`[data-demo="${target}"]`);
}

function unionRects(els: Element[]): SpotlightRect | null {
  const usable = els.filter(isUsable);
  const list = usable.length > 0 ? usable : els;
  if (list.length === 0) return null;
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const el of list) {
    const r = el.getBoundingClientRect();
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (!Number.isFinite(top)) return null;
  const pad = 6;
  return {
    top: Math.max(4, top - pad),
    left: Math.max(4, left - pad),
    width: Math.min(window.innerWidth - 8, right - left + pad * 2),
    height: Math.min(window.innerHeight - 8, bottom - top + pad * 2),
  };
}

function measure(target: DemoTarget, el: Element | null): SpotlightRect | null {
  if (target === 'columns') {
    const headers = Array.from(document.querySelectorAll('[data-demo="column-header"]'));
    if (headers.length > 0) return unionRects(headers);
  }
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  const pad = target === 'waiter' || target === 'repair-chips' || target === 'speed' ? 8 : 6;
  // Cap absurdly tall spotlights so coach still frames the idea
  let height = r.height + pad * 2;
  let width = r.width + pad * 2;
  let top = r.top - pad;
  let left = r.left - pad;
  if (target === 'job-detail' && height > window.innerHeight * 0.55) {
    height = window.innerHeight * 0.55;
  }
  return {
    top: Math.max(4, top),
    left: Math.max(4, left),
    width: Math.min(window.innerWidth - 8, width),
    height: Math.min(window.innerHeight - 8, height),
  };
}

export function DecisionDemo({
  open,
  repairDetailEnabled = false,
  onEnsureRepairDetail,
  onSelectWaiter,
  onClearSelection,
  onFinishPlay,
  onFinishHome,
  onSkip,
}: Props) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [spot, setSpot] = useState<SpotlightRect | null>(null);

  const current = STEPS[step];
  const last = step >= STEPS.length - 1;

  // Keep coach opposite the spotlight so it never covers the described UI
  const coachTop = (() => {
    if (!current) return false;
    // Always top for bottom-of-screen UI
    if (
      current.target === 'movebar' ||
      current.target === 'job-detail' ||
      current.target === 'toast'
    ) {
      return true;
    }
    // Always bottom for top-bar / column-header / HUD strip targets
    if (
      current.target === 'speed' ||
      current.target === 'columns' ||
      current.target === 'zones' ||
      current.target === 'magnets' ||
      current.target === 'next-important' ||
      current.target === 'counts' ||
      current.target === 'goals'
    ) {
      return false;
    }
    if (!spot) return false;
    const mid = spot.top + spot.height / 2;
    return mid > window.innerHeight * 0.48;
  })();

  useEffect(() => {
    if (!open) {
      setStep(0);
      setDone(false);
      setSpot(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || done || !current) return;
    if (current.selectWaiter) {
      onSelectWaiter?.();
    } else {
      // Keep JobDetail closed so card chips / columns stay visible
      onClearSelection?.();
    }
  }, [open, done, step, current?.selectWaiter, onSelectWaiter, onClearSelection]);

  // Temporarily enable repair detail for chip / sheet steps
  useEffect(() => {
    if (!open || done || !current?.needsDetail) return;
    if (!repairDetailEnabled) onEnsureRepairDetail?.();
  }, [
    open,
    done,
    step,
    current?.needsDetail,
    repairDetailEnabled,
    onEnsureRepairDetail,
  ]);

  useLayoutEffect(() => {
    if (!open || done || !current) {
      setSpot(null);
      return;
    }

    let cancelled = false;
    const update = () => {
      if (cancelled) return;
      const el = queryTarget(current.target);
      setSpot(measure(current.target, el));
      const scrollEl =
        current.target === 'waiter'
          ? (document.querySelector('.card--selected') ??
            document.querySelector('[data-demo="waiter-card"]') ??
            el)
          : el;
      if (scrollEl && 'scrollIntoView' in scrollEl) {
        try {
          (scrollEl as HTMLElement).scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: 'smooth',
          });
        } catch {
          /* ignore */
        }
      }
      // Also scroll column headers into view for the track step
      if (current.target === 'columns') {
        const first = document.querySelector('[data-demo="column-header"]');
        if (first && 'scrollIntoView' in first) {
          try {
            (first as HTMLElement).scrollIntoView({
              block: 'nearest',
              inline: 'nearest',
              behavior: 'smooth',
            });
          } catch {
            /* ignore */
          }
        }
      }
    };

    update();
    const delays = current.needsDetail || current.selectWaiter
      ? [60, 160, 320, 520]
      : [60, 180, 360];
    const timers = delays.map((ms) => window.setTimeout(update, ms));
    const onResize = () => update();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, done, step, current?.target, repairDetailEnabled]);

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
