import { useEffect, useLayoutEffect, useState } from 'react';

export type DemoTarget =
  | 'clock'
  | 'columns'
  | 'zones'
  | 'magnets'
  | 'waiter'
  | 'next-important'
  | 'counts'
  | 'toast'
  | 'goals'
  | 'movebar'
  | 'repair-chips'
  | 'job-detail'
  | 'speed';

interface DemoStep {
  target: DemoTarget;
  title: string;
  body: string;
  /** Prefer selecting a waiter card so MoveBar / timer / detail are visible */
  selectWaiter?: boolean;
  /** Needs repair detail UI visible — demo will temporarily enable if off */
  needsDetail?: boolean;
  /** Force coach to top (true) or bottom (false); otherwise opposite spotlight */
  coachTop?: boolean;
}

/**
 * Decision walkthrough for the current Board layout:
 * desktop split board | JobDetail; mobile HUD → board → detail → sticky MoveBar.
 * Selection is cleared unless selectWaiter so the side panel stays closed
 * when spotlighting chips / columns / HUD.
 */
const STEPS: DemoStep[] = [
  {
    target: 'clock',
    title: 'Paused Morning Rush',
    body: 'You’re in learning mode on Morning Rush. The sim clock is paused so you can study the board — use Resume later when you’re ready to play in real time.',
    coachTop: false,
  },
  {
    target: 'columns',
    title: 'Ride the track left → right',
    body: 'Board columns are roller-coaster order: Dispatch through Final. Don’t skip cars ahead of earlier ones — clear the earliest step first.',
    coachTop: false,
  },
  {
    target: 'zones',
    title: 'Speed zone vs Sold',
    body: 'Unsold cars live in the speed zone (Dispatch / Inspection / answer). HUD zone chips and column tint match. Prioritize answers out before polishing sold / production work.',
    coachTop: false,
  },
  {
    target: 'magnets',
    title: 'Magnet markers W / R / S / H',
    body: 'Letter magnets flag special cars: Waiter, Rental, Shuttle, Heart. Scan magnets before you dig into concerns — they change priority.',
    coachTop: false,
  },
  {
    target: 'waiter',
    title: 'Waiter timer = 1-hour answer',
    body: 'W cars show a countdown chip. Earliest timer first — deliver an answer within about an hour of drop-off before chasing sold WIP.',
    selectWaiter: true,
  },
  {
    target: 'next-important',
    title: 'Trust “Next most important”',
    body: 'The coach picks the earliest pressure on the board. Read the reason, tap Select, then act — don’t invent a different fire unless the board proves otherwise.',
    coachTop: false,
  },
  {
    target: 'counts',
    title: 'Column pills & bottlenecks',
    body: 'Count pills show where cars pile up. A hot (bottleneck) pill means empty that section before feeding more work into it.',
    coachTop: false,
  },
  {
    target: 'toast',
    title: 'Toast events — react',
    body: 'Toasts are live shop events (walk-ins, parts late, QC fails). Read them, update the board, don’t dismiss and forget.',
    coachTop: true,
  },
  {
    target: 'goals',
    title: 'Flag hrs & GP$ sold',
    body: 'Shop goals track flat-rate flag hours and GP$ sold. Important — but secondary to clearing the unsold speed zone and waiter timers.',
    coachTop: false,
  },
  {
    target: 'movebar',
    title: 'How to act',
    body: 'With a card selected, use MoveBar at the bottom: advance columns, mark Answer delivered, or Clear blocker. That’s how decisions become flow.',
    selectWaiter: true,
    coachTop: true,
  },
  {
    target: 'repair-chips',
    title: 'Inspection → approval → parts → repair',
    body: 'Card chips answer four shop questions at a glance: Is inspection done? What did the customer approve? Are parts available (and when)? Is the repair complete? (Repair detail turns on for this step; selection stays clear so the side panel doesn’t cover the chips.)',
    needsDetail: true,
    coachTop: false,
  },
  {
    target: 'job-detail',
    title: 'Job detail panel — four questions',
    body: 'Select a card with Detail on to open the side panel (desktop) or in-flow sheet (mobile). It expands proposed lines, approvals, parts ETAs, and completion — plus training actions to mark inspection, approve, order parts, or finish a line.',
    selectWaiter: true,
    needsDetail: true,
    coachTop: true,
  },
  {
    target: 'speed',
    title: 'Pace with 0.5× while learning',
    body: 'Easy pace buys thinking room. Use the 0.5× / 1× / 1.5× control in the top bar while learning indicators — turn speed back up once the HUD feels automatic.',
    coachTop: false,
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
  if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return false;
  return true;
}

function pickBest(nodes: Element[]): Element | null {
  const usable = nodes.filter(isUsable);
  if (usable.length === 0) return nodes[0] ?? null;
  const selected = usable.find((el) => el.closest('.card--selected'));
  if (selected) return selected;
  return usable.reduce((best, el) => {
    const a = el.getBoundingClientRect();
    const b = best.getBoundingClientRect();
    const areaA =
      Math.min(a.width, window.innerWidth) * Math.min(a.height, window.innerHeight);
    const areaB =
      Math.min(b.width, window.innerWidth) * Math.min(b.height, window.innerHeight);
    return areaA < areaB ? el : best;
  });
}

function queryTarget(target: DemoTarget): Element | null {
  if (target === 'columns') {
    const headers = Array.from(
      document.querySelectorAll('[data-demo="column-header"]'),
    );
    if (headers.length > 0) return headers[0];
    return document.querySelector('[data-demo="columns"]');
  }
  if (target === 'zones') {
    return (
      document.querySelector('[data-demo="zones"]') ??
      document.querySelector('[data-demo="column-zone"]')
    );
  }
  if (target === 'waiter') {
    const selected =
      document.querySelector('.card--selected [data-demo="waiter"]') ??
      document.querySelector('.card--selected[data-demo="waiter"]');
    if (selected) return selected;
    return pickBest(Array.from(document.querySelectorAll('[data-demo="waiter"]')));
  }
  if (target === 'repair-chips') {
    // Prefer on-screen chips with selection cleared (no JobDetail covering them)
    const chips = Array.from(
      document.querySelectorAll('[data-demo="repair-chips"]'),
    );
    const onScreen = chips.filter(isUsable);
    if (onScreen.length > 0) {
      const speed = onScreen.find((el) => el.closest('.column--speed'));
      return speed ?? onScreen[0];
    }
    // Fallback: Detail toggle while chips mount after enabling detail
    return (
      document.querySelector('[data-demo="repair-detail-toggle"]') ??
      chips[0] ??
      null
    );
  }
  if (target === 'job-detail') {
    const panel = document.querySelector('[data-demo="job-detail"]');
    if (panel && isUsable(panel)) return panel;
    const status = document.querySelector('[data-demo="repair-status"]');
    if (status) return status;
    return panel;
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
    const headers = Array.from(
      document.querySelectorAll('[data-demo="column-header"]'),
    );
    if (headers.length > 0) return unionRects(headers);
  }
  if (target === 'zones') {
    const hud = document.querySelector('[data-demo="zones"]');
    const zoneLabels = Array.from(
      document.querySelectorAll('[data-demo="column-zone"]'),
    );
    const parts = [hud, ...zoneLabels].filter((n): n is Element => Boolean(n));
    if (parts.length > 0) {
      const united = unionRects(parts);
      // Cap tall unions (HUD + all columns) so coach still frames the idea
      if (united && united.height > window.innerHeight * 0.42) {
        // Prefer HUD strip alone when the board union is huge
        if (hud && isUsable(hud)) {
          const r = hud.getBoundingClientRect();
          const pad = 8;
          return {
            top: Math.max(4, r.top - pad),
            left: Math.max(4, r.left - pad),
            width: Math.min(window.innerWidth - 8, r.width + pad * 2),
            height: Math.min(window.innerHeight - 8, r.height + pad * 2),
          };
        }
      }
      return united;
    }
  }
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  const pad =
    target === 'waiter' ||
    target === 'repair-chips' ||
    target === 'speed' ||
    target === 'clock'
      ? 8
      : 6;
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
    if (typeof current.coachTop === 'boolean') return current.coachTop;
    if (
      current.target === 'movebar' ||
      current.target === 'job-detail' ||
      current.target === 'toast'
    ) {
      return true;
    }
    if (
      current.target === 'speed' ||
      current.target === 'clock' ||
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
      // Keep JobDetail closed so card chips / columns / HUD stay visible
      onClearSelection?.();
    }
  }, [open, done, step, current?.selectWaiter, onSelectWaiter, onClearSelection]);

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
          : current.target === 'job-detail'
            ? (document.querySelector('[data-demo="job-detail"]') ?? el)
            : current.target === 'repair-chips'
              ? (el?.closest('.card') ?? el)
              : el;
      if (scrollEl && 'scrollIntoView' in scrollEl) {
        try {
          (scrollEl as HTMLElement).scrollIntoView({
            block: current.target === 'job-detail' ? 'nearest' : 'center',
            inline: 'nearest',
            behavior: 'smooth',
          });
        } catch {
          /* ignore */
        }
      }
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
      if (current.target === 'clock' || current.target === 'speed') {
        const top = document.querySelector(
          current.target === 'clock'
            ? '[data-demo="clock"]'
            : '[data-demo="speed"]',
        );
        if (top && 'scrollIntoView' in top) {
          try {
            (top as HTMLElement).scrollIntoView({
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
    const delays =
      current.needsDetail || current.selectWaiter
        ? [60, 160, 320, 520, 800]
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
