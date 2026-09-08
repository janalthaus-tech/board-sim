import { useState } from 'react';

export const TUTORIAL_STORAGE_KEY = 'board-sim-tutorial-seen';

const STEPS = [
  {
    title: 'The shop is a roller coaster',
    body: 'Same order every time: check-in → dispatch → waiters/inspection → estimate/sale → parts → WIP → QC → out. Ride the track — don’t skip cars.',
  },
  {
    title: 'Speed zone = unsold',
    body: 'Dispatch, Inspection, and getting the answer. Speed matters getting the answer to the customer — not finishing the repair.',
  },
  {
    title: '1-hour drop-off + 1-10-100',
    body: 'Aim to deliver an answer within about an hour of drop-off. Find one thing in ~10 minutes, every time (1-10-100 habit).',
  },
  {
    title: 'Highest priority = earliest step',
    body: 'On each car, protect the earliest step first. Play “next most important thing” — earliest waiter timer first.',
  },
  {
    title: 'Magnet markers',
    body: 'Job cards show letter magnets: W = Waiter, R = Rental, S = Shuttle, H = Heart car. Waiters often carry a countdown timer — clear them early.',
  },
  {
    title: 'Production meeting & Heart cars',
    body: 'Hold a production meeting daily at the same time. Commit “goes today.” Heart cars (H) need extra care — don’t treat them like ordinary WIP.',
  },
  {
    title: 'Goals: flag hours, then GP$ sold',
    body: 'Flat rate: techs earn on flag (billed/sold) hours, not clock time. Sell work into Parts/WIP/QC/Final (or mark Answer delivered) to feed the shop’s GP$ sold. Aim ~8 flag hrs/tech as the day baseline — then chase GP$ sold. Flag hours only bank when a tech is assigned on the card.',
  },
  {
    title: 'Assign a tech to bank flag hours',
    body: 'Sold hours on a card only feed flag hrs when a tech is on that card. Select a job and use Assign tech on the MoveBar (No tech clears it). Final does not invent a tech — pile cars in Final without assigning and flag hours stay soft.',
  },
  {
    title: 'Final ≠ automatic day goals',
    body: 'Final means the car is complete — not that day goals are done. GP$ comes from sold work in Parts/WIP/QC/Final or Answer delivered. Flag hrs need tech + sold hours. A big Final pile is success throughput, not a flow bottleneck to “empty” like Approval or Parts.',
  },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  /** When true, mark tutorial as seen in localStorage on Done/Skip */
  markSeen?: boolean;
}

export function Tutorial({ open, onClose, markSeen = false }: Props) {
  const [step, setStep] = useState(0);

  if (!open) return null;

  const last = step >= STEPS.length - 1;
  const current = STEPS[step];

  const finish = (seen: boolean) => {
    if (seen && markSeen) {
      try {
        localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
      } catch {
        /* ignore */
      }
    }
    setStep(0);
    onClose();
  };

  return (
    <div className="tutorial-overlay" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <div className="tutorial-modal">
        <p className="eyebrow">How The Board works</p>
        <p className="tutorial-step-count">
          Step {step + 1} / {STEPS.length}
        </p>
        <h2 id="tutorial-title">{current.title}</h2>
        <p className="tutorial-body">{current.body}</p>
        <p className="tutorial-disclaimer">
          Inspired by Shop Fix Board / roller-coaster training — paraphrased for training only.
        </p>
        <div className="tutorial-dots" aria-hidden>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`tutorial-dot ${i === step ? 'tutorial-dot--active' : ''}`}
            />
          ))}
        </div>
        <div className="tutorial-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => finish(true)}
          >
            Skip
          </button>
          {!last ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => finish(true)}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function tutorialStepCount(): number {
  return STEPS.length;
}
