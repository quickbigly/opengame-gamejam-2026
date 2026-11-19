// Payout formula from docs/design.md §7. Shown to players in the Notebook.

export const BASE_PAY = { 1: 20, 2: 35, 3: 50, 4: 80 } as const;

export interface JobResult {
  tier: keyof typeof BASE_PAY;
  wastedActions: number;
  harmfulActions: number;
  usedHint: boolean;
  /** Minutes finished before the caller's deadline (negative = late). */
  minutesEarly: number;
  deadlineWindow: number;
  streak: number; // consecutive clean fixes before this one
  bonusFix: number;
}

export function isClean(r: Pick<JobResult, 'wastedActions' | 'harmfulActions' | 'usedHint'>): boolean {
  return r.wastedActions === 0 && r.harmfulActions === 0 && !r.usedHint;
}

export function cleanMult(r: JobResult): number {
  let m = r.harmfulActions > 0 || r.wastedActions > 2 ? 0.8 : r.wastedActions > 0 ? 1.0 : 1.5;
  if (r.usedHint) m *= 0.5;
  return m;
}

export function onTimeBonus(r: JobResult): number {
  if (r.minutesEarly <= 0 || r.deadlineWindow <= 0) return 0;
  return 0.5 * Math.min(1, r.minutesEarly / r.deadlineWindow);
}

export function streakBonus(streak: number): number {
  return Math.min(0.5, 0.1 * Math.max(0, streak));
}

export function payout(r: JobResult): number {
  const raw = BASE_PAY[r.tier] * cleanMult(r) * (1 + onTimeBonus(r)) * (1 + streakBonus(r.streak)) + r.bonusFix;
  return Math.round(raw);
}
