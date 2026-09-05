import type { BoardState, LineStatus, RepairLine, VehicleJob } from './types';
import { updateJob } from './board';

const SOLD_LIKE: LineStatus[] = [
  'approved',
  'parts_ordered',
  'parts_ready',
  'in_repair',
  'done',
];

export function linesOf(job: VehicleJob): RepairLine[] {
  return job.repairLines ?? [];
}

export function isApprovedLike(status: LineStatus): boolean {
  return SOLD_LIKE.includes(status);
}

export function inspectionChipLabel(job: VehicleJob): string | null {
  if (!job.inspectionStatus) return null;
  if (job.inspectionStatus === 'complete') return 'Insp ✓';
  if (job.inspectionStatus === 'in_progress') return 'Insp…';
  return 'Insp —';
}

export function approvalChipLabel(job: VehicleJob): string | null {
  const lines = linesOf(job);
  if (lines.length === 0) return null;
  const approved = lines.filter((l) => isApprovedLike(l.status)).length;
  return `${approved}/${lines.length} appr`;
}

export function partsChipLabel(job: VehicleJob, simMin: number): string | null {
  const lines = linesOf(job);
  const ordered = lines.filter((l) => l.status === 'parts_ordered');
  const ready = lines.filter((l) => l.status === 'parts_ready');
  if (ready.length > 0 && ordered.length === 0) return 'Parts ready';
  if (ordered.length > 0) {
    const etas = ordered
      .map((l) => l.partsEtaSimMin)
      .filter((x): x is number => x != null);
    if (etas.length > 0) {
      const soonest = Math.min(...etas);
      const remaining = Math.max(0, soonest - Math.floor(simMin));
      return `Parts ETA ${remaining}m`;
    }
    return 'Parts ordered';
  }
  return null;
}

export function repairChipLabel(job: VehicleJob): string | null {
  const lines = linesOf(job);
  const trackable = lines.filter((l) => isApprovedLike(l.status));
  if (trackable.length === 0) return null;
  const done = trackable.filter((l) => l.status === 'done').length;
  return `Repair ${done}/${trackable.length}`;
}

export function inspectionSummary(job: VehicleJob): string {
  const status = job.inspectionStatus ?? 'not_started';
  if (status === 'complete') {
    const proposed = linesOf(job).filter(
      (l) =>
        l.status === 'proposed' ||
        l.status === 'pending_approval' ||
        isApprovedLike(l.status) ||
        l.status === 'declined',
    );
    if (proposed.length === 0) return 'Inspection complete — no lines proposed yet';
    return `Inspection complete — ${proposed.length} line(s) proposed`;
  }
  if (status === 'in_progress') return 'Inspection in progress';
  return 'Inspection not started';
}

export function approvalSummary(job: VehicleJob): string {
  const lines = linesOf(job);
  if (lines.length === 0) return 'No repair lines yet';
  const approved = lines.filter((l) => isApprovedLike(l.status));
  const pending = lines.filter(
    (l) => l.status === 'pending_approval' || l.status === 'proposed',
  );
  const declined = lines.filter((l) => l.status === 'declined');
  if (approved.length === 0 && pending.length === 0) {
    return declined.length > 0
      ? `No approvals — ${declined.length} declined`
      : 'No approvals yet';
  }
  const bits = [`${approved.length}/${lines.length} approved`];
  if (pending.length > 0) bits.push(`${pending.length} pending`);
  if (declined.length > 0) bits.push(`${declined.length} declined`);
  return bits.join(' · ');
}

export function partsSummary(job: VehicleJob, simMin: number): string {
  const lines = linesOf(job);
  const ordered = lines.filter((l) => l.status === 'parts_ordered');
  const ready = lines.filter((l) => l.status === 'parts_ready');
  if (ordered.length === 0 && ready.length === 0) {
    const needsParts = lines.filter(
      (l) =>
        (l.status === 'approved' || l.status === 'in_repair' || l.status === 'done') &&
        l.partsNote,
    );
    if (needsParts.length === 0) return 'No parts on order';
    return 'Parts not ordered yet';
  }
  const bits: string[] = [];
  if (ready.length > 0) bits.push(`${ready.length} ready`);
  if (ordered.length > 0) {
    const etas = ordered
      .map((l) => l.partsEtaSimMin)
      .filter((x): x is number => x != null);
    if (etas.length > 0) {
      const soonest = Math.min(...etas);
      const remaining = Math.max(0, soonest - Math.floor(simMin));
      bits.push(`${ordered.length} ordered · ETA ${remaining}m (T+${soonest}m)`);
    } else {
      bits.push(`${ordered.length} ordered`);
    }
  }
  return bits.join(' · ');
}

export function repairCompletionSummary(job: VehicleJob): string {
  const lines = linesOf(job);
  const trackable = lines.filter((l) => isApprovedLike(l.status));
  if (trackable.length === 0) return 'No approved repairs yet';
  const done = trackable.filter((l) => l.status === 'done');
  if (done.length === trackable.length) {
    const last = Math.max(
      ...done.map((l) => l.completedAtSimMin ?? 0),
    );
    return `All ${done.length} approved repair(s) done${last > 0 ? ` · last at T+${last}m` : ''}`;
  }
  const inRepair = trackable.filter((l) => l.status === 'in_repair').length;
  return `${done.length}/${trackable.length} done${inRepair > 0 ? ` · ${inRepair} in repair` : ''}`;
}

function mapLines(
  state: BoardState,
  jobId: string,
  fn: (lines: RepairLine[], job: VehicleJob) => RepairLine[],
  extra?: Partial<VehicleJob>,
): BoardState {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return state;
  const repairLines = fn(linesOf(job), job);
  return updateJob(state, jobId, { repairLines, ...extra });
}

/** Mark inspection complete; ensure at least one proposed/pending line from concern. */
export function markInspectionComplete(
  state: BoardState,
  jobId: string,
): BoardState {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return state;
  let repairLines = linesOf(job);
  if (repairLines.length === 0) {
    repairLines = [
      {
        id: `${jobId}-line-1`,
        description: job.concern || 'Inspection findings',
        status: 'pending_approval',
        hours: job.soldHours,
      },
    ];
  } else {
    repairLines = repairLines.map((l) => {
      if (l.status === 'proposed') {
        return { ...l, status: 'pending_approval' as const };
      }
      return l;
    });
  }
  return updateJob(state, jobId, {
    inspectionStatus: 'complete',
    repairLines,
  });
}

export function approveAllPending(
  state: BoardState,
  jobId: string,
  simMin: number,
): BoardState {
  return mapLines(state, jobId, (lines) =>
    lines.map((l) => {
      if (l.status === 'pending_approval' || l.status === 'proposed') {
        return {
          ...l,
          status: 'approved' as const,
          approvedAtSimMin: l.approvedAtSimMin ?? simMin,
        };
      }
      return l;
    }),
  );
}

export function approveLine(
  state: BoardState,
  jobId: string,
  lineId: string,
  simMin: number,
): BoardState {
  return mapLines(state, jobId, (lines) =>
    lines.map((l) => {
      if (l.id !== lineId) return l;
      if (l.status !== 'pending_approval' && l.status !== 'proposed') return l;
      return {
        ...l,
        status: 'approved' as const,
        approvedAtSimMin: simMin,
      };
    }),
  );
}

export function markPartsOrdered(
  state: BoardState,
  jobId: string,
  lineId: string,
  simMin: number,
  etaOffsetMin = 30,
): BoardState {
  return mapLines(state, jobId, (lines) =>
    lines.map((l) => {
      if (l.id !== lineId) return l;
      if (
        l.status !== 'approved' &&
        l.status !== 'parts_ordered' &&
        l.status !== 'parts_ready'
      ) {
        return l;
      }
      return {
        ...l,
        status: 'parts_ordered' as const,
        partsEtaSimMin: simMin + etaOffsetMin,
      };
    }),
  );
}

export function markLineDone(
  state: BoardState,
  jobId: string,
  lineId: string,
  simMin: number,
): BoardState {
  return mapLines(state, jobId, (lines) =>
    lines.map((l) => {
      if (l.id !== lineId) return l;
      if (l.status === 'declined' || l.status === 'done') return l;
      return {
        ...l,
        status: 'done' as const,
        completedAtSimMin: simMin,
      };
    }),
  );
}

export function markLineInRepair(
  state: BoardState,
  jobId: string,
  lineId: string,
): BoardState {
  return mapLines(state, jobId, (lines) =>
    lines.map((l) => {
      if (l.id !== lineId) return l;
      if (
        l.status !== 'approved' &&
        l.status !== 'parts_ready' &&
        l.status !== 'parts_ordered'
      ) {
        return l;
      }
      return { ...l, status: 'in_repair' as const };
    }),
  );
}

/** When moving to Final: close open approved lines that are still in_repair. */
export function completeInRepairLinesOnFinal(
  lines: RepairLine[] | undefined,
  simMin: number,
): RepairLine[] | undefined {
  if (!lines) return lines;
  return lines.map((l) => {
    if (l.status !== 'in_repair') return l;
    return { ...l, status: 'done' as const, completedAtSimMin: simMin };
  });
}

export const LINE_STATUS_LABEL: Record<LineStatus, string> = {
  proposed: 'Proposed',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  declined: 'Declined',
  parts_ordered: 'Parts ordered',
  parts_ready: 'Parts ready',
  in_repair: 'In repair',
  done: 'Done',
};
