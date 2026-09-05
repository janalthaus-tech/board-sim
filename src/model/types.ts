/** Domain types for The Board — reusable for live shop ops later. */

export const BOARD_COLUMNS = [
  'dispatch',
  'inspection',
  'approval',
  'parts',
  'wip',
  'qc',
  'final',
] as const;

export type BoardColumnId = (typeof BOARD_COLUMNS)[number];

export const COLUMN_LABELS: Record<BoardColumnId, string> = {
  dispatch: 'Dispatch',
  inspection: 'Inspection',
  approval: 'Approval',
  parts: 'Parts',
  wip: 'WIP',
  qc: 'QC',
  final: 'Final',
};

/** Unsold / speed zone — answer not yet delivered / work not sold. */
export const SPEED_ZONE_COLUMNS: BoardColumnId[] = ['dispatch', 'inspection'];

/** Selling / waiting on customer — still speed-sensitive. */
export const SELLING_COLUMNS: BoardColumnId[] = ['approval'];

/** Sold / production — money already made; lower priority than earliest unsold. */
export const SOLD_COLUMNS: BoardColumnId[] = ['parts', 'wip', 'qc', 'final'];

export function columnZoneLabel(column: BoardColumnId): string {
  if (SPEED_ZONE_COLUMNS.includes(column)) return 'Speed zone (unsold)';
  if (column === 'approval') return 'Selling';
  return 'Sold / production';
}

export function isSpeedZone(column: BoardColumnId): boolean {
  return SPEED_ZONE_COLUMNS.includes(column);
}

export function isSoldZone(column: BoardColumnId): boolean {
  return SOLD_COLUMNS.includes(column);
}

export type JobFlag = 'waiting' | 'blocked' | 'urgent';

/** Magnet-style markers: W=waiter, R=rental, S=shuttle, H=heart car */
export type JobMarker = 'W' | 'R' | 'S' | 'H';

export const MARKER_LABELS: Record<JobMarker, string> = {
  W: 'Waiter',
  R: 'Rental',
  S: 'Shuttle',
  H: 'Heart car',
};

export interface VehicleJob {
  id: string;
  customerName: string;
  year: number;
  make: string;
  model: string;
  column: BoardColumnId;
  bay?: string;
  tech?: string;
  flags: JobFlag[];
  concern: string;
  createdAtSimMin: number;
  completedAtSimMin?: number;
  blockerHistory: string[];
  /** Magnet markers: W=waiter, R=rental, S=shuttle, H=heart */
  markers?: JobMarker[];
  /** Sim minutes remaining on waiter urgency clock (shown on card) */
  waiterTimerMin?: number;
  /** Hours sold on this job (factory-of-hours / Parts+WIP totals) */
  soldHours?: number;
  /** Gross profit dollars when work is sold (optional; else soldHours × gpPerHourHint) */
  gpSold?: number;
  /** Times bounced from QC back to advisor */
  qcFailCount?: number;
  /** True = keys still on magnet / not pulled into bay yet */
  keysOnBoard?: boolean;
  /** When car dropped; used for 1-hour answer rule */
  droppedAtSimMin?: number;
  /** Set when answer first delivered (move to approval or explicit action) */
  answerDeliveredAtSimMin?: number;
  /** Production-meeting commitment star */
  promisedToday?: boolean;
  /** Breached 1-hour answer rule */
  lateAnswer?: boolean;
}

export type ScenarioEventType =
  | 'new_arrival'
  | 'parts_late'
  | 'customer_no_answer'
  | 'qc_fail'
  | 'qc_rework'
  | 'urgent_walkin'
  | 'tech_unavailable'
  | 'production_meeting';

export interface ScenarioEvent {
  id: string;
  /** Minutes from scenario start when this fires */
  atSimMin: number;
  type: ScenarioEventType;
  message: string;
  /** Job id to affect, or omit for new arrivals */
  jobId?: string;
  /** Multiple jobs (e.g. production meeting commitments) */
  jobIds?: string[];
  /** Payload for new arrivals */
  job?: Omit<
    VehicleJob,
    'id' | 'createdAtSimMin' | 'completedAtSimMin' | 'blockerHistory' | 'flags'
  > & {
    flags?: JobFlag[];
  };
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  /** Total simulation length in minutes */
  durationMin: number;
  /** Real-time seconds per sim minute */
  realSecondsPerSimMin: number;
  /** Optional training difficulty badge */
  difficulty?: 'intro' | 'intermediate' | 'advanced';
  /** One-line skill focus for the scenario picker */
  focus?: string;
  /** Daily flag-hour + GP$ sold pipeline targets (flat-rate training) */
  goals?: {
    /** Flag-hour target per tech for the sim day (default 8) */
    techHoursPerDay: number;
    gpSoldTarget: number; // dollars for the scenario “day”
    gpPerHourHint?: number; // e.g. 150 for estimating sold GP from hours
    /** Training default $/flag hour (e.g. 45–55) — sim rate, not a shop claim */
    flatRatePerFlagHr?: number;
    /** Clock-equivalent hours for efficiency denom (default 8) */
    availableClockHrs?: number;
    /** Optional teaching HUD target for gross sales per hour */
    gsphHint?: number;
  };
  seedJobs: Omit<
    VehicleJob,
    'id' | 'createdAtSimMin' | 'completedAtSimMin' | 'blockerHistory'
  >[];
  events: ScenarioEvent[];
}

export interface BoardState {
  jobs: VehicleJob[];
  columnOrder: BoardColumnId[];
}

export interface SimClockState {
  /** Elapsed simulation minutes */
  simMin: number;
  running: boolean;
  finished: boolean;
}

export interface FiredEventLog {
  eventId: string;
  atSimMin: number;
  message: string;
  type: ScenarioEventType;
}

export interface DebriefStats {
  completed: number;
  inProcess: number;
  blockersHit: number;
  urgentHandled: number;
  score: number;
  maxScore: number;
  grade: string;
  notes: string[];
  waitersLeft?: number;
  hoursStuckPartsWip?: number;
  qcRestarts?: number;
  /** Answers delivered within 1 sim hour of drop */
  answersOnTime?: number;
  /** Answers late or never delivered while subject to 1-hour rule */
  answersLate?: number;
  /** GP$ sold pipeline vs scenario target */
  gpSold?: number;
  gpTarget?: number;
  /** Per-tech flag hours vs daily goal (+ optional flat-rate pay / efficiency) */
  techHours?: {
    tech: string;
    hours: number;
    goal: number;
    payEstimate?: number;
    efficiencyPct?: number;
  }[];
}

export type AppScreen = 'home' | 'board' | 'debrief';

export interface NextImportantHint {
  jobId: string | null;
  reason: string;
}
