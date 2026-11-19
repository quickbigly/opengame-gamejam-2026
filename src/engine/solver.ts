// Par: the best possible night score (design §7). A search over call order and bonus choices, assuming
// every fix is clean and on par. Also serves as a balance check in tests and in `npm run par`.
//
// It's exact, kept fast by two prunes:
// - Bound: skip a branch when even perfect pay on every call left can't beat the best night found.
// - Dominance: reaching the same place, with the same calls done and the same streak, later and with
//   fewer tips is never better (travel only gets faster when you leave earlier, since you can wait).

import { bonusMinutes, parMinutes } from './job';
import { bestDeparture, type NightDef, type Town } from './night';
import { payout } from './scoring';
import type { Fault } from './types';
import { costOptions, nightEnd, type Upgrades } from './upgrades';

export interface ParStop {
  call: string;
  depart: number;
  arrive: number;
  /** When the job starts: on arrival, or when the call comes in if you got there early. */
  start: number;
  finish: number;
  bonus: boolean;
  pay: number;
}

export interface ParResult {
  score: number;
  stops: ParStop[];
}

const MAX_STREAK = 5; // streakBonus caps at +0.5

export function solveNight(
  night: NightDef,
  town: Town,
  faults: Record<string, Fault>,
  opts: { start?: string; startStreak?: number; up?: Upgrades } = {},
): ParResult {
  const up = opts.up ?? {};
  const end = nightEnd(up);
  const cost = costOptions(up);
  const calls = night.calls;

  const jobs = calls.map((call) => {
    const fault = faults[call.fault];
    const free = !!call.callbackOf;
    const window = call.deadline - call.calledAt;
    const bonusReward = fault.bonus?.reward ?? 0;
    return {
      call,
      fault,
      free,
      window,
      par: parMinutes(fault, cost),
      bonusMin: bonusMinutes(fault, cost),
      bonusChoices: fault.bonus && !free ? [true, false] : [false],
      maxPay: free ? 0 : payout({ tier: fault.tier, wastedActions: 0, harmfulActions: 0, usedHint: false, minutesEarly: window, deadlineWindow: window, streak: MAX_STREAK, bonusFix: bonusReward }),
    };
  });

  const routes = new Map<string, ReturnType<typeof bestDeparture>>();
  const route = (from: string, to: string, t: number) => {
    const key = `${from}|${to}|${t}`;
    if (!routes.has(key)) routes.set(key, bestDeparture(town, night.snow, from, to, t, up));
    return routes.get(key)!;
  };

  let best: ParResult = { score: 0, stops: [] };
  const seen = new Map<string, [number, number][]>();

  const visit = (place: string, t: number, streak: number, mask: number, stops: ParStop[], score: number) => {
    // Ties go to the night that answers more calls (callbacks pay nothing but still count).
    if (score > best.score || (score === best.score && stops.length > best.stops.length)) best = { score, stops };

    const key = `${mask}|${place}|${Math.min(streak, MAX_STREAK)}`;
    const front = seen.get(key) ?? [];
    if (front.some(([t2, s2]) => t2 <= t && s2 >= score)) return;
    front.push([t, score]);
    seen.set(key, front);

    let bound = score;
    jobs.forEach((j, i) => {
      if (!(mask & (1 << i))) bound += j.maxPay;
    });
    if (bound < best.score) return;

    jobs.forEach((j, i) => {
      if (mask & (1 << i)) return;
      const dep = route(place, j.call.place, t);
      if (!dep) return;
      const start = Math.max(dep.route.arrive, j.call.calledAt);
      if (start >= end) return;
      for (const bonus of j.bonusChoices) {
        const finish = start + j.par + (bonus ? j.bonusMin : 0);
        const pay = j.free
          ? 0
          : payout({
              tier: j.fault.tier,
              wastedActions: 0,
              harmfulActions: 0,
              usedHint: false,
              minutesEarly: j.call.deadline - finish,
              deadlineWindow: j.window,
              streak,
              bonusFix: bonus ? j.fault.bonus!.reward : 0,
            });
        const stop: ParStop = { call: j.call.id, depart: dep.depart, arrive: dep.route.arrive, start, finish, bonus, pay };
        visit(j.call.place, finish, streak + 1, mask | (1 << i), [...stops, stop], score + pay);
      }
    });
  };

  visit(opts.start ?? 'shop', 0, opts.startStreak ?? 0, 0, [], 0);
  return best;
}

/** True if a perfect player could answer every call in `calls` before the night ends. */
export function canAnswerAll(night: NightDef, town: Town, faults: Record<string, Fault>, up: Upgrades = {}): boolean {
  // Pay every call the same so the solver's only goal is to fit them all in.
  const flat = { ...night, calls: night.calls.map((c) => ({ ...c, callbackOf: undefined })) };
  return solveNight(flat, town, faults, { up }).stops.length === night.calls.length;
}
