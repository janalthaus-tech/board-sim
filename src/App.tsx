import { useCallback, useEffect, useRef, useState } from 'react';
import { BoardView } from './components/BoardView';
import { Debrief } from './components/Debrief';
import { Home } from './components/Home';
import { hasSeenTutorial, Tutorial } from './components/Tutorial';
import {
  clearFlag,
  computeDebrief,
  getScenario,
  markAnswerDelivered,
  moveJob,
  startScenario,
  tickEngine,
  type AppScreen,
  type BoardColumnId,
  type DebriefStats,
  type EngineSnapshot,
  type Scenario,
} from './model';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [engine, setEngine] = useState<EngineSnapshot | null>(null);
  const [running, setRunning] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stats, setStats] = useState<DebriefStats | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialMarkSeen, setTutorialMarkSeen] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const engineRef = useRef(engine);
  const scenarioRef = useRef(scenario);
  const runningRef = useRef(running);

  engineRef.current = engine;
  scenarioRef.current = scenario;
  runningRef.current = running;

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
      const rate = 1 / sc.realSecondsPerSimMin;
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

  const begin = (scenarioId: string) => {
    const sc = getScenario(scenarioId);
    if (!sc) return;
    const snap = startScenario(sc);
    setScenario(sc);
    setEngine(snap);
    setSelectedId(null);
    setStats(null);
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

  const openTutorial = () => {
    setTutorialMarkSeen(false);
    setRunning(false);
    setTutorialOpen(true);
  };

  const closeTutorial = () => {
    setTutorialOpen(false);
    setTutorialMarkSeen(false);
    if (screen === 'board' && scenario && engine && !engine.simMin) {
      // Resume after first-run tutorial (or reopen at start)
      setRunning(true);
    } else if (screen === 'board') {
      setRunning(true);
    }
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

  if (screen === 'home') {
    return <Home onStart={begin} />;
  }

  if (screen === 'debrief' && scenario && stats && engine) {
    return (
      <Debrief
        scenario={scenario}
        stats={stats}
        fired={engine.fired}
        onAgain={() => begin(scenario.id)}
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
          onSelect={setSelectedId}
          onMove={onMove}
          onClearBlocker={onClearBlocker}
          onAnswerDelivered={onAnswerDelivered}
          onTogglePause={() => setRunning((r) => !r)}
          onEnd={finish}
          onDismissToast={() =>
            setEngine((prev) => (prev ? { ...prev, toast: null } : prev))
          }
          onHome={() => {
            setRunning(false);
            setScreen('home');
            setScenario(null);
            setEngine(null);
          }}
          onOpenTutorial={openTutorial}
        />
        <Tutorial
          open={tutorialOpen}
          onClose={closeTutorial}
          markSeen={tutorialMarkSeen}
        />
      </>
    );
  }

  return <Home onStart={begin} />;
}
