// Fault #13 "Surround Sound Sounds Hollow" — see docs/fault-library.md.

import type { Fault, RoomState } from '../../engine/types';
import { allOn, dev, sock, spec } from '../helpers';

/** never: Auto Setup never run · good: tuned · bad: tuned with something still wrong · stale: changed since tuning. */
type Tune = 'never' | 'good' | 'bad' | 'stale';
const tune = (s: RoomState) => s.devices.hub.settings.tuned as Tune;
const wiresOk = (s: RoomState) => s.devices.frontL.settings.wires === 'matched';
const subOn = (s: RoomState) => s.devices.hub.settings.sub === 'yes';
const ready = (s: RoomState) => wiresOk(s) && subOn(s);

const TUNE_TEXT: Record<Tune, string> = {
  never: 'Auto Setup: never run',
  good: 'Tuned to the room ✓',
  bad: 'Auto Setup saved bad settings',
  stale: 'Changed since Auto Setup',
};

export const f13Surround: Fault = {
  id: 'f13',
  number: 13,
  tier: 3,
  title: 'Surround Sound Sounds Hollow',
  caller: 'patterson',
  call: { text: 'We set up surround sound and the voices sound hollow, and there’s no deep bass.' },

  setup: () => ({
    devices: {
      tv: dev({ id: 'tv', name: 'TV', kind: 'tv', x: 360, y: 40, w: 280, h: 170, sockets: [sock('in1', 'Input 1', 'bottom')] }),
      hub: dev({
        id: 'hub', name: 'Speaker Hub', kind: 'box', x: 390, y: 410, w: 220, h: 64,
        sockets: [sock('tv', 'TV', 'top'), sock('fl', 'Front L', 'left'), sock('fr', 'Front R', 'right'), sock('sub', 'Sub', 'bottom')],
        settings: { sub: 'none', tuned: 'never' },
        settingSpecs: { sub: spec('Subwoofer', [['none', 'None'], ['yes', 'Yes']]) },
      }),
      frontL: dev({
        id: 'frontL', name: 'Front Speaker L', kind: 'soundbar', x: 50, y: 400, w: 190, h: 56, noPower: true,
        sockets: [sock('in', 'Wires', 'right')],
        settings: { wires: 'crossed' },
        settingSpecs: { wires: spec('Wires at the back', [['crossed', 'Red to Black'], ['matched', 'Red to Red']]) },
      }),
      frontR: dev({ id: 'frontR', name: 'Front Speaker R', kind: 'soundbar', x: 760, y: 400, w: 190, h: 56, noPower: true, sockets: [sock('in', 'Wires', 'left')] }),
      sub: dev({ id: 'sub', name: 'Subwoofer', kind: 'soundbar', x: 650, y: 494, w: 170, h: 52, sockets: [sock('in', 'In', 'left')] }),
    },
    cables: {
      tvc: { id: 'tvc', kind: 'standard', a: { device: 'hub', socket: 'tv' }, b: { device: 'tv', socket: 'in1' } },
      fl: { id: 'fl', kind: 'speaker', a: { device: 'hub', socket: 'fl' }, b: { device: 'frontL', socket: 'in' } },
      fr: { id: 'fr', kind: 'speaker', a: { device: 'hub', socket: 'fr' }, b: { device: 'frontR', socket: 'in' } },
      sb: { id: 'sb', kind: 'speaker', a: { device: 'hub', socket: 'sub' }, b: { device: 'sub', socket: 'in' } },
    },
    installedParts: [],
    flags: {},
  }),

  legal: (s, a) => (a.type === 'installPart' && a.part === 'setupMic' && !s.devices.hub.powered ? 'Turn on the Speaker Hub first.' : null),

  rules: (before, a, s) => {
    const hub = s.devices.hub.settings;
    // The Setup Mic runs Auto Setup, which saves whatever it hears.
    if (a.type === 'installPart' && a.part === 'setupMic') hub.tuned = ready(s) ? 'good' : 'bad';
    const changed = wiresOk(before) !== wiresOk(s) || subOn(before) !== subOn(s);
    if (changed && hub.tuned !== 'never') hub.tuned = 'stale';
    return s;
  },

  goal: (s) => ready(s) && tune(s) === 'good' && allOn(s, 'hub', 'sub', 'tv'),

  view: (s) => {
    const on = s.devices.hub.powered;
    const t = tune(s);
    return {
      lines: {
        tvc: { signal: 'picture', state: on ? 'ok' : 'idle' },
        fl: { signal: 'sound', state: !on ? 'idle' : wiresOk(s) ? (t === 'good' ? 'ok' : 'weak') : 'unstable' },
        fr: { signal: 'sound', state: !on ? 'idle' : t === 'good' ? 'ok' : 'weak' },
        sb: { signal: 'sound', state: !on || !subOn(s) || !s.devices.sub.powered ? 'idle' : t === 'good' ? 'ok' : 'weak' },
      },
      status: {
        tv: !s.devices.tv.powered
          ? { text: 'Off', tone: 'neutral' }
          : ready(s) && t === 'good'
            ? { text: 'Movie night is saved! 🍿', tone: 'good' }
            : !wiresOk(s)
              ? { text: 'Voices sound hollow', tone: 'bad' }
              : { text: 'Better… but thin', tone: 'bad' },
        hub: on ? { text: TUNE_TEXT[t], tone: t === 'good' ? 'good' : t === 'never' ? 'neutral' : 'bad' } : { text: 'Off', tone: 'neutral' },
        frontL: wiresOk(s) ? { text: 'Clear', tone: 'good' } : { text: 'Hollow, out of step', tone: 'bad' },
        frontR: { text: 'Clear', tone: 'good' },
        sub: !s.devices.sub.powered
          ? { text: 'Off', tone: 'neutral' }
          : subOn(s)
            ? { text: t === 'good' ? 'Deep rumble' : 'Rumbling, a bit off', tone: t === 'good' ? 'good' : 'neutral' }
            : { text: 'Silent: the Hub doesn’t know it’s here', tone: 'bad' },
      },
    };
  },

  optimal: [
    { pattern: { type: 'setting', device: 'frontL', key: 'wires', value: 'matched' }, hint: 'The left speaker’s wires are crossed. Put red to red.' },
    { pattern: { type: 'setting', device: 'hub', key: 'sub', value: 'yes' }, hint: 'Tell the Speaker Hub there’s a subwoofer: set Subwoofer to Yes.' },
    { pattern: { type: 'installPart', part: 'setupMic', when: ready }, hint: 'Now that the hardware is right, run Auto Setup with your Setup Mic.' },
  ],

  inspect: {
    frontL: 'At the back, the red wire goes into the black clip. This speaker pushes when the other one pulls.',
    frontR: 'Red to red, black to black. This one’s right.',
    hub: 'Settings say Subwoofer: None. It also has a jack for a Setup Mic, for Auto Setup.',
    sub: 'Plugged in and on, but nothing comes down its line.',
    fl: 'Speaker wire. The red and black are swapped at the speaker end.',
    sb: 'The subwoofer’s line goes nowhere: the Hub isn’t sending anything to it.',
  },

  ask: [
    { id: 'who', question: 'Who set it up?', answer: 'Hubby did, during the second half of the game. With the lights off.' },
    { id: 'setup', question: 'Did you run any setup?', answer: 'He pressed Auto Setup straight away, before he’d finished. Does that matter?' },
  ],

  thanks: 'Listen to that bass! Hubby says he “meant to do that.” He did not.',
  tipCard: 'Fix the hardware before you run the setup.',
};
