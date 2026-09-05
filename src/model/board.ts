import type { BoardColumnId, BoardState, JobFlag, VehicleJob } from './types';
import { BOARD_COLUMNS, isSpeedZone } from './types';

let idCounter = 0;

export function nextId(prefix = 'job'): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Date.now().toString(36)}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

export function createEmptyBoard(): BoardState {
  return {
    jobs: [],
    columnOrder: [...BOARD_COLUMNS],
  };
}

export function jobsInColumn(state: BoardState, column: BoardColumnId): VehicleJob[] {
  return state.jobs.filter((j) => j.column === column);
}

export function dropTime(job: Pick<VehicleJob, 'droppedAtSimMin' | 'createdAtSimMin'>): number {
  return job.droppedAtSimMin ?? job.createdAtSimMin;
}

/** Clear keys when car is pulled into a bay / inspection / WIP. */
function applyBayPull(job: VehicleJob, toColumn: BoardColumnId, bay?: string): Partial<VehicleJob> {
  const enteringBay =
    Boolean(bay ?? job.bay) ||
    toColumn === 'inspection' ||
    toColumn === 'wip' ||
    toColumn === 'qc';
  if (job.keysOnBoard && enteringBay) {
    return { keysOnBoard: false };
  }
  return {};
}

/** Mark answer delivered the first time work moves into Approval (selling). */
function applyAnswerOnMove(
  job: VehicleJob,
  toColumn: BoardColumnId,
  simMin: number,
): Partial<VehicleJob> {
  if (job.answerDeliveredAtSimMin != null) return {};
  if (toColumn === 'approval' && job.column !== 'approval') {
    return { answerDeliveredAtSimMin: simMin };
  }
  // Moving past inspection into sold/production also counts as answer delivered
  if (
    isSpeedZone(job.column) &&
    (toColumn === 'parts' || toColumn === 'wip' || toColumn === 'qc' || toColumn === 'final')
  ) {
    return { answerDeliveredAtSimMin: simMin };
  }
  return {};
}

export function moveJob(
  state: BoardState,
  jobId: string,
  toColumn: BoardColumnId,
  simMin: number,
): BoardState {
  return {
    ...state,
    jobs: state.jobs.map((job) => {
      if (job.id !== jobId) return job;
      const next: VehicleJob = {
        ...job,
        column: toColumn,
        ...applyBayPull(job, toColumn),
        ...applyAnswerOnMove(job, toColumn, simMin),
      };
      if (toColumn === 'final' && job.column !== 'final') {
        next.completedAtSimMin = simMin;
        next.flags = job.flags.filter((f) => f !== 'waiting' && f !== 'blocked');
        if (job.repairLines) {
          next.repairLines = job.repairLines.map((line) =>
            line.status === 'in_repair'
              ? { ...line, status: 'done' as const, completedAtSimMin: simMin }
              : line,
          );
        }
      }
      if (toColumn !== 'final') {
        next.completedAtSimMin = undefined;
      }
      return next;
    }),
  };
}

export function markAnswerDelivered(
  state: BoardState,
  jobId: string,
  simMin: number,
): BoardState {
  return {
    ...state,
    jobs: state.jobs.map((j) => {
      if (j.id !== jobId) return j;
      if (j.answerDeliveredAtSimMin != null) return j;
      return { ...j, answerDeliveredAtSimMin: simMin };
    }),
  };
}

export function addJob(state: BoardState, job: VehicleJob): BoardState {
  return { ...state, jobs: [...state.jobs, job] };
}

export function updateJob(
  state: BoardState,
  jobId: string,
  patch: Partial<VehicleJob>,
): BoardState {
  return {
    ...state,
    jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, ...patch } : j)),
  };
}

export function addFlag(state: BoardState, jobId: string, flag: JobFlag, reason?: string): BoardState {
  return {
    ...state,
    jobs: state.jobs.map((j) => {
      if (j.id !== jobId) return j;
      const flags = j.flags.includes(flag) ? j.flags : [...j.flags, flag];
      const blockerHistory =
        flag === 'blocked' && reason
          ? [...j.blockerHistory, reason]
          : j.blockerHistory;
      return { ...j, flags, blockerHistory };
    }),
  };
}

export function clearFlag(state: BoardState, jobId: string, flag: JobFlag): BoardState {
  return {
    ...state,
    jobs: state.jobs.map((j) =>
      j.id === jobId ? { ...j, flags: j.flags.filter((f) => f !== flag) } : j,
    ),
  };
}

export function vehicleLabel(job: Pick<VehicleJob, 'year' | 'make' | 'model'>): string {
  return `${job.year} ${job.make} ${job.model}`;
}

export function assignBayTech(
  state: BoardState,
  jobId: string,
  bay?: string,
  tech?: string,
): BoardState {
  const job = state.jobs.find((j) => j.id === jobId);
  const patch: Partial<VehicleJob> = { bay, tech };
  if (job?.keysOnBoard && bay) {
    patch.keysOnBoard = false;
  }
  return updateJob(state, jobId, patch);
}
