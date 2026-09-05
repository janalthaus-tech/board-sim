import {
  addFlag,
  addJob,
  createEmptyBoard,
  dropTime,
  nextId,
  resetIdCounter,
  updateJob,
  vehicleLabel,
} from './board';
import type {
  BoardColumnId,
  BoardState,
  DebriefStats,
  FiredEventLog,
  NextImportantHint,
  Scenario,
  ScenarioEvent,
  VehicleJob,
} from './types';
import {
  BOARD_COLUMNS,
  COLUMN_LABELS,
  isSpeedZone,
} from './types';

export const ANSWER_WINDOW_MIN = 60;

export interface EngineSnapshot {
  board: BoardState;
  simMin: number;
  fired: FiredEventLog[];
  toast: string | null;
}

function seedJobsFromScenario(scenario: Scenario): VehicleJob[] {
  return scenario.seedJobs.map((seed, index) => {
    const pastSpeed =
      seed.column === 'approval' ||
      seed.column === 'parts' ||
      seed.column === 'wip' ||
      seed.column === 'qc' ||
      seed.column === 'final';
    return {
      ...seed,
      id: `seed-${index}`,
      createdAtSimMin: 0,
      droppedAtSimMin: seed.droppedAtSimMin ?? 0,
      blockerHistory: seed.flags.includes('blocked')
        ? ['Started with blocker']
        : [],
      qcFailCount: seed.qcFailCount ?? 0,
      // Jobs already past speed zone count as answer delivered for GP$ pipeline
      answerDeliveredAtSimMin:
        seed.answerDeliveredAtSimMin ?? (pastSpeed ? 0 : undefined),
    };
  });
}

export function startScenario(scenario: Scenario): EngineSnapshot {
  resetIdCounter();
  const board = createEmptyBoard();
  board.jobs = seedJobsFromScenario(scenario);
  return {
    board,
    simMin: 0,
    fired: [],
    toast: scenario.title + ' started — keep The Board moving.',
  };
}

function needsAnswer(job: VehicleJob): boolean {
  if (job.answerDeliveredAtSimMin != null) return false;
  if (job.column === 'final') return false;
  return isSpeedZone(job.column) || Boolean(job.markers?.includes('W'));
}

function applyEvent(
  board: BoardState,
  event: ScenarioEvent,
  simMin: number,
): { board: BoardState; toast: string } {
  let next = board;
  let toast = event.message;

  switch (event.type) {
    case 'new_arrival':
    case 'urgent_walkin': {
      if (event.job) {
        const job: VehicleJob = {
          ...event.job,
          id: nextId('evt'),
          flags:
            event.job.flags ??
            (event.type === 'urgent_walkin' ? ['urgent'] : []),
          createdAtSimMin: simMin,
          droppedAtSimMin: event.job.droppedAtSimMin ?? simMin,
          blockerHistory: [],
          qcFailCount: event.job.qcFailCount ?? 0,
        };
        next = addJob(next, job);
      }
      break;
    }
    case 'parts_late': {
      if (event.jobId) {
        next = addFlag(next, event.jobId, 'blocked', event.message);
        next = addFlag(next, event.jobId, 'waiting');
      }
      break;
    }
    case 'customer_no_answer': {
      if (event.jobId) {
        next = addFlag(next, event.jobId, 'waiting', event.message);
        next = addFlag(next, event.jobId, 'blocked', event.message);
      }
      break;
    }
    case 'qc_fail': {
      // Inspired path: QC bounce goes to Approval so the advisor knows,
      // then can be sent back to WIP for rework (qc_rework or manual move).
      if (event.jobId) {
        const job = next.jobs.find((j) => j.id === event.jobId);
        if (job) {
          const flags = [
            ...new Set([...job.flags, 'blocked' as const, 'waiting' as const]),
          ];
          const note =
            'QC fail — returned to advisor for lead/tech rework';
          const history = [...job.blockerHistory, note, event.message];
          if (job.markers?.includes('H')) {
            history.push('Heart car — manager/lead rework');
          }
          next = updateJob(next, event.jobId, {
            column: 'approval',
            completedAtSimMin: undefined,
            flags,
            qcFailCount: (job.qcFailCount ?? 0) + 1,
            blockerHistory: history,
            answerDeliveredAtSimMin:
              job.answerDeliveredAtSimMin ?? simMin,
          });
        }
      }
      break;
    }
    case 'qc_rework': {
      // Advisor releases QC fail back to WIP with original tech if set.
      if (event.jobId) {
        const job = next.jobs.find((j) => j.id === event.jobId);
        if (job) {
          const flags = job.flags.filter((f) => f !== 'waiting' && f !== 'blocked');
          next = updateJob(next, event.jobId, {
            column: 'wip',
            completedAtSimMin: undefined,
            flags,
            blockerHistory: [
              ...job.blockerHistory,
              event.message || 'QC rework released to WIP',
            ],
          });
        }
      }
      break;
    }
    case 'tech_unavailable': {
      if (event.jobId) {
        next = updateJob(next, event.jobId, { tech: undefined });
        next = addFlag(next, event.jobId, 'blocked', event.message);
      }
      break;
    }
    case 'production_meeting': {
      const ids = event.jobIds ?? (event.jobId ? [event.jobId] : []);
      for (const id of ids) {
        next = updateJob(next, id, { promisedToday: true });
      }
      // Soft WTF nudge: blocked long with no tech
      const orphans = next.jobs.filter(
        (j) =>
          j.column !== 'final' &&
          !j.tech &&
          j.flags.includes('blocked') &&
          simMin - dropTime(j) >= 45,
      );
      if (orphans.length > 0) {
        const names = orphans
          .slice(0, 2)
          .map((j) => j.customerName)
          .join(', ');
        toast =
          event.message +
          ' · WTF check: ' +
          names +
          (orphans.length > 2 ? '…' : '') +
          ' blocked with no tech.';
      }
      break;
    }
    default:
      break;
  }

  return { board: next, toast };
}

/** Tick waiter timers down by elapsed sim minutes (floor). */
function tickWaiterTimers(
  board: BoardState,
  prevSimMin: number,
  newSimMin: number,
): BoardState {
  const delta = Math.floor(newSimMin) - Math.floor(prevSimMin);
  if (delta <= 0) return board;
  let changed = false;
  const jobs = board.jobs.map((j) => {
    if (
      j.column === 'final' ||
      !j.markers?.includes('W') ||
      j.waiterTimerMin == null
    ) {
      return j;
    }
    changed = true;
    return {
      ...j,
      waiterTimerMin: Math.max(0, j.waiterTimerMin - delta),
    };
  });
  return changed ? { ...board, jobs } : board;
}

/**
 * Flag late answers once the 1-hour window since drop is breached
 * for unanswered waiters / speed-zone cars. Returns toast if a new breach fires.
 */
function tickAnswerClock(
  board: BoardState,
  newSimMin: number,
): { board: BoardState; toast: string | null } {
  let toast: string | null = null;
  let changed = false;
  const jobs = board.jobs.map((j) => {
    if (!needsAnswer(j) || j.lateAnswer) return j;
    const elapsed = Math.floor(newSimMin) - Math.floor(dropTime(j));
    if (elapsed < ANSWER_WINDOW_MIN) return j;
    changed = true;
    if (!toast) {
      toast =
        '1-hour answer missed: ' +
        j.customerName +
        ' (' +
        vehicleLabel(j) +
        ') — closing ratio dies with delay.';
    }
    return { ...j, lateAnswer: true };
  });
  return {
    board: changed ? { ...board, jobs } : board,
    toast,
  };
}

/** Advance clock; apply events due between prevSimMin (exclusive) and simMin (inclusive). */
export function tickEngine(
  scenario: Scenario,
  snapshot: EngineSnapshot,
  newSimMin: number,
): EngineSnapshot {
  const due = scenario.events.filter(
    (e) => e.atSimMin > snapshot.simMin && e.atSimMin <= newSimMin,
  );
  let board = tickWaiterTimers(snapshot.board, snapshot.simMin, newSimMin);
  const fired = [...snapshot.fired];
  let toast = snapshot.toast;

  for (const event of due) {
    if (fired.some((f) => f.eventId === event.id)) continue;
    const result = applyEvent(board, event, event.atSimMin);
    board = result.board;
    toast = result.toast;
    fired.push({
      eventId: event.id,
      atSimMin: event.atSimMin,
      message: event.message,
      type: event.type,
    });
  }

  const answerTick = tickAnswerClock(board, newSimMin);
  board = answerTick.board;
  if (answerTick.toast) toast = answerTick.toast;

  return { board, simMin: newSimMin, fired, toast };
}

export function columnJobCounts(
  board: BoardState,
): Record<BoardColumnId, number> {
  const counts = Object.fromEntries(
    BOARD_COLUMNS.map((c) => [c, 0]),
  ) as Record<BoardColumnId, number>;
  for (const j of board.jobs) {
    counts[j.column] += 1;
  }
  return counts;
}

export function bottleneckColumn(
  board: BoardState,
): BoardColumnId | null {
  const counts = columnJobCounts(board);
  let max = 0;
  let col: BoardColumnId | null = null;
  for (const c of BOARD_COLUMNS) {
    if (counts[c] > max) {
      max = counts[c];
      col = c;
    }
  }
  return max > 0 ? col : null;
}

export interface HoursByTech {
  tech: string;
  hours: number;
}

/** Sold hours sitting in Parts + WIP, optionally broken down by tech. */
export function partsWipHours(board: BoardState): {
  total: number;
  byTech: HoursByTech[];
} {
  const relevant = board.jobs.filter(
    (j) => j.column === 'parts' || j.column === 'wip',
  );
  const total = relevant.reduce((n, j) => n + (j.soldHours ?? 0), 0);
  const map = new Map<string, number>();
  for (const j of relevant) {
    if (!j.tech || !(j.soldHours && j.soldHours > 0)) continue;
    map.set(j.tech, (map.get(j.tech) ?? 0) + j.soldHours);
  }
  const byTech = [...map.entries()]
    .map(([tech, hours]) => ({ tech, hours }))
    .sort((a, b) => b.hours - a.hours);
  return { total, byTech };
}


const DEFAULT_GP_PER_HOUR = 150;
const DEFAULT_TECH_HOURS = 8;

/** Gross profit dollars attributed to a job when it counts as sold. */
export function jobGpDollars(job: VehicleJob, scenario: Scenario): number {
  const hint = scenario.goals?.gpPerHourHint ?? DEFAULT_GP_PER_HOUR;
  if (job.gpSold != null) return job.gpSold;
  return (job.soldHours ?? 0) * hint;
}

/** Job contributes to GP$ sold pipeline once answer delivered or in sold columns. */
export function jobCountsTowardGpSold(job: VehicleJob): boolean {
  if (job.answerDeliveredAtSimMin != null) return true;
  return (
    job.column === 'parts' ||
    job.column === 'wip' ||
    job.column === 'qc' ||
    job.column === 'final'
  );
}

export interface TechHoursRow {
  tech: string;
  /** Flag (billed/sold) hours attributed to this tech */
  hours: number;
  goal: number;
  hit: boolean;
  /** flatRatePerFlagHr × flag hours */
  payEstimate?: number;
  /** flagHours / availableClockHrs × 100 when clock denom set */
  efficiencyPct?: number;
}

export interface TechHoursOptions {
  goalHours?: number;
  flatRatePerFlagHr?: number;
  availableClockHrs?: number;
}

/** Whether a job’s soldHours count as flag hours for an assigned tech. */
export function jobCountsTowardFlagHours(job: VehicleJob): boolean {
  if (job.column === 'parts' || job.column === 'wip' || job.column === 'qc' || job.column === 'final') {
    return true;
  }
  // Approval after sold / answer delivered still feeds flag hours
  if (job.column === 'approval' && job.answerDeliveredAtSimMin != null) {
    return true;
  }
  return false;
}

/** Flag hours on production (+ sold approval) per tech vs daily flag-hour goal. */
export function techHoursProgress(
  board: BoardState,
  goalHoursOrOpts: number | TechHoursOptions = DEFAULT_TECH_HOURS,
): TechHoursRow[] {
  const opts: TechHoursOptions =
    typeof goalHoursOrOpts === 'number'
      ? { goalHours: goalHoursOrOpts }
      : goalHoursOrOpts;
  const goalHours = opts.goalHours ?? DEFAULT_TECH_HOURS;
  const rate = opts.flatRatePerFlagHr;
  const clockHrs = opts.availableClockHrs;

  const map = new Map<string, number>();
  // Collect every tech seen on the board
  for (const j of board.jobs) {
    if (j.tech) {
      if (!map.has(j.tech)) map.set(j.tech, 0);
    }
  }
  for (const j of board.jobs) {
    if (!j.tech) continue;
    if (jobCountsTowardFlagHours(j)) {
      map.set(j.tech, (map.get(j.tech) ?? 0) + (j.soldHours ?? 0));
    }
  }
  return [...map.entries()]
    .map(([tech, hours]) => {
      const row: TechHoursRow = {
        tech,
        hours,
        goal: goalHours,
        hit: hours >= goalHours,
      };
      if (rate != null && rate > 0) {
        row.payEstimate = Math.round(hours * rate * 100) / 100;
      }
      if (clockHrs != null && clockHrs > 0) {
        row.efficiencyPct = Math.round((hours / clockHrs) * 1000) / 10;
      }
      return row;
    })
    .sort((a, b) => a.tech.localeCompare(b.tech));
}

/** Total flag hours across all techs (for GSPH = GP$ / flag hrs). */
export function totalFlagHours(board: BoardState): number {
  let total = 0;
  for (const j of board.jobs) {
    if (j.tech && jobCountsTowardFlagHours(j)) {
      total += j.soldHours ?? 0;
    }
  }
  return total;
}

export interface GpSoldProgress {
  current: number;
  target: number;
  ratio: number;
  met: boolean;
}

/** Sum GP$ for jobs that left the unsold speed zone / have answer delivered. */
export function gpSoldProgress(
  board: BoardState,
  scenario: Scenario,
): GpSoldProgress {
  const target = scenario.goals?.gpSoldTarget ?? 0;
  let current = 0;
  for (const j of board.jobs) {
    if (jobCountsTowardGpSold(j)) {
      current += jobGpDollars(j, scenario);
    }
  }
  current = Math.round(current);
  const ratio = target > 0 ? current / target : 0;
  return {
    current,
    target,
    ratio,
    met: target > 0 && current >= target,
  };
}

/**
 * Next most important thing coach:
 * 1. Earliest waiter timer (W) still unanswered / in speed zone
 * 2. Else earliest drop-off still in dispatch/inspection without answer
 * 3. Else oldest approval waiting
 * 4. Else heart cars needing attention
 * 5. Else bottleneck column job
 */
export function nextMostImportant(
  board: BoardState,
  simMin: number,
): NextImportantHint {
  const open = board.jobs.filter((j) => j.column !== 'final');

  // 1. Earliest waiter (W) unanswered / in speed zone — by lowest remaining timer, then earliest drop
  const waiters = open.filter(
    (j) =>
      j.markers?.includes('W') &&
      (j.answerDeliveredAtSimMin == null || isSpeedZone(j.column)),
  );
  if (waiters.length > 0) {
    waiters.sort((a, b) => {
      const ta = a.waiterTimerMin ?? 999;
      const tb = b.waiterTimerMin ?? 999;
      if (ta !== tb) return ta - tb;
      return dropTime(a) - dropTime(b);
    });
    const j = waiters[0];
    return {
      jobId: j.id,
      reason:
        'Earliest waiter: ' +
        j.customerName +
        (j.waiterTimerMin != null ? ' · ⏱ ' + j.waiterTimerMin + 'm' : ''),
    };
  }

  // 2. Earliest unanswered drop-off in dispatch/inspection
  const unansweredSpeed = open.filter(
    (j) => isSpeedZone(j.column) && j.answerDeliveredAtSimMin == null,
  );
  if (unansweredSpeed.length > 0) {
    unansweredSpeed.sort((a, b) => dropTime(a) - dropTime(b));
    const j = unansweredSpeed[0];
    const age = Math.floor(simMin) - Math.floor(dropTime(j));
    return {
      jobId: j.id,
      reason:
        'Earliest unanswered drop: ' +
        j.customerName +
        ' · ' +
        age +
        'm since drop',
    };
  }

  // 3. Oldest approval waiting
  const approvals = open.filter(
    (j) => j.column === 'approval' && j.flags.includes('waiting'),
  );
  if (approvals.length > 0) {
    approvals.sort((a, b) => dropTime(a) - dropTime(b));
    const j = approvals[0];
    return {
      jobId: j.id,
      reason: 'Oldest approval waiting: ' + j.customerName,
    };
  }

  // 4. Heart cars needing attention (not final, blocked or in QC/approval)
  const hearts = open.filter(
    (j) =>
      j.markers?.includes('H') &&
      (j.flags.includes('blocked') ||
        j.column === 'qc' ||
        j.column === 'approval' ||
        isSpeedZone(j.column)),
  );
  if (hearts.length > 0) {
    hearts.sort((a, b) => dropTime(a) - dropTime(b));
    const j = hearts[0];
    return {
      jobId: j.id,
      reason: 'Heart car needs attention: ' + j.customerName,
    };
  }

  // 5. Bottleneck column — oldest job there
  const bottleneck = bottleneckColumn(board);
  if (bottleneck) {
    const pile = open.filter((j) => j.column === bottleneck);
    if (pile.length >= 2) {
      pile.sort((a, b) => dropTime(a) - dropTime(b));
      const j = pile[0];
      return {
        jobId: j.id,
        reason:
          'Bottleneck in ' +
          COLUMN_LABELS[bottleneck] +
          ': ' +
          j.customerName,
      };
    }
  }

  return { jobId: null, reason: 'Board looks clear — keep emptying sections.' };
}

export function minutesUntilAnswerDue(
  job: VehicleJob,
  simMin: number,
): number | null {
  if (!needsAnswer(job)) return null;
  const elapsed = Math.floor(simMin) - Math.floor(dropTime(job));
  return ANSWER_WINDOW_MIN - elapsed;
}

export function computeDebrief(
  scenario: Scenario,
  board: BoardState,
  fired: FiredEventLog[],
): DebriefStats {
  const completed = board.jobs.filter((j) => j.column === 'final').length;
  const inProcess = board.jobs.filter((j) => j.column !== 'final').length;
  const blockersHit = board.jobs.reduce((n, j) => n + j.blockerHistory.length, 0);
  const urgentDone = board.jobs.filter(
    (j) => j.column === 'final' && j.flags.includes('urgent'),
  ).length;
  const totalJobs = board.jobs.length;
  const eventCount = fired.length;
  const openBlockers = board.jobs.filter(
    (j) => j.column !== 'final' && j.flags.includes('blocked'),
  ).length;

  const waitersLeft = board.jobs.filter(
    (j) => j.column !== 'final' && j.markers?.includes('W'),
  ).length;
  const waitersCleared = board.jobs.filter(
    (j) => j.column === 'final' && j.markers?.includes('W'),
  ).length;
  const { total: hoursStuck } = partsWipHours(board);
  const qcRestarts = board.jobs.reduce((n, j) => n + (j.qcFailCount ?? 0), 0);
  const qcFailEvents = fired.filter((f) => f.type === 'qc_fail').length;

  // Speed-zone / 1-hour answer performance
  const answerSubjects = board.jobs.filter(
    (j) =>
      j.markers?.includes('W') ||
      j.lateAnswer ||
      j.answerDeliveredAtSimMin != null ||
      isSpeedZone(j.column),
  );
  let answersOnTime = 0;
  let answersLate = 0;
  for (const j of answerSubjects) {
    if (j.lateAnswer) {
      answersLate += 1;
      continue;
    }
    if (j.answerDeliveredAtSimMin != null) {
      const lag = j.answerDeliveredAtSimMin - dropTime(j);
      if (lag <= ANSWER_WINDOW_MIN) answersOnTime += 1;
      else answersLate += 1;
    } else if (needsAnswer(j)) {
      // Still unanswered at debrief — count late if past window or still in speed zone
      answersLate += 1;
    }
  }

  const goalHours = scenario.goals?.techHoursPerDay ?? DEFAULT_TECH_HOURS;
  const flatRate = scenario.goals?.flatRatePerFlagHr;
  const availableClock = scenario.goals?.availableClockHrs ?? 8;
  const techHours = techHoursProgress(board, {
    goalHours,
    flatRatePerFlagHr: flatRate,
    availableClockHrs: availableClock,
  });
  const gpProg = gpSoldProgress(board, scenario);
  const techsHit = techHours.filter((t) => t.hit).length;
  const halfTechs =
    techHours.length === 0 ? false : techsHit >= Math.ceil(techHours.length / 2);

  let goalBonus = 0;
  if (gpProg.target > 0 && gpProg.met && halfTechs) {
    goalBonus += 12;
  } else if (gpProg.target > 0 && gpProg.met) {
    goalBonus += 6;
  }
  if (gpProg.target > 0 && gpProg.ratio < 0.5) {
    goalBonus -= 8; // soft penalty if far under GP$ target
  } else if (gpProg.target > 0 && gpProg.ratio < 0.75) {
    goalBonus -= 3;
  }
  if (techHours.length > 0 && techsHit === 0) {
    goalBonus -= 4;
  }

  const raw =
    completed * 20 +
    Math.max(0, 10 - openBlockers) * 3 +
    Math.min(eventCount, 6) * 2 -
    inProcess * 2 -
    waitersLeft * 8 -
    Math.min(hoursStuck, 20) * 0.5 -
    qcRestarts * 4 +
    waitersCleared * 6 +
    answersOnTime * 8 -
    answersLate * 10 +
    goalBonus;
  const score = Math.max(
    0,
    Math.min(100, Math.round((raw / (totalJobs * 12 + 40)) * 100)),
  );

  let grade = 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 40) grade = 'D';

  const notes: string[] = [];
  if (completed === 0) {
    notes.push('No cars reached Final — protect throughput.');
  }
  if (completed >= Math.ceil(totalJobs * 0.4)) {
    notes.push('Solid completion rate under pressure.');
  }
  if (openBlockers > 2) {
    notes.push('Too many open blockers left on the board.');
  }
  if (blockersHit > 0) {
    notes.push('You absorbed ' + blockersHit + ' blocker event(s).');
  }
  if (urgentDone > 0) {
    notes.push('Urgent work was pushed to Final.');
  }
  if (inProcess > completed) {
    notes.push('WIP still outweighs completions — tighten flow.');
  }

  if (waitersLeft > 0) {
    notes.push(
      waitersLeft +
        ' waiter(s) still on the board — prioritize W+timer customers.',
    );
  } else if (waitersCleared > 0) {
    notes.push('All waiters cleared — lobby pressure handled well.');
  }

  if (hoursStuck > 0) {
    notes.push(
      hoursStuck.toFixed(1) +
        ' sold hour(s) still sitting in Parts/WIP — empty your section.',
    );
  } else if (completed > 0) {
    notes.push('Parts/WIP hours cleared — good factory-of-hours discipline.');
  }

  if (qcRestarts > 0 || qcFailEvents > 0) {
    notes.push(
      'QC restarts: ' +
        qcRestarts +
        ' bounce(s). Each fail should hit Approval so the advisor knows before rework.',
    );
  } else if (completed > 0) {
    notes.push('QC held clean — no restart bounces this run.');
  }

  if (answersOnTime + answersLate > 0) {
    notes.push(
      '1-hour answers: ' +
        answersOnTime +
        ' on time, ' +
        answersLate +
        ' late. Closing ratio dies with delay — protect the speed zone first.',
    );
  }

  const bottleneck = bottleneckColumn(board);
  if (bottleneck && board.jobs.filter((j) => j.column === bottleneck).length >= 3) {
    notes.push(
      'Biggest pile still in ' +
        bottleneck +
        ' — find the bottleneck and empty that section first.',
    );
  } else if (completed > inProcess) {
    notes.push('Board looks emptier — bottleneck pressure eased.');
  }

  if (gpProg.target > 0) {
    notes.push(
      'GP$ sold (pipeline): $' +
        gpProg.current.toLocaleString() +
        ' / $' +
        gpProg.target.toLocaleString() +
        (gpProg.met ? ' — target hit.' : gpProg.ratio < 0.5 ? ' — far under target.' : ' — short of target.'),
    );
  }
  if (techHours.length > 0) {
    const hits = techHours.filter((t) => t.hit).map((t) => t.tech);
    const misses = techHours.filter((t) => !t.hit);
    if (hits.length > 0) {
      notes.push(
        'Flag hours ≥' +
          goalHours +
          ': ' +
          hits.join(', ') +
          '.',
      );
    }
    for (const m of misses) {
      const payBit =
        m.payEstimate != null
          ? ' · est. pay $' + m.payEstimate.toFixed(0)
          : '';
      const effBit =
        m.efficiencyPct != null && m.efficiencyPct < 70
          ? ' · efficiency low (' + m.efficiencyPct.toFixed(0) + '%)'
          : '';
      notes.push(
        m.tech +
          ' at ' +
          m.hours.toFixed(1) +
          ' flag hrs / ' +
          m.goal.toFixed(1) +
          ' — baseline flag-hour miss' +
          payBit +
          effBit +
          '.',
      );
    }
    for (const h of techHours.filter((t) => t.hit)) {
      if (h.efficiencyPct != null && h.efficiencyPct < 70) {
        notes.push(
          h.tech +
            ' hit flag goal but efficiency low (' +
            h.efficiencyPct.toFixed(0) +
            '% of available clock).',
        );
      }
    }
  }
  notes.push(
    'Flat rate: paid on flag hours · target ' +
      goalHours +
      ' flag hrs/tech · then GP$ sold (pipeline).',
  );

  notes.push(
    'Scenario: ' +
      scenario.title +
      ' (' +
      scenario.durationMin +
      ' sim minutes).',
  );

  return {
    completed,
    inProcess,
    blockersHit,
    urgentHandled: urgentDone,
    score,
    maxScore: 100,
    grade,
    notes,
    waitersLeft,
    hoursStuckPartsWip: hoursStuck,
    qcRestarts,
    answersOnTime,
    answersLate,
    gpSold: gpProg.current,
    gpTarget: gpProg.target,
    techHours: techHours.map((t) => ({
      tech: t.tech,
      hours: t.hours,
      goal: t.goal,
      payEstimate: t.payEstimate,
      efficiencyPct: t.efficiencyPct,
    })),
  };
}

export function formatSimClock(simMin: number): string {
  const baseHour = 7;
  const total = Math.floor(simMin);
  const h = baseHour + Math.floor(total / 60);
  const m = total % 60;
  const hh = ((h - 1) % 12) + 1;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return hh + ':' + m.toString().padStart(2, '0') + ' ' + ampm;
}
