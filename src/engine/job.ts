// A single house visit: action history, order detection, undo, hints and the final JobResult.

import { actionCost, applyAction, illegalReason, matches, type CostOptions } from './room';
import type { JobResult } from './scoring';
import type { Action, ActionClass, Fault, OptimalStep, RoomState } from './types';

/** progress[path][step]: which steps of each clean solution are done. Path 0 is the par solution. */
type Progress = boolean[][];

export interface HistoryEntry {
  action: Action;
  cls: ActionClass;
  minutes: number;
  message?: string;
  undone?: boolean;
  /** Snapshot for undo. */
  before: { room: RoomState; progress: Progress; bonusEarned: boolean };
}

export interface JobState {
  fault: Fault;
  room: RoomState;
  minutes: number;
  history: HistoryEntry[];
  progress: Progress;
  wasted: number;
  harmful: number;
  usedHint: boolean;
  bonusEarned: boolean;
  goalMet: boolean;
}

export function solutions(fault: Fault): OptimalStep[][] {
  return [fault.optimal, ...(fault.alternatives ?? [])];
}

export function startJob(fault: Fault): JobState {
  const room = fault.setup();
  return {
    fault,
    room,
    minutes: 0,
    history: [],
    progress: solutions(fault).map((p) => p.map(() => false)),
    wasted: 0,
    harmful: 0,
    usedHint: false,
    bonusEarned: false,
    goalMet: fault.goal(room),
  };
}

export type ActResult = { ok: true; job: JobState; entry: HistoryEntry } | { ok: false; reason: string };

export interface ActOptions extends CostOptions {
  /** Items at hand (kit plus house items). Omit to allow every item. */
  available?: string[];
}

export function act(job: JobState, action: Action, opts: ActOptions = {}): ActResult {
  const { fault } = job;
  const reason = illegalReason(fault, job.room, action, opts.available);
  if (reason) return { ok: false, reason };

  const before = job.room;
  // Re-inspecting something already revealed, or re-asking, is free and not logged.
  if (
    (action.type === 'inspect' && before.flags[`inspected:${action.target}`]) ||
    (action.type === 'ask' && before.flags[`asked:${action.topic}`])
  ) {
    return { ok: false, reason: 'already-known' };
  }

  let room = applyAction(before, action);
  if (fault.rules) room = fault.rules(before, action, room);

  const paths = solutions(fault);
  const progress = job.progress.map((p) => [...p]);
  let matchedStep = false;
  paths.forEach((path, pi) => {
    const si = path.findIndex((st, i) => !progress[pi][i] && matches(st.pattern, action, before));
    if (si >= 0) {
      progress[pi][si] = true;
      matchedStep = true;
    }
  });

  let bonusEarned = job.bonusEarned;
  let { wasted, harmful } = job;
  let cls: ActionClass;
  let message: string | undefined;
  const harm = fault.harmful?.find((h) => matches(h.pattern, action, before));

  if (harm) {
    cls = 'harmful';
    room = harm.effect(room);
    message = harm.message;
    harmful++;
  } else if (fault.bonus && !bonusEarned && matches(fault.bonus.pattern, action, before)) {
    cls = 'bonus';
    bonusEarned = true;
    message = fault.bonus.message;
  } else if (matchedStep) {
    cls = 'optimal';
  } else if (action.type === 'inspect' || action.type === 'ask') {
    cls = 'info';
  } else {
    cls = 'wasted';
    wasted++;
  }
  // A harmful or bonus action never counts as progress.
  const finalProgress = cls === 'optimal' ? progress : job.progress;

  const minutes = actionCost(action, opts);
  const entry: HistoryEntry = {
    action,
    cls,
    minutes,
    message,
    before: { room: before, progress: job.progress, bonusEarned: job.bonusEarned },
  };
  return {
    ok: true,
    entry,
    job: {
      ...job,
      room,
      minutes: job.minutes + minutes,
      history: [...job.history, entry],
      progress: finalProgress,
      wasted,
      harmful,
      bonusEarned,
      goalMet: fault.goal(room),
    },
  };
}

/** Wasted/harmful counts stay: undoing a mistake doesn't make the fix clean again. Undo costs the time again. */
export function undo(job: JobState): JobState | null {
  const idx = job.history.findLastIndex((e) => !e.undone);
  if (idx < 0) return null;
  const last = job.history[idx];
  const { room, progress, bonusEarned } = last.before;
  const history = [...job.history];
  history[idx] = { ...last, undone: true };
  return {
    ...job,
    room,
    progress,
    bonusEarned,
    minutes: job.minutes + last.minutes,
    history,
    goalMet: job.fault.goal(room),
  };
}

/** The solution the player is furthest along (ties go to par), and its next step. */
export function nextStep(job: JobState): OptimalStep | null {
  const paths = solutions(job.fault);
  let best = 0;
  let bestFrac = -1;
  paths.forEach((path, pi) => {
    const frac = job.progress[pi].filter(Boolean).length / path.length;
    if (frac > bestFrac) {
      best = pi;
      bestFrac = frac;
    }
  });
  const i = job.progress[best].findIndex((d) => !d);
  return i >= 0 ? paths[best][i] : null;
}

/** "Call a Friend": the next step of the closest solution. Halves the tip. */
export function takeHint(job: JobState): { job: JobState; hint: string } {
  const step = nextStep(job);
  const hint = job.goalMet || !step ? 'It should be working now. Try wrapping up the job.' : step.hint;
  return { job: { ...job, usedHint: true }, hint };
}

export function pathMinutes(path: OptimalStep[], opts: CostOptions = {}): number {
  return path.reduce((sum, st) => sum + actionCost(st.pattern as unknown as Action, opts), 0);
}

/** Par minutes = the cost of the par solution. */
export function parMinutes(fault: Fault, opts: CostOptions = {}): number {
  return pathMinutes(fault.optimal, opts);
}

export function bonusMinutes(fault: Fault, opts: CostOptions = {}): number {
  return fault.bonus ? actionCost(fault.bonus.pattern as unknown as Action, opts) : 0;
}

export function jobResult(
  job: JobState,
  timing: { finishedAt: number; deadline: number; window: number; streak: number },
): JobResult {
  return {
    tier: job.fault.tier,
    wastedActions: job.wasted,
    harmfulActions: job.harmful,
    usedHint: job.usedHint,
    minutesEarly: timing.deadline - timing.finishedAt,
    deadlineWindow: timing.window,
    streak: timing.streak,
    bonusFix: job.bonusEarned && job.fault.bonus ? job.fault.bonus.reward : 0,
  };
}
