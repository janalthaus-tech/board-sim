import type { VehicleJob } from '../model';
import {
  LINE_STATUS_LABEL,
  approvalSummary,
  inspectionSummary,
  partsSummary,
  repairCompletionSummary,
  vehicleLabel,
} from '../model';

interface Props {
  job: VehicleJob;
  simMin: number;
  onClose: () => void;
  onMarkInspectionComplete: () => void;
  onApproveAllPending: () => void;
  onApproveLine: (lineId: string) => void;
  onMarkPartsOrdered: (lineId: string) => void;
  onMarkLineDone: (lineId: string) => void;
  onMarkLineInRepair?: (lineId: string) => void;
}

export function JobDetail({
  job,
  simMin,
  onClose,
  onMarkInspectionComplete,
  onApproveAllPending,
  onApproveLine,
  onMarkPartsOrdered,
  onMarkLineDone,
  onMarkLineInRepair,
}: Props) {
  const lines = job.repairLines ?? [];
  const pendingCount = lines.filter(
    (l) => l.status === 'pending_approval' || l.status === 'proposed',
  ).length;
  const floor = Math.floor(simMin);

  return (
    <section
      className="job-detail"
      role="dialog"
      aria-label={`Job detail for ${job.customerName}`}
      data-demo="job-detail"
    >
      <header className="job-detail__head">
        <div className="job-detail__titles">
          <strong>{job.customerName}</strong>
          <span>{vehicleLabel(job)}</span>
        </div>
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          onClick={onClose}
          aria-label="Close job detail"
        >
          Close
        </button>
      </header>

      <div className="job-detail__questions" data-demo="repair-status">
        <div className="job-detail__q">
          <span className="job-detail__q-label">1. Inspection</span>
          <span className="job-detail__q-answer">{inspectionSummary(job)}</span>
        </div>
        <div className="job-detail__q">
          <span className="job-detail__q-label">2. Customer approval</span>
          <span className="job-detail__q-answer">{approvalSummary(job)}</span>
        </div>
        <div className="job-detail__q">
          <span className="job-detail__q-label">3. Parts</span>
          <span className="job-detail__q-answer">{partsSummary(job, simMin)}</span>
        </div>
        <div className="job-detail__q">
          <span className="job-detail__q-label">4. Repair complete</span>
          <span className="job-detail__q-answer">
            {repairCompletionSummary(job)}
          </span>
        </div>
      </div>

      <div className="job-detail__actions">
        {job.inspectionStatus !== 'complete' && (
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={onMarkInspectionComplete}
          >
            Mark inspection complete
          </button>
        )}
        {pendingCount > 0 && (
          <button
            type="button"
            className="btn btn--sm btn--ok"
            onClick={onApproveAllPending}
          >
            Approve all pending ({pendingCount})
          </button>
        )}
      </div>

      {lines.length > 0 && (
        <ul className="job-detail__lines" aria-label="Repair lines">
          {lines.map((line) => {
            const canApprove =
              line.status === 'proposed' || line.status === 'pending_approval';
            const canOrderParts =
              line.status === 'approved' ||
              line.status === 'parts_ordered' ||
              line.status === 'parts_ready';
            const canStartRepair =
              line.status === 'approved' ||
              line.status === 'parts_ready' ||
              line.status === 'parts_ordered';
            const canDone =
              line.status !== 'done' && line.status !== 'declined';
            const etaLeft =
              line.status === 'parts_ordered' && line.partsEtaSimMin != null
                ? Math.max(0, line.partsEtaSimMin - floor)
                : null;

            return (
              <li key={line.id} className={`job-line job-line--${line.status}`}>
                <div className="job-line__main">
                  <strong className="job-line__desc">{line.description}</strong>
                  <span className={`job-line__status chip chip--line-${line.status}`}>
                    {LINE_STATUS_LABEL[line.status]}
                  </span>
                </div>
                <div className="job-line__meta">
                  {line.hours != null && (
                    <span className="chip chip--meta">{line.hours}h</span>
                  )}
                  {line.partsNote && (
                    <span className="chip chip--meta">{line.partsNote}</span>
                  )}
                  {etaLeft != null && (
                    <span className="chip chip--parts-eta">ETA {etaLeft}m</span>
                  )}
                  {line.status === 'parts_ready' && (
                    <span className="chip chip--parts-ready">Available now</span>
                  )}
                  {line.approvedAtSimMin != null && (
                    <span className="chip chip--meta">
                      Appr T+{line.approvedAtSimMin}m
                    </span>
                  )}
                  {line.completedAtSimMin != null && (
                    <span className="chip chip--meta">
                      Done T+{line.completedAtSimMin}m
                    </span>
                  )}
                </div>
                <div className="job-line__actions">
                  {canApprove && (
                    <button
                      type="button"
                      className="btn btn--sm btn--ok"
                      onClick={() => onApproveLine(line.id)}
                    >
                      Approve
                    </button>
                  )}
                  {canOrderParts && line.status !== 'parts_ready' && (
                    <button
                      type="button"
                      className="btn btn--sm btn--primary"
                      onClick={() => onMarkPartsOrdered(line.id)}
                      title="Order parts · ETA = now + 30 sim min"
                    >
                      Mark parts ordered (+30m)
                    </button>
                  )}
                  {canStartRepair && onMarkLineInRepair && line.status !== 'in_repair' && (
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      onClick={() => onMarkLineInRepair(line.id)}
                    >
                      Start repair
                    </button>
                  )}
                  {canDone && (
                    <button
                      type="button"
                      className="btn btn--sm btn--warn"
                      onClick={() => onMarkLineDone(line.id)}
                    >
                      Mark line done
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {lines.length === 0 && (
        <p className="job-detail__empty">
          No repair lines yet — mark inspection complete to propose findings.
        </p>
      )}
    </section>
  );
}
