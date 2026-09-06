import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

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
  },
  {
    target: 'columns',
    title: 'Ride the track left → right',
    body: 'Columns run Dispatch → Final like a roller coaster. Clear the earliest step first — don’t skip cars ahead.',
  },
  {
    target: 'zones',
    title: 'Speed zone vs Sold',
    body: 'Unsold cars live in the speed zone (Dispatch / Inspection / answer). HUD zone chips and column tint match. Prioritize answers out before polishing sold / production work.',
  },
  {
    target: 'magnets',
    title: 'Magnet markers W / R / S / H',
    body: 'W / R / S / H magnets flag Waiter, Rental, Shuttle, Heart. Scan magnets before the concern — they change priority.',
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
    body: 'The coach names the earliest pressure. Read it, tap Select, then act — don’t invent another fire unless the board proves otherwise.',
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
    body: 'Flag hours and GP$ sold matter — but only after the unsold speed zone and waiter timers are under control.',
  },
  {
    target: 'movebar',
    title: 'How to act',
    body: 'With a card selected, use MoveBar at the bottom: advance columns, mark Answer delivered, or Clear blocker. That’s how decisions become flow.',
    selectWaiter: true,
  },
  {
    target: 'repair-chips',
    title: 'Inspection → approval → parts → repair',
    body: 'Card chips answer four shop questions at a glance: Is inspection done? What did the customer approve? Are parts available (and when)? Is the repair complete? (Repair detail turns on for this step; selection stays clear so the side panel doesn’t cover the chips.)',
    needsDetail: true,
  },
  {
    target: 'job-detail',
    title: 'Job detail panel — four questions',
    body: 'Detail + a selected card opens this panel (right on desktop, above MoveBar on phone): inspection, approval, parts, repair, and training actions.',
    selectWaiter: true,
    needsDetail: true,
  },
  {
    target: 'speed',
    title: 'Pace with 0.5× while learning',
    body: 'Easy pace buys thinking room. Use the 0.5× / 1× / 1.5× control in the top bar while learning indicators — turn speed back up once the HUD feels automatic.',
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
  onEnsureRepairDetail?: () => void;
  onSelectWaiter?: () => void;
  onClearSelection?: () => void;
  onFocusChange?: (target: DemoTarget | null) => void;
  onFinishPlay: () => void;
  onFinishHome: () => void;
  onSkip: () => void;
}

const COACH_GAP = 10;

function isUsable(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return false;
  return true;
}

function rectFromEl(el: Element, pad = 6): SpotlightRect | null {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return {
    top: Math.max(4, r.top - pad),
    left: Math.max(4, r.left - pad),
    width: Math.min(window.innerWidth - 8, r.width + pad * 2),
    height: Math.min(window.innerHeight - 8, r.height + pad * 2),
  };
}

function unionRects(els: Element[], pad = 6): SpotlightRect | null {
  if (els.length === 0) return null;
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let any = false;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    any = true;
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (!any) return null;
  return {
    top: Math.max(4, top - pad),
    left: Math.max(4, left - pad),
    width: Math.min(window.innerWidth - 8, right - left + pad * 2),
    height: Math.min(window.innerHeight - 8, bottom - top + pad * 2),
  };
}

function queryTarget(target: DemoTarget): Element | null {
  if (target === 'columns') {
    const headers = Array.from(
      document.querySelectorAll('[data-demo="column-header"]'),
    );
    // Prefer headers currently in (or near) the viewport
    const onScreen = headers.filter(isUsable);
    return (onScreen[0] ?? headers[0] ?? document.querySelector('[data-demo="columns"]'));
  }
  if (target === 'zones') {
    return (
      document.querySelector('[data-demo="zones"]') ??
      document.querySelector('[data-demo="column-zone"]')
    );
  }
  if (target === 'waiter') {
    // Prefer the selected card's countdown chip (may be briefly off-screen)
    const selectedTimer =
      document.querySelector('.card--selected [data-demo="waiter"]') ??
      document.querySelector('.card--selected .card__timer');
    if (selectedTimer) return selectedTimer;
    const selectedMarkers =
      document.querySelector('.card--selected [data-demo="waiter-markers"]') ??
      document.querySelector('.card--selected .card__markers');
    if (selectedMarkers) return selectedMarkers;
    return (
      document.querySelector('[data-demo="waiter"]') ??
      document.querySelector('[data-demo="waiter-markers"]') ??
      document.querySelector('[data-demo="waiter-card"]')
    );
  }
  if (target === 'repair-chips') {
    const chips = Array.from(
      document.querySelectorAll('[data-demo="repair-chips"]'),
    );
    const onScreen = chips.filter(isUsable);
    if (onScreen.length > 0) {
      const speed = onScreen.find((el) => el.closest('.column--speed'));
      return speed ?? onScreen[0];
    }
    return (
      document.querySelector('[data-demo="repair-detail-toggle"]') ??
      chips[0] ??
      null
    );
  }
  if (target === 'job-detail') {
    // Spotlight the four-question block — matches the copy and is visible
    // in both the desktop side panel and the phone in-flow sheet.
    const status = document.querySelector('[data-demo="repair-status"]');
    if (status) return status;
    return document.querySelector('[data-demo="job-detail"]');
  }
  return document.querySelector(`[data-demo="${target}"]`);
}

function measure(target: DemoTarget, el: Element | null): SpotlightRect | null {
  if (target === 'columns') {
    // Only union headers that are on-screen so the ring stays tight on iPhone
    const headers = Array.from(
      document.querySelectorAll('[data-demo="column-header"]'),
    );
    const onScreen = headers.filter(isUsable);
    const list = onScreen.length > 0 ? onScreen : headers.slice(0, 3);
    if (list.length > 0) return unionRects(list, 6);
  }
  if (target === 'zones') {
    const hud = document.querySelector('[data-demo="zones"]');
    if (hud) return rectFromEl(hud, 8);
  }
  if (target === 'waiter' && el) {
    // Prefer markers row (W magnet + countdown) so the ring is reliable on phones
    const selectedCard = document.querySelector('.card--selected');
    const markers =
      selectedCard?.querySelector('[data-demo="waiter-markers"]') ??
      selectedCard?.querySelector('.card__markers') ??
      (el as Element).closest?.('.card__markers') ??
      null;
    const timer =
      selectedCard?.querySelector('[data-demo="waiter"]') ??
      selectedCard?.querySelector('.card__timer') ??
      (el.matches?.('[data-demo="waiter"], .card__timer') ? el : null) ??
      el.querySelector?.('[data-demo="waiter"], .card__timer');
    if (markers && timer) return rectFromEl(markers, 10);
    if (timer) return rectFromEl(timer as Element, 12);
    if (markers) return rectFromEl(markers, 10);
    return rectFromEl(el, 10);
  }
  if (target === 'job-detail') {
    const status = document.querySelector('[data-demo="repair-status"]');
    const panel = document.querySelector('[data-demo="job-detail"]');
    const focus = status ?? panel ?? el;
    if (!focus) return null;
    const r = rectFromEl(focus, 8);
    if (!r) return null;
    // Keep ring within the visible panel, not under MoveBar / coach
    const maxH = window.innerHeight * 0.4;
    if (r.height > maxH) r.height = maxH;
    return r;
  }
  if (!el) return null;
  const pad =
    target === 'repair-chips' ||
    target === 'speed' ||
    target === 'clock' ||
    target === 'magnets' ||
    target === 'counts' ||
    target === 'next-important' ||
    target === 'goals'
      ? 8
      : 6;
  return rectFromEl(el, pad);
}

/** Place coach in the larger free band that does not cover the spotlight. */
const HUD_SECTION_TARGETS = new Set<DemoTarget>([
  'zones',
  'magnets',
  'counts',
  'goals',
  'next-important',
]);

/** Place coach in the larger free band that does not cover the spotlight. */
function placeCoach(
  spot: SpotlightRect | null,
  target?: DemoTarget | null,
): {
  top: boolean;
  maxHeight: number;
} {
  const vh = window.innerHeight;
  const landscape = window.matchMedia(
    '(orientation: landscape) and (max-height: 520px)',
  ).matches;
  const phone = window.matchMedia('(max-width: 900px)').matches;
  const minCoach = landscape ? 96 : phone ? 160 : 180;
  const idealCoach = landscape
    ? Math.min(vh * 0.32, 150)
    : Math.min(vh * 0.4, 300);

  // Landscape + HUD strip under topbar: always park coach at the bottom
  // so the focused strip stays visible (landscape CSS also un-hides it).
  if (landscape && target && HUD_SECTION_TARGETS.has(target)) {
    const spotBottom = spot ? spot.top + spot.height : 0;
    const spaceBelow = Math.max(96, vh - spotBottom - COACH_GAP);
    return {
      top: false,
      maxHeight: Math.min(idealCoach, spaceBelow),
    };
  }

  if (!spot) {
    return { top: false, maxHeight: idealCoach };
  }

  const spotTop = spot.top;
  const spotBottom = spot.top + spot.height;
  const spaceAbove = Math.max(0, spotTop - COACH_GAP);
  const spaceBelow = Math.max(0, vh - spotBottom - COACH_GAP);

  const aboveOk = spaceAbove >= minCoach;
  const belowOk = spaceBelow >= minCoach;

  if (aboveOk && belowOk) {
    if (spaceAbove >= spaceBelow) {
      return { top: true, maxHeight: Math.min(idealCoach, spaceAbove) };
    }
    return { top: false, maxHeight: Math.min(idealCoach, spaceBelow) };
  }
  if (aboveOk) {
    return { top: true, maxHeight: Math.min(idealCoach, spaceAbove) };
  }
  if (belowOk) {
    return { top: false, maxHeight: Math.min(idealCoach, spaceBelow) };
  }

  if (spaceAbove >= spaceBelow) {
    return {
      top: true,
      maxHeight: Math.max(88, Math.min(idealCoach, spaceAbove || vh * 0.28)),
    };
  }
  return {
    top: false,
    maxHeight: Math.max(88, Math.min(idealCoach, spaceBelow || vh * 0.28)),
  };
}

function scrollTargetIntoSafeZone(
  el: Element | null,
  coachTop: boolean,
  coachMaxH: number,
  opts?: { center?: boolean },
) {
  if (!el || !('scrollIntoView' in el)) return;
  try {
    (el as HTMLElement).scrollIntoView({
      block: opts?.center ? 'center' : 'nearest',
      inline: opts?.center ? 'center' : 'nearest',
      behavior: 'smooth',
    });
  } catch {
    /* ignore */
  }

  // After layout, nudge so the target sits in the free band opposite the coach
  const vh = window.innerHeight;
  const r = el.getBoundingClientRect();
  const safeTop = coachTop ? coachMaxH + COACH_GAP + 4 : 4;
  const safeBottom = coachTop ? vh - 4 : vh - coachMaxH - COACH_GAP - 4;
  if (r.top >= safeTop && r.bottom <= safeBottom) return;

  // Prefer aligning into the safe band via window / nearest scroll parent
  const delta =
    r.top < safeTop
      ? r.top - safeTop
      : r.bottom > safeBottom
        ? r.bottom - safeBottom
        : 0;
  if (Math.abs(delta) < 2) return;

  let node: Element | null = el.parentElement;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const canScroll =
      /(auto|scroll)/.test(style.overflowY) ||
      /(auto|scroll)/.test(style.overflow) ||
      node.scrollHeight > node.clientHeight + 4;
    if (canScroll) {
      (node as HTMLElement).scrollBy({ top: delta, behavior: 'smooth' });
      return;
    }
    node = node.parentElement;
  }
  window.scrollBy({ top: delta, behavior: 'smooth' });
}

export function DecisionDemo({
  open,
  repairDetailEnabled = false,
  onEnsureRepairDetail,
  onSelectWaiter,
  onClearSelection,
  onFocusChange,
  onFinishPlay,
  onFinishHome,
  onSkip,
}: Props) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [spot, setSpot] = useState<SpotlightRect | null>(null);
  const [placementTick, setPlacementTick] = useState(0);
  const coachRef = useRef<HTMLDivElement | null>(null);

  const current = STEPS[step];
  const last = step >= STEPS.length - 1;

  const placement = useMemo(() => {
    void placementTick;
    return placeCoach(spot, current?.target);
  }, [spot, placementTick]);

  const coachTop = placement.top;
  const coachMaxHeight = placement.maxHeight;

  useEffect(() => {
    if (!open) {
      setStep(0);
      setDone(false);
      setSpot(null);
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open || done || !current) {
      onFocusChange?.(null);
      return;
    }
    onFocusChange?.(current.target);
  }, [open, done, step, current?.target, onFocusChange]);

  useEffect(() => {
    if (!open || done || !current) return;
    if (current.selectWaiter) {
      onSelectWaiter?.();
    } else {
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
      const next = measure(current.target, el);
      setSpot(next);
      setPlacementTick((n) => n + 1);

      const place = placeCoach(next, current.target);
      const scrollEl =
        current.target === 'waiter'
          ? (document.querySelector('.card--selected') ??
            document.querySelector('[data-demo="waiter-card"]') ??
            el)
          : current.target === 'job-detail'
            ? (document.querySelector('[data-demo="repair-status"]') ??
              document.querySelector('[data-demo="job-detail"]') ??
              el)
            : current.target === 'repair-chips'
              ? (el?.closest('.card') ?? el)
              : current.target === 'columns'
                ? (document.querySelector('[data-demo="column-header"]') ?? el)
                : el;

      scrollTargetIntoSafeZone(scrollEl, place.top, place.maxHeight, {
        center:
          current.target === 'waiter' ||
          current.target === 'columns' ||
          current.target === 'repair-chips',
      });
    };

    update();
    const hudSection =
      current.target === 'zones' ||
      current.target === 'magnets' ||
      current.target === 'counts' ||
      current.target === 'goals' ||
      current.target === 'next-important';
    const layoutSensitive =
      hudSection ||
      current.target === 'job-detail' ||
      current.target === 'waiter' ||
      current.target === 'columns' ||
      current.target === 'toast';
    const delays = layoutSensitive
      ? [100, 220, 400, 650, 900, 1200]
      : current.needsDetail || current.selectWaiter
        ? [50, 140, 280, 480, 750, 1100]
        : [50, 160, 320, 560];
    const timers = delays.map((ms) => window.setTimeout(update, ms));
    const onResize = () => update();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    const mq = window.matchMedia('(orientation: landscape)');
    const onOrient = () => update();
    mq.addEventListener?.('change', onOrient);
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      mq.removeEventListener?.('change', onOrient);
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

      <div
        ref={coachRef}
        className={`demo-coach ${coachTop ? 'demo-coach--top' : ''} ${
          coachMaxHeight < 200 ? 'demo-coach--compact' : ''
        }`}
        style={{ maxHeight: coachMaxHeight }}
      >
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
