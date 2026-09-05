import { useCallback, useEffect, useRef, useState } from 'react';
import { BoardView } from './components/BoardView';
import { DecisionDemo } from './components/DecisionDemo';
import { Debrief } from './components/Debrief';
import { Home } from './components/Home';
import { hasSeenTutorial, Tutorial } from './components/Tutorial';
import {
  applyPace,
  approveAllPending,
  approveLine,
  clearFlag,
  computeDebrief,
  getScenario,
  markAnswerDelivered,
  markInspectionComplete,
  markLineDone,
  markLineInRepair,
  markPartsOrdered,
  moveJob,
  startScenario,
  tickEngine,
  type AppScreen,
  type BoardColumnId,
  type DebriefStats,
  type EngineSnapshot,
  type PaceId,
  type Scenario,
  type SpeedMul,
} from './model';

const DEMO_SCENARIO_ID = 'morning-rush';
const DEMO_TOAST =
  'Demo event: Walk-in waiting in lobby — check Dispatch and the earliest W timer.';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [engine, setEngine] = useState<EngineSnapshot | null>(null);
  const [running, setRunning] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stats, setStats] = useState<DebriefStats | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialMarkSeen, setTutorialMarkSeen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [pace, setPace] = useState<PaceId>('easy');
  const [speedMul, setSpeedMul] = useState<SpeedMul>(1);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const engineRef = useRef(engine);
  const scenarioRef = useRef(scenario);
  const runningRef = useRef(running);
  const speedMulRef = useRef(speedMul);

  engineRef.current = engine;
  scenarioRef.current = scenario;
  runningRef.current = running;
  speedMulRef.current = speedMul;

  const finish = useCallback(() => {
    const sc = scenarioRef.current;
    const en = engineRef.current;
    if (!sc || !en) return;
    setRunning(false);
    setStats(computeDebrief(sc, en.board, en.fired));
    setScreen('debrief');
  }, []);

  useEffect(() => {
    if (!running || !scenario) return;

    const loop = (ts: number) => {
      if (!runningRef.current || !scenarioRef.current || !engineRef.current) return;
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      const sc = scenarioRef.current;
      const rate = (1 / sc.realSecondsPerSimMin) * speedMulRef.current;
      const nextMin = engineRef.current.simMin + dt * rate;

      if (nextMin >= sc.durationMin) {
        const snapped = tickEngine(sc, engineRef.current, sc.durationMin);
        setEngine(snapped);
        finish();
        return;
      }

      setEngine(tickEngine(sc, engineRef.current, nextMin));
      rafRef.current = requestAnimationFrame(loop);
    };

    lastTsRef.current = null;
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [running, scenario, finish]);

  const begin = (scenarioId: string, nextPace: PaceId) => {
    const base = getScenario(scenarioId);
    if (!base) return;
    const sc = applyPace(base, nextPace);
    const snap = startScenario(sc);
    setPace(nextPace);
    setSpeedMul(1);
    setScenario(sc);
    setEngine(snap);
    setSelectedId(null);
    setStats(null);
    setDemoOpen(false);
    setScreen('board');
    const firstTime = !hasSeenTutorial();
    if (firstTime) {
      setRunning(false);
      setTutorialMarkSeen(true);
      setTutorialOpen(true);
    } else {
      setRunning(true);
    }
  };

  const beginDecisionDemo = () => {
    const base = getScenario(DEMO_SCENARIO_ID);
    if (!base) return;
    const sc = applyPace(base, 'easy');
    const snap = startScenario(sc);
    setPace('easy');
    setSpeedMul(0.5);
    setScenario(sc);
    setEngine({ ...snap, toast: DEMO_TOAST });
    setSelectedId(null);
    setStats(null);
    setTutorialOpen(false);
    setDemoOpen(true);
    setRunning(false);
    setScreen('board');
  };

  const selectDemoWaiter = useCallback(() => {
    const en = engineRef.current;
    if (!en) return;
    const waiter =
      en.board.jobs.find(
        (j) => j.markers?.includes('W') && j.waiterTimerMin != null,
      ) ?? en.board.jobs.find((j) => j.markers?.includes('W'));
    if (waiter) setSelectedId(waiter.id);
  }, []);

  const openTutorial = () => {
    setTutorialMarkSeen(false);
    setRunning(false);
    setTutorialOpen(true);
  };

  const openDemoFromBoard = () => {
    setRunning(false);
    setSpeedMul(0.5);
    setEngine((prev) => (prev ? { ...prev, toast: DEMO_TOAST } : prev));
    setDemoOpen(true);
  };

  const closeTutorial = () => {
    setTutorialOpen(false);
    setTutorialMarkSeen(false);
    if (demoOpen) return;
    if (screen === 'board' && scenario && engine) {
      setRunning(true);
    }
  };

  const closeDemoSkip = () => {
    setDemoOpen(false);
    setRunning(false);
    setScreen('home');
    setScenario(null);
    setEngine(null);
    setSelectedId(null);
  };

  const closeDemoPlay = () => {
    setDemoOpen(false);
    setSpeedMul(1);
    setEngine((prev) => (prev ? { ...prev, toast: null } : prev));
    setRunning(true);
  };

  const closeDemoHome = () => {
    setDemoOpen(false);
    setRunning(false);
    setScreen('home');
    setScenario(null);
    setEngine(null);
    setSelectedId(null);
  };

  const onMove = (jobId: string, column: BoardColumnId) => {
    setEngine((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        board: moveJob(prev.board, jobId, column, Math.floor(prev.simMin)),
      };
    });
  };

  const onClearBlocker = (jobId: string) => {
    setEngine((prev) => {
      if (!prev) return prev;
      let board = clearFlag(prev.board, jobId, 'blocked');
      board = clearFlag(board, jobId, 'waiting');
      return { ...prev, board, toast: 'Blocker cleared — keep the car moving.' };
    });
  };

  const onAnswerDelivered = (jobId: string) => {
    setEngine((prev) => {
      if (!prev) return prev;
      const board = markAnswerDelivered(
        prev.board,
        jobId,
        Math.floor(prev.simMin),
      );
      return {
        ...prev,
        board,
        toast: 'Answer delivered — speed-zone clock stopped for that car.',
      };
    });
  };

  const onMarkInspectionComplete = (jobId: string) => {
    setEngine((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        board: markInspectionComplete(prev.board, jobId),
        toast: 'Inspection complete — proposed repairs ready for the advisor.',
      };
    });
  };

  const onApproveAllPending = (jobId: string) => {
    setEngine((prev) => {
      if (!prev) return prev;
      const sim = Math.floor(prev.simMin);
      return {
        ...prev,
        board: approveAllPending(prev.board, jobId, sim),
        toast: 'Customer approved pending lines.',
      };
    });
  };

  const onApproveLine = (jobId: string, lineId: string) => {
    setEngine((prev) => {
      if (!prev) return prev;
      const sim = Math.floor(prev.simMin);
      return {
        ...prev,
        board: approveLine(prev.board, jobId, lineId, sim),
        toast: 'Line approved.',
      };
    });
  };

  const onMarkPartsOrdered = (jobId: string, lineId: string) => {
    setEngine((prev) => {
      if (!prev) return prev;
      const sim = Math.floor(prev.simMin);
      return {
        ...prev,
        board: markPartsOrdered(prev.board, jobId, lineId, sim, 30),
        toast: 'Parts ordered — ETA +30 sim minutes.',
      };
    });
  };

  const onMarkLineDone = (jobId: string, lineId: string) => {
    setEngine((prev) => {
      if (!prev) return prev;
      const sim = Math.floor(prev.simMin);
      return {
        ...prev,
        board: markLineDone(prev.board, jobId, lineId, sim),
        toast: 'Repair line marked done.',
      };
    });
  };

  const onMarkLineInRepair = (jobId: string, lineId: string) => {
    setEngine((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        board: markLineInRepair(prev.board, jobId, lineId),
        toast: 'Line moved to in repair.',
      };
    });
  };

  if (screen === 'home') {
    return <Home onStart={begin} onWatchDemo={beginDecisionDemo} />;
  }

  if (screen === 'debrief' && scenario && stats && engine) {
    return (
      <Debrief
        scenario={scenario}
        stats={stats}
        fired={engine.fired}
        pace={pace}
        speedMul={speedMul}
        onAgain={() => begin(scenario.id, pace)}
        onHome={() => {
          setScreen('home');
          setScenario(null);
          setEngine(null);
          setRunning(false);
        }}
      />
    );
  }

  if (screen === 'board' && scenario && engine) {
    return (
      <>
        <BoardView
          scenario={scenario}
          board={engine.board}
          simMin={engine.simMin}
          running={running}
          toast={engine.toast}
          fired={engine.fired}
          selectedId={selectedId}
          speedMul={speedMul}
          onSpeedMul={setSpeedMul}
          onSelect={setSelectedId}
          onMove={onMove}
          onClearBlocker={onClearBlocker}
          onAnswerDelivered={onAnswerDelivered}
          onMarkInspectionComplete={onMarkInspectionComplete}
          onApproveAllPending={onApproveAllPending}
          onApproveLine={onApproveLine}
          onMarkPartsOrdered={onMarkPartsOrdered}
          onMarkLineDone={onMarkLineDone}
          onMarkLineInRepair={onMarkLineInRepair}
          onTogglePause={() => setRunning((r) => !r)}
          onEnd={finish}
          onDismissToast={() =>
            setEngine((prev) => (prev ? { ...prev, toast: null } : prev))
          }
          onHome={() => {
            setRunning(false);
            setDemoOpen(false);
            setScreen('home');
            setScenario(null);
            setEngine(null);
          }}
          onOpenTutorial={openTutorial}
          onOpenDemo={openDemoFromBoard}
          demoMode={demoOpen}
        />
        <Tutorial
          open={tutorialOpen}
          onClose={closeTutorial}
          markSeen={tutorialMarkSeen}
        />
        <DecisionDemo
          open={demoOpen}
          onSelectWaiter={selectDemoWaiter}
          onFinishPlay={closeDemoPlay}
          onFinishHome={closeDemoHome}
          onSkip={closeDemoSkip}
        />
      </>
    );
  }

  return <Home onStart={begin} onWatchDemo={beginDecisionDemo} />;
}
