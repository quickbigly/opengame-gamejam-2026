import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JobState } from '../engine/job';
import type { Route } from '../engine/night';
import { solveNight } from '../engine/solver';
import { nightEnd } from '../engine/upgrades';
import { FAULTS_BY_ID } from '../content/faults';
import { ITEMS, KIT } from '../content/items';
import { NEIGHBORS } from '../content/neighbors';
import { NIGHTS } from '../content/nights';
import { TOWN } from '../content/town';
import {
  buyUpgrade, callAt, drive, endNight, finishJob, isLastNight, isNightOver, newRun, openJob, startNight, wait, type RunState,
} from '../game/run';
import { HouseScreen, type ToolboxEntry } from './HouseScreen';
import { MapScreen } from './MapScreen';
import { Notebook } from './Notebook';
import { DispatchScreen, EndingScreen, NightReport, ResultScreen, ShopScreen, TitleScreen } from './screens';
import { clearSave, loadBest, loadSave, recordBest, writeSave } from './storage';

type Screen =
  | { kind: 'title' }
  | { kind: 'dispatch' }
  | { kind: 'map' }
  /** startClock: the night clock when job.minutes was 0, so clock = startClock + job.minutes. */
  | { kind: 'house'; callId: string; startClock: number }
  | { kind: 'result'; callId: string }
  | { kind: 'report' }
  | { kind: 'shop' }
  | { kind: 'end'; newBest: boolean };

/** Dev only: `?fault=f07` opens any fault directly; `?night=3` starts that night. */
function devStart(): { run: RunState; screen: Screen } | null {
  if (!import.meta.env.DEV) return null;
  const q = new URLSearchParams(window.location.search);
  const id = q.get('fault');
  if (id && FAULTS_BY_ID[id]) {
    const night = { ...NIGHTS[0], calls: [{ id: 'dev', fault: id, place: 'shop', calledAt: 0, deadline: 120 }] };
    const { run } = openJob(newRun(night), night.calls[0]);
    return { run, screen: { kind: 'house', callId: 'dev', startClock: 0 } };
  }
  const n = Number(q.get('night'));
  if (n >= 1 && n <= NIGHTS.length) {
    const callbacks = q.has('callbacks') ? NIGHTS.flatMap((d) => d.calls.map((c) => c.id)) : [];
    return { run: startNight({ ...newRun(), coins: 200, earned: 200, callbacks }, n - 1), screen: { kind: 'dispatch' } };
  }
  return null;
}

export function App() {
  const [dev] = useState(devStart);
  const [screen, setScreen] = useState<Screen>(dev?.screen ?? { kind: 'title' });
  const [run, setRun] = useState<RunState>(() => dev?.run ?? newRun());
  const [saved, setSaved] = useState(loadSave);
  const [best, setBest] = useState(loadBest);
  const [notebook, setNotebook] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const end = nightEnd(run.upgrades);

  // Par is only needed for the Night Report, and Night 3 can take half a second to solve.
  const wantPar = screen.kind === 'report';
  const par = useMemo(
    () => (wantPar ? solveNight(run.night, TOWN, FAULTS_BY_ID, { up: run.upgrades }) : null),
    [wantPar, run.night, run.upgrades],
  );

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  /** Moves the clock and announces calls that came in meanwhile. */
  const advance = useCallback((before: RunState, after: RunState) => {
    const fresh = after.night.calls.filter((c) => c.calledAt > before.clock && c.calledAt <= after.clock);
    if (fresh.length) setToast(`📞 New call: ${fresh.map((c) => NEIGHBORS[FAULTS_BY_ID[c.fault].caller].name).join(', ')}`);
    setRun(after);
    return after;
  }, []);

  const toMap = useCallback((r: RunState) => {
    setScreen(isNightOver(r) ? { kind: 'report' } : { kind: 'map' });
  }, []);

  const enterHouse = useCallback(
    (r: RunState) => {
      const call = callAt(r, r.location);
      if (!call) return toMap(r);
      const { run: next, job } = openJob(r, call);
      setRun(next);
      setScreen({ kind: 'house', callId: call.id, startClock: next.clock - job.minutes });
    },
    [toMap],
  );

  const onDrive = (route: Route) => {
    const after = advance(run, drive(run, route));
    if (callAt(after, after.location)) enterHouse(after);
    else toMap(after);
  };

  const onWait = useCallback(
    (minutes: number) => {
      const after = advance(run, wait(run, Math.min(minutes, end - run.clock)));
      toMap(after);
    },
    [run, end, advance, toMap],
  );

  const beginNight = (r: RunState) => {
    writeSave(r);
    setSaved(r);
    setRun(r);
    setScreen({ kind: 'dispatch' });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && screen.kind !== 'title') {
        e.preventDefault();
        setNotebook((n) => !n);
      } else if (notebook) {
        // The notebook pauses the game: no waiting or undoing behind it.
        e.stopImmediatePropagation();
        if (e.key === 'Escape') setNotebook(false);
      } else if (e.key === ' ' && screen.kind === 'map') {
        e.preventDefault();
        onWait(15);
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [screen.kind, notebook, onWait]);

  let body;
  switch (screen.kind) {
    case 'title':
      body = (
        <TitleScreen
          saved={saved}
          best={best}
          onNew={() => beginNight(newRun())}
          onContinue={() => saved && beginNight(saved)}
        />
      );
      break;
    case 'dispatch':
      body = <DispatchScreen run={run} onNext={() => setScreen({ kind: 'map' })} />;
      break;
    case 'map':
      body = (
        <MapScreen
          run={run}
          toast={toast}
          onDrive={onDrive}
          onWait={onWait}
          onEnter={() => enterHouse(run)}
          onEndNight={() => setScreen({ kind: 'report' })}
          onNotebook={() => setNotebook(true)}
        />
      );
      break;
    case 'house': {
      const call = run.night.calls.find((c) => c.id === screen.callId)!;
      const job = run.jobs[call.id];
      const fault = job.fault;
      const toolbox: ToolboxEntry[] = [
        ...KIT.map((id) => ({ item: ITEMS[id], source: 'kit' as const })),
        ...(fault.houseItems ?? []).map((id) => ({ item: ITEMS[id], source: 'house' as const })),
      ];
      const setJob = (j: JobState) => setRun((r) => ({ ...r, jobs: { ...r.jobs, [call.id]: j } }));
      const clockNow = screen.startClock + job.minutes;
      body = (
        <HouseScreen
          key={call.id}
          call={call}
          placeName={TOWN.places[call.place].name}
          startClock={screen.startClock}
          coins={run.coins}
          upgrades={run.upgrades}
          job={job}
          setJob={setJob}
          toolbox={toolbox}
          onWrapUp={() => {
            advance(run, finishJob(run, call, job, clockNow));
            setScreen({ kind: 'result', callId: call.id });
          }}
          onLeave={() => toMap(advance(run, { ...run, clock: clockNow }))}
          onNotebook={() => setNotebook(true)}
        />
      );
      break;
    }
    case 'result':
      body = (
        <ResultScreen
          o={run.outcomes[screen.callId]}
          call={run.night.calls.find((c) => c.id === screen.callId)!}
          coins={run.coins}
          onNext={() => toMap(run)}
        />
      );
      break;
    case 'report':
      body = par && (
        <NightReport
          run={run}
          par={par}
          onNext={() => {
            const after = endNight(run, par.score);
            setRun(after);
            if (isLastNight(after)) {
              clearSave();
              setSaved(null);
              const newBest = recordBest(after);
              setBest(loadBest());
              setScreen({ kind: 'end', newBest });
            } else {
              setScreen({ kind: 'shop' });
            }
          }}
        />
      );
      break;
    case 'shop':
      body = (
        <ShopScreen
          run={run}
          onBuy={(id) => setRun((r) => buyUpgrade(r, id))}
          onNext={() => beginNight(startNight(run, run.nightIndex + 1))}
        />
      );
      break;
    case 'end':
      body = <EndingScreen run={run} newBest={screen.newBest} onAgain={() => setScreen({ kind: 'title' })} />;
      break;
  }

  return (
    <>
      {body}
      {notebook && <Notebook tips={run.tips} upgrades={run.upgrades} onClose={() => setNotebook(false)} />}
    </>
  );
}
