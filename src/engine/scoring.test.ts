import { describe, expect, it } from 'vitest';
import { payout, type JobResult } from './scoring';

const base: JobResult = {
  tier: 2, wastedActions: 0, harmfulActions: 0, usedHint: false,
  minutesEarly: 0, deadlineWindow: 60, streak: 0, bonusFix: 0,
};

describe('payout', () => {
  it('pays 1.5x base for a clean, just-in-time fix', () => {
    expect(payout(base)).toBe(53); // 35 * 1.5 = 52.5 -> 53
  });
  it('halves for a hint', () => {
    expect(payout({ ...base, usedHint: true })).toBe(26); // 35 * 0.75 = 26.25
  });
  it('caps the streak bonus at +50%', () => {
    expect(payout({ ...base, streak: 9 })).toBe(79); // 52.5 * 1.5 = 78.75
  });
  it('adds the on-time bonus and the flat bonus fix', () => {
    expect(payout({ ...base, minutesEarly: 60, bonusFix: 10 })).toBe(89); // 52.5 * 1.5 + 10
  });
});
