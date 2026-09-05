import type { Scenario, ScenarioEvent } from './types';

export type PaceId = 'easy' | 'standard' | 'challenge';

export const PACE_STORAGE_KEY = 'board-sim-pace';

export const PACE_OPTIONS: {
  id: PaceId;
  label: string;
  blurb: string;
}[] = [
  {
    id: 'easy',
    label: 'Easy',
    blurb: 'More real time per sim minute; chaos arrives later',
  },
  {
    id: 'standard',
    label: 'Standard',
    blurb: 'As authored — default training pace',
  },
  {
    id: 'challenge',
    label: 'Challenge',
    blurb: 'Faster clock and tighter answer window',
  },
];

const VALID: ReadonlySet<string> = new Set(['easy', 'standard', 'challenge']);

export function isPaceId(value: string): value is PaceId {
  return VALID.has(value);
}

/** Default pace for new users — kinder than authored scenarios. */
export function loadPace(): PaceId {
  try {
    const raw = localStorage.getItem(PACE_STORAGE_KEY);
    if (raw && isPaceId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return 'easy';
}

export function savePace(pace: PaceId): void {
  try {
    localStorage.setItem(PACE_STORAGE_KEY, pace);
  } catch {
    /* ignore */
  }
}

export function paceLabel(pace: PaceId): string {
  return PACE_OPTIONS.find((o) => o.id === pace)?.label ?? pace;
}

/**
 * Clone and adjust a scenario for the chosen Home pace.
 * Does not mutate the authored scenario.
 */
export function applyPace(scenario: Scenario, pace: PaceId): Scenario {
  if (pace === 'standard') {
    return {
      ...scenario,
      events: scenario.events.map((e) => ({ ...e })),
      seedJobs: scenario.seedJobs.map((j) => ({ ...j })),
      answerWindowScale: 1,
    };
  }

  if (pace === 'easy') {
    const events: ScenarioEvent[] = scenario.events.map((e) => ({
      ...e,
      // Stretch event timing so pressure arrives later
      atSimMin: Math.round(e.atSimMin * 1.2),
    }));
    return {
      ...scenario,
      realSecondsPerSimMin: scenario.realSecondsPerSimMin * 1.75,
      durationMin: Math.round(scenario.durationMin * 1.1),
      answerWindowScale: 1.5,
      events,
      seedJobs: scenario.seedJobs.map((j) => ({ ...j })),
    };
  }

  // challenge
  return {
    ...scenario,
    realSecondsPerSimMin: scenario.realSecondsPerSimMin * 0.7,
    answerWindowScale: 0.85,
    events: scenario.events.map((e) => ({ ...e })),
    seedJobs: scenario.seedJobs.map((j) => ({ ...j })),
  };
}

export type SpeedMul = 0.5 | 1 | 1.5;

export const SPEED_MUL_OPTIONS: SpeedMul[] = [0.5, 1, 1.5];
