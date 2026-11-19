// A single house visit: action history, order detection, undo, hints and the final JobResult.

import { actionCost, applyAction, illegalReason, matches } from './room';
import type { JobResult } from './scoring';
import type { Action, ActionClass, Fault, RoomState } from './types';

export interface HistoryEntry {
  action: Action;
  cls: ActionClass;
  minutes: number;
  message?: string;
  undone?: boolean;
  /** Snapshot for undo. */
  before: { room: RoomState; doneSteps: boolean[]; bonusEarned: boolean };
}

export interface JobState {
  fault: Fault;
  room: RoomState;
  minutes: number;
  history: HistoryEntry[];
  doneSteps: boolean[];
  wasted: number;
  harmful: number;
  usedHint: boolean;
  bonusEarned: boolean;
  goalMet: boolean;
}

export function startJob(fault: Fault): JobState {
  const room = fault.setup();
  return {
    fault,
    room,
    minutes: 0,
    history: [],
    doneSteps: fault.optimal.map(() => false),
    wasted: 0,
    harmful: 0,
    usedHint: false,
    bonusEarned: false,
    goalMet: fault.goal(room),
  };
}

export type ActResult = { ok: true; job: JobState; entry: HistoryEntry } | { ok: false; reason: string };

export function act(job: JobState, action: Action, opts: { askCost?: number } = {}): ActResult {
  const { fault } = job;
  const reason = illegalReason(fault, job.room, action);
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
  const doneSteps = [...job.doneSteps];
  let bonusEarned = job.bonusEarned;
  let { wasted, harmful } = job;
  let cls: ActionClass;
  let message: string | undefined;

  const harm = fault.harmful?.find((h) => matches(h.pattern, action, before));
  const stepIdx = fault.optimal.findIndex((st, i) => !doneSteps[i] && matches(st.pattern, action, before));

  if (harm) {
    cls = 'harmful';
    room = harm.effect(room);
    message = harm.message;
    harmful++;
  } else if (fault.bonus && !bonusEarned && matches(fault.bonus.pattern, action, before)) {
    cls = 'bonus';
    bonusEarned = true;
    message = fault.bonus.message;
  } else if (stepIdx >= 0) {
    cls = 'optimal';
    doneSteps[stepIdx] = true;
  } else if (action.type === 'inspect' || action.type === 'ask') {
    cls = 'info';
  } else {
    cls = 'wasted';
    wasted++;
  }

  const minutes = action.type === 'ask' && opts.askCost !== undefined ? opts.askCost : actionCost(action);
  const entry: HistoryEntry = { action, cls, minutes, message, before: { room: before, doneSteps: job.doneSteps, bonusEarned: job.bonusEarned } };
  return {
    ok: true,
    entry,
    job: {
      ...job,
      room,
      minutes: job.minutes + minutes,
      history: [...job.history, entry],
      doneSteps,
      wasted,
      harmful,
      bonusEarned,
      goalMet: fault.goal(room),
    },
  };
}

/** Reverts the last action. Undo is never free: it costs the undone action's minutes again. */
/** Wasted/harmful counts stay: undoing a mistake doesn't make the fix clean again. */
export function undo(job: JobState): JobState | null {
  const idx = job.history.findLastIndex((e) => !e.undone);
  if (idx < 0) return null;
  const last = job.history[idx];
  const { room, doneSteps, bonusEarned } = last.before;
  const history = [...job.history];
  history[idx] = { ...last, undone: true };
  return {
    ...job,
    room,
    doneSteps,
    bonusEarned,
    minutes: job.minutes + last.minutes,
    history,
    goalMet: job.fault.goal(room),
  };
}

/** "Call a Friend": the next step of the par solution. Halves the tip. */
export function takeHint(job: JobState): { job: JobState; hint: string } {
  const i = job.doneSteps.findIndex((d) => !d);
  const hint = i >= 0 ? job.fault.optimal[i].hint : "It should be working now. Try wrapping up the job.";
  return { job: { ...job, usedHint: true }, hint };
}

/** Par minutes = the cost of the optimal sequence. */
export function parMinutes(fault: Fault): number {
  return fault.optimal.reduce((sum, st) => sum + actionCost(st.pattern as Action), 0);
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
