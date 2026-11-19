// State for a whole run: three nights, the shop between them, and the festival at the end.
// Pure functions; the UI holds the state. See design §4, §7, §8 and §9.

import { FAULTS_BY_ID } from '../content/faults';
import { NIGHTS } from '../content/nights';
import { jobResult, parMinutes, startJob, type JobState } from '../engine/job';
import { NIGHT_MINUTES, callsFor, type Call, type NightDef, type Route } from '../engine/night';
import { isClean, payout, type JobResult } from '../engine/scoring';
import type { Fault } from '../engine/types';
import { UPGRADES_BY_ID, nightEnd, type UpgradeId, type Upgrades } from '../engine/upgrades';

/** Added to the run score when the festival screen is fixed before midnight on the last night. */
export const FESTIVAL_BONUS = 150;

export interface JobOutcome {
  callId: string;
  fault: Fault;
  result: JobResult;
  pay: number;
  /** A callback: fixed for free. */
  free: boolean;
  finishedAt: number;
  minutes: number;
  par: number;
  newTip: boolean;
}

export interface NightRecord {
  number: number;
  tips: number;
  par: number;
  done: number;
  total: number;
  stars: [boolean, boolean, boolean];
}

export interface RunState {
  /** Index into NIGHTS. */
  nightIndex: number;
  /** Tonight's schedule, with callbacks from earlier nights resolved. */
  night: NightDef;
  clock: number;
  location: string;
  /** Coins in the till. Parts are free; coins only buy upgrades between nights. */
  coins: number;
  /** Every tip earned this run, whatever was spent. The run score is built on this. */
  earned: number;
  streak: number;
  jobs: Record<string, JobState>;
  outcomes: Record<string, JobOutcome>;
  tips: string[];
  /** Ids of calls that left a problem behind; their callbacks come in on a later night. */
  callbacks: string[];
  upgrades: Upgrades;
  nights: NightRecord[];
  /** The festival screen was fixed in time. */
  festival: boolean;
}

/** A fresh run on Night 1, or on a given schedule (dev and tests). */
export function newRun(night: NightDef = NIGHTS[0], tips: string[] = []): RunState {
  const base: RunState = {
    nightIndex: 0,
    night,
    clock: 0,
    location: 'shop',
    coins: 0,
    earned: 0,
    streak: 0,
    jobs: {},
    outcomes: {},
    tips,
    callbacks: [],
    upgrades: {},
    nights: [],
    festival: false,
  };
  const index = NIGHTS.indexOf(night);
  return index >= 0 ? startNight(base, index) : base;
}

/** 6:00 PM at the workshop. Coins, tips, upgrades and callbacks carry over; the streak doesn't. */
export function startNight(run: RunState, index: number): RunState {
  const def = NIGHTS[index];
  return {
    ...run,
    nightIndex: index,
    night: { ...def, calls: callsFor(def, run.callbacks) },
    clock: 0,
    location: 'shop',
    streak: 0,
    jobs: {},
    outcomes: {},
  };
}

export function isLastNight(run: RunState): boolean {
  return run.nightIndex >= NIGHTS.length - 1;
}

/** The route's arrival time already includes any wait before leaving. */
export function drive(run: RunState, route: Route): RunState {
  return { ...run, clock: route.arrive, location: route.places[route.places.length - 1] };
}

export function wait(run: RunState, minutes: number): RunState {
  return { ...run, clock: run.clock + minutes };
}

export function callAt(run: RunState, place: string): Call | undefined {
  return run.night.calls.find((c) => c.place === place && c.calledAt <= run.clock && !run.outcomes[c.id]);
}

export function callText(call: Call): string {
  return call.callText ?? FAULTS_BY_ID[call.fault].call.text;
}

export function openJob(run: RunState, call: Call): { run: RunState; job: JobState } {
  const job = run.jobs[call.id] ?? startJob(FAULTS_BY_ID[call.fault]);
  return { run: { ...run, jobs: { ...run.jobs, [call.id]: job } }, job };
}

export function finishJob(run: RunState, call: Call, job: JobState, finishedAt: number): RunState {
  const result = jobResult(job, {
    finishedAt,
    deadline: call.deadline,
    window: call.deadline - call.calledAt,
    streak: run.streak,
  });
  const free = !!call.callbackOf;
  const pay = free ? 0 : payout(result);
  const fault = job.fault;
  const newTip = !run.tips.includes(fault.tipCard);
  const outcome: JobOutcome = { callId: call.id, fault, result, pay, free, finishedAt, minutes: job.minutes, par: parMinutes(fault), newTip };
  // A callback never calls back again.
  const leavesProblem =
    !free && ((!!fault.bonus?.preventsCallback && !job.bonusEarned) || !!fault.callbackIf?.(job.room));
  return {
    ...run,
    clock: finishedAt,
    coins: run.coins + pay,
    earned: run.earned + pay,
    streak: isClean(result) ? run.streak + 1 : 0,
    tips: newTip ? [...run.tips, fault.tipCard] : run.tips,
    outcomes: { ...run.outcomes, [call.id]: outcome },
    callbacks: leavesProblem ? [...run.callbacks, call.id] : run.callbacks,
    festival: run.festival || (!!call.finale && finishedAt <= NIGHT_MINUTES),
  };
}

export function isNightOver(run: RunState): boolean {
  return run.clock >= nightEnd(run.upgrades) || run.night.calls.every((c) => run.outcomes[c.id]);
}

export interface NightSummary {
  tips: number;
  done: number;
  total: number;
  par: number;
  stars: [boolean, boolean, boolean];
}

export function summarize(run: RunState, par: number): NightSummary {
  const outcomes = Object.values(run.outcomes);
  const tips = outcomes.reduce((n, o) => n + o.pay, 0);
  const done = outcomes.length;
  const total = run.night.calls.length;
  return {
    tips,
    done,
    total,
    par,
    stars: [done === total, tips >= 0.7 * par, tips >= 0.95 * par],
  };
}

/** Files tonight's report. Call once, when the Night Report is dismissed. */
export function endNight(run: RunState, par: number): RunState {
  const s = summarize(run, par);
  const record: NightRecord = { number: run.night.number, tips: s.tips, par, done: s.done, total: s.total, stars: s.stars };
  return { ...run, nights: [...run.nights, record] };
}

export function canBuy(run: RunState, id: UpgradeId): boolean {
  return !run.upgrades[id] && run.coins >= UPGRADES_BY_ID[id].cost;
}

export function buyUpgrade(run: RunState, id: UpgradeId): RunState {
  if (!canBuy(run, id)) return run;
  return { ...run, coins: run.coins - UPGRADES_BY_ID[id].cost, upgrades: { ...run.upgrades, [id]: true } };
}

export function runScore(run: RunState): number {
  return run.earned + (run.festival ? FESTIVAL_BONUS : 0);
}

export function totalStars(run: RunState): number {
  return run.nights.reduce((n, r) => n + r.stars.filter(Boolean).length, 0);
}

// ---- Save (between nights only: a saved run restarts its night at 6:00 PM) ----

export interface SaveData {
  v: 1;
  nightIndex: number;
  coins: number;
  earned: number;
  tips: string[];
  callbacks: string[];
  upgrades: Upgrades;
  nights: NightRecord[];
  festival: boolean;
}

export function toSave(run: RunState): SaveData {
  const { nightIndex, coins, earned, tips, callbacks, upgrades, nights, festival } = run;
  return { v: 1, nightIndex, coins, earned, tips, callbacks, upgrades, nights, festival };
}

export function fromSave(d: SaveData): RunState | null {
  if (d?.v !== 1 || !NIGHTS[d.nightIndex]) return null;
  const { v: _v, nightIndex, ...rest } = d;
  return startNight({ ...newRun(), ...rest }, nightIndex);
}
