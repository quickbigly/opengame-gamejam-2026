// Fault #15 "TV Won't Turn On After the Storm" — see docs/fault-library.md.

import { otherEnd } from '../../engine/room';
import type { Fault, RoomState } from '../../engine/types';
import { button, dev, sock } from '../helpers';

/** stuck: blinking red · draining: unplugged and button held, needs a wait · drained: ready to plug back in · ok: fixed. */
type TvState = 'stuck' | 'draining' | 'drained' | 'ok';
const state = (s: RoomState) => s.devices.tv.settings.state as TvState;
const plugged = (s: RoomState) => otherEnd(s, { device: 'tv', socket: 'pwr' })?.device === 'outlet';
const surge = (s: RoomState) => s.installedParts.includes('surgeProtector');
const DRAIN_MINUTES = 5;
const OUTLET = { device: 'outlet', socket: 'o1' };
const TV_PWR = { device: 'tv', socket: 'pwr' };

export const f15Surge: Fault = {
  id: 'f15',
  number: 15,
  tier: 3,
  title: 'TV Won’t Turn On After the Storm',
  caller: 'fenwick',
  call: { text: 'Since the power surge, the TV won’t turn on. The little red light just blinks.' },

  setup: () => ({
    devices: {
      tv: dev({
        id: 'tv', name: 'TV', kind: 'tv', x: 360, y: 40, w: 280, h: 170, noPower: true,
        sockets: [sock('pwr', 'Power', 'bottom')],
        settings: { state: 'stuck', button: 'rest' },
        settingSpecs: { button: button('Power button', [['press', 'Press it'], ['hold', 'Hold for 30 seconds']]) },
      }),
      outlet: dev({
        id: 'outlet', name: 'Wall Outlet', kind: 'outlet', x: 400, y: 430, w: 200, h: 56, noPower: true,
        sockets: [sock('o1', 'Top', 'top'), sock('o2', 'Bottom', 'right')],
      }),
      lamp: dev({ id: 'lamp', name: 'Lamp', kind: 'other', x: 700, y: 430, w: 150, h: 56, noPower: true, sockets: [sock('pwr', 'Plug', 'left')] }),
    },
    cables: {
      tp: { id: 'tp', kind: 'power', a: { ...TV_PWR }, b: { ...OUTLET } },
      lp: { id: 'lp', kind: 'power', a: { device: 'lamp', socket: 'pwr' }, b: { device: 'outlet', socket: 'o2' } },
    },
    installedParts: [],
    flags: {},
  }),

  rules: (before, a, s) => {
    const tv = s.devices.tv.settings;
    if (a.type === 'setting' && a.device === 'tv' && a.value === 'hold' && !plugged(s) && tv.state === 'stuck') tv.state = 'draining';
    if (a.type === 'wait' && a.minutes >= DRAIN_MINUTES && tv.state === 'draining' && !plugged(s)) tv.state = 'drained';
    if (a.type === 'moveCable' && plugged(s) && !plugged(before)) {
      // Plugged back in: a full drain resets it; plugging in too soon leaves it stuck.
      if (tv.state === 'drained') tv.state = 'ok';
      if (tv.state === 'draining') tv.state = 'stuck';
    }
    return s;
  },

  goal: (s) => state(s) === 'ok' && plugged(s),

  view: (s) => {
    const st = state(s);
    return {
      lines: {
        tp: { signal: 'power', state: !plugged(s) ? 'idle' : st === 'ok' ? 'ok' : 'unstable' },
        lp: { signal: 'power', state: 'ok' },
      },
      status: {
        tv: plugged(s)
          ? st === 'ok'
            ? { text: 'Weather channel is back!', tone: 'good' }
            : { text: '🔴 Blinking red light', tone: 'bad' }
          : st === 'draining'
            ? { text: 'Draining… give it a few minutes', tone: 'neutral' }
            : st === 'drained'
              ? { text: 'Fully drained. Plug it back in.', tone: 'neutral' }
              : { text: 'No power', tone: 'neutral' },
        outlet: { text: surge(s) ? '⚡ Surge Protector fitted' : 'Works fine', tone: surge(s) ? 'good' : 'neutral' },
        lamp: { text: 'On. So the outlet works.', tone: 'good' },
      },
    };
  },

  optimal: [
    { pattern: { type: 'moveCable', cable: 'tp', end: 'b', to: null }, hint: 'Unplug the TV from the wall.' },
    { pattern: { type: 'setting', device: 'tv', key: 'button', value: 'hold', when: (s) => !plugged(s) }, hint: 'While it’s unplugged, hold its power button for 30 seconds.' },
    { pattern: { type: 'wait', minutes: DRAIN_MINUTES, when: (s) => state(s) === 'draining' }, hint: 'Now wait a few minutes (press Space) so it fully drains.' },
    { pattern: { type: 'moveCable', cable: 'tp', end: 'b', to: { ...OUTLET }, when: (s) => state(s) === 'drained' }, hint: 'Plug the TV back into the wall.' },
  ],
  alternatives: [
    [
      { pattern: { type: 'moveCable', cable: 'tp', end: 'a', to: null }, hint: 'Pull the power cable out of the back of the TV.' },
      { pattern: { type: 'setting', device: 'tv', key: 'button', value: 'hold', when: (s) => !plugged(s) }, hint: 'While it’s unplugged, hold its power button for 30 seconds.' },
      { pattern: { type: 'wait', minutes: DRAIN_MINUTES, when: (s) => state(s) === 'draining' }, hint: 'Now wait a few minutes (press Space) so it fully drains.' },
      { pattern: { type: 'moveCable', cable: 'tp', end: 'a', to: { ...TV_PWR }, when: (s) => state(s) === 'drained' }, hint: 'Plug the power cable back into the TV.' },
    ],
  ],

  bonus: {
    pattern: { type: 'installPart', part: 'surgeProtector' },
    reward: 20,
    message: 'A Surge Protector on the outlet. The next storm won’t get this TV.',
    preventsCallback: true,
  },

  inspect: {
    tv: 'The red light blinks in a steady pattern. The TV’s brain got stuck in the surge. It needs a full reset, not just a press.',
    outlet: 'The lamp on the same outlet works, so the outlet is fine.',
    tp: 'The TV’s power cable. Power is reaching it.',
  },

  ask: [
    { id: 'tried', question: 'What have you tried?', answer: 'Pressed the button. Pressed it harder. Pressed it with a different finger.' },
    { id: 'storm', question: 'What happened in the storm?', answer: 'A big flash, a pop, and the lights dimmed. The lamp came back. The TV didn’t.' },
  ],

  thanks: 'There’s the weatherman! He says more snow. Of course he does.',
  tipCard: 'Stuck gadgets: unplug, hold power, wait.',
};
