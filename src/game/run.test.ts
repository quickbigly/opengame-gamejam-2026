import { describe, expect, it } from 'vitest';
import { FAULTS_BY_ID } from '../content/faults';
import { NIGHT1, NIGHT3, NIGHTS } from '../content/nights';
import { act, startJob, type JobState } from '../engine/job';
import type { Action } from '../engine/types';
import { UPGRADES_BY_ID } from '../engine/upgrades';
import {
  FESTIVAL_BONUS, buyUpgrade, endNight, finishJob, fromSave, isNightOver, newRun, runScore, startNight, summarize, toSave,
  type RunState,
} from './run';

function play(job: JobState, ...actions: Action[]): JobState {
  for (const a of actions) {
    const r = act(job, a);
    if (!r.ok) throw new Error(r.reason);
    job = r.job;
  }
  return job;
}

describe('new run', () => {
  it('starts on Night 1 at the workshop with no coins', () => {
    const run = newRun();
    expect(run.night.number).toBe(1);
    expect(run.location).toBe('shop');
    expect(run.coins).toBe(0);
  });

  it('has three nights, and the last one has the festival', () => {
    expect(NIGHTS).toHaveLength(3);
    expect(NIGHT3.calls.filter((c) => c.finale)).toHaveLength(1);
  });
});

describe('jobs and the night', () => {
  const ingrid = NIGHT1.calls.find((c) => c.fault === 'f05')!;

  it('pays, streaks and records a callback when the preventive bonus is skipped', () => {
    const job = play(startJob(FAULTS_BY_ID.f05), { type: 'installPart', part: 'softBroom' });
    const run = finishJob({ ...newRun(NIGHT1), clock: 200 }, ingrid, job, 203);
    expect(run.outcomes[ingrid.id].pay).toBeGreaterThan(0);
    expect(run.earned).toBe(run.coins);
    expect(run.streak).toBe(1);
    expect(run.callbacks).toEqual([ingrid.id]);
    expect(run.tips).toContain(FAULTS_BY_ID.f05.tipCard);
  });

  it('records no callback when the preventive bonus is done', () => {
    const job = play(startJob(FAULTS_BY_ID.f05), { type: 'installPart', part: 'softBroom' }, { type: 'installPart', part: 'dishCover' });
    expect(finishJob(newRun(NIGHT1), ingrid, job, 10).callbacks).toEqual([]);
  });

  it('ends at midnight, or 12:30 with the Thermos, and scores stars against Par', () => {
    expect(isNightOver({ ...newRun(NIGHT1), clock: 360 })).toBe(true);
    expect(isNightOver({ ...newRun(NIGHT1), clock: 360, upgrades: { thermos: true } })).toBe(false);
    const s = summarize(newRun(NIGHT1), 100);
    expect(s.stars).toEqual([false, false, false]);
  });
});

describe('callbacks across nights', () => {
  it('only brings back the callbacks earlier nights left behind', () => {
    const none = startNight(newRun(), 2);
    expect(none.night.calls.some((c) => c.callbackOf)).toBe(false);
    const some = startNight({ ...newRun(), callbacks: ['n1-ingrid'] }, 2);
    expect(some.night.calls.filter((c) => c.callbackOf).map((c) => c.id)).toEqual(['n3-cb-ingrid']);
  });

  it('fixes callbacks for free and never calls back twice', () => {
    const run = startNight({ ...newRun(), callbacks: ['n1-ingrid'] }, 2);
    const cb = run.night.calls.find((c) => c.callbackOf)!;
    const job = play(startJob(FAULTS_BY_ID[cb.fault]), { type: 'installPart', part: 'softBroom' });
    const after = finishJob({ ...run, clock: 60 }, cb, job, 63);
    expect(after.outcomes[cb.id].pay).toBe(0);
    expect(after.outcomes[cb.id].free).toBe(true);
    expect(after.callbacks).toEqual(['n1-ingrid']);
  });
});

describe('the festival', () => {
  const finale = NIGHT3.calls.find((c) => c.finale)!;
  const fixed = () =>
    play(
      startJob(FAULTS_BY_ID.f20),
      ...FAULTS_BY_ID.f20.optimal.map((st) => {
        const { when: _w, ...a } = st.pattern;
        return a as unknown as Action;
      }),
    );

  it('goes live when the finale is fixed before midnight', () => {
    const run = finishJob(startNight(newRun(), 2), finale, fixed(), 300);
    expect(run.festival).toBe(true);
    expect(runScore(run)).toBe(run.earned + FESTIVAL_BONUS);
  });

  it('misses the broadcast after midnight', () => {
    expect(finishJob(startNight(newRun(), 2), finale, fixed(), 361).festival).toBe(false);
  });
});

describe('shop and save', () => {
  it('buys each upgrade once, if you can afford it', () => {
    const cost = UPGRADES_BY_ID.thermos.cost;
    const poor = buyUpgrade(newRun(), 'thermos');
    expect(poor.upgrades.thermos).toBeUndefined();
    const rich = buyUpgrade({ ...newRun(), coins: cost + 5, earned: cost + 5 }, 'thermos');
    expect(rich.upgrades.thermos).toBe(true);
    expect(rich.coins).toBe(5);
    expect(rich.earned).toBe(cost + 5);
    expect(buyUpgrade(rich, 'thermos')).toBe(rich);
  });

  it('round-trips a run between nights', () => {
    let run: RunState = { ...newRun(), coins: 90,earned: 140, callbacks: ['n1-ingrid'], tips: ['A tip'], upgrades: { snowTires: true } };
    run = startNight(endNight(run, 300), 1);
    const back = fromSave(JSON.parse(JSON.stringify(toSave(run))))!;
    expect(back.night.number).toBe(2);
    expect(back).toMatchObject({ coins: 90, earned: 140, callbacks: ['n1-ingrid'], tips: ['A tip'], upgrades: { snowTires: true } });
    expect(back.nights).toHaveLength(1);
    expect(fromSave({ ...toSave(run), v: 2 } as never)).toBeNull();
  });
});
