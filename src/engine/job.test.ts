import { describe, expect, it } from 'vitest';
import { FAULTS } from '../content/faults';
import { f06SoundSocket } from '../content/faults/f06-sound-socket';
import { act, jobResult, parMinutes, startJob, takeHint, undo, type JobState } from './job';
import { visibleOptions } from './room';
import { payout } from './scoring';
import type { Action, Fault } from './types';

function run(job: JobState, ...actions: Action[]): JobState {
  for (const a of actions) {
    const r = act(job, a);
    if (!r.ok) throw new Error(`${JSON.stringify(a)} rejected: ${r.reason}`);
    job = r.job;
  }
  return job;
}

const asAction = (f: Fault, i: number) => {
  const { when: _when, ...a } = f.optimal[i].pattern;
  return a as unknown as Action;
};

describe.each(FAULTS.map((f) => [f.id, f] as const))('fault %s', (_id, fault) => {
  it('starts broken', () => {
    expect(startJob(fault).goalMet).toBe(false);
  });

  it('is solved cleanly by its own optimal sequence', () => {
    const job = run(startJob(fault), ...fault.optimal.map((_, i) => asAction(fault, i)));
    expect(job.goalMet).toBe(true);
    expect(job.wasted).toBe(0);
    expect(job.harmful).toBe(0);
    expect(job.history.every((e) => e.cls === 'optimal')).toBe(true);
    expect(job.minutes).toBe(parMinutes(fault));
  });

  it('only references real devices and cables', () => {
    const s = fault.setup();
    const ids = new Set([...Object.keys(s.devices), ...Object.keys(s.cables)]);
    for (const k of Object.keys(fault.inspect)) expect(ids).toContain(k);
    for (const k of Object.keys(fault.view(s).lines)) expect(s.cables).toHaveProperty(k);
    for (const g of fault.gates ?? []) expect(s.devices[g.device].settingSpecs).toHaveProperty(g.key);
  });

  it('earns its bonus without breaking a clean fix', () => {
    if (!fault.bonus) return;
    const { when: _w, ...b } = fault.bonus.pattern;
    const job = run(startJob(fault), b as unknown as Action, ...fault.optimal.map((_, i) => asAction(fault, i)));
    expect(job.goalMet).toBe(true);
    expect(job.bonusEarned).toBe(true);
    expect(job.wasted).toBe(0);
  });
});

describe('order detection', () => {
  it('hides the Sound Bar option until the cable is moved and Auto-control is on (#6)', () => {
    let job = startJob(f06SoundSocket);
    const opts = () => visibleOptions(f06SoundSocket, job.room, 'tv', 'soundOut').map((o) => o.value);
    expect(opts()).toEqual(['tv']);
    expect(act(job, { type: 'setting', device: 'tv', key: 'soundOut', value: 'bar' }).ok).toBe(false);
    job = run(job, { type: 'setting', device: 'tv', key: 'auto', value: 'on' });
    expect(opts()).toEqual(['tv']);
    job = run(job, { type: 'moveCable', cable: 'sb', end: 'b', to: { socket: 'in3', device: 'tv' } });
    expect(opts()).toEqual(['tv', 'bar']);
  });

  it('counts unneeded actions as wasted and info actions as free of penalty', () => {
    const job = run(
      startJob(f06SoundSocket),
      { type: 'inspect', target: 'tv' },
      { type: 'ask', topic: 'who' },
      { type: 'setting', device: 'tv', key: 'input', value: 'in2' },
    );
    expect(job.history.map((e) => e.cls)).toEqual(['info', 'info', 'wasted']);
    expect(job.wasted).toBe(1);
    expect(job.minutes).toBe(1 + 2 + 1);
  });

  it('does not charge twice for re-inspecting', () => {
    const job = run(startJob(f06SoundSocket), { type: 'inspect', target: 'tv' });
    const again = act(job, { type: 'inspect', target: 'tv' });
    expect(again.ok).toBe(false);
  });

  it('rejects plugging into an occupied socket', () => {
    const r = act(startJob(f06SoundSocket), { type: 'moveCable', cable: 'sb', end: 'b', to: { device: 'tv', socket: 'in1' } });
    expect(r).toEqual({ ok: false, reason: 'That socket is already in use.' });
  });

  it('applies harmful side effects', () => {
    const fault: Fault = {
      ...f06SoundSocket,
      harmful: [
        {
          pattern: { type: 'power', device: 'soundbar', on: false },
          effect: (s) => ({ ...s, flags: { ...s.flags, grumpy: true } }),
          message: 'The Sound Bar forgot its settings.',
        },
      ],
    };
    const job = run(startJob(fault), { type: 'power', device: 'soundbar', on: false });
    expect(job.harmful).toBe(1);
    expect(job.room.flags.grumpy).toBe(true);
    expect(job.history[0]).toMatchObject({ cls: 'harmful', message: 'The Sound Bar forgot its settings.' });
  });
});

describe('undo and hints', () => {
  it('restores the room but charges the time again and keeps the waste', () => {
    let job = run(startJob(f06SoundSocket), { type: 'setting', device: 'tv', key: 'input', value: 'in2' });
    job = undo(job)!;
    expect(job.room.devices.tv.settings.input).toBe('in1');
    expect(job.minutes).toBe(2);
    expect(job.wasted).toBe(1);
    expect(undo(job)).toBeNull();
  });

  it('lets an undone optimal step be earned again', () => {
    let job = run(startJob(f06SoundSocket), { type: 'setting', device: 'tv', key: 'auto', value: 'on' });
    job = run(undo(job)!, { type: 'setting', device: 'tv', key: 'auto', value: 'on' });
    expect(job.history.at(-1)?.cls).toBe('optimal');
  });

  it('hints the next unfinished step and halves the pay', () => {
    const job = run(startJob(f06SoundSocket), asAction(f06SoundSocket, 0));
    const { job: hinted, hint } = takeHint(job);
    expect(hint).toBe(f06SoundSocket.optimal[1].hint);
    const r = jobResult(hinted, { finishedAt: 0, deadline: 0, window: 60, streak: 0 });
    expect(payout(r)).toBe(Math.round(35 * 0.75));
  });
});
