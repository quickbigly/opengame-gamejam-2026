import { describe, expect, it } from 'vitest';
import { FAULTS } from '../content/faults';
import { f02Remote } from '../content/faults/f02-remote';
import { f04TooSmooth } from '../content/faults/f04-too-smooth';
import { f05Satellite } from '../content/faults/f05-satellite';
import { f06SoundSocket } from '../content/faults/f06-sound-socket';
import { f07WifiRestart } from '../content/faults/f07-wifi-restart';
import { f08Hum } from '../content/faults/f08-hum';
import { f09LipSync } from '../content/faults/f09-lip-sync';
import { f10Laptop } from '../content/faults/f10-laptop';
import { f11SmartPlug } from '../content/faults/f11-smart-plug';
import { cb12QuietBar, f12Switching } from '../content/faults/f12-switching';
import { f13Surround } from '../content/faults/f13-surround';
import { f14Buffering } from '../content/faults/f14-buffering';
import { f15Surge } from '../content/faults/f15-surge';
import { f16Headphones } from '../content/faults/f16-headphones';
import { f17Handshake } from '../content/faults/f17-handshake';
import { f18FastCable } from '../content/faults/f18-fast-cable';
import { f19BlackLevel } from '../content/faults/f19-black-level';
import { f20Festival } from '../content/faults/f20-festival';
import { act, jobResult, parMinutes, pathMinutes, solutions, startJob, takeHint, undo, type JobState } from './job';
import { visibleOptions } from './room';
import { payout } from './scoring';
import type { Action, ActionPattern, Fault } from './types';

function run(job: JobState, ...actions: Action[]): JobState {
  for (const a of actions) {
    const r = act(job, a);
    if (!r.ok) throw new Error(`${JSON.stringify(a)} rejected: ${r.reason}`);
    job = r.job;
  }
  return job;
}

const toAction = (p: ActionPattern) => {
  const { when: _when, ...a } = p;
  return a as unknown as Action;
};

describe.each(FAULTS.map((f) => [`#${f.number} ${f.title}`, f] as const))('%s', (_name, fault) => {
  it('starts broken', () => {
    expect(startJob(fault).goalMet).toBe(false);
  });

  it.each(solutions(fault).map((path, i) => [i, path] as const))('is solved cleanly by solution %i', (_i, path) => {
    const job = run(startJob(fault), ...path.map((st) => toAction(st.pattern)));
    expect(job.goalMet).toBe(true);
    expect(job.wasted).toBe(0);
    expect(job.harmful).toBe(0);
    expect(job.history.every((e) => e.cls === 'optimal')).toBe(true);
  });

  it('has a par solution no slower than its alternatives', () => {
    for (const path of solutions(fault)) expect(parMinutes(fault)).toBeLessThanOrEqual(pathMinutes(path));
  });

  it('only references real devices, cables and links', () => {
    const s = fault.setup();
    const v = fault.view(s);
    const ids = new Set([...Object.keys(s.devices), ...Object.keys(s.cables), ...(v.links ?? []).map((l) => l.id)]);
    for (const k of Object.keys(fault.inspect)) expect(ids).toContain(k);
    for (const k of Object.keys(v.lines)) expect(s.cables).toHaveProperty(k);
    for (const k of Object.keys(v.status)) expect(s.devices).toHaveProperty(k);
    for (const g of fault.gates ?? []) expect(s.devices[g.device].settingSpecs).toHaveProperty(g.key);
  });

  it('earns its bonus without breaking a clean fix', () => {
    if (!fault.bonus) return;
    const job = run(startJob(fault), ...fault.optimal.map((st) => toAction(st.pattern)), toAction(fault.bonus.pattern));
    expect(job.goalMet).toBe(true);
    expect(job.bonusEarned).toBe(true);
    expect(job.wasted + job.harmful).toBe(0);
  });
});

describe('order rules', () => {
  const set = (device: string, key: string, value: string): Action => ({ type: 'setting', device, key, value });

  it('#6 hides the Sound Bar option until the cable is moved and Auto-control is on', () => {
    let job = startJob(f06SoundSocket);
    const opts = () => visibleOptions(f06SoundSocket, job.room, 'tv', 'soundOut').map((o) => o.value);
    expect(opts()).toEqual(['tv']);
    expect(act(job, set('tv', 'soundOut', 'bar')).ok).toBe(false);
    job = run(job, set('tv', 'auto', 'on'));
    expect(opts()).toEqual(['tv']);
    job = run(job, { type: 'moveCable', cable: 'sb', end: 'b', to: { socket: 'in3', device: 'tv' } });
    expect(opts()).toEqual(['tv', 'bar']);
  });

  it('#2 accepts the Remote Booster only if it is at hand', () => {
    const job = startJob(f02Remote);
    expect(act(job, { type: 'installPart', part: 'remoteBooster' }, { available: [] })).toEqual({ ok: false, reason: 'You don’t have that here.' });
    expect(act(job, { type: 'installPart', part: 'remoteBooster' }, { available: ['remoteBooster'] }).ok).toBe(true);
  });

  it('#4 turning Super Smooth off before picking Movie gets undone', () => {
    const job = run(startJob(f04TooSmooth), set('tv', 'smooth', 'off'), set('tv', 'mode', 'movie'));
    expect(job.room.devices.tv.settings.smooth).toBe('on');
    expect(job.goalMet).toBe(false);
    expect(job.wasted).toBe(1);
  });

  it('#5 hot water freezes the dish; the soft broom then needs two passes', () => {
    let job = run(startJob(f05Satellite), { type: 'installPart', part: 'kettle' });
    expect(job.harmful).toBe(1);
    expect(job.room.devices.dish.settings.snow).toBe('ice');
    job = run(job, { type: 'installPart', part: 'softBroom' });
    expect(job.goalMet).toBe(false);
    job = run(job, { type: 'installPart', part: 'softBroom' });
    expect(job.goalMet).toBe(true);
  });

  it('#5 lends house items at that house', () => {
    expect(act(startJob(f05Satellite), { type: 'installPart', part: 'kitchenBroom' }, { available: [] }).ok).toBe(true);
  });

  it('#7 restarting the Wi-Fi Box first repeats the problem', () => {
    const job = run(startJob(f07WifiRestart), { type: 'power', device: 'wifi', on: false }, { type: 'power', device: 'wifi', on: true });
    expect(job.goalMet).toBe(false);
    expect(job.wasted).toBe(1);
  });

  it('#7 turning the Wi-Fi Box on before the Internet Box is ready misses it', () => {
    const job = run(
      startJob(f07WifiRestart),
      { type: 'power', device: 'wifi', on: false },
      { type: 'power', device: 'modem', on: false },
      { type: 'power', device: 'modem', on: true },
      { type: 'power', device: 'wifi', on: true },
      { type: 'wait', minutes: 5 },
    );
    expect(job.goalMet).toBe(false);
  });

  it('#8 refuses the Hum Stopper while the wall cable is plugged in', () => {
    expect(act(startJob(f08Hum), { type: 'installPart', part: 'humStopper' }).ok).toBe(false);
  });

  it('#9 setting Lip Sync before switching to the cable gets reset', () => {
    const job = run(
      startJob(f09LipSync),
      set('tv', 'lipSync', 'auto'),
      set('soundbar', 'wireless', 'off'),
      { type: 'moveCable', cable: 'spare', end: 'b', to: { device: 'tv', socket: 'in3' } },
      set('tv', 'auto', 'on'),
      set('tv', 'soundOut', 'bar'),
    );
    expect(job.room.devices.tv.settings.lipSync).toBe('off');
    expect(job.goalMet).toBe(false);
  });

  it('#10 offers TV sound only once the TV shows the laptop', () => {
    const job = startJob(f10Laptop);
    expect(visibleOptions(f10Laptop, job.room, 'laptop', 'sound').map((o) => o.value)).toEqual(['laptop']);
  });

  it('#11 counts the question about the moon as part of the fix', () => {
    const job = run(startJob(f11SmartPlug), { type: 'ask', topic: 'moon' });
    expect(job.history[0].cls).toBe('optimal');
  });

  it('#12 the TV flips back while the Cable Box is bossy', () => {
    const job = run(startJob(f12Switching), set('tv', 'input', 'in2'));
    expect(job.room.devices.tv.settings.input).toBe('in1');
    expect(job.wasted).toBe(1);
  });

  it('#12 turning off the TV Auto-control fixes it, but silences the Sound Bar and earns a callback', () => {
    const job = run(startJob(f12Switching), set('tv', 'auto', 'off'), set('tv', 'input', 'in2'));
    expect(job.goalMet).toBe(true);
    expect(job.harmful).toBe(1);
    expect(job.room.devices.tv.settings.soundOut).toBe('tv');
    expect(f12Switching.callbackIf!(job.room)).toBe(true);
    const clean = run(startJob(f12Switching), ...f12Switching.optimal.map((st) => toAction(st.pattern)));
    expect(f12Switching.callbackIf!(clean.room)).toBe(false);
  });

  it('#12 callback: turning the TV Auto-control back on first brings the tugging back', () => {
    const job = run(startJob(cb12QuietBar), set('tv', 'auto', 'on'));
    expect(job.room.devices.tv.settings.input).toBe('in1');
    expect(job.wasted).toBe(1);
  });

  it('#13 running Auto Setup before fixing the wires saves bad settings', () => {
    let job = run(startJob(f13Surround), { type: 'installPart', part: 'setupMic' }, set('frontL', 'wires', 'matched'), set('hub', 'sub', 'yes'));
    expect(job.wasted).toBe(1);
    expect(job.goalMet).toBe(false);
    job = run(job, { type: 'installPart', part: 'setupMic' });
    expect(job.goalMet).toBe(true);
  });

  it('#14 offers the Fast lane only once the stick is out from behind the TV', () => {
    const job = startJob(f14Buffering);
    expect(visibleOptions(f14Buffering, job.room, 'stick', 'lane').map((o) => o.value)).toEqual(['slow']);
    const out = run(job, { type: 'installPart', part: 'extensionCable' });
    expect(visibleOptions(f14Buffering, out.room, 'stick', 'lane').map((o) => o.value)).toEqual(['slow', 'fast']);
    expect(out.room.devices.stick.y).not.toBe(job.room.devices.stick.y);
  });

  it('#15 holding the power button while plugged in does nothing; plugging in too soon leaves it stuck', () => {
    const held = run(startJob(f15Surge), set('tv', 'button', 'hold'));
    expect(held.room.devices.tv.settings.state).toBe('stuck');
    expect(held.wasted).toBe(1);
    const rushed = run(startJob(f15Surge), { type: 'moveCable', cable: 'tp', end: 'b', to: null }, set('tv', 'button', 'hold'), {
      type: 'moveCable', cable: 'tp', end: 'b', to: { device: 'outlet', socket: 'o1' },
    });
    expect(rushed.room.devices.tv.settings.state).toBe('stuck');
    expect(rushed.goalMet).toBe(false);
  });

  it('#15 the power button is a button: it never shows its resting value', () => {
    const job = startJob(f15Surge);
    expect(visibleOptions(f15Surge, job.room, 'tv', 'button').map((o) => o.value)).toEqual(['press', 'hold']);
    expect(run(job, set('tv', 'button', 'press')).room.devices.tv.settings.button).toBe('rest');
  });

  it('#16 pairing the headphones before forgetting the patio speaker fails', () => {
    const job = run(startJob(f16Headphones), set('phones', 'pair', 'pair'));
    expect(job.room.devices.phones.settings.mode).toBe('failed');
    expect(visibleOptions(f16Headphones, job.room, 'tv', 'wireless').map((o) => o.value)).toEqual(['forget']);
    expect(job.wasted).toBe(1);
  });

  it('#17 turning on the Streaming Box before the Hub brings the error back', () => {
    const job = run(
      startJob(f17Handshake),
      { type: 'moveCable', cable: 'sb', end: 'b', to: { device: 'hub', socket: 'in3' } },
      { type: 'power', device: 'sbox', on: false },
      { type: 'power', device: 'hub', on: false },
      { type: 'power', device: 'sbox', on: true },
      { type: 'power', device: 'hub', on: true },
    );
    expect(job.goalMet).toBe(false);
  });

  it('#17 power-cycling in the old socket never shakes hands', () => {
    const job = run(startJob(f17Handshake), { type: 'power', device: 'sbox', on: false }, { type: 'power', device: 'sbox', on: true });
    expect(job.goalMet).toBe(false);
    expect(job.wasted).toBe(1);
  });

  it('#18 Turbo Mode on the old cable is harmful', () => {
    const job = run(startJob(f18FastCable), set('tv', 'turbo', 'on'));
    expect(job.harmful).toBe(1);
    expect(f18FastCable.view(job.room).lines.cc.state).toBe('failed');
  });

  it('#19 turning HDR off resets the computer Black Level', () => {
    const job = run(startJob(f19BlackLevel), set('pc', 'black', 'deep'), set('pc', 'hdr', 'off'), set('tv', 'mode', 'game'));
    expect(job.room.devices.pc.settings.black).toBe('soft');
    expect(job.goalMet).toBe(false);
  });

  it('#19 turning up brightness is wasted and must be undone', () => {
    const job = run(startJob(f19BlackLevel), ...f19BlackLevel.optimal.map((st) => toAction(st.pattern)), set('tv', 'brightness', 'high'));
    expect(job.goalMet).toBe(false);
    expect(job.wasted).toBe(1);
  });

  it('#20 restarting the player before the splitter does not help', () => {
    const job = run(
      startJob(f20Festival),
      set('splitter', 'match', 'screen1'),
      set('splitter', 'shrink', 'on'),
      { type: 'power', device: 'player', on: false },
      { type: 'power', device: 'player', on: true },
      { type: 'power', device: 'splitter', on: false },
      { type: 'power', device: 'splitter', on: true },
    );
    expect(job.goalMet).toBe(false);
  });

  it('#20 forcing Max quality blacks out the projector', () => {
    const job = run(startJob(f20Festival), set('player', 'quality', 'max'));
    expect(job.harmful).toBe(1);
    expect(f20Festival.view(job.room).status.projector.tone).toBe('bad');
  });
});

describe('upgrades in the house', () => {
  it('Friendly Face makes asking free', () => {
    const r = act(startJob(f06SoundSocket), { type: 'ask', topic: 'who' }, { freeAsk: true });
    expect(r.ok && r.job.minutes).toBe(0);
    expect(parMinutes(f11SmartPlug, { freeAsk: true })).toBe(parMinutes(f11SmartPlug) - 2);
  });
});

describe('classification', () => {
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
    expect(act(job, { type: 'inspect', target: 'tv' }).ok).toBe(false);
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

  it('hints the next step of the solution the player is following', () => {
    const job = run(startJob(f05Satellite), { type: 'installPart', part: 'kitchenBroom' });
    expect(takeHint(job).hint).toBe(f05Satellite.alternatives![0][1].hint);
  });

  it('halves the pay after a hint', () => {
    const job = run(startJob(f06SoundSocket), toAction(f06SoundSocket.optimal[0].pattern));
    const { job: hinted, hint } = takeHint(job);
    expect(hint).toBe(f06SoundSocket.optimal[1].hint);
    const r = jobResult(hinted, { finishedAt: 0, deadline: 0, window: 60, streak: 0 });
    expect(payout(r)).toBe(Math.round(35 * 0.75));
  });
});
