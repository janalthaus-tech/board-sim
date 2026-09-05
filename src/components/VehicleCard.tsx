import type { BoardColumnId, JobMarker, VehicleJob } from '../model';
import {
  vehicleLabel,
  BOARD_COLUMNS,
  COLUMN_LABELS,
  MARKER_LABELS,
  approvalChipLabel,
  inspectionChipLabel,
  partsChipLabel,
  repairChipLabel,
} from '../model';

interface Props {
  job: VehicleJob;
  selected: boolean;
  highlight?: boolean;
  simMin?: number;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
}

const FLAG_LABEL: Record<string, string> = {
  waiting: 'Waiting',
  blocked: 'Blocked',
  urgent: 'Urgent',
};

function formatWaiterTimer(min: number): string {
  const m = Math.max(0, Math.floor(min));
  return m + 'm';
}

export function VehicleCard({
  job,
  selected,
  highlight,
  simMin = 0,
  onSelect,
  onDragStart,
}: Props) {
  const markers = job.markers ?? [];
  const isWaiter = markers.includes('W');
  const isHeart = markers.includes('H');
  const timerCritical =
    isWaiter && job.waiterTimerMin != null && job.waiterTimerMin <= 5;
  const inspChip = inspectionChipLabel(job);
  const apprChip = approvalChipLabel(job);
  const partsChip = partsChipLabel(job, simMin);
  const repairChip = repairChipLabel(job);

  return (
    <article
      className={`card ${selected ? 'card--selected' : ''} ${job.flags.includes('urgent') ? 'card--urgent' : ''} ${job.flags.includes('blocked') ? 'card--blocked' : ''} ${isWaiter ? 'card--waiter' : ''} ${isHeart ? 'card--heart' : ''} ${job.lateAnswer ? 'card--late-answer' : ''} ${highlight ? 'card--next-important' : ''} ${job.promisedToday ? 'card--promised' : ''}`}
      data-demo={isWaiter && job.waiterTimerMin != null ? 'waiter' : undefined}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', job.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(job.id);
      }}
      onClick={() => onSelect(job.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(job.id);
        }
      }}
      aria-label={`${job.customerName}, ${vehicleLabel(job)}`}
    >
      {(markers.length > 0 || job.keysOnBoard || job.promisedToday) && (
        <div className="card__markers" aria-label="Job magnets">
          {markers.map((m: JobMarker) => (
            <span
              key={m}
              className={`magnet magnet--${m.toLowerCase()}`}
              title={`${m} = ${MARKER_LABELS[m]}`}
              aria-label={`${m} = ${MARKER_LABELS[m]}`}
            >
              {m === 'H' ? '♥' : m}
            </span>
          ))}
          {isWaiter && job.waiterTimerMin != null && (
            <span
              className={`card__timer ${timerCritical ? 'card__timer--critical' : ''}`}
              title="Waiter timer (sim min remaining)"
            >
              ⏱ {formatWaiterTimer(job.waiterTimerMin)}
            </span>
          )}
          {job.keysOnBoard && (
            <span className="chip chip--keys" title="Keys still on board">
              🔑 Keys
            </span>
          )}
          {job.promisedToday && (
            <span className="chip chip--promised" title="Promised today">
              ★ Today
            </span>
          )}
          {job.lateAnswer && (
            <span className="chip chip--late" title="1-hour answer late">
              Late ans
            </span>
          )}
        </div>
      )}
      <header className="card__header">
        <strong className="card__customer">{job.customerName}</strong>
        <span className="card__vehicle">{vehicleLabel(job)}</span>
      </header>
      <p className="card__concern">{job.concern}</p>
      <div className="card__meta">
        {job.bay && <span className="chip chip--meta">{job.bay}</span>}
        {job.tech && <span className="chip chip--meta">{job.tech}</span>}
        {job.soldHours != null && job.soldHours > 0 && (
          <span className="chip chip--hours" title="Sold hours">
            {job.soldHours}h sold
          </span>
        )}
        {(job.qcFailCount ?? 0) > 0 && (
          <span className="chip chip--qc" title="QC fail count">
            QC×{job.qcFailCount}
          </span>
        )}
        {job.answerDeliveredAtSimMin != null && (
          <span className="chip chip--answered" title="Answer delivered">
            Answered
          </span>
        )}
      </div>
      {(inspChip || apprChip || partsChip || repairChip) && (
        <div className="card__repair-chips" data-demo="repair-chips">
          {inspChip && (
            <span className="chip chip--insp" title="Inspection status">
              {inspChip}
            </span>
          )}
          {apprChip && (
            <span className="chip chip--appr" title="Approved / total lines">
              {apprChip}
            </span>
          )}
          {partsChip && (
            <span className="chip chip--parts-eta" title="Parts availability">
              {partsChip}
            </span>
          )}
          {repairChip && (
            <span className="chip chip--repair" title="Repair progress">
              {repairChip}
            </span>
          )}
        </div>
      )}
      {job.flags.length > 0 && (
        <div className="card__flags">
          {job.flags.map((f) => (
            <span key={f} className={`chip chip--${f}`}>
              {FLAG_LABEL[f] ?? f}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

interface MoveBarProps {
  job: VehicleJob | undefined;
  onMove: (column: BoardColumnId) => void;
  onClearSelection: () => void;
  onClearBlocker: () => void;
  onAnswerDelivered?: () => void;
}

export function MoveBar({
  job,
  onMove,
  onClearSelection,
  onClearBlocker,
  onAnswerDelivered,
}: MoveBarProps) {
  if (!job) {
    return (
      <div className="movebar movebar--hint" role="region" aria-label="Move selected vehicle" data-demo="movebar">
        <p className="movebar__hint">Tap a card to move</p>
      </div>
    );
  }
  const canDeliverAnswer = job.answerDeliveredAtSimMin == null && job.column !== 'final';
  return (
    <div className="movebar" role="region" aria-label="Move selected vehicle" data-demo="movebar">
      <div className="movebar__info">
        <strong>{job.customerName}</strong>
        <span>{vehicleLabel(job)}</span>
        <span className="movebar__col">in {COLUMN_LABELS[job.column]}</span>
        {job.markers && job.markers.length > 0 && (
          <span className="movebar__markers">
            {job.markers.map((m) => (
              <span
                key={m}
                className={`magnet magnet--${m.toLowerCase()}`}
                title={`${m} = ${MARKER_LABELS[m]}`}
                aria-label={`${m} = ${MARKER_LABELS[m]}`}
              >
                {m === 'H' ? '♥' : m}
              </span>
            ))}
          </span>
        )}
        {job.keysOnBoard && (
          <span className="chip chip--keys">🔑 Keys</span>
        )}
      </div>
      <div className="movebar__actions">
        {BOARD_COLUMNS.map((col) => (
          <button
            key={col}
            type="button"
            className={`btn btn--sm ${col === job.column ? 'btn--ghost' : 'btn--primary'}`}
            disabled={col === job.column}
            onClick={() => onMove(col)}
          >
            {COLUMN_LABELS[col]}
          </button>
        ))}
        {canDeliverAnswer && onAnswerDelivered && (
          <button
            type="button"
            className="btn btn--sm btn--ok"
            onClick={onAnswerDelivered}
            title="Mark customer answer delivered (1-hour clock)"
          >
            Answer delivered
          </button>
        )}
        {job.flags.includes('blocked') && (
          <button type="button" className="btn btn--sm btn--warn" onClick={onClearBlocker}>
            Clear blocker
          </button>
        )}
        <button type="button" className="btn btn--sm btn--ghost" onClick={onClearSelection}>
          Deselect
        </button>
      </div>
    </div>
  );
}
