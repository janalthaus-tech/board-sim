import type { BoardColumnId, VehicleJob } from '../model';
import { COLUMN_LABELS, columnZoneLabel, isSpeedZone, isSoldZone } from '../model';
import { VehicleCard } from './VehicleCard';

interface Props {
  columnId: BoardColumnId;
  jobs: VehicleJob[];
  selectedId: string | null;
  highlightJobId?: string | null;
  bottleneck?: boolean;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDropJob: (columnId: BoardColumnId, jobId: string) => void;
}

export function Column({
  columnId,
  jobs,
  selectedId,
  highlightJobId,
  bottleneck,
  onSelect,
  onDragStart,
  onDropJob,
}: Props) {
  const zone = columnZoneLabel(columnId);
  const zoneClass = isSpeedZone(columnId)
    ? 'column--speed'
    : isSoldZone(columnId)
      ? 'column--sold'
      : 'column--selling';

  return (
    <section
      className={`column ${zoneClass} ${bottleneck ? 'column--bottleneck' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        if (id) onDropJob(columnId, id);
      }}
    >
      <header className="column__header">
        <div className="column__titles">
          <h2>
            {COLUMN_LABELS[columnId]}
            {bottleneck && <span className="column__bottleneck-tag">Bottleneck</span>}
          </h2>
          <span className="column__zone">{zone}</span>
        </div>
        <span className={`column__count ${bottleneck ? 'column__count--hot' : ''}`}>
          {jobs.length}
        </span>
      </header>
      <div className="column__body">
        {jobs.map((job) => (
          <VehicleCard
            key={job.id}
            job={job}
            selected={selectedId === job.id}
            highlight={highlightJobId === job.id}
            onSelect={onSelect}
            onDragStart={onDragStart}
          />
        ))}
        {jobs.length === 0 && <p className="column__empty">Drop cards here</p>}
      </div>
    </section>
  );
}
