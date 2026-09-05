import type { BoardColumnId } from './types';

/** Repair & approval detail UI — opt-in; default classic board. */
export const REPAIR_DETAIL_STORAGE_KEY = 'board-sim-repair-detail';

export type RoleId = 'full' | 'manager' | 'advisor' | 'technician';

export const ROLE_STORAGE_KEY = 'board-sim-role';

export const ROLE_OPTIONS: {
  id: RoleId;
  label: string;
  shortLabel: string;
  blurb: string;
  /** Columns that stay bright; empty = none dimmed */
  primaryColumns: BoardColumnId[];
  coachCue: string;
}[] = [
  {
    id: 'full',
    label: 'Full board',
    shortLabel: 'Full',
    blurb: 'All controls — current simulation',
    primaryColumns: [],
    coachCue: 'Empty your section — find the bottleneck',
  },
  {
    id: 'manager',
    label: 'Manager',
    shortLabel: 'Manager',
    blurb: 'Next most important, bottlenecks, GP$ / flag hrs, promised ★ & heart cars',
    primaryColumns: [],
    coachCue:
      'Manager focus: Next most important, bottlenecks, GP$ / flag hrs, promised ★ & ♥ cars',
  },
  {
    id: 'advisor',
    label: 'Service advisor',
    shortLabel: 'Advisor',
    blurb: 'Approval, Answer delivered, Dispatch — sell & communicate',
    primaryColumns: ['dispatch', 'inspection', 'approval'],
    coachCue:
      'Advisor focus: Dispatch → Approval, Answer delivered, approve lines, clear customer waits',
  },
  {
    id: 'technician',
    label: 'Technician',
    shortLabel: 'Tech',
    blurb: 'Inspection / Parts / WIP / QC — keys on board, finish lines',
    primaryColumns: ['inspection', 'parts', 'wip', 'qc'],
    coachCue:
      'Tech focus: Inspection → Parts → WIP → QC; keys on board; mark inspection / lines done',
  },
];

const VALID_ROLES: ReadonlySet<string> = new Set([
  'full',
  'manager',
  'advisor',
  'technician',
]);

export function isRoleId(value: string): value is RoleId {
  return VALID_ROLES.has(value);
}

export function loadRepairDetailEnabled(): boolean {
  try {
    const raw = localStorage.getItem(REPAIR_DETAIL_STORAGE_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    /* ignore */
  }
  return false;
}

export function saveRepairDetailEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(REPAIR_DETAIL_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function loadRole(): RoleId {
  try {
    const raw = localStorage.getItem(ROLE_STORAGE_KEY);
    if (raw && isRoleId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return 'full';
}

export function saveRole(role: RoleId): void {
  try {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
  } catch {
    /* ignore */
  }
}

export function roleLabel(role: RoleId): string {
  return ROLE_OPTIONS.find((o) => o.id === role)?.label ?? role;
}

export function roleShortLabel(role: RoleId): string {
  return ROLE_OPTIONS.find((o) => o.id === role)?.shortLabel ?? role;
}

export function roleCoachCue(role: RoleId): string {
  return (
    ROLE_OPTIONS.find((o) => o.id === role)?.coachCue ??
    'Empty your section — find the bottleneck'
  );
}

/** True when card should be visually dimmed for this role (still interactive). */
export function isRoleDimmed(role: RoleId, column: BoardColumnId): boolean {
  const cols = ROLE_OPTIONS.find((o) => o.id === role)?.primaryColumns ?? [];
  if (cols.length === 0) return false;
  return !cols.includes(column);
}

/** Advisor-primary actions (approve / answer). */
export function roleShowsAdvisorActions(role: RoleId): boolean {
  return role === 'full' || role === 'manager' || role === 'advisor';
}

/** Tech-primary line actions (mark done / start repair). */
export function roleShowsTechActions(role: RoleId): boolean {
  return role === 'full' || role === 'manager' || role === 'technician';
}

/** When true, advisor actions stay visible but secondary for tech role. */
export function roleDeemphasizeAdvisorActions(role: RoleId): boolean {
  return role === 'technician';
}

/** When true, tech line actions stay visible but secondary for advisor role. */
export function roleDeemphasizeTechActions(role: RoleId): boolean {
  return role === 'advisor';
}

/** Hide tech-only line actions entirely for advisor when detail on. */
export function roleHideTechLineActions(role: RoleId): boolean {
  return role === 'advisor';
}

/** Hide advisor-only line actions entirely for technician when detail on. */
export function roleHideAdvisorLineActions(role: RoleId): boolean {
  return role === 'technician';
}
