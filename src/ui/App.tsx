import { useEffect, useState } from 'react';
import { jobResult, parMinutes, startJob, type JobState } from '../engine/job';
import { isClean, payout } from '../engine/scoring';
import { SLICE_JOBS } from '../content/slice';
import { HouseScreen } from './HouseScreen';
import { Notebook } from './Notebook';
import { CallScreen, EndScreen, ResultScreen, TitleScreen, type JobOutcome } from './screens';

type Screen =
  | { kind: 'title' }
  | { kind: 'call'; index: number }
  | { kind: 'house'; index: number; arrivedAt: number }
  | { kind: 'result'; index: number }
  | { kind: 'end' };

interface Run {
  clock: number; // game minutes after 6:00 PM
  coins: number;
  streak: number;
  tips: string[];
  outcomes: JobOutcome[];
}

const NEW_RUN: Run = { clock: 0, coins: 0, streak: 0, tips: [], outcomes: [] };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'title' });
  const [run, setRun] = useState<Run>(NEW_RUN);
  const [job, setJob] = useState<JobState | null>(null);
  const [notebook, setNotebook] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && screen.kind !== 'title') {
        e.preventDefault();
        setNotebook((n) => !n);
      } else if (notebook) {
        // The notebook pauses the house: no waiting or undoing behind it.
        e.stopImmediatePropagation();
        if (e.key === 'Escape') setNotebook(false);
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [screen.kind, notebook]);

  const wrapUp = (index: number, arrivedAt: number) => {
    if (!job) return;
    const sj = SLICE_JOBS[index];
    const finishedAt = arrivedAt + job.minutes;
    const result = jobResult(job, {
      finishedAt,
      deadline: sj.deadline,
      window: sj.deadline - sj.calledAt,
      streak: run.streak,
    });
    const pay = payout(result);
    const newTip = !run.tips.includes(sj.fault.tipCard);
    setRun({
      clock: finishedAt,
      coins: run.coins + pay,
      streak: isClean(result) ? run.streak + 1 : 0,
      tips: newTip ? [...run.tips, sj.fault.tipCard] : run.tips,
      outcomes: [...run.outcomes, { fault: sj.fault, result, pay, finishedAt, minutes: job.minutes, par: parMinutes(sj.fault), newTip }],
    });
    setJob(null);
    setScreen({ kind: 'result', index });
  };

  let body;
  switch (screen.kind) {
    case 'title':
      body = (
        <TitleScreen
          onStart={() => {
            setRun(NEW_RUN);
            setScreen({ kind: 'call', index: 0 });
          }}
        />
      );
      break;
    case 'call': {
      const sj = SLICE_JOBS[screen.index];
      body = (
        <CallScreen
          sj={sj}
          now={run.clock}
          onGo={() => {
            setJob(startJob(sj.fault));
            setScreen({ kind: 'house', index: screen.index, arrivedAt: run.clock + sj.travel });
          }}
        />
      );
      break;
    }
    case 'house':
      body = job && (
        <HouseScreen
          key={screen.index}
          sj={SLICE_JOBS[screen.index]}
          arrivedAt={screen.arrivedAt}
          coins={run.coins}
          job={job}
          setJob={setJob}
          onWrapUp={() => wrapUp(screen.index, screen.arrivedAt)}
          onNotebook={() => setNotebook(true)}
        />
      );
      break;
    case 'result': {
      const last = screen.index === SLICE_JOBS.length - 1;
      body = (
        <ResultScreen
          o={run.outcomes[run.outcomes.length - 1]}
          coins={run.coins}
          last={last}
          onNext={() => setScreen(last ? { kind: 'end' } : { kind: 'call', index: screen.index + 1 })}
        />
      );
      break;
    }
    case 'end':
      body = <EndScreen outcomes={run.outcomes} coins={run.coins} onAgain={() => setScreen({ kind: 'title' })} />;
      break;
  }

  return (
    <>
      {body}
      {notebook && <Notebook tips={run.tips} onClose={() => setNotebook(false)} />}
    </>
  );
}
