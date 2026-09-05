import type { JobMarker } from '../model';
import { MARKER_LABELS } from '../model';

const MARKERS: JobMarker[] = ['W', 'R', 'S', 'H'];

interface Props {
  /** Compact chips for board HUD; roomier on home */
  compact?: boolean;
  className?: string;
}

export function MagnetLegend({ compact = false, className = '' }: Props) {
  return (
    <div
      className={`magnet-legend ${compact ? 'magnet-legend--compact' : ''} ${className}`.trim()}
      aria-label="Magnet abbreviations"
    >
      <span className="magnet-legend__label">Magnets</span>
      <ul className="magnet-legend__list">
        {MARKERS.map((m) => (
          <li key={m} className="magnet-legend__item">
            <span
              className={`magnet magnet--${m.toLowerCase()}`}
              aria-hidden
            >
              {m === 'H' ? '♥' : m}
            </span>
            <span className="magnet-legend__text">
              <abbr title={MARKER_LABELS[m]}>{m}</abbr>
              <span className="magnet-legend__eq"> = </span>
              {MARKER_LABELS[m]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
